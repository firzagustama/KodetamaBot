import { ChatCompletionTool } from "openai/resources.mjs";

export const getFinancialSummaryTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "getFinancialSummary",
        description: "Get period income/expense summary",
        parameters: {
            type: "object",
            properties: {
                periodType: { type: "string", enum: ["current", "previous"] },
            },
            required: [],
        },
    },
};
