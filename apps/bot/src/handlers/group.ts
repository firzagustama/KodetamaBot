import type { BotContext } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Handle messages in group chats (Family tier)
 * Bot only processes messages when mentioned
 */
export async function handleGroupMessage(ctx: BotContext): Promise<void> {
    const message = ctx.message?.text;
    const botInfo = ctx.me;

    if (!message || !botInfo) return;

    // Check if bot is mentioned
    const botUsername = botInfo.username;
    const isMentioned =
        message.includes(`@${botUsername}`) ||
        message.toLowerCase().startsWith("kodetama");

    if (!isMentioned) {
        // Bot wasn't mentioned, ignore message
        return;
    }

    // Remove mention from message
    const cleanedMessage = message
        .replace(new RegExp(`@${botUsername}`, "gi"), "")
        .replace(/^kodetama\s*/i, "")
        .trim();

    if (!cleanedMessage) {
        await ctx.reply(
            "👋 Halo! Untuk mencatat transaksi, mention saya lalu ketik transaksinya.\n\n" +
            `Contoh: @${botUsername} makan siang 50rb`,
            { reply_to_message_id: ctx.message?.message_id }
        );
        return;
    }

    // TODO: Check if group is authorized (Family tier)
    // TODO: Process transaction similar to private chat

    logger.info(`Group message from ${ctx.from?.id} in ${ctx.chat?.id}:`, {
        original: message,
        cleaned: cleanedMessage,
    });

    await ctx.reply(
        "📝 Fitur group (Family tier) akan segera hadir!\n\n" +
        "Untuk saat ini, silakan chat langsung ke bot secara private.",
        { reply_to_message_id: ctx.message?.message_id }
    );
}
