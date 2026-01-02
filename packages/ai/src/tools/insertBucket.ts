import { ChatCompletionTool } from "openai/resources.mjs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BucketSchema } from "./schemas.js";

export const insertBucketTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "insertBucket",
        description: "Create budget bucket",
        parameters: zodToJsonSchema(BucketSchema.omit({ bucketId: true }))
    },
}