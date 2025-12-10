import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { TransactionFormatter } from "../utils/TransactionFormatter.js";
import { TransactionUseCase } from "../useCases/TransactionUseCase.js";
import { logger } from "../utils/logger.js";
import { getUserByTelegramId } from "../services/index.js";

// Initialize shared instances
let ai: AIOrchestrator | null = null;
let transactionUseCase: TransactionUseCase | null = null;

/**
 * Get or create AI orchestrator (singleton pattern)
 */
function getAiOrchestrator(): AIOrchestrator {
    if (!ai) {
        ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL,
        });
    }
    return ai;
}

/**
 * Get or create transaction use case (singleton pattern)
 */
function getTransactionUseCase(): TransactionUseCase {
    if (!transactionUseCase) {
        const aiOrchestrator = getAiOrchestrator();
        transactionUseCase = new TransactionUseCase(aiOrchestrator);
    }
    return transactionUseCase;
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

        // Get use case instance
        const useCase = getTransactionUseCase();

        // Parse transaction using AI
        const parseResult = await useCase.parseTransaction(message);

        if (!parseResult.success) {
            throw new Error("Failed to parse transaction");
        }

        const { parsed, usage } = parseResult;

        logger.info(`Transaction parsed for user ${user.id}`, {
            raw: message,
            parsed,
            usage,
        });

        // Check if it's multiple transactions
        if (parsed?.isMultiple && parsed.transactions && Array.isArray(parsed.transactions)) {
            await useCase.saveMultipleTransactionsWithConfirmation(
                ctx,
                parsed.transactions,
                usage,
                account.userId,
                message,
                parsed.message ?? ""
            );
            return;
        }

        const trx = parsed?.transactions?.[0];
        if (!trx) {
            throw new Error("No transaction data found");
        }

        // Handle single transaction (existing logic)
        if (trx.type === "other") {
            await ctx.reply(trx.description);
            return;
        }

        // Check if amount needs confirmation (under 1000)
        if (trx.needsConfirmation && trx.suggestedAmount) {
            const { text, keyboard } = TransactionFormatter.formatAmountConfirmation(message, trx);
            await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
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

            // Build and send confirmation message
            const messageText = TransactionFormatter.formatLowConfidenceTransaction(
                trx,
                message,
                parsed?.message ?? ""
            );
            const keyboard = TransactionFormatter.getSingleTransactionKeyboard();

            const fullMessage = trx.confidence < 0.7 ?
                messageText + `\n\n💡 Jika bingung, coba /help` : messageText;

            await ctx.reply(fullMessage, {
                parse_mode: "Markdown",
                reply_markup: keyboard
            });
            return;
        }

        // High confidence - save immediately
        await useCase.saveTransactionWithConfirmation(ctx, trx, usage, account.userId, message);
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