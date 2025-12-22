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
        description: "Delete Budget or Bucket",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Name of bucket",
                },
                description: {
                    type: "string",
                    description: "Description of bucket",
                },
                moveBucket: {
                    type: "string",
                    description: "Move all transactions to this bucket",
                },
                confidence: {
                    type: "number",
                    description: "0.0 - 1.0",
                },
                confirmationMessage: {
                    type: "string",
                    description: "Confirmation message if confidence < 0.7 to send to user",
                },
            },
            required: ["name", "description", "moveBucket", "confidence", "confirmationMessage"],
        },
    },
}