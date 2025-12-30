import { CommandHandler } from "../../core/CommandHandler.js";
import type { BotContext } from "../../types.js";
import { TransactionUseCase } from "../../useCases/TransactionUseCase.js";

/**
 * Undo Command Handler
 * Handles /undo command to cancel last recorded transactions
 */
export class UndoCommand extends CommandHandler {
    protected commandName = "undo";

    constructor(private transactionUseCase: TransactionUseCase) {
        super();
    }

    async execute(ctx: BotContext): Promise<{ success: boolean; message?: string; error?: Error }> {
        return await this.transactionUseCase.undoLastTransactions(ctx);
    }
}