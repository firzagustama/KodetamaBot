import { CommandHandler } from "../../core/CommandHandler.js";
import type { BotContext } from "../../types.js";
import { TransactionUseCase } from "../../useCases/TransactionUseCase.js";
import { AIOrchestrator } from "@kodetama/ai";

/**
 * Undo Command Handler
 * Handles /undo command to cancel last recorded transactions
 */
export class UndoCommand extends CommandHandler {
    protected commandName = "undo";

    private transactionUseCase: TransactionUseCase;

    constructor() {
        super();
        // Initialize use case (could later be injected via DI)
        const ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL,
        });
        this.transactionUseCase = new TransactionUseCase(ai);
    }

    async execute(ctx: BotContext): Promise<{ success: boolean; message?: string; error?: Error }> {
        return await this.transactionUseCase.undoLastTransactions(ctx);
    }
}