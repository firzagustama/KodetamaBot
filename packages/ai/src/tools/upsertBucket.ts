import { ChatCompletionTool } from "openai/resources.mjs";

export interface UpsertBucketParams {
    bucketId?: string;
    name: string;
    description: string;
    amount: number;
    category: string;
}

export const upsertBucketTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "upsertBucket",
        description: "Create/update budget bucket",
        parameters: {
            type: "object",
            properties: {
                bucketId: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                amount: { type: "number", description: "IDR" },
                category: { type: "string", enum: ["needs", "wants", "savings"] }
            },
            required: ["name", "description", "amount", "category"],
        },
    },
}