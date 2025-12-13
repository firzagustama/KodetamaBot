import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext, TargetContext } from "../../core/index.js";
import { InlineKeyboard } from "grammy";
import { getCurrentGroupPeriod, getCurrentPeriod } from "../../services/index.js";

/**
 * Handles /link_family command - link group chat to family budget
 * Works for both private chats (personal budget) and group chats (family budget)
 */
export class LinkFamilyCommand extends CommandHandler {
    protected readonly commandName = "link_family";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        if (!ctx.chat) {
            await ctx.reply("Boleh lewat chat atau grup ya");
            return { success: true };
        }

        const { id: groupId, title: groupName } = ctx.chat;
        const { id: userId } = ctx.from;

        const account = await db.getUserByTelegramId(userId);
        console.log(account)

        return { success: true };
    }
}