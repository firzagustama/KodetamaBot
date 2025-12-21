import { ChatCompletionTool } from "openai/resources.mjs";

export const deleteTransactionTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "deleteTransaction",
        description: "Delete Transaction Log",
        parameters: {
            type: "object",
            properties: {
                transactionId: { type: "string" }
            },
            required: ["transactionId"],
        },
    },
}