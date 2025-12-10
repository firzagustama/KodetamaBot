import type { BotContext } from "../types.js";
import { AIOrchestrator } from "@kodetama/ai";
import { TransactionFormatter } from "../utils/TransactionFormatter.js";
import { TransactionUseCase } from "../useCases/TransactionUseCase.js";
import { GroupRepository } from "../infrastructure/repositories/index.js";
import { getUserByTelegramId } from "../services/index.js";
import { logger } from "../utils/logger.js";

// Initialize shared instances
let ai: AIOrchestrator | null = null;
let transactionUseCase: TransactionUseCase | null = null;
let groupRepo: GroupRepository | null = null;

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
 * Get or create group repository (singleton pattern)
 */
function getGroupRepository(): GroupRepository {
    if (!groupRepo) {
        groupRepo = new GroupRepository();
    }
    return groupRepo;
}

/**
 * Handle messages in group chats (Family tier)
 * Bot only processes messages when mentioned
 */
export async function handleGroupMessage(ctx: BotContext): Promise<void> {
    const message = ctx.message?.text;
    const botInfo = ctx.me;

    if (!message || !botInfo || !ctx.from) return;

    // Check if bot is mentioned
    const botUsername = botInfo.username;
    const isMentioned =
        message.includes(`@${botUsername}`) ||
        message.toLowerCase().startsWith(`${botUsername}`);

    if (!isMentioned) {
        // Bot wasn't mentioned, ignore message
        return;
    }

    // Remove mention from message
    const cleanedMessage = message
        .replace(new RegExp(`@${botUsername}`, "gi"), "")
        .replace(new RegExp(`^${botUsername}\s*`, "i"), "")
        .trim();

    if (!cleanedMessage) {
        await ctx.reply(
            "*Tch.* Mau catat transaksi? Mention gue dulu.\n\n" +
            `Contoh: @${botUsername} makan siang 50rb 💪`,
            { reply_to_message_id: ctx.message?.message_id }
        );
        return;
    }

    try {
        const groupRepo = getGroupRepository();
        const useCase = getTransactionUseCase();

        // Check if group is authorized (exists and is active)
        if (!ctx.chat) {
            await ctx.reply("❌ Tidak dapat mengidentifikasi grup.", {
                reply_to_message_id: ctx.message?.message_id
            });
            return;
        }

        const group = await groupRepo.findByTelegramId(ctx.chat.id);
        if (!group) {
            await ctx.reply(
                "*Tch.* Grup ini belum terdaftar untuk fitur keluarga.\n\n" +
                "Minta owner grup untuk setup dulu ya! 🤷‍♂️",
                { reply_to_message_id: ctx.message?.message_id }
            );
            return;
        }

        // Check if user is registered and member of the group
        const userAccount = await getUserByTelegramId(ctx.from.id);
        if (!userAccount) {
            await ctx.reply(
                "*Tch.* Kamu belum terdaftar. Ketik /start untuk mendaftar terlebih dahulu.",
                { reply_to_message_id: ctx.message?.message_id }
            );
            return;
        }

        // Check if user is a member of this family group
        const isMember = await groupRepo.isUserMember(userAccount.userId, group.id);
        if (!isMember) {
            await ctx.reply(
                "*Tch.* Kamu bukan anggota grup keluarga ini.\n\n" +
                "Minta owner grup untuk invite kamu dulu ya! 👨‍👩‍👧‍👦",
                { reply_to_message_id: ctx.message?.message_id }
            );
            return;
        }

        // Skip commands - these are handled by CommandRegistry regardless of group context
        if (cleanedMessage.startsWith("/")) return;

        // Parse transaction using AI
        const parseResult = await useCase.parseTransaction(cleanedMessage);

        if (!parseResult.success) {
            throw new Error("Failed to parse transaction");
        }

        const { parsed, usage } = parseResult;

        logger.info(`Group transaction parsed for user ${ctx.from.id} in group ${ctx.chat?.id}:`, {
            raw: message,
            cleaned: cleanedMessage,
            parsed,
            usage,
        });

        // Check if it's multiple transactions
        if (parsed?.isMultiple && parsed.transactions && Array.isArray(parsed.transactions)) {
            await useCase.saveMultipleGroupTransactionsWithConfirmation(
                ctx,
                parsed.transactions,
                usage,
                userAccount.userId,
                group.id,
                cleanedMessage,
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
            await ctx.reply(trx.description, { reply_to_message_id: ctx.message?.message_id });
            return;
        }

        // Check if amount needs confirmation (under 1000)
        if (trx.needsConfirmation && trx.suggestedAmount) {
            const { text, keyboard } = TransactionFormatter.formatAmountConfirmation(cleanedMessage, trx);
            await ctx.reply(text, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
                reply_to_message_id: ctx.message?.message_id
            });
            return;
        }

        // Check if transaction needs confirmation due to low confidence
        if (trx.confidence < 0.9) {
            // Store pending transaction
            ctx.session.pendingTransactions.push({
                parsed: trx,
                usage,
                userId: userAccount.userId,
                groupId: group.id,
                rawMessage: cleanedMessage
            });

            // Build and send confirmation message
            const messageText = TransactionFormatter.formatLowConfidenceTransaction(
                trx,
                cleanedMessage,
                parsed?.message ?? ""
            );
            const keyboard = TransactionFormatter.getSingleTransactionKeyboard();

            const fullMessage = trx.confidence < 0.7 ?
                messageText + `\n\n💡 Jika bingung, coba /help` : messageText;

            await ctx.reply(fullMessage, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
                reply_to_message_id: ctx.message?.message_id
            });
            return;
        }

        // High confidence - save immediately
        await useCase.saveGroupTransactionWithConfirmation(
            ctx, trx, usage, userAccount.userId, group.id, cleanedMessage
        );

    } catch (error) {
        logger.error("Failed to parse group transaction:", error);

        await ctx.reply(
            "*Tch, baca juga dong format nya.* 🤷‍♂️\n\n" +
            "Coba kayak gini:\n" +
            "• `makan 20rb`\n" +
            "• `gaji 8jt`\n" +
            "• `bensin 150rb`\n\n" +
            "Atau batch:\n" +
            "```\ncatat\n* gaji 8jt\n* kopi 20rb\n* makan 20rb```",
            {
                parse_mode: "Markdown",
                reply_to_message_id: ctx.message?.message_id
            }
        );
    }
}