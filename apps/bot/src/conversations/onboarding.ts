import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import {
    parseIndonesianAmount,
    formatRupiah,
    getIndonesianMonth,
} from "@kodetama/shared";
import { BudgetCalculationService } from "../domain/services/index.js";

import { logger } from "../utils/logger.js";
import {
    getUserByTelegramId,
    ensurePeriodExists,
    upsertBudget,
    updateUserIncomeSettings,
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
        // STEP 1: Ask Income Estimate
        // ==========================================================================
        await ctx.reply(
            "*Yo, Gue Saitama* 👊\n\n" +
            "Dengar baik-baik. Kita bakal atur duitmu biar gak habis.\n" +
            "Satu pukulan buat kemiskinan, oke?\n\n" +
            "💰 *Sekarang, berapa duit yang masuk ke kantongmu sebulan?*\n\n" +
            "Tulis angkanya aja. Contoh: `8jt` atau `10000000`.",
            { parse_mode: "Markdown" }
        );

        let estimatedIncome: number | null = null;
        while (!estimatedIncome) {
            const incomeResponse = await conversation.waitFor("message:text");
            const incomeText = incomeResponse.message.text;
            estimatedIncome = parseIndonesianAmount(incomeText);

            if (!estimatedIncome) {
                await ctx.reply(
                    "Oi, tulis yang bener. 😑\n" +
                    "Gue gak paham. Coba lagi: `5jt` atau `5000000`.",
                    { parse_mode: "Markdown" }
                );
            }
        }

        conversation.session.onboardingData.estimatedIncome = estimatedIncome;

        // ==========================================================================
        // STEP 2: Ask Income Date (Logic Fix: 1-28 + Uncertain)
        // ==========================================================================

        // Generate keyboard grid 1-28 (7 columns x 4 rows)
        const incomeDateKeyboard = new InlineKeyboard();
        let dayCounter = 1;

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 7; col++) {
                if (dayCounter <= 28) {
                    incomeDateKeyboard.text(`${dayCounter}`, `date_${dayCounter}`);
                    dayCounter++;
                }
            }
            incomeDateKeyboard.row();
        }

        // Add "Tidak Tentu" at the bottom
        incomeDateKeyboard.text("❓ Ga Tentu / Akhir Bulan", "date_uncertain");

        await ctx.reply(
            "📅 *Kapan biasanya gajian?*\n\n" +
            "Pilih tanggalnya, jangan kelamaan.",
            { parse_mode: "Markdown", reply_markup: incomeDateKeyboard }
        );

        const dateResponse = await conversation.waitForCallbackQuery(/^date_/);
        const dateChoice = dateResponse.callbackQuery.data;
        await dateResponse.answerCallbackQuery();

        let incomeDate = 1;
        let isIncomeUncertain = false;

        if (dateChoice === "date_uncertain") {
            isIncomeUncertain = true;
            incomeDate = 1; // Default to 1st for system logic
        } else {
            // Extract number from "date_12" -> 12
            const extractedDate = parseInt(dateChoice.replace("date_", ""));
            if (!isNaN(extractedDate)) {
                incomeDate = extractedDate;
            }
        }

        conversation.session.onboardingData.incomeDate = incomeDate;
        conversation.session.onboardingData.isIncomeUncertain = isIncomeUncertain;

        // ==========================================================================
        // STEP 3: AI Recommendation & Budget Split
        // ==========================================================================

        console.log("Initializing AI orchestrator...");
        const ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4-turbo",
        });

        await ctx.reply("*Bentar... lagi mikir...*", { parse_mode: "Markdown" });

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
                .text("👊 Oke, Gas", "ai_accept")
                .row()
                .text("✏️ Gak, Mau Atur Sendiri", "ai_reject");

            await ctx.reply(
                `*Analisis selesai.*\n\n` +
                `Nih saran pembagiannya biar hidupmu aman:\n\n` +
                `🏠 *Needs (${aiResult.needsPercentage}%)*: ${formatRupiah(aiResult.needsAmount)}\n` +
                `🎮 *Wants (${aiResult.wantsPercentage}%)*: ${formatRupiah(aiResult.wantsAmount)}\n` +
                `💵 *Savings (${aiResult.savingsPercentage}%)*: ${formatRupiah(aiResult.savingsAmount)}\n\n` +
                `Saran:\n- ${aiResult.suggestions.join("\n- ")}\n\n` +
                `Mau pakai rekomendasi ini?`,
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
                .text("✅ Standar 50/30/20", "split_default")
                .row()
                .text("✏️ Manual Aja", "split_custom");

            await ctx.reply(
                `👍 Duit: *${formatRupiah(estimatedIncome)}*\n\n` +
                "Standarnya dibagi ke 3 _buckets_:\n" +
                "🏠 Needs (50%)\n" +
                "🎮 Wants (30%)\n" +
                "💵 Savings (20%)\n\n" +
                "Mau pake ini atau mau atur sendiri?",
                { parse_mode: "Markdown", reply_markup: splitKeyboard }
            );

            const splitResponse = await conversation.waitForCallbackQuery(/^split_/);
            const splitChoice = splitResponse.callbackQuery.data;
            await splitResponse.answerCallbackQuery();

            if (splitChoice === "split_custom") {
                // Custom split flow
                await ctx.reply(
                    "📝 *Mode Manual.*\n\n" +
                    "Tulis persentase buat *Kebutuhan (Needs)*.\n" +
                    "Langsung angkanya. Contoh: `60`.",
                    { parse_mode: "Markdown" }
                );

                // Needs percentage
                let validNeeds = false;
                while (!validNeeds) {
                    const needsResponse = await conversation.waitFor("message:text");
                    needsPercent = parseInt(needsResponse.message.text);
                    if (isNaN(needsPercent) || needsPercent < 0 || needsPercent > 100) {
                        await ctx.reply("Oi, angkanya 0 sampai 100 aja. Jangan aneh-aneh.");
                    } else {
                        validNeeds = true;
                    }
                }

                await ctx.reply(
                    `✅ Needs: ${needsPercent}%\n\n` +
                    "Sekarang buat *Keinginan (Wants)* berapa persen?",
                    { parse_mode: "Markdown" }
                );

                // Wants percentage
                let validWants = false;
                while (!validWants) {
                    const wantsResponse = await conversation.waitFor("message:text");
                    wantsPercent = parseInt(wantsResponse.message.text);
                    const remaining = 100 - needsPercent;

                    // Logic fix: Allow 0 logic correctly
                    if (isNaN(wantsPercent) || wantsPercent < 0 || wantsPercent > remaining) {
                        await ctx.reply(`Salah. Sisa jatah cuma ${remaining}%. Masukkan angka 0-${remaining}:`);
                    } else {
                        validWants = true;
                    }
                }

                // Calculate savings
                savingsPercent = 100 - needsPercent - wantsPercent;
                await ctx.reply(
                    `✅ Wants: ${wantsPercent}%\n` +
                    `✅ Savings: ${savingsPercent}% (Sisanya masuk sini otomatis)`
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

        let periodMonth = currentMonth;
        let periodYear = currentYear;

        const incomeDateForCalc = conversation.session.onboardingData.incomeDate ?? 1;

        if (currentDay < incomeDateForCalc) {
            // Before payday, so we are still in last month's period
            periodMonth = currentMonth - 1;
            if (periodMonth < 0) {
                periodMonth = 11;
                periodYear = currentYear - 1;
            }
        }

        conversation.session.onboardingData.periodMonth = periodMonth;
        conversation.session.onboardingData.periodYear = periodYear;

        // ==========================================================================
        // STEP 5: Summary
        // ==========================================================================

        const finalNeedsPercent = conversation.session.onboardingData.needsPercentage!;
        const finalWantsPercent = conversation.session.onboardingData.wantsPercentage!;
        const finalSavingsPercent = conversation.session.onboardingData.savingsPercentage!;

        const budgetService = new BudgetCalculationService();
        const allocation = budgetService.calculateBudgetAllocation(
            estimatedIncome,
            finalNeedsPercent,
            finalWantsPercent,
            finalSavingsPercent
        );

        const periodName = `${getIndonesianMonth(periodMonth)} ${periodYear}`;
        const finalIncomeDate = conversation.session.onboardingData.incomeDate ?? 1;
        const finalIsIncomeUncertain = conversation.session.onboardingData.isIncomeUncertain ?? false;
        const incomeDateText = finalIsIncomeUncertain ? "Gak Tentu" : `Tgl ${finalIncomeDate}`;

        // Create keyboard with Dashboard button
        const finalKeyboard = new InlineKeyboard();
        if (process.env.WEB_APP_URL) {
            finalKeyboard.webApp("Buka Dashboard", process.env.WEB_APP_URL);
        }

        await ctx.reply(
            "👊 *Selesai. Setup Beres.*\n\n" +
            `📅 *Periode:* ${periodName}\n` +
            `🗓 *Gajian:* ${incomeDateText}\n` +
            `💰 *Total:* ${formatRupiah(estimatedIncome)}\n\n` +
            "*Alokasi:*\n" +
            `🏠 Needs (${needsPercent}%): ${formatRupiah(allocation.needs)}\n` +
            `🎮 Wants (${wantsPercent}%): ${formatRupiah(allocation.wants)}\n` +
            `💵 Savings (${savingsPercent}%): ${formatRupiah(allocation.savings)}\n\n` +
            "━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "Sekarang catat pengeluaranmu. Jangan malas.\n\n" +
            "Ketik aja:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 15rb`\n\n" +
            "Dah, sana lanjut aktivitas.",
            { parse_mode: "Markdown", reply_markup: finalKeyboard }
        );

        // Save to database
        try {
            const account = await getUserByTelegramId(user.id);
            if (account) {
                await updateUserIncomeSettings(account.userId, finalIncomeDate, finalIsIncomeUncertain);

                const periodDate = new Date(
                    conversation.session.onboardingData.periodYear!,
                    conversation.session.onboardingData.periodMonth!,
                    1
                );

                const periodId = await ensurePeriodExists(account.userId, periodDate, finalIncomeDate);

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
                });
            }
        } catch (error) {
            logger.error("Failed to save onboarding data:", error);
            await ctx.reply("Ada error pas nyimpen data. Tapi yaudahlah, lanjut aja.");
        }

    } catch (error) {
        logger.error("Error in onboarding conversation:", error);
        await ctx.reply("Waduh, error. Ulangi command /start coba.");
    }
}