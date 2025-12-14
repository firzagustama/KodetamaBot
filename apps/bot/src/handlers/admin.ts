import type { BotContext } from "../types.js";
import { logger } from "../utils/logger.js";
import {
    approveRegistration,
    updateRegistrationStatus,
    updateUserIncomeSettings,
    ensurePeriodExists,
    upsertBudget,
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

            // Automate Budget Setup
            try {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const incomeDate = 1;
                const isIncomeUncertain = true;

                // 1. Update income settings
                await updateUserIncomeSettings(newUserId, incomeDate, isIncomeUncertain);

                // 2. Ensure period exists
                const periodDate = new Date(currentYear, currentMonth, 1);
                const periodId = await ensurePeriodExists(newUserId, periodDate, incomeDate);

                // 3. Create Unallocated budget
                await upsertBudget({
                    periodId,
                    estimatedIncome: 0,
                    // No percentages -> Unallocated
                });

                logger.info(`Automatic budget setup completed for user ${userId}`);

                // Notify the user
                await ctx.api.sendMessage(
                    userId,
                    "🎉 *Selamat!*\n\n" +
                    "Registrasimu telah disetujui oleh admin.\n" +
                    "Budget otomatis dibuat (Unallocated).\n\n" +
                    "Langsung chat pengeluaranmu, untuk detailnya ketik /help",
                    { parse_mode: "Markdown" }
                );
            } catch (setupError) {
                logger.error(`Failed to setup budget for user ${userId}:`, setupError);
                // Fallback notification
                await ctx.api.sendMessage(
                    userId,
                    "🎉 *Selamat!*\n\n" +
                    "Registrasimu telah disetujui oleh admin.\n" +
                    "Tapi ada error dikit pas setup budget. Ketik /start buat coba lagi.",
                    { parse_mode: "Markdown" }
                );
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
                    "Lo ngga dapet izin\n" +
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
