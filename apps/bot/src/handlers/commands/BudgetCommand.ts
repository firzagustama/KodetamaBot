import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult } from "../../core/CommandHandler.js";
import { formatRupiah } from "@kodetama/shared";
import {
    getUserByTelegramId,
    getCurrentPeriod,
    getBudgetSummary,
} from "../../services/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Handles /budget command - shows budget overview with progress bars
 */
export class BudgetCommand extends CommandHandler {
    protected readonly commandName = "budget";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        const user = ctx.from;
        if (!user) {
            return { success: false, error: new Error("No user information") };
        }

        try {
            const account = await getUserByTelegramId(user.id);
            if (!account) {
                await ctx.reply("Kamu belum terdaftar. Ketik /start untuk mendaftar.");
                return { success: true };
            }

            const period = await getCurrentPeriod(account.userId);
            if (!period) {
                await ctx.reply(
                    "Belum ada budget yang diatur.\n" +
                    "Buka Dashboard untuk mengatur budget bulan ini."
                );
                return { success: true };
            }

            const summary = await getBudgetSummary(account.userId, period.id);
            if (!summary) {
                await ctx.reply(
                    "Belum ada budget yang diatur untuk bulan ini.\n" +
                    "Buka Dashboard untuk mengatur budget."
                );
                return { success: true };
            }

            const progressBar = (percent: number) => {
                const filled = Math.min(Math.floor(percent / 10), 10);
                const empty = 10 - filled;
                const bar = "█".repeat(filled) + "░".repeat(empty);
                const emoji = percent > 90 ? "🔴" : percent > 75 ? "🟡" : "🟢";
                return `${emoji} ${bar} ${percent}%`;
            };

            await ctx.reply(
                `💰 *Budget ${period.name}*\n\n` +
                `📊 *Estimasi Pendapatan:* ${formatRupiah(summary.budget.estimatedIncome)}\n\n` +
                `*🏠 Needs (${summary.budget.needsPercent}%)*\n` +
                `${progressBar(summary.percentage.needs)}\n` +
                `${formatRupiah(summary.spent.needs)} / ${formatRupiah(summary.budget.needs)}\n` +
                `Sisa: ${formatRupiah(summary.remaining.needs)}\n\n` +
                `*🎮 Wants (${summary.budget.wantsPercent}%)*\n` +
                `${progressBar(summary.percentage.wants)}\n` +
                `${formatRupiah(summary.spent.wants)} / ${formatRupiah(summary.budget.wants)}\n` +
                `Sisa: ${formatRupiah(summary.remaining.wants)}\n\n` +
                `*💵 Savings (${summary.budget.savingsPercent}%)*\n` +
                `${progressBar(summary.percentage.savings)}\n` +
                `${formatRupiah(summary.spent.savings)} / ${formatRupiah(summary.budget.savings)}\n` +
                `Sisa: ${formatRupiah(summary.remaining.savings)}`,
                { parse_mode: "Markdown" }
            );

            return { success: true };
        } catch (error) {
            logger.error("Error fetching budget:", error);
            return { success: false, error: error as Error };
        }
    }
}