import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import { formatRupiah } from "@kodetama/shared";
import {
    getCurrentPeriod,
    getCurrentGroupPeriod,
    getBudgetSummary,
    getBuckets,
} from "../../services/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Handles /budget command - shows budget overview with progress bars
 * Works for both private chats (personal budget) and group chats (family budget)
 */
export class BudgetCommand extends CommandHandler {
    protected readonly commandName = "budget";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        try {
            const target = await getTargetContext(ctx);

            const period = target.isGroup
                ? await getCurrentGroupPeriod(target.targetId)
                : await getCurrentPeriod(target.targetId);

            if (!period) {
                await ctx.reply(
                    "Belum ada budget yang diatur.\n" +
                    "Buka Dashboard untuk mengatur budget bulan ini."
                );
                return { success: true };
            }

            const buckets = await getBuckets(period.id);
            if (!buckets || buckets.length === 1) {
                await ctx.conversation.enter("setupbudget");
                return { success: true };
            }

            const summary = await getBudgetSummary(target.targetId, period.id, target.isGroup);
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

            let response =
                `💰 *Budget ${period.name}*\n\n` +
                `📊 *Estimasi Pendapatan:* ${formatRupiah(summary.budget.estimatedIncome)}\n\n`;
            for (const bucket of summary.budget.buckets) {
                const percent = bucket.amount / summary.budget.estimatedIncome * 100;
                response +=
                    `*${bucket.bucket} (${percent}%)*\n` +
                    `${progressBar(percent)}\n` +
                    `${formatRupiah(bucket.spent)} / ${formatRupiah(bucket.amount)}\n` +
                    `Sisa: ${formatRupiah(bucket.remaining)}\n\n`;
            }

            await ctx.reply(response, { parse_mode: "Markdown" });

            return { success: true };
        } catch (error) {
            logger.error("Error fetching budget:", error);
            return { success: false, error: error as Error };
        }
    }
}