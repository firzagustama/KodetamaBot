import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult } from "../../core/CommandHandler.js";

/**
 * Handles /help command - displays usage instructions
 */
export class HelpCommand extends CommandHandler {
    protected readonly commandName = "help";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        await ctx.reply(
            "🤖 *Kodetama Bot (BETA)*\n\n" +
            "Asisten keuangan personal lo.\n\n" +
            "*Cara Pakai:*\n" +
            "Langsung chat aja pengeluaran lo:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 10jt`\n" +
            "• `buat budget belanja 500rb`\n" +
            "• `buat periode baru`\n" +
            "• `transfer ke mama 500k`\n\n" +
            "*Atau lo juga bisa:*\n" +
            "• Kirim foto struk/invoice\n" +
            "• Kirim voice note\n\n" +
            "*Perintah:*\n" +
            "/start - Mulai/Reset\n" +
            "/help - Bantuan ini\n" +
            "/dashboard - Dashboard\n" +
            "/budget - Lihat budget bulan ini\n" +
            "/summary - Ringkasan bulan ini\n" +
            "`/export_excel` - Export laporan ke excel\n" +
            "/cancel - Batalin percakapan",
            { parse_mode: "Markdown" }
        );

        return { success: true };
    }
}