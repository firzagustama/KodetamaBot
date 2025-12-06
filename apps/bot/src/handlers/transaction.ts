import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { formatRupiah } from "@kodetama/shared";
import { logger } from "../utils/logger.js";
import {
    getUserByTelegramId,
    saveTransaction,
    resolvePeriodId,
    trackAiUsage,
} from "../services/index.js";

const ai = new AIOrchestrator({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.OPENROUTER_MODEL,
});

/**
 * Save transaction to DB and send confirmation message
 */
async function saveAndConfirmTransaction(
    ctx: BotContext,
    parsed: any,
    usage: any,
    userId: string,
    rawMessage: string
): Promise<void> {
    // Track AI usage
    if (usage) {
        await trackAiUsage({
            userId,
            model: usage.model ?? "unknown",
            operation: "parse_transaction",
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
        });
    }

    // Ensure period exists and get period ID
    const periodId = await resolvePeriodId(userId);
    if (!periodId) {
        await ctx.reply("Transaksi belum tercatat... Kamu belum mengatur budget. Mari kita setup dulu!");
        await ctx.conversation.enter("onboardingConversation");
        return;
    }

    // Save transaction to database
    const transactionId = await saveTransaction({
        userId,
        periodId,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        bucket: parsed.bucket,
        rawMessage,
        aiConfidence: parsed.confidence,
    });

    // Store last transaction ID in session for undo
    ctx.session.lastTransactionId = transactionId;

    // Build confirmation message
    const bucketEmoji: Record<string, string> = {
        needs: "🏠",
        wants: "🎮",
        savings: "💵",
    };

    await ctx.reply(
        `*Transaksi Tercatat!*\n\n` +
        `📝 *${parsed.description}*
` +
        `💰 Jumlah: ${formatRupiah(parsed.amount)}\n` +
        `📂 Kategori: ${parsed.category}\n` +
        `${bucketEmoji[parsed.bucket] ?? "📦"} Bucket: ${parsed.bucket}\n` +
        `_Ketik /undo untuk membatalkan_\n\n` +
        `${(parsed as any).message}`,
        { parse_mode: "Markdown" }
    );
}

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

        if ((parsed as any).type === "other") {
            await ctx.reply((parsed as any).message);
            return;
        }

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

        // Check if transaction needs confirmation due to low confidence
        if (parsed.confidence < 0.9) {
            // Store pending transaction
            ctx.session.pendingTransaction = { parsed, usage, userId: account.userId, rawMessage: message };

            // Build confirmation message
            const bucketEmoji: Record<string, string> = {
                needs: "🏠",
                wants: "🎮",
                savings: "💵",
            };

            const confidenceLabel =
                parsed.confidence >= 0.7 ? "⚠️" : "❓";

            const replyMessage = `${confidenceLabel} *Konfirmasi Transaksi*\n\n` +
                `Kamu menulis: "${message}"\n\n` +
                `💝 *${parsed.description}*\n` +
                `💰 Jumlah: ${formatRupiah(parsed.amount)}\n` +
                `📂 Kategori: ${parsed.category}\n` +
                `${bucketEmoji[parsed.bucket] ?? "📦"} Bucket: ${parsed.bucket}\n` +
                `${(parsed as any).message}\n\n` +
                `Boleh?`;

            const confirmationKeyboard = new InlineKeyboard()
                .text("Ok", "confirm_transaction")
                .text("Bukan", "reject_transaction");

            const fullMessage = parsed.confidence < 0.7 ?
                replyMessage + `\n\n💡 Jika bingung, coba /help` : replyMessage;

            await ctx.reply(fullMessage, {
                parse_mode: "Markdown",
                reply_markup: confirmationKeyboard
            });
            return;
        }

        // High confidence - save immediately
        await saveAndConfirmTransaction(ctx, parsed, usage, account.userId, message);
    } catch (error) {
        logger.error("Failed to parse transaction:", error);

        await ctx.reply(
            "*Tch, baca juga dong format nya.* 🤷‍♂️\n\n" +
            "Coba kayak gini:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 150rb`",
            { parse_mode: "Markdown" }
        );
    }
}