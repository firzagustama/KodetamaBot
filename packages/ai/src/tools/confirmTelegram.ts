import { ChatCompletionTool } from "openai/resources.mjs";

export interface ConfirmTelegramParams {
    confirmationMessage: string;
    buttons: {
        text: string;
        callback_data: string;
    }[];
}

export const confirmTelegramTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "confirmTelegram",
        description: "USE this tool to give button to user for confirmation",
        parameters: {
            type: "object",
            properties: {
                confirmationMessage: { type: "string", description: "Confirmation message to user" },
                buttons: {
                    type: "array",
                    description: "List of buttons to show to user, 'Yes' option should be in last array",
                    items: {
                        type: "object",
                        properties: {
                            text: { type: "string", description: "Button text" },
                            callback_data: { type: "string", description: "short data such as yes, no, etc" },
                        },
                        required: ["text", "callback_data"],
                    }
                }
            },
            required: ["confirmationMessage", "buttons"],
        },
    },
}