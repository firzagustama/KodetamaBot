import OpenAI from "openai";
import { AIConfig } from "./orchestrator.js";
import { getTargetContextKey, Period, redisManager, TargetContext } from "@kodetama/shared";
import { contextSummary, transactions, db } from "@kodetama/db";
import { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources.mjs";
import { CONTEXT_SUMMARY_USER_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "./prompts/index.js";
import { eq, desc } from "drizzle-orm";
import { deleteBucketTool, deleteTransactionTool, upsertBucketTool, upsertTransactionTool } from "./tools/index.js";

export class ConversationAI {
    private isDevMode: boolean;
    private client: OpenAI | undefined;
    private clientModel!: string;

    // Context Limit
    private CONTEXT_LIMIT = 20; // 10 messages include assistant and user
    private CONTEXT_LAST_N = 5;
    private CONTEXT_TTL = 60 * 60; // 1 hour

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
        const response = await this.client?.chat.completions.create({
            model: this.clientModel,
            messages: messages,
            tools: [upsertTransactionTool, upsertBucketTool, deleteTransactionTool, deleteBucketTool]
        });
        return response?.choices[0].message;
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
        await redisManager.set(contextKey, JSON.stringify(filtered));

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
        const lastN = messages.slice(-n);
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

    private async getContext(target: TargetContext, period: Period): Promise<string> {
        const summary = await this.getSummary(target);
        const lastNTransactions = await this.getLastNTransaction(period.id, 5);
        const estimatedIncome = period.budget?.estimatedIncome ?? 0;

        let buckets = "Unallocated";
        if (period.budget?.buckets && period.budget.buckets.length > 0) {
            buckets = period.budget.buckets.map((bucket) => `${bucket.id}: ${bucket.name} (${bucket.description})`).join("\n");
        }
        return `Summary: ${summary}\n\nLast 5 transactions: ${lastNTransactions}\n\nEstimated income: ${estimatedIncome}\n\nBudget buckets: ${buckets}\n\n`;
    }

    private async getLastNTransaction(periodId: string, n: number): Promise<string> {
        const lastTransactions = await db.query.transactions.findMany({
            where: eq(transactions.periodId, periodId),
            orderBy: [desc(transactions.createdAt)],
            limit: n
        });
        return JSON.stringify(lastTransactions.map((transaction) => {
            return {
                id: transaction.id,
                type: transaction.type,
                amount: transaction.amount,
                description: transaction.description,
                bucket: transaction.bucket,
            }
        }));
    }
}