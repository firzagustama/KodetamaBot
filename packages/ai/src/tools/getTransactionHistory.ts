import { ChatCompletionTool } from "openai/resources.mjs";
import { TX_TYPES } from "@kodetama/shared";

export const getTransactionHistoryTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "getTransactionHistory",
        description: "Get recent transactions",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", description: "1-20, default 5" },
                bucket: { type: "string" },
                type: { type: "string", enum: TX_TYPES },
                daysBack: { type: "number", description: "default 7" },
            },
            required: [],
        },
    },
};
