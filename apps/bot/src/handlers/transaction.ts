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
 * Save transaction to DB and return transaction ID
 */
async function saveTransactionToDb(
    userId: string,
    periodId: string,
    parsed: any,
    rawMessage: string
): Promise<string> {
    return await saveTransaction({
        userId,
        periodId,
        transaction: parsed,
        rawMessage,
    });
}

/**
 * Save single transaction and send confirmation
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
    const transactionId = await saveTransactionToDb(userId, periodId, parsed, rawMessage);

    // Store last transaction ID in session for undo
    ctx.session.lastTransactionIds.push(transactionId);

    // Build confirmation message
    const bucketEmoji: Record<string, string> = {
        needs: "🏠",
        wants: "🎮",
        savings: "💵",
    };

    await ctx.reply(
        `*Transaksi Tercatat!*\n\n` +
        `📝 *${parsed.description}*\n` +
        `💰 Jumlah: ${formatRupiah(parsed.amount)}\n` +
        `📂 Kategori: ${parsed.category}\n` +
        `${bucketEmoji[parsed.bucket] ?? "📦"} Bucket: ${parsed.bucket}\n` +
        `_Ketik /undo untuk membatalkan_`,
        { parse_mode: "Markdown" }
    );
}

/**
 * Save multiple transactions and send summary
 */
