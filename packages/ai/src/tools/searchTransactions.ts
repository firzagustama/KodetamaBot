import { ChatCompletionTool } from "openai/resources.mjs";

export const searchTransactionsTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "searchTransactions",
        description: "Search transactions by keyword",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string" },
                limit: { type: "number", description: "default 10" },
            },
            required: ["query"],
        },
    },
};
