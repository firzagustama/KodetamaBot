import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext, TargetContext } from "../../core/index.js";
import { InlineKeyboard } from "grammy";
import { IPeriodService } from "@kodetama/shared";

/**
 * Handles /dashboard command - shows dashboard overview with progress bars
 * Works for both private chats (personal budget) and group chats (family budget)
 */
export class DashboardCommand extends CommandHandler {
    protected readonly commandName = "dashboard";

    constructor(private periodService: IPeriodService) {
        super();
    }

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        let target: TargetContext
        try {
            target = ctx.targetContext || await getTargetContext(ctx);
        } catch (error) {
            await ctx.reply(error instanceof Error ? error.message : "Unknown error");
            return { success: true };
        }

        const period = ctx.periodContext || await this.periodService.getCurrentPeriod(target.targetId);

        if (!period) {
            await ctx.reply("Belum ada budget yang diatur.\n" +
                "Ketik /start untuk mulai mengatur budget.");
            return { success: true };
        }

        if (target.isGroup) {
            const botInfo = ctx.me;
            await ctx.reply("Buka dashboard di sini ya 😐", {
                reply_markup: new InlineKeyboard().url("Dashboard", `https://t.me/${botInfo?.username}?startapp=${target.targetId}`)
            });
            return { success: true };
        } else {
            await ctx.reply("Buka dashboard di sini ya 😐", {
                reply_markup: new InlineKeyboard().webApp("Dashboard", process.env.WEB_APP_URL!)
            });
            return { success: true };
        }
    }
}