async function saveAndConfirmMultipleTransactions(
    ctx: BotContext,
    transactions: any[],
    usage: any,
    userId: string,
    rawMessage: string,
    aiMessage: string
): Promise<void> {
    // Track AI usage
    if (usage) {
        await trackAiUsage({
            userId,
            model: usage.model ?? "unknown",
            operation: "parse_multiple_transactions",
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

    // Check if any transaction needs confirmation
    const lowConfidence = transactions.filter(t => t.confidence < 0.9);

    if (lowConfidence.length > 0) {
        // Store pending transactions
        ctx.session.pendingTransactions = transactions;

        // Build confirmation message
        let confirmationMessage = `⚠️ *Konfirmasi ${transactions.length} Transaksi*\n\n`;
        confirmationMessage += `Kamu menulis:\n"${rawMessage}"\n\n`;
        confirmationMessage += `Hasil parsing:\n`;

        const bucketEmoji: Record<string, string> = {
            needs: "🏠",
            wants: "🎮",
            savings: "💵",
        };

        transactions.forEach((t, idx) => {
            const typeEmoji = t.type === "income" ? "📥" : "📤";
            const confidenceWarning = t.confidence < 0.9 ? " ⚠️" : "";

            confirmationMessage += `\n${idx + 1}. ${typeEmoji} *${t.description}*${confidenceWarning}\n`;
            confirmationMessage += `   💰 ${formatRupiah(t.amount)}\n`;
            confirmationMessage += `   📂 ${t.category} ${bucketEmoji[t.bucket] ?? "📦"}\n`;
        });

        confirmationMessage += `\nSemua benar?`;

        const confirmationKeyboard = new InlineKeyboard()
            .text("✅ Ya, Simpan Semua", "confirm_multiple_transactions")
            .row()
            .text("❌ Batal", "reject_multiple_transactions");

        await ctx.reply(confirmationMessage, {
            parse_mode: "Markdown",
            reply_markup: confirmationKeyboard
        });
        return;
    }

    // All high confidence - save all immediately
    const savedIds: string[] = [];

    try {
        for (const transaction of transactions) {
            const transactionId = await saveTransactionToDb(
                userId,
                periodId,
                transaction,
                rawMessage
            );
            savedIds.push(transactionId);
        }

        // Store last batch transaction IDs for bulk undo
        ctx.session.lastTransactionIds.push(...savedIds);

        // Build summary message
        let summaryMessage = `✅ *${transactions.length} Transaksi Tercatat!*\n\n`;

        // Group by type for summary
        const income = transactions.filter(t => t.type === "income");
        const expense = transactions.filter(t => t.type === "expense");

        if (income.length > 0) {
            const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
            summaryMessage += `📥 *Pemasukan:* ${formatRupiah(totalIncome)}\n`;
            income.forEach(t => {
                summaryMessage += `   • ${t.description}: ${formatRupiah(t.amount)}\n`;
            });
            summaryMessage += `\n`;
        }

        if (expense.length > 0) {
            const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0);
            summaryMessage += `📤 *Pengeluaran:* ${formatRupiah(totalExpense)}\n`;
            expense.forEach(t => {
                summaryMessage += `   • ${t.description}: ${formatRupiah(t.amount)}\n`;
            });
        }

        summaryMessage += `\n_Ketik /undo untuk membatalkan semua_`;
        summaryMessage += `\n\n${aiMessage}`;

        await ctx.reply(summaryMessage, { parse_mode: "Markdown" });

    } catch (error) {
        logger.error("Failed to save multiple transactions:", error);
        await ctx.reply("❌ Gagal menyimpan beberapa transaksi. Coba lagi.");
    }
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

        // Check if it's multiple transactions
        if (parsed.isMultiple && parsed.transactions && Array.isArray(parsed.transactions)) {
            await saveAndConfirmMultipleTransactions(
                ctx,
                parsed.transactions,
                usage,
                account.userId,
                message,
                parsed.message
            );
            return;
        }

        const trx = parsed.transactions[0];
        // Handle single transaction (existing logic)
        if (trx.type === "other") {
            await ctx.reply(trx.description);
            return;
        }

        // Check if amount needs confirmation (under 1000)
        if (trx.needsConfirmation && trx.suggestedAmount) {
            const confirmKeyboard = new InlineKeyboard()
                .text(
                    `💰 ${formatRupiah(trx.suggestedAmount)}`,
                    `confirm_amount_${trx.suggestedAmount}`
                )
                .row()
                .text(
                    `💵 ${formatRupiah(trx.amount)}`,
                    `confirm_amount_${trx.amount}`
                );

            await ctx.reply(
                `🤔 *Konfirmasi Jumlah*\n\n` +
                `Kamu menulis: "${message}"\n\n` +
                `Maksudnya:\n` +
                `• ${formatRupiah(trx.suggestedAmount)} (${trx.suggestedAmount / 1000}rb)?\n` +
                `• ${formatRupiah(trx.amount)}?\n\n` +
                `Pilih yang benar:`,
                { parse_mode: "Markdown", reply_markup: confirmKeyboard }
            );
            return;
        }

        // Check if transaction needs confirmation due to low confidence
        if (trx.confidence < 0.9) {
            // Store pending transaction
            ctx.session.pendingTransactions.push({
                parsed: trx,
                usage,
                userId: account.userId,
                rawMessage: message
            });

            // Build confirmation message
            const bucketEmoji: Record<string, string> = {
                needs: "🏠",
                wants: "🎮",
                savings: "💵",
            };

            const confidenceLabel = trx.confidence >= 0.7 ? "⚠️" : "❓";

            const replyMessage = `${confidenceLabel} *Konfirmasi Transaksi*\n\n` +
                `Kamu menulis: "${message}"\n\n` +
                `💝 *${trx.description}*\n` +
                `💰 Jumlah: ${formatRupiah(trx.amount)}\n` +
                `📂 Kategori: ${trx.category}\n` +
                `${bucketEmoji[trx.bucket] ?? "📦"} Bucket: ${trx.bucket}\n` +
                `${parsed.message}\n\n` +
                `Boleh?`;

            const confirmationKeyboard = new InlineKeyboard()
                .text("Ok", "confirm_transaction")
                .text("Bukan", "reject_transaction");

            const fullMessage = trx.confidence < 0.7 ?
                replyMessage + `\n\n💡 Jika bingung, coba /help` : replyMessage;

            await ctx.reply(fullMessage, {
                parse_mode: "Markdown",
                reply_markup: confirmationKeyboard
            });
            return;
        }

        // High confidence - save immediately
        await saveAndConfirmTransaction(ctx, trx, usage, account.userId, message);
    } catch (error) {
        logger.error("Failed to parse transaction:", error);

        await ctx.reply(
            "*Tch, baca juga dong format nya.* 🤷‍♂️\n\n" +
            "Coba kayak gini:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 150rb`\n\n" +
            "Atau batch:\n" +
            "```\ncatat\n* gaji 8jt\n* kopi 20rb\n* makan 20rb```",
            { parse_mode: "Markdown" }
        );
    }
}