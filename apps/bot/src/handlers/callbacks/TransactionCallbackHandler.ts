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
        return data === "reject_transaction" ||
            data === "confirm_multiple_transactions" ||
            data === "reject_multiple_transactions";
    }

    /**
     * Handle the callback query
     */
    async handle(ctx: BotContext): Promise<void> {
        if (!ctx.callbackQuery?.data) return;

        const data = ctx.callbackQuery.data;

        try {
            switch (data) {
                case "reject_transaction":
                    await this.handleSingleTransactionRejection(ctx);
                    break;
                case "confirm_multiple_transactions":
                    await this.handleMultipleTransactionsConfirmation(ctx);
                    break;
                case "reject_multiple_transactions":
                    await this.handleMultipleTransactionsRejection(ctx);
                    break;
            }
        } catch (error) {
            console.error("Error handling transaction callback:", error);
            await ctx.answerCallbackQuery("❌ Terjadi kesalahan saat memproses permintaan.");
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
}