import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { formatRupiah } from "@kodetama/shared";
import { logger } from "../utils/logger.js";
import {
    getUserByTelegramId,
    saveTransaction,
    ensurePeriodExists,
    trackAiUsage,
} from "../services/index.js";

const ai = new AIOrchestrator({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.OPENROUTER_MODEL,
});

/**
 * Handle transaction messages in private chat
 */
export async function handleTransaction(ctx: BotContext): Promise<void> {
    const message = ctx.message?.text;
    const user = ctx.from;

    if (!message || !user) return;

    // Skip commands
    if (message.startsWith("/")) return;

    try {
        // Get user from DB
        const account = await getUserByTelegramId(user.id);
        if (!account) {
            await ctx.reply(
                "Kamu belum terdaftar. Ketik /start untuk mendaftar terlebih dahulu."
            );
            return;
        }

        // Parse transaction using AI
        const { result: parsed, usage } = await ai.parseTransaction(message);

        logger.info(`Transaction parsed for user ${user.id}`, {
            raw: message,
            parsed,
            usage,
        });

        // Check if amount needs confirmation (under 1000)
        if (parsed.needsConfirmation && parsed.suggestedAmount) {
            const confirmKeyboard = new InlineKeyboard()
                .text(
                    `💰 ${formatRupiah(parsed.suggestedAmount)}`,
                    `confirm_amount_${parsed.suggestedAmount}`
                )
                .row()
                .text(
                    `💵 ${formatRupiah(parsed.amount)}`,
                    `confirm_amount_${parsed.amount}`
                );

            await ctx.reply(
                `🤔 *Konfirmasi Jumlah*\n\n` +
                `Kamu menulis: "${message}"\n\n` +
                `Maksudnya:\n` +
                `• ${formatRupiah(parsed.suggestedAmount)} (${parsed.suggestedAmount / 1000}rb)?\n` +
                `• ${formatRupiah(parsed.amount)}?\n\n` +
                `Pilih yang benar:`,
                { parse_mode: "Markdown", reply_markup: confirmKeyboard }
            );
            return;
        }

        // Ensure period exists and get period ID
        const periodId = await ensurePeriodExists(account.userId);

        // Save transaction to database
        const transactionId = await saveTransaction({
            userId: account.userId,
            periodId,
            type: parsed.type,
            amount: parsed.amount,
            description: parsed.description,
            category: parsed.category,
            bucket: parsed.bucket,
            rawMessage: message,
            aiConfidence: parsed.confidence,
        });

        // Store last transaction ID in session for undo
        ctx.session.lastTransactionId = transactionId;

        // Track AI usage
        if (usage) {
            await trackAiUsage({
                userId: account.userId,
                model: usage.model ?? "unknown",
                operation: "parse_transaction",
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
            });
        }

        // Build confirmation message
        const typeEmoji = {
            income: "📈",
            expense: "📉",
            transfer: "↔️",
            adjustment: "⚙️",
        };

        const bucketEmoji: Record<string, string> = {
            needs: "🏠",
            wants: "🎮",
            savings: "💵",
        };

        const confidenceLabel =
            parsed.confidence >= 0.9
                ? "✅"
                : parsed.confidence >= 0.7
                    ? "⚠️"
                    : "❓";

        await ctx.reply(
            `${typeEmoji[parsed.type]} *Transaksi Tercatat!*\n\n` +
            `📝 *${parsed.description}*\n` +
            `💰 Jumlah: ${formatRupiah(parsed.amount)}\n` +
            `📂 Kategori: ${parsed.category}\n` +
            `${bucketEmoji[parsed.bucket] ?? "📦"} Bucket: ${parsed.bucket}\n` +
            `🎯 Akurasi: ${confidenceLabel} ${Math.round(parsed.confidence * 100)}%\n\n` +
            `_Ketik /undo untuk membatalkan_`,
            { parse_mode: "Markdown" }
        );

    } catch (error) {
        logger.error("Failed to parse transaction:", error);

        await ctx.reply(
            "Maaf, saya tidak bisa memahami pesan tersebut. 😅\n\n" +
            "Coba format seperti:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 150rb`",
            { parse_mode: "Markdown" }
        );
    }
}
