import type { BotContext, TransactionData } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { TransactionUseCase } from "../useCases/TransactionUseCase.js";
import { logger } from "../utils/logger.js";
import { getUserByTelegramId } from "../services/index.js";
import { resolvePeriodId } from "../services/period.js";

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
            // SAITAMA: Direct rejection.
            await ctx.reply(
                "Woy, belum daftar kok main nyelonong? Ketik /start dulu sana."
            );
            return;
        }

        // Ensure period exists
        const periodId = await resolvePeriodId(account.userId);
        if (!periodId) {
            // SAITAMA: Annoyed but helpful.
            await ctx.reply("Duh, budget belum diatur. Ribet nih. Setup dulu gih biar bisa dicatet.");
            await ctx.conversation.enter("onboardingConversation");
            return;
        }

        // Get use case instance
        const useCase = getTransactionUseCase();

        // Parse transaction using AI
        const parseResult = await useCase.parseTransaction(message);
        if (!parseResult.success || !parseResult.parsed) {
            throw new Error("Failed to parse transaction");
        }

        const { parsed, usage } = parseResult;

        // User just sent a message, not a transaction
        if (parsed.transactions.length === 0) {
            ctx.reply(parsed.message);
            return;
        }

        const transactionData: TransactionData = {
            account: {
                userId: account.userId,
                periodId: periodId
            },
            parsed,
            usage,
            rawMessage: message
        }
        await useCase.saveMultipleTransactionsWithConfirmation(
            ctx,
            transactionData
        );
        return;
    } catch (error) {
        logger.error("Failed to parse transaction:", error);

        // SAITAMA: Brutally honest instruction. 
        // "Salah tuh" instead of "Error parsing".
        await ctx.reply(
            "*Salah tuh formatnya.* 😑\n" +
            "Ngetik gini aja susah amat:\n\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 150rb`\n\n" +
            "Atau kalo mau banyak:\n" +
            "```\ncatat\n* gaji 8jt\n* kopi 20rb\n* makan 20rb```\n\n" +
            "Udah, gitu doang.",
            { parse_mode: "Markdown" }
        );
    }
}