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
    confirmationMessage: string;
}

export const upsertTransactionTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "upsertTransaction",
        description: "Update or Insert Transaction Log",
        parameters: {
            type: "object",
            properties: {
                transactionId: {
                    type: "string",
                    description: "Transaction ID",
                },
                type: {
                    type: "string",
                    enum: TX_TYPES,
                    description: "income: gaji, transfer in\nexpense: beli, makan, transport\ntransfer: kirim uang, topup\nadjustment: correction",
                },
                amount: {
                    type: "number",
                    description: "rb/ribu/k=1000, jt/juta=1000000. Comma (,) = decimal.",
                },
                category: {
                    type: "string",
                    description: "Infer standard Indonesian Category",
                },
                bucket: {
                    type: "string",
                    description: "User available buckets",
                },
                confidence: {
                    type: "number",
                    description: "0.0 - 1.0",
                },
                confirmationMessage: {
                    type: "string",
                    description: "Confirmation message if confidence < 0.7 to send to user",
                },
                description: {
                    type: "string",
                    description: "Description of the transaction",
                }
            },
            required: ["type", "amount", "category", "bucket", "confidence", "description"],
        },
    },
}