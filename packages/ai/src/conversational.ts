import OpenAI from "openai";
import { AIConfig } from "./orchestrator.js";
import { getTargetContextKey, redisManager, TargetContext } from "@kodetama/shared";
import { contextSummary, datePeriods, transactions, db } from "@kodetama/db";
import { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources.mjs";
import { CONTEXT_SUMMARY_USER_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "./prompts/index.js";
import { eq, or, and, desc } from "drizzle-orm";
import { deleteBucketTool, deleteTransactionTool, upsertBucketTool, upsertTransactionTool } from "./tools/index.js";

export class ConversationAI {
    private isDevMode: boolean;
    private client: OpenAI | undefined;
    private clientModel!: string;
    private target: TargetContext;
    private targetId!: string;
    private CONTEXT_KEY!: string;

    // Context Limit
    private CONTEXT_LIMIT = 20; // 10 messages include assistant and user
    private CONTEXT_LAST_N = 5;
    private CONTEXT_TTL = 60 * 60; // 1 hour

    constructor(target: TargetContext, config: AIConfig) {
        this.isDevMode = !config.apiKey;
        this.target = target;
        this.targetId = target.targetId;
        this.CONTEXT_KEY = getTargetContextKey(this.targetId);
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

    async buildPrompt(): Promise<ChatCompletionMessageParam[]> {
        const messages = await this.getTargetContext();
        const bucket = await this.getBuckets();
        const lastTransactions = await this.getLastNTransaction(5);
        const summary = await this.getSummary();
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

    private async getTargetContext(): Promise<ChatCompletionMessageParam[]> {
        const raw = await redisManager.get(this.CONTEXT_KEY);
        if (!raw) {
            return [];
        }
        return JSON.parse(raw) as ChatCompletionMessageParam[];
    }

    async setTargetContext(messages: ChatCompletionMessageParam[]): Promise<void> {
        console.log(messages);
        const filtered = messages.filter((message) => message.role !== "system");
        await redisManager.set(this.CONTEXT_KEY, JSON.stringify(filtered));

        if (filtered.length > this.CONTEXT_LIMIT) {
            this.createSummary(JSON.stringify(filtered));
            this.keepLastN(this.CONTEXT_LAST_N);
        }
    }

    async clearContext(): Promise<void> {
        const messages = await this.getTargetContext();
        const filtered = messages.filter((message) => message.role !== "system");
        await this.createSummary(JSON.stringify(filtered));
        await redisManager.del(this.CONTEXT_KEY);
    }

    private async keepLastN(n: number): Promise<void> {
        const raw = await redisManager.get(this.CONTEXT_KEY);
        if (!raw) {
            return;
        }
        const messages = JSON.parse(raw) as ChatCompletionMessageParam[];
        const lastN = messages.slice(-n);
        await redisManager.set(this.CONTEXT_KEY, JSON.stringify(lastN), this.CONTEXT_TTL);
    }

    private async getSummary(): Promise<string> {
        const summary = await db.query.contextSummary.findFirst({
            where: eq(contextSummary.targetId, this.targetId)
        });
        if (!summary) {
            await db.insert(contextSummary).values({
                targetId: this.targetId,
                summary: ""
            });
            return "";
        }
        return summary.summary!;
    }

    private async createSummary(messages: string): Promise<void> {
        const oldSummary: string = await this.getSummary();

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
        }).where(eq(contextSummary.targetId, this.targetId));
    }

    private async getBuckets(): Promise<string> {
        const period = await db.query.datePeriods.findFirst({
            where: and(
                eq(datePeriods.isCurrent, true),
                or(
                    eq(datePeriods.userId, this.targetId),
                    eq(datePeriods.groupId, this.targetId)
                )),
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

    private async getLastNTransaction(n: number): Promise<string> {
        const lastTransactions = await db.query.transactions.findMany({
            where: this.target.groupId ?
                eq(transactions.groupId, this.target.groupId) :
                eq(transactions.userId, this.target.userId!),
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