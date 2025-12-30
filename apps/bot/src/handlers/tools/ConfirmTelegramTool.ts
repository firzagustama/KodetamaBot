import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { InlineKeyboard } from "grammy";

export class ConfirmTelegramTool implements IToolHandler {
    readonly name = "confirmTelegram";

    async execute(args: any, { ctx }: ToolHandlerContext): Promise<string> {
        let keyboard: InlineKeyboard | undefined = undefined;

        if (args.buttons && Array.isArray(args.buttons)) {
            for (const button of args.buttons) {
                if (!keyboard) keyboard = new InlineKeyboard();
                keyboard.text(button.text, `ai_${button.callback_data}`);
            }
        }

        await ctx.reply(args.confirmationMessage, { reply_markup: keyboard });

        return compactResult({ ok: true });
    }
}
