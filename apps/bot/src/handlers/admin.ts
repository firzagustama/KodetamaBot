import { IBudgetService, IPeriodService, IUserService } from "@kodetama/shared";
import type { BotContext } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Handle admin approval/rejection callbacks
 */
export function createAdminCallbackHandler(
    userService: IUserService,
    periodService: IPeriodService,
    budgetService: IBudgetService
) {
    return async function handleAdminCallback(ctx: BotContext): Promise<void> {
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

                const approveResult = await userService.approveRegistration(userId, adminId);
                if (!approveResult.success || !approveResult.data) {
                    await ctx.answerCallbackQuery("Tidak ada registrasi pending untuk user ini.");
                    return;
                }
                const newUserId = approveResult.data;

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
                    await userService.updateUserIncomeSettings(newUserId, incomeDate, isIncomeUncertain);

                    // 2. Ensure period exists
                    const periodDate = new Date(currentYear, currentMonth, 1);
                    const periodId = await periodService.ensurePeriodExists(newUserId, periodDate, incomeDate);

                    // 3. Create Unallocated budget
                    await budgetService.upsertBudget({
                        periodId,
                        estimatedIncome: 0,
                        // No percentages -> Unallocated
                    });

                    logger.info(`Automatic budget setup completed for user ${userId}`);

                    // Notify the user
                    await ctx.api.sendMessage(
                        userId,
                        "🎉 *Selamat!*\n\n" +
                        "Registrasimu telah disetujui oleh admin!",
                        { parse_mode: "Markdown" }
                    );
                    await ctx.api.sendMessage(
                        userId,
                        "🤖 *Kodetama Bot (BETA)*\n\n" +
                        "Asisten keuangan personal lo.\n\n" +
                        "*Cara Pakai:*\n" +
                        "Langsung chat aja pengeluaran lo:\n" +
                        "• `makan 20rb`\n" +
                        "• `gaji 10jt`\n" +
                        "• `buat budget belanja 500rb`\n" +
                        "• `buat periode baru`\n" +
                        "• `transfer ke mama 500k`\n\n" +
                        "*Atau lo juga bisa:*\n" +
                        "• Kirim foto struk/invoice\n" +
                        "• Kirim voice note\n\n" +
                        "*Perintah:*\n" +
                        "/start - Mulai/Reset\n" +
                        "/help - Bantuan ini\n" +
                        "/dashboard - Dashboard\n" +
                        "/budget - Lihat budget bulan ini\n" +
                        "/summary - Ringkasan bulan ini\n" +
                        "`/export_excel` - Export laporan ke excel\n" +
                        "/cancel - Batalin percakapan",
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

                await userService.rejectRegistration(userId, adminId);

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
}
