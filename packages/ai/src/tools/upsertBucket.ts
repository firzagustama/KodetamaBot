import { ChatCompletionTool } from "openai/resources.mjs";

export interface UpsertBucketParams {
    bucketId?: string;
    budgetId: string;
    name: string;
    description: string;
    amount: number;
    category: string;
}

export const upsertBucketTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "upsertBucket",
        description: "Update or Insert Budget or Bucket",
        parameters: {
            type: "object",
            properties: {
                bucketId: {
                    type: "string",
                    description: "Bucket ID",
                },
                budgetId: {
                    type: "string",
                    description: "Budget ID",
                },
                name: {
                    type: "string",
                    description: "Bucket name",
                },
                description: {
                    type: "string",
                    description: "Bucket description",
                },
                amount: {
                    type: "number",
                    description: "Bucket amount",
                },
                category: {
                    type: "string",
                    enum: ["needs", "wants", "savings"],
                    description: "Bucket category, set needs for essential expenses, wants for non-essential expenses, savings for savings",
                }
            },
            required: ["budgetId", "name", "description", "amount", "category"],
        },
    },
}