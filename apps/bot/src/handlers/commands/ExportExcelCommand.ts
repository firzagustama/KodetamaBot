import { InputFile } from "grammy";
import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import { ExcelService } from "@kodetama/shared";
import { getTargetCurrentPeriod, getAllTransactions } from "../../services/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Handles /export_excel command - generates and sends an Excel file
 */
export class ExportExcelCommand extends CommandHandler {
    protected readonly commandName = "export_excel";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        try {
            const target = await getTargetContext(ctx);
            const period = await getTargetCurrentPeriod(target);

            if (!period) {
                await ctx.reply("Belum ada periode aktif. Silakan atur budget terlebih dahulu.");
                return { success: true };
            }

            const transactions = await getAllTransactions(target, period.id);

            const excelService = new ExcelService();
            const buffer = await excelService.generateFinancialReportv2(period as any, transactions as any);

            const fileName = `Kodetama_Report_${period.name.replace(/\s+/g, "_")}.xlsx`;

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
