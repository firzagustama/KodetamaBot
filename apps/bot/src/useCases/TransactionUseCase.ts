import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { TransactionFormatter } from "../utils/TransactionFormatter.js";
import { logger } from "../utils/logger.js";
import {
    saveTransaction,
    resolvePeriodId,
    trackAiUsage,
} from "../services/index.js";

interface TransactionResult {
    success: boolean;
    message?: string;
    error?: Error;
    transactions?: any[];
}

/**
 * Transaction Use Case - handles business logic for transaction operations
 * Following Clean Architecture principles with application-specific logic
 */
export class TransactionUseCase {
    private ai: AIOrchestrator;

    constructor(aiOrchestrator: AIOrchestrator) {
        this.ai = aiOrchestrator;
    }

    /**
     * Save a single transaction with confirmation
     */
    async saveTransactionWithConfirmation(
        ctx: BotContext,
        transaction: any,
        usage: any,
        userId: string,
        rawMessage: string
    ): Promise<TransactionResult> {
        try {
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

            // Ensure period exists
            const periodId = await resolvePeriodId(userId);
            if (!periodId) {
                await ctx.reply("Transaksi belum tercatat... Kamu belum mengatur budget. Mari kita setup dulu!");
                await ctx.conversation.enter("onboardingConversation");
                return { success: false, error: new Error("No active period") };
            }

            // Save transaction to database
            const transactionId = await saveTransaction({
                userId,
                periodId,
                transaction,
                rawMessage,
            });

            // Store last transaction ID in session for undo
            ctx.session.lastTransactionIds.push(transactionId);

            // Format confirmation message
            const message = TransactionFormatter.formatTransactionConfirmation(transaction);

            await ctx.reply(message, { parse_mode: "Markdown" });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save transaction:", error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Save multiple transactions with confirmation check
     */
    async saveMultipleTransactionsWithConfirmation(
        ctx: BotContext,
        transactions: any[],
        usage: any,
        userId: string,
        rawMessage: string,
        aiMessage: string
    ): Promise<TransactionResult> {
        try {
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

            // Ensure period exists
            const periodId = await resolvePeriodId(userId);
            if (!periodId) {
                await ctx.reply("Transaksi belum tercatat... Kamu belum mengatur budget. Mari kita setup dulu!");
                await ctx.conversation.enter("onboardingConversation");
                return { success: false, error: new Error("No active period") };
            }

            // Check if any transaction needs confirmation
            const lowConfidence = transactions.filter(t => t.confidence < 0.9);

            if (lowConfidence.length > 0) {
                // Store pending transactions for confirmation
                ctx.session.pendingTransactions = transactions;

                // Send confirmation request
                const message = TransactionFormatter.formatMultipleTransactionsConfirmation(
                    transactions,
                    rawMessage
                );
                const keyboard = TransactionFormatter.getMultipleTransactionsKeyboard();

                await ctx.reply(message, {
                    parse_mode: "Markdown",
                    reply_markup: keyboard
                });

                return { success: true, message: "Pending confirmation" };
            }

            // All high confidence - save all immediately
            const savedIds = await this.saveTransactionsToDatabase(userId, periodId, transactions, rawMessage);

            // Store last batch transaction IDs for bulk undo
            ctx.session.lastTransactionIds.push(...savedIds);

            // Send success message
            const message = TransactionFormatter.formatMultipleTransactionsSuccess(transactions) + `\n\n${aiMessage}`;
            await ctx.reply(message, { parse_mode: "Markdown" });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save multiple transactions:", error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Confirm pending transactions (from callback)
     */
    async confirmPendingTransactions(ctx: BotContext): Promise<TransactionResult> {
        const pending = ctx.session.pendingTransactions;

        if (!pending || pending.length === 0) {
            return { success: false, error: new Error("No pending transactions") };
        }

        try {
            const periodId = await resolvePeriodId(pending[0].userId);
            if (!periodId) {
                await ctx.reply("❌ Gagal menyimpan. Period tidak ditemukan.");
                return { success: false, error: new Error("No active period") };
            }

            // Save all transactions
            const savedIds = await this.saveTransactionsToDatabase(
                pending[0].userId,
                periodId,
                pending,
                pending[0].rawMessage
            );

            ctx.session.lastTransactionIds = savedIds;
            ctx.session.pendingTransactions = [];

            // Track usage
            if (pending[0].usage) {
                await trackAiUsage({
                    userId: pending[0].userId,
                    model: pending[0].usage.model ?? "unknown",
                    operation: "confirm_multiple_transactions",
                    inputTokens: pending[0].usage.inputTokens ?? 0,
                    outputTokens: pending[0].usage.outputTokens ?? 0,
                });
            }

            // Send summary
            const message = TransactionFormatter.formatMultipleTransactionsSuccess(pending);
            await ctx.editMessageText(message, { parse_mode: "Markdown" });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save confirmed transactions:", error);
            await ctx.editMessageText("❌ Gagal menyimpan transaksi.");
            return { success: false, error: error as Error };
        }
    }

    /**
     * Confirm single pending transaction (from callback)
     */
    async confirmSinglePendingTransaction(ctx: BotContext): Promise<TransactionResult> {
        const pending = ctx.session.pendingTransactions;

        if (!pending || pending.length === 0 || !pending[0]) {
            return { success: false, error: new Error("No pending transaction") };
        }

        try {
            const transaction = pending[0];
            const periodId = await resolvePeriodId(transaction.userId);

            if (!periodId) {
                await ctx.reply("❌ Gagal menyimpan. Period tidak ditemukan.");
                return { success: false, error: new Error("No active period") };
            }

            // Save transaction
            const transactionId = await saveTransaction({
                userId: transaction.userId,
                periodId,
                transaction: transaction.parsed,
                rawMessage: transaction.rawMessage
            });

            ctx.session.lastTransactionIds = [transactionId];
            ctx.session.pendingTransactions = [];

            // Track AI usage
            if (transaction.usage) {
                await trackAiUsage({
                    userId: transaction.userId,
                    model: transaction.usage.model ?? "unknown",
                    operation: "confirm_transaction",
                    inputTokens: transaction.usage.inputTokens ?? 0,
                    outputTokens: transaction.usage.outputTokens ?? 0,
                });
            }

            // Update message
            const message = TransactionFormatter.formatTransactionConfirmationForEdit(transaction.parsed);
            await ctx.editMessageText(message, { parse_mode: "Markdown" });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save confirmed transaction:", error);
            await ctx.editMessageText("❌ Terjadi kesalahan saat menyimpan transaksi.");
            return { success: false, error: error as Error };
        }
    }

    /**
     * Reject pending transactions
     */
    async rejectPendingTransactions(ctx: BotContext): Promise<TransactionResult> {
        ctx.session.pendingTransactions = [];

        try {
            const message = TransactionFormatter.formatRejectionMessage();
            await ctx.editMessageText(message, { parse_mode: "Markdown" });
            return { success: true, message };
        } catch (error) {
            logger.error("Failed to send rejection message:", error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Undo last transactions
     */
    async undoLastTransactions(ctx: BotContext): Promise<TransactionResult> {
        const transactionIds = ctx.session.lastTransactionIds;

        if (!transactionIds || transactionIds.length === 0) {
            await ctx.reply("Tidak ada transaksi yang bisa dibatalkan. 📝\n\n" +
                "Hanya transaksi yang baru dicatat saja yang bisa di-undo ya!");
            return { success: true };
        }

        try {
            // Import repository dynamically to maintain dependency direction
            const { TransactionRepository } = await import("../infrastructure/repositories/index.js");
            const transactionRepo = new TransactionRepository();

            // Delete transactions from database
            let success = true;
            for (const id of transactionIds) {
                const deleted = await transactionRepo.delete(id);
                if (!deleted) {
                    success = false;
                    logger.error(`Failed to delete transaction ${id}`);
                }
            }

            if (!success) {
                await ctx.reply("⚠️ Beberapa transaksi gagal dibatalkan, tapi sebagian berhasil.");
            } else {
                // Clear session on successful deletion
                ctx.session.lastTransactionIds = [];

                // Send success message
                const count = transactionIds.length;
                const message = count === 1
                    ? "✅ Transaksi berhasil dibatalkan!\n\nKamu bisa catat transaksi yang benar sekarang. 💰"
                    : `✅ ${count} transaksi berhasil dibatalkan!\n\nKamu bisa catat transaksi yang benar sekarang. 💰`;

                await ctx.reply(message);
            }

            return { success };
        } catch (error) {
            logger.error("Failed to undo transactions:", error);
            await ctx.reply("❌ Gagal membatalkan transaksi. Silakan coba lagi.");
            return { success: false, error: error as Error };
        }
    }

    /**
     * Parse transaction using AI
     */
    async parseTransaction(message: string) {
        try {
            const { result: parsed, usage } = await this.ai.parseTransaction(message);

            logger.info("Transaction parsed", { raw: message, parsed, usage });

            return { success: true, parsed, usage };
        } catch (error) {
            logger.error("Failed to parse transaction:", error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Helper method to save multiple transactions
     */
    private async saveTransactionsToDatabase(
        userId: string,
        periodId: string,
        transactions: any[],
        rawMessage: string
    ): Promise<string[]> {
        const savedIds: string[] = [];

        for (const transaction of transactions) {
            const transactionId = await saveTransaction({
                userId,
                periodId,
                transaction,
                rawMessage
            });
            savedIds.push(transactionId);
        }

        return savedIds;
    }
}