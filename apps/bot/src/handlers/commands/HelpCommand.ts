import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult } from "../../core/CommandHandler.js";

/**
 * Handles /help command - displays usage instructions
 */
export class HelpCommand extends CommandHandler {
    protected readonly commandName = "help";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        await ctx.reply(
            "🤖 *Kodetama Bot - Asisten Keuangan*\n\n" +
            "*Cara Mencatat Transaksi:*\n" +
            "Kirim pesan natural seperti:\n" +
            "• `makan 20rb` → pengeluaran makanan\n" +
            "• `gaji 8jt` → pemasukan gaji\n" +
            "• `bensin 150rb` → pengeluaran transportasi\n" +
            "• `transfer ke mama 500k` → transfer\n\n" +
            "*Format Angka:*\n" +
            "• `rb` atau `ribu` = ribuan (20rb = 20.000)\n" +
            "• `jt` atau `juta` = jutaan (1,5jt = 1.500.000)\n" +
            "• `k` = ribuan (500k = 500.000)\n\n" +
            "*Perintah:*\n" +
            "/start - Mulai atau registrasi\n" +
            "/help - Bantuan\n" +
            "/budget - Lihat budget\n" +
            "/summary - Ringkasan bulan ini\n" +
            "/undo - Batalkan transaksi terakhir\n" +
            "/wallet - Lihat saldo\n" +
            "/export - Export ke Google Sheets\n" +
            "/cancel - Batalkan percakapan",
            { parse_mode: "Markdown" }
        );

        return { success: true };
    }
}