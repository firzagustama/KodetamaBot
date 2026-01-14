import OpenAI from "openai";
import { AIConfig } from "./orchestrator.js";
import { getTargetContextKey, Period, redisManager, TargetContext, IConversationAI } from "@kodetama/shared";
import { contextSummary, transactions, db } from "@kodetama/db";
import { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources.mjs";
import { CONTEXT_SUMMARY_USER_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "./prompts/index.js";
import { eq, desc } from "drizzle-orm";
import {
    // Write tools
    insertTransactionTool,
    deleteTransactionTool,
    insertBucketTool,
    updateBucketTool,
    deleteBucketTool,
    upsertPeriodTool,
    updateTransactionTool,
    // Read tools
    getTransactionHistoryTool,
    getBudgetStatusTool,
    searchTransactionsTool,
    getFinancialSummaryTool,
} from "./tools/index.js";

export class ConversationAI implements IConversationAI {
    private isDevMode: boolean;
    private client: OpenAI | undefined;
    private clientModel!: string;

    // Context Limit
    private CONTEXT_LIMIT = 30;
    private CONTEXT_LAST_N = 10;
    private CONTEXT_TTL = 60 * 60; // 1 hour

    // Retry configuration
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff
    private readonly TIMEOUT_MS = 30000;

    // All available tools
    private readonly tools = [
        // Write tools
        insertTransactionTool,
        deleteTransactionTool,
        insertBucketTool,
        deleteBucketTool,
        upsertPeriodTool,
        updateTransactionTool,
        updateBucketTool,
        // Read tools
        getTransactionHistoryTool,
        getBudgetStatusTool,
        searchTransactionsTool,
        getFinancialSummaryTool,
    ];

    constructor(config: AIConfig) {
        this.isDevMode = !config.apiKey;
        if (this.isDevMode) {
            console.log("AI Development mode");
            return;
        }

        const apiKey = config.apiKey;
        let baseURL = config.baseURL ?? "https://openrouter.ai/api/v1";

        // Support Google AI Studio OpenAI-compatible API
        if (apiKey.startsWith("AIza") && !config.baseURL) {
            baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
        }

        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: baseURL,
        });
        this.clientModel = config.model ?? (apiKey.startsWith("AIza") ? "gemini-2.0-flash" : "gemini-2.5-flash");
    }

    async buildPrompt(target: TargetContext, period: Period): Promise<ChatCompletionMessageParam[]> {
        const history = await this.getTargetContext(target);
        const context = await this.getContext(target, period);

        const systemMessages: ChatCompletionMessageParam[] = [
            { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
            { role: "system", content: `Current date: ${new Date().toLocaleDateString()}` },
            { role: "system", content: `User context:\n${context}` },
        ];

        return [...systemMessages, ...history];
    }

    async generateResponse(messages: ChatCompletionMessageParam[]): Promise<ChatCompletionMessage | undefined> {
        if (this.isDevMode) {
            return {
                role: "assistant",
                content: "AI Development mode",
                refusal: ""
            }
        }

        const normalizedMessages = this.normalizeMessages(messages);

        return this.withRetry(async () => {
            const response = await this.client?.chat.completions.create({
                model: this.clientModel,
                messages: normalizedMessages,
                tools: this.tools,
            });
            return response?.choices[0].message;
        });
    }

    /**
     * Normalize messages for Gemini OpenAI-compatible API:
     * 1. Combine consecutive messages with the same role (essential for group chats).
     * 2. Combine all system messages at the start into a single system message.
     * 3. Ensure alternating User/Assistant roles after the system message.
     */
    private normalizeMessages(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
        if (messages.length === 0) return [];

        const normalized: ChatCompletionMessageParam[] = [];

        // 1. Combine system messages at the start
        let systemContent = "";
        let i = 0;
        while (i < messages.length && messages[i].role === "system") {
            const content = messages[i].content;
            if (typeof content === "string") {
                systemContent += (systemContent ? "\n\n" : "") + content;
            }
            i++;
        }

        if (systemContent) {
            normalized.push({ role: "system", content: systemContent });
        }

        // 2. Process remaining messages and merge consecutive roles
        for (; i < messages.length; i++) {
            const current = messages[i];
            const last = normalized[normalized.length - 1];

            // If roles match and it's not a tool-related sequence, merge them
            // Note: tool messages MUST stay separate and follow their assistant message
            if (last && last.role === current.role && current.role !== "tool" && last.role !== "tool") {
                if (typeof last.content === "string" && typeof current.content === "string") {
                    last.content += "\n\n" + current.content;
                } else {
                    // Handle array content (like image_url)
                    const lastContentArr = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content || "" }];
                    const currentContentArr = Array.isArray(current.content) ? current.content : [{ type: "text", text: current.content || "" }];
                    last.content = [...(lastContentArr as any), ...(currentContentArr as any)];
                }
            } else {
                normalized.push({ ...current });
            }
        }

        // 3. Ensure we don't end with an assistant message that has tool_calls
        // Gemini's OpenAI adapter fails if tool_calls are not followed by tool results.
        // If the last message is an assistant message with tool_calls, remove it.
        while (normalized.length > 0) {
            const last = normalized[normalized.length - 1];
            if (last.role === "assistant" && (last as any).tool_calls && (last as any).tool_calls.length > 0) {
                normalized.pop();
            } else {
                break;
            }
        }

        return normalized;
    }

    /**
     * Execute a function with retry logic and exponential backoff
     */
    private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                // Create a timeout promise
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), this.TIMEOUT_MS);
                });

                // Race between the function and timeout
                return await Promise.race([fn(), timeoutPromise]);
            } catch (error) {
                lastError = error as Error;
                console.error(`AI request failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}):`, error);

                // Don't retry on final attempt
                if (attempt < this.MAX_RETRIES) {
                    const delay = this.RETRY_DELAYS[attempt] ?? 4000;
                    console.log(`Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError ?? new Error('AI request failed after retries');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async getTargetContext(target: TargetContext): Promise<ChatCompletionMessageParam[]> {
        const raw = await redisManager.get(getTargetContextKey(target.targetId));
        if (!raw) {
            return [];
        }
        return JSON.parse(raw) as ChatCompletionMessageParam[];
    }

    async setTargetContext(target: TargetContext, messages: ChatCompletionMessageParam[]): Promise<void> {
        const contextKey = getTargetContextKey(target.targetId);
        const filtered = messages.filter((message) => message.role !== "system");
        await redisManager.set(contextKey, JSON.stringify(filtered), this.CONTEXT_TTL);

        if (filtered.length > this.CONTEXT_LIMIT) {
            this.createSummary(target, JSON.stringify(filtered));
            this.keepLastN(target, this.CONTEXT_LAST_N);
        }
    }

    async clearContext(target: TargetContext): Promise<void> {
        const messages = await this.getTargetContext(target);
        const filtered = messages.filter((message) => message.role !== "system");
        await this.createSummary(target, JSON.stringify(filtered));
        await redisManager.del(getTargetContextKey(target.targetId));
    }

    private async keepLastN(target: TargetContext, n: number): Promise<void> {
        const raw = await redisManager.get(getTargetContextKey(target.targetId));
        if (!raw) {
            return;
        }
        const messages = JSON.parse(raw) as ChatCompletionMessageParam[];

        // Slice last N
        let lastN = messages.slice(-n);

        // Ensure we don't start with a 'tool' message (orphan)
        // A 'tool' message MUST follow an 'assistant' message with 'tool_calls'
        while (lastN.length > 0 && lastN[0].role === "tool") {
            lastN.shift();
        }

        await redisManager.set(getTargetContextKey(target.targetId), JSON.stringify(lastN), this.CONTEXT_TTL);
    }

    private async getSummary(target: TargetContext): Promise<string> {
        const summary = await db.query.contextSummary.findFirst({
            where: eq(contextSummary.targetId, target.targetId)
        });
        if (!summary) {
            await db.insert(contextSummary).values({
                targetId: target.targetId,
                summary: ""
            });
            return "";
        }
        return summary.summary!;
    }

    private async createSummary(target: TargetContext, messages: string): Promise<void> {
        try {
            const oldSummary: string = await this.getSummary(target);

            // Generate new summary
            let newSummary: string = "AI Dev summary";
            if (!this.isDevMode) {
                const summaryPrompt: ChatCompletionMessageParam[] = [{
                    role: "user",
                    content: CONTEXT_SUMMARY_USER_PROMPT(oldSummary, JSON.stringify(messages))
                }];

                const response = await this.client?.chat.completions.create({
                    model: this.clientModel,
                    messages: summaryPrompt,
                });
                newSummary = response?.choices[0].message.content || "Failed to generate response";
            }

            // Insert new summary to db and clear context
            await db.update(contextSummary).set({
                summary: newSummary,
            }).where(eq(contextSummary.targetId, target.targetId));
        } catch (error: any) {
            console.error(`[ERROR] createSummary failed for target ${target.targetId}:`, error);
            if (error && typeof error === 'object') {
                console.error("[DEBUG] Detailed error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
            throw error; // Rethrow to let caller handle or reject
        }
    }

    async createSummaryFromCache(targetId: string) {
        const messages = await redisManager.get(getTargetContextKey(targetId));
        if (!messages) {
            return;
        }
        await this.createSummary({
            isGroup: false,
            targetId: targetId,
            userId: ""
        }, messages);
        await redisManager.del(getTargetContextKey(targetId));
    }

    private async getContext(target: TargetContext, period: Period): Promise<string> {
        const periodCtx = `${period.id}: ${period.name} (Ends in ${period.endDate})`
        const summary = await this.getSummary(target);
        const recentTx = await this.getLastNTransaction(period.id, 5);
        const income = period.budget?.estimatedIncome ?? 0;

        // Compact bucket format: "id:Name(description)"
        let buckets = "Unallocated";
        if (period.budget?.buckets && period.budget.buckets.length > 0) {
            buckets = period.budget.buckets
                .map(b => `${b.id}:${b.name}:${b.description}`)
                .join("\n");
        }
        return `Period\n${periodCtx}\n\nPreferences: ${summary}\n\nLast Transactions: ${recentTx}\n\nIncome: ${income}\n\nBuckets: ${buckets}`;
    }

    private async getLastNTransaction(periodId: string, n: number): Promise<string> {
        const txs = await db.query.transactions.findMany({
            where: eq(transactions.periodId, periodId),
            orderBy: [desc(transactions.createdAt)],
            limit: n
        });
        // Compact format: "id:type:amount:desc:bucket"
        return txs.map(t =>
            `${t.id}:${t.type}:${t.amount}:${t.description?.slice(0, 20) ?? ''}:${t.bucket ?? ''}`
        ).join("\n");
    }
}