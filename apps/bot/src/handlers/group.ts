import type { BotContext } from "../types.js";
import { GroupRepository } from "../infrastructure/repositories/index.js";
import { getUserByTelegramId } from "../services/index.js";
import { logger } from "../utils/logger.js";

// Initialize shared instances
let groupRepo: GroupRepository | null = null;

/**
 * Get or create group repository (singleton pattern)
 */
function getGroupRepository(): GroupRepository {
    if (!groupRepo) {
        groupRepo = new GroupRepository();
    }
    return groupRepo;
}

/**
 * Handle messages in group chats (Family tier)
 * Bot only processes messages when mentioned
 */
export async function handleGroupMessage(ctx: BotContext): Promise<void> {
    const message = ctx.message?.text;
    const botInfo = ctx.me;

    if (!message || !botInfo || !ctx.from) return;

    // Check if bot is mentioned
    const botUsername = botInfo.username;
    const isMentioned =
        message.includes(`@${botUsername}`) ||
        message.toLowerCase().startsWith(`${botUsername}`);

    if (!isMentioned) {
        // Bot wasn't mentioned, ignore message
        return;
    }

    // Remove mention from message
    const cleanedMessage = message
        .replace(new RegExp(`@${botUsername}`, "gi"), "")
        .replace(new RegExp(`^${botUsername}\s*`, "i"), "")
        .trim();

    if (!cleanedMessage) {
        await ctx.reply(
            "*Tch.* Mau catat transaksi? Mention gue dulu.\n\n" +
            `Contoh: @${botUsername} makan siang 50rb 💪`,
            { reply_to_message_id: ctx.message?.message_id }
        );
        return;
    }

    try {
        const groupRepo = getGroupRepository();

        // Check if group is authorized (exists and is active)
        if (!ctx.chat) {
            await ctx.reply("❌ Tidak dapat mengidentifikasi grup.", {
                reply_to_message_id: ctx.message?.message_id
            });
            return;
        }

        const group = await groupRepo.findByTelegramId(ctx.chat.id);
        if (!group) {
            await ctx.reply(
                "*Tch.* Grup ini belum terdaftar untuk fitur keluarga.\n\n" +
                "Minta owner grup untuk setup dulu ya! 🤷‍♂️",
                { reply_to_message_id: ctx.message?.message_id }
            );
            return;
        }

        // Check if user is registered and member of the group
        const userAccount = await getUserByTelegramId(ctx.from.id);
        if (!userAccount) {
            await ctx.reply(
                "*Tch.* Kamu belum terdaftar. Ketik /start untuk mendaftar terlebih dahulu.",
                { reply_to_message_id: ctx.message?.message_id }
            );
            return;
        }

        // Check if user is a member of this family group
        const isMember = await groupRepo.isUserMember(userAccount.userId, group.id);
        if (!isMember) {
            await ctx.reply(
                "*Tch.* Kamu bukan anggota grup keluarga ini.\n\n" +
                "Minta owner grup untuk invite kamu dulu ya! 👨‍👩‍👧‍👦",
                { reply_to_message_id: ctx.message?.message_id }
            );
            return;
        }

        // Skip commands - these are handled by CommandRegistry regardless of group context
        if (cleanedMessage.startsWith("/")) return;

        await ctx.reply("Fitur family masih sedang dibangun...");
        return
    } catch (error) {
        logger.error("Failed to parse group transaction:", error);

        await ctx.reply(
            "*Tch, baca juga dong format nya.* 🤷‍♂️\n\n" +
            "Coba kayak gini:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 150rb`\n\n" +
            "Atau batch:\n" +
            "```\ncatat\n* gaji 8jt\n* kopi 20rb\n* makan 20rb```",
            {
                parse_mode: "Markdown",
                reply_to_message_id: ctx.message?.message_id
            }
        );
    }
}