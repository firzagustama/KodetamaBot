import { TX_TYPES } from "@kodetama/shared";
import { ChatCompletionTool } from "openai/resources.mjs";

export interface UpsertTransactionParams {
    transactionId?: string;
    type: "income" | "expense" | "transfer" | "adjustment";
    amount: number;
    category: string;
    bucket: string;
    description: string;
    confidence: number;
    confirmationMessage?: string;
}

export const upsertTransactionTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "upsertTransaction",
        description: "Log transactions. rb=1000, jt=1M. Batch supported.",
        parameters: {
            type: "object",
            properties: {
                input: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            transactionId: { type: "string", description: "MANDATORY if updating existing transaction" },
                            type: { type: "string", enum: TX_TYPES },
                            amount: { type: "number", description: "IDR" },
                            category: { type: "string", description: "Indonesian category such as Makanan, Transportasi, Belanja, Kesehatan, etc" },
                            bucket: { type: "string", description: "User available budget or buckets" },
                            description: { type: "string", description: "Item name, store name, etc" },
                            confidence: { type: "number", description: ">= 0.8 to execute" },
                            confirmationMessage: { type: "string", description: "What is need to be confirmed if confidence < 0.8" },
                        },
                        required: ["type", "amount", "category", "bucket", "confidence", "description"],
                    }
                },
            },
            required: ["input"],
        },
    },
}
