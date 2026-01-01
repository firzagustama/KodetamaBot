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
            "• Catat bareng temen/keluarga di grup\n" +
            "• Kirim foto struk/invoice\n" +
            "• Kirim voice note\n\n" +
            "*Pencatatan di grup:*\n" +
            "1. Buat dan invite bot ini ke grup\n" +
            "2. Ubah setting grup menjadi 'Semua anggota dapat mengirim pesan'\n" +
            "3. Jadikan bot sebagai admin\n" +
            "4. Jalankan perintah /link\\_family\n" +
            "5. Untuk anggota grup jalankan perintah /join\\_group\n" +
            "6. Setelah itu lo bisa catat bareng temen/keluarga di grup!\n\n" +
            "*Perintah:*\n" +
            "/start - Mulai/Reset\n" +
            "/help - Bantuan ini\n" +
            "/dashboard - Dashboard\n" +
            "/budget - Lihat budget bulan ini\n" +
            "/summary - Ringkasan bulan ini\n" +
            "/export\\_excel - Export laporan ke excel\n" +
            "/join\\_family - Join keluarga\n" +
            "/link\\_family - Link grup untuk pencatatan (Owner)\n" +
            "/cancel - Batalin percakapan",
            { parse_mode: "Markdown" }
        );

        return { success: true };
    }
}