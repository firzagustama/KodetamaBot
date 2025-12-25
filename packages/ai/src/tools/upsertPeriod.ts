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
                copyFromPrevious: { type: "boolean", description: "Always ask, never default" },
            },
            required: [],
        },
    },
};
