import { ChatCompletionTool } from "openai/resources.mjs";

export interface deleteBucketParams {
    name: string;
    description: string;
    moveBucket: string;
    confidence: number;
    confirmationMessage: string;
}

export const deleteBucketTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "deleteBucket",
        description: "Delete bucket, move transactions to another",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                moveBucket: { type: "string", description: "Target bucket for transactions" },
                confidence: { type: "number", description: ">0.8 to execute" },
                confirmationMessage: { type: "string" },
            },
            required: ["name", "moveBucket", "confidence", "confirmationMessage"],
        },
    },
}