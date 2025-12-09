import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import {
    parseIndonesianAmount,
    formatRupiah,
    calculateBudgetAllocation,
    getIndonesianMonth,
} from "@kodetama/shared";

import { logger } from "../utils/logger.js";
import {
    getUserByTelegramId,
    ensurePeriodExists,
    upsertBudget,
    updateUserIncomeSettings,
} from "../services/index.js";

/**
 * ZBB Onboarding conversation flow
 * 1. Ask income estimate
 * 2. Ask budget split (50/30/20 or custom)
 * 3. Ask date period
 * 4. Show summary
 */
export async function onboardingConversation(
    conversation: Conversation<BotContext>,
    ctx: BotContext
): Promise<void> {
    const user = ctx.from;
    if (!user) {
        await ctx.reply("Maaf, terjadi kesalahan. Silakan coba lagi.");
        return;
    }

    // Initialize onboarding data
    conversation.session.onboardingData = {};

    try {
        // ==========================================================================
        // STEP 1: Ask Income Estimate
        // ==========================================================================
        await ctx.reply(
            "🚀 *Mari Mulai Zero-Based Budgeting!*\n\n" +
            "Dengan ZBB, setiap rupiah punya tujuan. " +
            "Kita akan alokasikan penghasilanmu ke kategori yang tepat.\n\n" +
            "💰 *Pertama, berapa estimasi penghasilan kamu per bulan?*\n\n" +
            "Contoh: `8jt`, `5.5juta`, `10000000`",
            { parse_mode: "Markdown" }
        );

        let estimatedIncome: number | null = null;
        while (!estimatedIncome) {
            const incomeResponse = await conversation.waitFor("message:text");
            const incomeText = incomeResponse.message.text;
            estimatedIncome = parseIndonesianAmount(incomeText);

            if (!estimatedIncome) {
                await ctx.reply(
                    "Hmm, saya tidak bisa memahami jumlahnya. 🤔\n" +
                    "Coba ketik seperti: `8jt`, `5500000`, atau `5,5juta`",
                    { parse_mode: "Markdown" }
                );
            }
        }

        conversation.session.onboardingData.estimatedIncome = estimatedIncome;

        conversation.session.onboardingData.estimatedIncome = estimatedIncome;

        // ==========================================================================
        // STEP 2: Ask Income Date
        // ==========================================================================
        const incomeDateKeyboard = new InlineKeyboard()
            .text("📅 Tanggal 1", "date_1")
            .text("📅 Tanggal 25", "date_25")
            .row()
            .text("📅 Akhir Bulan", "date_last")
            .text("❓ Tidak Tentu", "date_uncertain");

        await ctx.reply(
            "📅 *Kapan biasanya kamu terima penghasilan?*\n\n" +
            "Ini membantu saya mengatur periode budget kamu.\n" +
            "Misal: gajian tgl 25, maka periode budgetmu tgl 25 - 24 bulan depan.",
            { parse_mode: "Markdown", reply_markup: incomeDateKeyboard }
        );

        const dateResponse = await conversation.waitForCallbackQuery(/^date_/);
        const dateChoice = dateResponse.callbackQuery.data;
        await dateResponse.answerCallbackQuery();

        let incomeDate = 1;
        let isIncomeUncertain = false;

        if (dateChoice === "date_1") {
            incomeDate = 1;
        } else if (dateChoice === "date_25") {
            incomeDate = 25;
        } else if (dateChoice === "date_last") {
            // Treat end of month as starting on 1st of next month for simplicity in period logic,
            // or we could handle it differently. For now let's map "Akhir Bulan" to 28th or similar?
            // Actually, "Akhir Bulan" usually means they want to budget from 1st of next month?
            // Let's stick to 1st for simplicity if they choose "Akhir Bulan" implying they budget for the full next month.
            // Or maybe 25th is common.
            // Let's ask for specific date if they want custom, but for buttons let's stick to common ones.
            // If "Akhir Bulan", let's assume 1st.
            incomeDate = 1;
        } else if (dateChoice === "date_uncertain") {
            isIncomeUncertain = true;
            incomeDate = 1; // Default
        }

        conversation.session.onboardingData.incomeDate = incomeDate;
        conversation.session.onboardingData.isIncomeUncertain = isIncomeUncertain;

        // ==========================================================================
        // STEP 3: AI Recommendation & Budget Split
        // ==========================================================================
        // ==========================================================================
        // STEP 3: AI Recommendation & Budget Split
        // ==========================================================================

        // Initialize AI
        console.log("Initializing AI orchestrator...");
        const ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4-turbo",
        });

        await ctx.reply("🤖 *Sedang menghitung rekomendasi budget untukmu...*", { parse_mode: "Markdown" });

        let aiResult = null;
        try {
            const { result } = await ai.generateBudgetSplit(estimatedIncome);
            aiResult = result;
        } catch (error) {
            logger.error("AI budget split failed", error);
        }

        let needsPercent = 50;
        let wantsPercent = 30;
        let savingsPercent = 20;
        let useAiRecommendation = false;

        if (aiResult) {
            const aiKeyboard = new InlineKeyboard()
                .text("✅ Pakai Rekomendasi", "ai_accept")
                .row()
                .text("✏️ Atur Manual", "ai_reject");

            await ctx.reply(
                `🤖 *Memberikan rekomendasi...*\n\n` +
                `Berdasarkan penghasilanmu, menyarankan:\n\n` +
                `🏠 *Needs (${aiResult.needsPercentage}%)*: ${formatRupiah(aiResult.needsAmount)}\n` +
                `🎮 *Wants (${aiResult.wantsPercentage}%)*: ${formatRupiah(aiResult.wantsAmount)}\n` +
                `💵 *Savings (${aiResult.savingsPercentage}%)*: ${formatRupiah(aiResult.savingsAmount)}\n\n` +
                `Suggestion:\n- ${aiResult.suggestions.join("\n- ")}\n\n` +
                `Apakah kamu ingin menggunakan rekomendasi ini?`,
                { parse_mode: "Markdown", reply_markup: aiKeyboard }
            );

            const aiResponse = await conversation.waitForCallbackQuery(/^ai_/);
            const aiChoice = aiResponse.callbackQuery.data;
            await aiResponse.answerCallbackQuery();

            if (aiChoice === "ai_accept") {
                useAiRecommendation = true;
                needsPercent = aiResult.needsPercentage;
                wantsPercent = aiResult.wantsPercentage;
                savingsPercent = aiResult.savingsPercentage;
            }
        }

        // If AI failed or user rejected, ask for manual split
        if (!useAiRecommendation) {
            const splitKeyboard = new InlineKeyboard()
                .text("✅ Pakai 50/30/20", "split_default")
                .row()
                .text("✏️ Atur Manual", "split_custom");

            await ctx.reply(
                `👍 Penghasilan: *${formatRupiah(estimatedIncome)}*\n\n` +
                "Kita alokasikan ke 3 bucket:\n\n" +
                "🏠 *Needs* - 50%\n" +
                "🎮 *Wants* - 30%\n" +
                "💵 *Savings* - 20%\n\n" +
                "Mau pakai *aturan 50/30/20* atau atur sendiri?",
                { parse_mode: "Markdown", reply_markup: splitKeyboard }
            );

            const splitResponse = await conversation.waitForCallbackQuery(/^split_/);
            const splitChoice = splitResponse.callbackQuery.data;
            await splitResponse.answerCallbackQuery();

            if (splitChoice === "split_custom") {
                // Custom split flow
                await ctx.reply(
                    "📝 *Atur Alokasi Manual*\n\n" +
                    "Masukkan persentase untuk *Kebutuhan (Needs)*:\n" +
                    "Contoh: `60` untuk 60%",
                    { parse_mode: "Markdown" }
                );

                // Needs percentage
                let validNeeds = false;
                while (!validNeeds) {
                    const needsResponse = await conversation.waitFor("message:text");
                    needsPercent = parseInt(needsResponse.message.text);
                    if (isNaN(needsPercent) || needsPercent < 0 || needsPercent > 100) {
                        await ctx.reply("Masukkan angka antara 0-100:");
                    } else {
                        validNeeds = true;
                    }
                }

                await ctx.reply(
                    `✅ Needs: ${needsPercent}%\n\n` +
                    "Masukkan persentase untuk *Wants*:",
                    { parse_mode: "Markdown" }
                );

                // Wants percentage
                let validWants = false;
                while (!validWants) {
                    const wantsResponse = await conversation.waitFor("message:text");
                    wantsPercent = parseInt(wantsResponse.message.text);
                    const remaining = 100 - needsPercent;
                    if (isNaN(wantsPercent) || wantsPercent < 0 || wantsPercent > remaining) {
                        await ctx.reply(`Masukkan angka antara 0-${remaining}:`);
                    } else {
                        validWants = true;
                    }
                }

                // Calculate savings
                savingsPercent = 100 - needsPercent - wantsPercent;
                await ctx.reply(
                    `✅ Wants: ${wantsPercent}%\n` +
                    `✅ Savings: ${savingsPercent}% (sisa otomatis)`
                );
            }
        }

        conversation.session.onboardingData.needsPercentage = needsPercent;
        conversation.session.onboardingData.wantsPercentage = wantsPercent;
        conversation.session.onboardingData.savingsPercentage = savingsPercent;
        conversation.session.onboardingData.useAiRecommendation = useAiRecommendation;

        // ==========================================================================
        // STEP 4: Determine Period (Automatic)
        // ==========================================================================
        const now = new Date();
        const currentDay = now.getDate();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Determine period start based on income date
        // If income date is 25, and today is 10th, then we are in the period that started last month 25th.
        // If income date is 25, and today is 26th, then we are in the period that started this month 25th.
        // If income date is 1 (or uncertain), and today is 10th, we are in period starting 1st of this month.

        let periodMonth = currentMonth;
        let periodYear = currentYear;

        // Use incomeDate from session (default to 1 if not set/uncertain)
        const incomeDateForCalc = conversation.session.onboardingData.incomeDate ?? 1;

        if (currentDay < incomeDateForCalc) {
            // We are before the income date in current month, so period started last month
            periodMonth = currentMonth - 1;
            if (periodMonth < 0) {
                periodMonth = 11;
                periodYear = currentYear - 1;
            }
        }

        conversation.session.onboardingData.periodMonth = periodMonth;
        conversation.session.onboardingData.periodYear = periodYear;

        // ==========================================================================
        // STEP 4: Summary
        // ==========================================================================

        // Calculate final allocation based on user's choice
        const finalNeedsPercent = conversation.session.onboardingData.needsPercentage!;
        const finalWantsPercent = conversation.session.onboardingData.wantsPercentage!;
        const finalSavingsPercent = conversation.session.onboardingData.savingsPercentage!;

        const allocation = calculateBudgetAllocation(
            estimatedIncome,
            finalNeedsPercent,
            finalWantsPercent,
            finalSavingsPercent
        );



        const periodName = `${getIndonesianMonth(periodMonth)} ${periodYear}`;
        const finalIncomeDate = conversation.session.onboardingData.incomeDate ?? 1;
        const finalIsIncomeUncertain = conversation.session.onboardingData.isIncomeUncertain ?? false;
        const incomeDateText = finalIsIncomeUncertain ? "Tidak Tentu" : `Tanggal ${finalIncomeDate}`;

        // Create keyboard with Dashboard button
        const finalKeyboard = new InlineKeyboard();
        if (process.env.WEB_APP_URL) {
            finalKeyboard.webApp("Dashboard", process.env.WEB_APP_URL);
        }

        await ctx.reply(
            "🎊 *Setup Selesai!*\n\n" +
            `📅 *Periode:* ${periodName}\n` +
            `🗓 *Tgl Gajian:* ${incomeDateText}\n\n` +
            `💰 *Penghasilan:* ${formatRupiah(estimatedIncome)}\n\n` +
            "*Alokasi Budget:*\n" +
            `🏠 Needs (${needsPercent}%): ${formatRupiah(allocation.needs)}\n` +
            `🎮 Wants (${wantsPercent}%): ${formatRupiah(allocation.wants)}\n` +
            `💵 Savings (${savingsPercent}%): ${formatRupiah(allocation.savings)}\n\n` +
            "━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "✨ *Sekarang kamu bisa mulai mencatat transaksi!*\n\n" +
            "Contoh:\n" +
            "• `makan 20rb` → pengeluaran makan\n" +
            "• `gaji 8jt` → pemasukan gaji\n" +
            "• `bensin 150rb` → pengeluaran transportasi\n\n" +
            "Happy budgeting! 🚀",
            { parse_mode: "Markdown", reply_markup: finalKeyboard }
        );

        // Save to database
        try {
            const account = await getUserByTelegramId(user.id);
            if (account) {
                // Update income settings
                await updateUserIncomeSettings(account.userId, finalIncomeDate, finalIsIncomeUncertain);

                // Create period date
                const periodDate = new Date(
                    conversation.session.onboardingData.periodYear!,
                    conversation.session.onboardingData.periodMonth!,
                    1
                );

                // Ensure period exists (pass incomeDate)
                const periodId = await ensurePeriodExists(account.userId, periodDate, finalIncomeDate);

                // Create budget
                await upsertBudget({
                    periodId,
                    estimatedIncome: estimatedIncome!,
                    needsPercent,
                    wantsPercent,
                    savingsPercent,
                });

                logger.info(`Onboarding completed for user ${user.id}`, {
                    income: estimatedIncome,
                    incomeDate: finalIncomeDate,
                    isIncomeUncertain: finalIsIncomeUncertain,
                    needs: needsPercent,
                    wants: wantsPercent,
                    savings: savingsPercent,
                    period: periodName,
                });
            }
        } catch (error) {
            logger.error("Failed to save onboarding data:", error);
            await ctx.reply("Terjadi kesalahan saat menyimpan data. Namun setup telah selesai.");
        }

    } catch (error) {
        logger.error("Error in onboarding conversation:", error);
        await ctx.reply("Maaf, terjadi kesalahan saat setup. Silakan coba lagi dengan /start.");
    }
}