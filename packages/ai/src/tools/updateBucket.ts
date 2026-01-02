import { ChatCompletionTool } from "openai/resources.mjs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BucketSchema } from "./schemas.js";

export const updateBucketTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "updateBucket",
        description: "Update budget bucket",
        parameters: zodToJsonSchema(BucketSchema)
    },
}