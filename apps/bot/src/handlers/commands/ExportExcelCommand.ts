import { InputFile } from "grammy";
import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import { ExcelService, ITransactionService, IPeriodService } from "@kodetama/shared";
import { logger } from "../../utils/logger.js";

/**
 * Handles /export_excel command - generates and sends an Excel file
 */
export class ExportExcelCommand extends CommandHandler {
    protected readonly commandName = "export_excel";

    constructor(
        private transactionService: ITransactionService,
        private periodService: IPeriodService
    ) {
        super();
    }

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        try {
            const target = ctx.targetContext || await getTargetContext(ctx);
            const targetId = target.groupId || target.userId!;
            const period = ctx.periodContext || await this.periodService.getCurrentPeriod(targetId);

            if (!period) {
                await ctx.reply("Belum ada periode aktif. Silakan atur budget terlebih dahulu.");
                return { success: true };
            }

            const transactions = await this.transactionService.getAllTransactions(targetId, period.id);

            const excelService = new ExcelService();
            const apiBaseUrl = process.env.VITE_API_URL || process.env.WEB_APP_URL + "/api";
            const buffer = await excelService.generateFinancialReportv2(period as any, transactions as any, apiBaseUrl);

            const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const fileName = `Finance_Report_${period.name.replace(/\s+/g, "_")}_${timestamp}.xlsx`;

            await ctx.replyWithDocument(new InputFile(buffer, fileName), {
                caption: `Berikut adalah laporan keuangan untuk periode *${period.name}*.`,
                parse_mode: "Markdown",
            });

            return { success: true };
        } catch (error) {
            logger.error("Error exporting excel:", error);
            return { success: false, error: error as Error };
        }
    }
}
