import { ChatCompletionTool } from "openai/resources.mjs";

export const getBudgetStatusTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "getBudgetStatus",
        description: "Get budget/bucket balances",
        parameters: {
            type: "object",
            properties: {
                bucketName: { type: "string" },
            },
            required: [],
        },
    },
};
