import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult } from "../../core/index.js";
import { InlineKeyboard } from "grammy";
import { findGroupByTelegramId, groupExists } from "../../services/group.js";

/**
 * Handles /join_family command - shows dashboard overview with progress bars
 * Works for both private chats (personal budget) and group chats (family budget)
 */
export class JoinFamilyCommand extends CommandHandler {
    protected readonly commandName = "join_family";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        const chat = ctx.chat;
        if (!chat || chat.type !== "group" && chat.type !== "supergroup") {
            await ctx.reply("Ketik /join_family di dalam grup yang ingin kamu join");
            return { success: true };
        }

        const { id: groupId } = chat;
        if (!await groupExists(groupId)) {
            await ctx.reply("Grup belum terdaftar, minta owner daftarin dulu ya");
            return { success: true };
        }

        const group = await findGroupByTelegramId(groupId);

        const joinKeyboard = new InlineKeyboard().url("Join Family", `https://t.me/${ctx.me?.username}?start=join_${group?.id}`);
        await ctx.reply("Klik dibawah buat mulai mencatat keuangan kamu di grup ini!", { reply_markup: joinKeyboard });
        return { success: true };
    }
}