import { ChatCompletionTool } from "openai/resources.mjs";

export const deleteBucketTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "deleteBucket",
        description: "Delete Budget or Bucket",
        parameters: {
            type: "object",
            properties: {
                bucketId: {
                    type: "string",
                    description: "Bucket ID to delete. Use the ID from context or previous messages.",
                }
            },
            required: ["bucketId"],
        },
    },
}