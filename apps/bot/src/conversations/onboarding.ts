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

        // ==========================================================================
        // STEP 2: Ask Budget Split
        // ==========================================================================
        const splitKeyboard = new InlineKeyboard()
            .text("✅ Pakai 50/30/20", "split_default")
            .row()
            .text("✏️ Atur Manual", "split_custom");

        await ctx.reply(
            `👍 Penghasilan: *${formatRupiah(estimatedIncome)}*\n\n` +
            "Selanjutnya, kita alokasikan ke 3 bucket:\n\n" +
            "🏠 *Kebutuhan (Needs)* - 50%\n" +
            "  Makanan, transport, tagihan, sewa\n\n" +
            "🎮 *Keinginan (Wants)* - 30%\n" +
            "  Hiburan, makan di luar, hobi\n\n" +
            "💵 *Tabungan (Savings)* - 20%\n" +
            "  Dana darurat, investasi, cicilan\n\n" +
            "Mau pakai *aturan 50/30/20* atau atur sendiri?",
            { parse_mode: "Markdown", reply_markup: splitKeyboard }
        );

        const splitResponse = await conversation.waitForCallbackQuery(/^split_/);
        const splitChoice = splitResponse.callbackQuery.data;
        await splitResponse.answerCallbackQuery();

        let needsPercent = 50;
        let wantsPercent = 30;
        let savingsPercent = 20;

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
                `✅ Kebutuhan: ${needsPercent}%\n\n` +
                "Masukkan persentase untuk *Keinginan (Wants)*:",
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
                `✅ Keinginan: ${wantsPercent}%\n` +
                `✅ Tabungan: ${savingsPercent}% (sisa otomatis)`
            );
        }

        conversation.session.onboardingData.needsPercentage = needsPercent;
        conversation.session.onboardingData.wantsPercentage = wantsPercent;
        conversation.session.onboardingData.savingsPercentage = savingsPercent;

        // ==========================================================================
        // STEP 3: Ask Date Period
        // ==========================================================================
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const nextMonth = (currentMonth + 1) % 12;
        const nextYear = nextMonth === 0 ? currentYear + 1 : currentYear;

        const periodKeyboard = new InlineKeyboard()
            .text(
                `📅 ${getIndonesianMonth(currentMonth)} ${currentYear}`,
                `period_${currentMonth}_${currentYear}`
            )
            .row()
            .text(
                `📅 ${getIndonesianMonth(nextMonth)} ${nextYear}`,
                `period_${nextMonth}_${nextYear}`
            );

        await ctx.reply(
            "📆 *Periode Budget*\n\n" +
            "Untuk periode transaksi ini, mulai dari bulan apa?\n" +
            "Budget akan reset setiap periode baru.",
            { parse_mode: "Markdown", reply_markup: periodKeyboard }
        );

        const periodResponse = await conversation.waitForCallbackQuery(/^period_/);
        const [, month, year] = periodResponse.callbackQuery.data.split("_");
        await periodResponse.answerCallbackQuery();

        conversation.session.onboardingData.periodMonth = parseInt(month);
        conversation.session.onboardingData.periodYear = parseInt(year);

        // ==========================================================================
        // STEP 4: Summary
        // ==========================================================================
        // Initialize AI
        const ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.AI_MODEL ?? "openai/gpt-4-turbo",
        });

        let allocation;
        try {
            const { result } = await ai.generateBudgetSplit(estimatedIncome);
            allocation = {
                needs: result.needsAmount,
                wants: result.wantsAmount,
                savings: result.savingsAmount,
            };
            // Update percentages based on AI suggestion if needed, 
            // but here we just use the calculated amounts for display
            // or we could use the percentages returned by AI
            needsPercent = result.needsPercentage;
            wantsPercent = result.wantsPercentage;
            savingsPercent = result.savingsPercentage;
        } catch (error) {
            logger.error("AI budget split failed, falling back to manual calculation", error);
            allocation = calculateBudgetAllocation(
                estimatedIncome,
                needsPercent,
                wantsPercent,
                savingsPercent
            );
        }



        const periodName = `${getIndonesianMonth(parseInt(month))} ${year}`;

        // Create keyboard with Dashboard button
        const finalKeyboard = new InlineKeyboard();
        if (process.env.WEB_APP_URL) {
            finalKeyboard.webApp("📊 Buka Dashboard", process.env.WEB_APP_URL);
        }

        await ctx.reply(
            "🎊 *Setup Selesai!*\n\n" +
            `📅 *Periode:* ${periodName}\n\n` +
            `💰 *Penghasilan:* ${formatRupiah(estimatedIncome)}\n\n` +
            "*Alokasi Budget:*\n" +
            `🏠 Kebutuhan (${needsPercent}%): ${formatRupiah(allocation.needs)}\n` +
            `🎮 Keinginan (${wantsPercent}%): ${formatRupiah(allocation.wants)}\n` +
            `💵 Tabungan (${savingsPercent}%): ${formatRupiah(allocation.savings)}\n\n` +
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
                // Create period date
                const periodDate = new Date(
                    conversation.session.onboardingData.periodYear!,
                    conversation.session.onboardingData.periodMonth!,
                    1
                );

                // Ensure period exists
                const periodId = await ensurePeriodExists(account.userId, periodDate);

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
