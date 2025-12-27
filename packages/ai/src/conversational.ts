import OpenAI from "openai";
import { AIConfig } from "./orchestrator.js";
import { getTargetContextKey, Period, redisManager, TargetContext } from "@kodetama/shared";
import { contextSummary, transactions, db } from "@kodetama/db";
import { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources.mjs";
import { CONTEXT_SUMMARY_USER_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "./prompts/index.js";
import { eq, desc } from "drizzle-orm";
import {
    // Write tools
    upsertTransactionTool,
    deleteTransactionTool,
    upsertBucketTool,
    deleteBucketTool,
    upsertPeriodTool,
    // Read tools
    getTransactionHistoryTool,
    getBudgetStatusTool,
    searchTransactionsTool,
    getFinancialSummaryTool,
    confirmTelegramTool,
} from "./tools/index.js";

export class ConversationAI {
    private isDevMode: boolean;
    private client: OpenAI | undefined;
    private clientModel!: string;

    // Context Limit
    private CONTEXT_LIMIT = 40;
    private CONTEXT_LAST_N = 15;
    private CONTEXT_TTL = 60 * 60; // 1 hour

    // Retry configuration
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff
    private readonly TIMEOUT_MS = 30000;

    // All available tools
    private readonly tools = [
        // Confirm tools
        confirmTelegramTool,
        // Write tools
        upsertTransactionTool,
        deleteTransactionTool,
        upsertBucketTool,
        deleteBucketTool,
        upsertPeriodTool,
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

        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL ?? "https://openrouter.ai/api/v1",
        });
        this.clientModel = config.model ?? "gemini-2.5-flash";
    }

    async buildPrompt(target: TargetContext, period: Period): Promise<ChatCompletionMessageParam[]> {
        const messages = await this.getTargetContext(target);
        const context = await this.getContext(target, period);
        return [
            { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
            { role: "system", content: `Current date: ${new Date().toLocaleDateString()}` },
            { role: "system", content: `User context:\n${context}` },
            ...messages
        ];
    }

    async generateResponse(messages: ChatCompletionMessageParam[]): Promise<ChatCompletionMessage | undefined> {
        if (this.isDevMode) {
            return {
                role: "assistant",
                content: "AI Development mode",
                refusal: ""
            }
        }
        return this.withRetry(async () => {
            const response = await this.client?.chat.completions.create({
                model: this.clientModel,
                messages: messages,
                tools: this.tools,
            });
            return response?.choices[0].message;
        });
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
        console.log(messages);
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
        const oldSummary: string = await this.getSummary(target);

        // Generate new summary
        let newSummary: string = "AI Dev summary";
        if (!this.isDevMode) {
            const response = await this.client?.chat.completions.create({
                model: this.clientModel,
                messages: [{
                    role: "user",
                    content: CONTEXT_SUMMARY_USER_PROMPT(oldSummary, JSON.stringify(messages))
                }]
            });
            newSummary = response?.choices[0].message.content || "Failed to generate response";
        }

        // Insert new summary to db and clear context
        await db.update(contextSummary).set({
            summary: newSummary,
        }).where(eq(contextSummary.targetId, target.targetId));
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
                .map(b => `${b.id}:${b.name}(${b.description})`)
                .join("\n");
        }
        return `Period\n${periodCtx}\n\nSummary: ${summary}\n\nLast Transactions: ${recentTx}\n\nIncome: ${income}\n\nBuckets: ${buckets}`;
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