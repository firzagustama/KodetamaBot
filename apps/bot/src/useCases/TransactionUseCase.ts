import type { BotContext, TransactionData } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { TransactionFormatter } from "../utils/TransactionFormatter.js";
import { logger } from "../utils/logger.js";
import {
    saveTransaction,
    resolvePeriodId,
    resolveGroupPeriodId,
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
                // SAITAMA UX: Lazy instruction
                await ctx.reply("Budget belum diatur. Setup dulu, baru balik lagi.");
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
        transaction: TransactionData
    ): Promise<TransactionResult> {
        try {
            const { account, parsed, usage, rawMessage } = transaction
            // Track AI usage
            if (usage) {
                await trackAiUsage({
                    userId: account.userId,
                    model: usage.model ?? "unknown",
                    operation: "parse_multiple_transactions",
                    inputTokens: usage.inputTokens ?? 0,
                    outputTokens: usage.outputTokens ?? 0,
                });
            }

            // Check if any transaction needs confirmation
            const transactions = parsed.transactions
            const lowConfidence = transactions.filter(t => t.confidence < 0.9);
            if (lowConfidence.length > 0) {
                // Store pending transactions for confirmation
                ctx.session.pendingTransactions = transaction;

                // Send confirmation request
                const message = TransactionFormatter.formatMultipleTransactionsConfirmation(transactions);
                const keyboard = TransactionFormatter.getMultipleTransactionsKeyboard();

                await ctx.reply(message, {
                    parse_mode: "Markdown",
                    reply_markup: keyboard
                });

                return { success: true, message: "Pending confirmation" };
            }

            // All high confidence - save all immediately
            const savedIds = await this.saveTransactionsToDatabase(account.userId, account.periodId, transactions, rawMessage, account.groupId);

            // Store last batch transaction IDs for bulk undo
            ctx.session.lastTransactionIds = savedIds;

            // Send success message
            const message = TransactionFormatter.formatMultipleTransactionsSuccess(transactions) + `\n\n${parsed.message}`;
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
        if (!ctx.session.pendingTransactions) {
            return { success: false, error: new Error("No pending transactions") };
        }

        const { account, parsed, usage, rawMessage } = ctx.session.pendingTransactions;

        try {
            const periodId = await resolvePeriodId(account.userId);
            if (!periodId) {
                // SAITAMA UX: Blunt error
                await ctx.reply("❌ Gagal. Periodenya ilang entah kemana.");
                return { success: false, error: new Error("No active period") };
            }

            // Save all transactions
            const savedIds = await this.saveTransactionsToDatabase(
                account.userId,
                periodId,
                parsed.transactions,
                rawMessage,
                account.groupId
            );

            ctx.session.lastTransactionIds = savedIds;
            ctx.session.pendingTransactions = null;

            // Track usage
            if (usage) {
                await trackAiUsage({
                    userId: account.userId,
                    model: usage.model ?? "unknown",
                    operation: "confirm_multiple_transactions",
                    inputTokens: usage.inputTokens ?? 0,
                    outputTokens: usage.outputTokens ?? 0,
                });
            }

            // Send summary
            const message = TransactionFormatter.formatMultipleTransactionsSuccess(parsed.transactions);
            await ctx.editMessageText(message, { parse_mode: "Markdown" });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save confirmed transactions:", error);
            // SAITAMA UX: Serious Series Error
            await ctx.editMessageText("❌ Mode Serius: Gagal Simpen Data.");
            return { success: false, error: error as Error };
        }
    }

    /**
     * Reject pending transactions
     */
    async rejectPendingTransactions(ctx: BotContext): Promise<TransactionResult> {
        ctx.session.pendingTransactions = null;

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
            // SAITAMA UX: Confused/Bored
            await ctx.reply("Hah? Gak ada yang bisa di-undo. Jangan ngigo.");
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
                // SAITAMA UX: Partial failure
                await ctx.reply("⚠️ Setengah beres, setengah error. Aneh banget dah.");
            } else {
                // Clear session on successful deletion
                ctx.session.lastTransactionIds = [];

                // Send success message
                // SAITAMA UX: Minimalist success
                const count = transactionIds.length;
                const message = count === 1
                    ? "✅ Udah di-undo. Anggap aja gak pernah kejadian."
                    : `✅ ${count} transaksi udah di-undo. Kelar.`;

                await ctx.reply(message);
            }

            return { success };
        } catch (error) {
            logger.error("Failed to undo transactions:", error);
            await ctx.reply("❌ Gagal undo. Eror nih.");
            return { success: false, error: error as Error };
        }
    }

    /**
     * Parse transaction using AI
     */
    async parseTransaction(message: string, periodId?: string) {
        try {
            let budgetContext: { buckets: string[] } | undefined;

            if (periodId) {
                // Dynamic import to avoid circular dependency if any (though service import should be fine)
                const { getBudget } = await import("../services/budget.js");
                const budget = await getBudget(periodId);
                if (budget && budget.buckets) {
                    budgetContext = {
                        buckets: budget.buckets.map(b => b.name)
                    };
                }
            }

            const { result: parsed, usage } = await this.ai.parseTransaction(message, budgetContext);

            logger.info("Transaction parsed", { raw: message, parsed, usage, budgetContext });

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
        rawMessage: string,
        groupId: string | undefined,
    ): Promise<string[]> {
        const savedIds: string[] = [];

        for (const transaction of transactions) {
            const transactionId = await saveTransaction({
                userId,
                periodId,
                transaction,
                rawMessage,
                groupId
            });
            savedIds.push(transactionId);
        }

        return savedIds;
    }

    // =============================================================================
    // GROUP TRANSACTION METHODS (Family tier)
    // =============================================================================

    /**
     * Save a single group transaction with confirmation
     */
    async saveGroupTransactionWithConfirmation(
        ctx: BotContext,
        transaction: any,
        usage: any,
        userId: string,
        groupId: string,
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

            // Ensure group period exists
            const periodId = await resolveGroupPeriodId(groupId);
            if (!periodId) {
                // SAITAMA UX: Blunt Group Error
                await ctx.reply("❌ Gagal bikin periode grup. Bug kali ya?", {
                    reply_to_message_id: ctx.message?.message_id
                });
                return { success: false, error: new Error("No active group period") };
            }

            // Save transaction to database with groupId
            const transactionId = await saveTransaction({
                userId,
                periodId,
                transaction,
                rawMessage,
                groupId,
            });

            // Store last transaction ID in session for undo
            ctx.session.lastTransactionIds.push(transactionId);

            // Format confirmation message for group
            const message = TransactionFormatter.formatTransactionConfirmation(transaction);

            await ctx.reply(message, {
                parse_mode: "Markdown",
                reply_to_message_id: ctx.message?.message_id
            });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save group transaction:", error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Save multiple group transactions with confirmation check
     */
    async saveMultipleGroupTransactionsWithConfirmation(
        ctx: BotContext,
        transactions: any[],
        usage: any,
        userId: string,
        groupId: string,
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

            // Ensure group period exists
            const periodId = await resolveGroupPeriodId(groupId);
            if (!periodId) {
                await ctx.reply("❌ Gagal bikin periode grup. Bug kali ya?", {
                    reply_to_message_id: ctx.message?.message_id
                });
                return { success: false, error: new Error("No active group period") };
            }

            // Check if any transaction needs confirmation
            const lowConfidence = transactions.filter(t => t.confidence < 0.9);

            if (lowConfidence.length > 0) {
                // Store pending transactions for confirmation (with groupId)
                // ctx.session.pendingTransactions = transactions.map(t => ({
                //     ...t,
                //     groupId
                // }));

                // Send confirmation request
                const message = TransactionFormatter.formatMultipleTransactionsConfirmation(
                    transactions,
                );
                const keyboard = TransactionFormatter.getMultipleTransactionsKeyboard();

                await ctx.reply(message, {
                    parse_mode: "Markdown",
                    reply_markup: keyboard,
                    reply_to_message_id: ctx.message?.message_id
                });

                return { success: true, message: "Pending confirmation" };
            }

            // All high confidence - save all immediately
            const savedIds = await this.saveGroupTransactionsToDatabase(
                userId,
                periodId,
                groupId,
                transactions,
                rawMessage
            );

            // Store last batch transaction IDs for bulk undo
            ctx.session.lastTransactionIds.push(...savedIds);

            // Send success message
            const message = TransactionFormatter.formatMultipleTransactionsSuccess(transactions) + `\n\n${aiMessage}`;
            await ctx.reply(message, {
                parse_mode: "Markdown",
                reply_to_message_id: ctx.message?.message_id
            });

            return { success: true, message };
        } catch (error) {
            logger.error("Failed to save multiple group transactions:", error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Helper method to save multiple group transactions
     */
    private async saveGroupTransactionsToDatabase(
        userId: string,
        periodId: string,
        groupId: string,
        transactions: any[],
        rawMessage: string
    ): Promise<string[]> {
        const savedIds: string[] = [];

        for (const transaction of transactions) {
            const transactionId = await saveTransaction({
                userId,
                periodId,
                transaction,
                rawMessage,
                groupId,
            });
            savedIds.push(transactionId);
        }

        return savedIds;
    }
}