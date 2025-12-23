import { ChatCompletionTool } from "openai/resources.mjs";

export const upsertPeriodTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "upsertPeriod",
        description: "Create new period, copies budget from previous by default",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "e.g. Januari 2025" },
                incomeDate: { type: "number", description: "1-28, default 1" },
                copyFromPrevious: { type: "boolean", description: "default true" },
            },
            required: [],
        },
    },
};
