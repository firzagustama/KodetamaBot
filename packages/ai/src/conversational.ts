import OpenAI from "openai";
import { AIConfig } from "./orchestrator.js";
import { getTargetContextKey, redisManager, TargetContext } from "@kodetama/shared";
import { contextSummary, datePeriods, transactions, db } from "@kodetama/db";
import { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources.mjs";
import { CONTEXT_SUMMARY_USER_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "./prompts/index.js";
import { eq, and, desc } from "drizzle-orm";
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

    async buildPrompt(target: TargetContext): Promise<ChatCompletionMessageParam[]> {
        const messages = await this.getTargetContext(target);
        const bucket = await this.getBuckets(target);
        const lastTransactions = await this.getLastNTransaction(target, 5);
        const summary = await this.getSummary(target);
        return [
            { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
            { role: "system", content: `User budgets/buckets:\n${bucket}` },
            { role: "system", content: `Last transactions:\n${lastTransactions}` },
            { role: "system", content: `User context:\n${summary}` },
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

    private async getBuckets(target: TargetContext): Promise<string> {
        const condition = target.groupId ? eq(datePeriods.groupId, target.groupId) : eq(datePeriods.userId, target.userId!);
        const period = await db.query.datePeriods.findFirst({
            where: and(
                eq(datePeriods.isCurrent, true),
                condition,
            ),
            with: {
                budget: {
                    with: {
                        buckets: true
                    }
                }
            }
        });
        if (!period?.budget?.buckets) {
            return "Unallocated";
        }

        return JSON.stringify(period.budget.buckets.map((bucket) => {
            return {
                bucketId: bucket.id,
                name: bucket.name,
                description: bucket.description
            }
        }));
    }

    private async getLastNTransaction(target: TargetContext, n: number): Promise<string> {
        const lastTransactions = await db.query.transactions.findMany({
            where: target.groupId ?
                eq(transactions.groupId, target.groupId) :
                eq(transactions.userId, target.userId!),
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