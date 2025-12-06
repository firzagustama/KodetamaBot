import type { BotContext } from "../types.js";
import { logger } from "../utils/logger.js";
import {
    approveRegistration,
    updateRegistrationStatus,
} from "../services/index.js";

/**
 * Handle admin approval/rejection callbacks
 */
export async function handleAdminCallback(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data;
    const adminId = ctx.from?.id;

    if (!callbackData || !adminId) return;

    // Check if user is admin
    const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
    if (String(adminId) !== ADMIN_TELEGRAM_ID) {
        await ctx.answerCallbackQuery("Kamu tidak memiliki akses untuk ini.");
        return;
    }

    const [action, userIdStr] = callbackData.split("_");
    const userId = parseInt(userIdStr);

    if (isNaN(userId)) {
        await ctx.answerCallbackQuery("Data tidak valid.");
        return;
    }

    try {
        if (action === "approve") {
            // Approve registration and create user in DB
            logger.info(`Admin ${adminId} approved user ${userId}`);

            const newUserId = await approveRegistration(userId, adminId);

            if (!newUserId) {
                await ctx.answerCallbackQuery("Tidak ada registrasi pending untuk user ini.");
                return;
            }

            // Update the admin message
            await ctx.editMessageText(
                ctx.callbackQuery?.message?.text +
                "\n\n✅ *APPROVED* by admin\n" +
                `Waktu: ${new Date().toLocaleString("id-ID")}`,
                { parse_mode: "Markdown" }
            );

            // Notify the user
            try {
                await ctx.api.sendMessage(
                    userId,
                    "🎉 *Selamat!*\n\n" +
                    "Registrasimu telah disetujui oleh admin.\n" +
                    "Ketik /start untuk memulai setup budget kamu!",
                    { parse_mode: "Markdown" }
                );
            } catch (error) {
                logger.error(`Failed to notify user ${userId}:`, error);
            }

            await ctx.answerCallbackQuery("User approved!");

        } else if (action === "reject") {
            // Reject registration
            logger.info(`Admin ${adminId} rejected user ${userId}`);

            await updateRegistrationStatus(userId, "rejected", adminId);

            // Update the admin message
            await ctx.editMessageText(
                ctx.callbackQuery?.message?.text +
                "\n\n❌ *REJECTED* by admin\n" +
                `Waktu: ${new Date().toLocaleString("id-ID")}`,
                { parse_mode: "Markdown" }
            );

            // Notify the user
            try {
                await ctx.api.sendMessage(
                    userId,
                    "😔 *Maaf*\n\n" +
                    "Registrasimu tidak dapat disetujui saat ini.\n" +
                    "Silakan hubungi admin untuk informasi lebih lanjut.",
                    { parse_mode: "Markdown" }
                );
            } catch (error) {
                logger.error(`Failed to notify user ${userId}:`, error);
            }

            await ctx.answerCallbackQuery("User rejected.");
        }
    } catch (error) {
        logger.error("Error handling admin callback:", error);
        await ctx.answerCallbackQuery("Terjadi kesalahan. Silakan coba lagi.");
    }
}
