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
                            transactionId: { type: "string" },
                            type: { type: "string", enum: TX_TYPES },
                            amount: { type: "number", description: "IDR" },
                            category: { type: "string" },
                            bucket: { type: "string" },
                            description: { type: "string" },
                            confidence: { type: "number", description: ">0.8 to execute" },
                            confirmationMessage: { type: "string" },
                        },
                        required: ["type", "amount", "category", "bucket", "confidence", "description"],
                    }
                },
            },
            required: ["input"],
        },
    },
}