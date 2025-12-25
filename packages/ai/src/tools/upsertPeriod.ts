import { ChatCompletionTool } from "openai/resources.mjs";

export const upsertPeriodTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "upsertPeriod",
        description: "Create new period, copies budget from previous if copyFromPrevious is true",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "e.g. Januari 2025" },
                incomeDate: { type: "number", description: "1-28, default 1" },
                copyFromPrevious: { type: "boolean", description: "Always ask, never default" },
            },
            required: [],
        },
    },
};
