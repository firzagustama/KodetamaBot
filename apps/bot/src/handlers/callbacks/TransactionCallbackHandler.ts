import type { BotContext } from "../../types.js";
import { TransactionUseCase } from "../../useCases/TransactionUseCase.js";

/**
 * Handles transaction-related callback queries
 * Following Single Responsibility Principle - only handles transaction callbacks
 */
export class TransactionCallbackHandler {
    private transactionUseCase: TransactionUseCase;

    constructor(transactionUseCase: TransactionUseCase) {
        this.transactionUseCase = transactionUseCase;
    }

    /**
     * Check if this handler can handle the callback
     */
    canHandle(ctx: BotContext): boolean {
        if (!ctx.callbackQuery?.data) return false;

        const data = ctx.callbackQuery.data;
        return data === "confirm_transaction" ||
               data === "reject_transaction" ||
               data === "confirm_multiple_transactions" ||
               data === "reject_multiple_transactions" ||
               data.startsWith("confirm_amount_");
    }

    /**
     * Handle the callback query
     */
    async handle(ctx: BotContext): Promise<void> {
        if (!ctx.callbackQuery?.data) return;

        const data = ctx.callbackQuery.data;

        try {
            switch (data) {
                case "confirm_transaction":
                    await this.handleSingleTransactionConfirmation(ctx);
                    break;
                case "reject_transaction":
                    await this.handleSingleTransactionRejection(ctx);
                    break;
                case "confirm_multiple_transactions":
                    await this.handleMultipleTransactionsConfirmation(ctx);
                    break;
                case "reject_multiple_transactions":
                    await this.handleMultipleTransactionsRejection(ctx);
                    break;
                default:
                    if (data.startsWith("confirm_amount_")) {
                        await this.handleAmountConfirmation(ctx, data);
                    }
            }
        } catch (error) {
            console.error("Error handling transaction callback:", error);
            await ctx.answerCallbackQuery("❌ Terjadi kesalahan saat memproses permintaan.");
        }
    }

    private async handleSingleTransactionConfirmation(ctx: BotContext): Promise<void> {
        const result = await this.transactionUseCase.confirmSinglePendingTransaction(ctx);
        if (result.success) {
            await ctx.answerCallbackQuery("✅ Transaksi dikonfirmasi!");
        }
    }

    private async handleSingleTransactionRejection(ctx: BotContext): Promise<void> {
        await this.transactionUseCase.rejectPendingTransactions(ctx);
        await ctx.answerCallbackQuery("Transaksi dibatalkan.");
    }

    private async handleMultipleTransactionsConfirmation(ctx: BotContext): Promise<void> {
        const result = await this.transactionUseCase.confirmPendingTransactions(ctx);
        if (result.success) {
            await ctx.answerCallbackQuery("✅ Transaksi dikonfirmasi!");
        }
    }

    private async handleMultipleTransactionsRejection(ctx: BotContext): Promise<void> {
        await this.transactionUseCase.rejectPendingTransactions(ctx);
        await ctx.answerCallbackQuery("Transaksi dibatalkan.");
    }

    private async handleAmountConfirmation(ctx: BotContext, data: string): Promise<void> {
        // Extract amount from callback data
        const amountStr = data.replace("confirm_amount_", "");
        const amount = parseInt(amountStr);

        if (isNaN(amount)) {
            await ctx.answerCallbackQuery("❌ Jumlah tidak valid.");
            return;
        }

        // Update the pending transaction with confirmed amount
        if (ctx.session.pendingTransactions && ctx.session.pendingTransactions[0]) {
            ctx.session.pendingTransactions[0].parsed.amount = amount;
            ctx.session.pendingTransactions[0].parsed.needsConfirmation = false;
            delete ctx.session.pendingTransactions[0].parsed.suggestedAmount;
        }

        // Confirm the transaction with updated amount
        const result = await this.transactionUseCase.confirmSinglePendingTransaction(ctx);
        if (result.success) {
            await ctx.answerCallbackQuery("✅ Jumlah dikonfirmasi!");
        }
    }
}