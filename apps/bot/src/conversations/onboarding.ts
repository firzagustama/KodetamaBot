import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import {
    getIndonesianMonth,
} from "@kodetama/shared";

import { logger } from "../utils/logger.js";
import {
    getUserByTelegramId,
    ensurePeriodExists,
    upsertBudget,
    updateUserIncomeSettings,
    ensureGroupPeriodExists,
    findGroupByTelegramId,
} from "../services/index.js";

/**
 * ZBB Onboarding conversation flow (Saitama Style)
 */
export async function onboardingConversation(
    conversation: Conversation<BotContext>,
    ctx: BotContext
): Promise<void> {
    const user = ctx.from;
    if (!user) {
        await ctx.reply("Oi, error nih. Coba lagi nanti.");
        return;
    }

    // Initialize onboarding data
    conversation.session.onboardingData = {};

    try {
        // ==========================================================================
        // STEP 1: Introduction & Usage Guide
        // ==========================================================================
        await ctx.reply(
            "👋 *Halo! Salam kenal.*\n\n" +
            "Gue siap bantu catat keuangan lo.\n" +
            "Gak perlu setup ribet, langsung pakai aja.\n\n" +
            "💡 *Cara Pakai:*\n" +
            "Tinggal chat kayak ngobrol biasa:\n\n" +
            "• `makan nasi goreng 20rb`\n" +
            "• `gaji bulan ini 10jt`\n" +
            "• `beli bensin 50rb`\n" +
            "• `bayar listrik 500k`\n\n" +
            "📸 *Fitur Pro:*\n" +
            "• Kirim foto struk/invoice\n" +
            "• Kirim voice note (`abis beli kopi 25ribu`)",
            { parse_mode: "Markdown" }
        );

        // ==========================================================================
        // STEP 2: Determine Period (Automatic)
        // ==========================================================================
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Default settings for simplified flow
        const incomeDate = 1;
        const isIncomeUncertain = true;

        conversation.session.onboardingData.periodMonth = currentMonth;
        conversation.session.onboardingData.periodYear = currentYear;
        conversation.session.onboardingData.incomeDate = incomeDate;
        conversation.session.onboardingData.isIncomeUncertain = isIncomeUncertain;

        // ==========================================================================
        // STEP 3: Setup Backend (Create Unallocated Budget)
        // ==========================================================================

        // Check if group
        const isGroup = ctx.chat!.type === "supergroup" || ctx.chat!.type === "group";
        const estimatedIncome = 0; // Default 0 for unallocated start

        try {
            if (isGroup) {
                const groupId = ctx.chat!.id;
                const group = await findGroupByTelegramId(groupId);
                if (!group) {
                    await ctx.reply("Group tidak terdaftar, mungkin sudah dihapus?")
                    return;
                }

                const periodDate = new Date(currentYear, currentMonth, 1);
                const periodId = await ensureGroupPeriodExists(group.id, periodDate, incomeDate);

                await upsertBudget({
                    periodId,
                    estimatedIncome,
                    // No percentages passed -> creates Unallocated bucket
                });

                logger.info(`Onboarding completed for group ${group.id}`);
            } else {
                const account = await getUserByTelegramId(user.id);
                if (account) {
                    await updateUserIncomeSettings(account.userId, incomeDate, isIncomeUncertain);

                    const periodDate = new Date(currentYear, currentMonth, 1);
                    const periodId = await ensurePeriodExists(account.userId, periodDate, incomeDate);

                    await upsertBudget({
                        periodId,
                        estimatedIncome,
                        // No percentages passed -> creates Unallocated bucket
                    });

                    logger.info(`Onboarding completed for user ${user.id}`);
                }
            }
        } catch (error) {
            logger.error("Failed to save onboarding data:", error);
            await ctx.reply("Ada error dikit pas setup database, tapi harusnya aman.");
        }

        // ==========================================================================
        // STEP 4: Completion
        // ==========================================================================

        const periodName = `${getIndonesianMonth(currentMonth)} ${currentYear}`;

        // Create keyboard with Dashboard button
        const finalKeyboard = new InlineKeyboard();
        if (process.env.WEB_APP_URL) {
            if (isGroup) {
                const group = await findGroupByTelegramId(ctx.chat!.id);
                if (group) {
                    const botInfo = ctx.me;
                    finalKeyboard.url("Join Group", `https://t.me/${botInfo?.username}?start=join_${group.id}`)
                }
            } else {
                finalKeyboard.webApp("Buka Dashboard", process.env.WEB_APP_URL);
            }
        }

        await ctx.reply(
            "✅ *Siap Digunakan!*\n\n" +
            `📅 *Periode Aktif:* ${periodName}\n` +
            `💰 *Budget:* Unallocated (Otomatis)\n\n` +
            "Langsung aja chat pengeluaran pertama lo sekarang! 👇",
            { parse_mode: "Markdown", reply_markup: finalKeyboard }
        );

    } catch (error) {
        logger.error("Error in onboarding conversation:", error);
        await ctx.reply("Waduh, error. Ulangi command /start coba.");
    }
}