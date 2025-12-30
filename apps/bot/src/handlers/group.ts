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
 * Factory to create group message handler with injected transaction handler
 */
export function createGroupMessageHandler(transactionHandler: (ctx: BotContext) => Promise<void>) {
    /**
     * Handle messages in group chats (Family tier)
     * Bot only processes messages when mentioned
     */
    return async function handleGroupMessage(ctx: BotContext): Promise<void> {
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
            .replace(new RegExp(`^${botUsername}\\s*`, "i"), "")
            .trim();

        if (!cleanedMessage) {
            await ctx.reply(
                "Mau catat transaksi? Mention gue dulu.\n\n" +
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
                    "Grup ini belum terdaftar untuk fitur keluarga.\n\n" +
                    "Minta owner grup untuk setup dulu ya! 🤷‍♂️",
                    { reply_to_message_id: ctx.message?.message_id }
                );
                return;
            }

            // Check if user is registered and member of the group
            const userAccount = await getUserByTelegramId(ctx.from.id);
            if (!userAccount) {
                await ctx.reply(
                    "Kamu belum terdaftar. Ketik /join_family untuk mendaftar terlebih dahulu.",
                    { reply_to_message_id: ctx.message?.message_id }
                );
                return;
            }

            // Check if user is a member of this family group
            const isMember = await groupRepo.isUserMember(userAccount.userId, group.id);
            if (!isMember) {
                await ctx.reply(
                    "Kamu bukan anggota grup keluarga ini.\n\n" +
                    "Minta owner grup untuk invite kamu dulu ya! 👨‍👩‍👧‍👦",
                    { reply_to_message_id: ctx.message?.message_id }
                );
                return;
            }
        } catch (error) {
            logger.error("Failed to handle group message:", error);
            await ctx.reply("Terjadi kesalahan. Coba lagi nanti.", {
                reply_to_message_id: ctx.message?.message_id
            });
        }

        ctx.message!.text = cleanedMessage;
        await transactionHandler(ctx);
    };
}