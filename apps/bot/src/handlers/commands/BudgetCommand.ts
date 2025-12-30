import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import { formatRupiah, IPeriodService, IBudgetService } from "@kodetama/shared";
import { logger } from "../../utils/logger.js";

/**
 * Handles /budget command - shows budget overview with progress bars
 * Works for both private chats (personal budget) and group chats (family budget)
 */
export class BudgetCommand extends CommandHandler {
    protected readonly commandName = "budget";

    constructor(
        private periodService: IPeriodService,
        private budgetService: IBudgetService
    ) {
        super();
    }

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        try {
            const target = ctx.targetContext || await getTargetContext(ctx);

            const period = ctx.periodContext || await this.periodService.getCurrentPeriod(target.targetId);

            if (!period) {
                await ctx.reply(
                    "Belum ada budget yang diatur.\n" +
                    "Buka Dashboard untuk mengatur budget bulan ini."
                );
                return { success: true };
            }

            const summary = await this.budgetService.getBudgetSummary(target.targetId, period.id);
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
                return `${emoji} ${bar} ${percent.toFixed(2)}%`;
            };

            let response =
                `💰 *Budget ${period.name}*\n\n` +
                `📊 *Estimasi Pendapatan:* ${formatRupiah(parseFloat(summary.budget.estimatedIncome))}\n\n`;

            const buckets = summary.spending;

            for (const bucket of buckets) {
                const amount = parseFloat(bucket.amount || "0");
                const spent = parseFloat(bucket.spent || "0");
                const income = parseFloat(summary.budget.estimatedIncome || "0");

                const percent = income > 0 ? (amount / income * 100) : 0;
                const progress = amount > 0 ? (spent / amount * 100) : 0;
                const percentString = percent.toFixed(0);

                response +=
                    `*${bucket.bucket} (${percentString}%)*\n` +
                    `${progressBar(progress)}\n` +
                    `${formatRupiah(spent)} / ${formatRupiah(amount)}\n` +
                    `Sisa: ${formatRupiah(amount - spent)}\n\n`;
            }

            await ctx.reply(response, { parse_mode: "Markdown" });

            return { success: true };
        } catch (error) {
            logger.error("Error fetching budget:", error);
            return { success: false, error: error as Error };
        }
    }
}