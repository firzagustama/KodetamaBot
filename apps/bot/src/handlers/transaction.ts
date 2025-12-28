import type { BotContext } from "../types.js";
import { ConversationAI } from "@kodetama/ai";
import { getTargetCurrentPeriod } from "../services/period.js";
import { getTargetContext } from "../core/targetContext.js";
import { toolCalls } from "./tools/index.js";
import { InlineKeyboard } from "grammy";
import { saveFileMetadata } from "../services/file.js";
import { getUserByTelegramId } from "../services/user.js";

// Initialize shared instances
let conversationAI: ConversationAI | null = null;

/**
 * Get or create conversation AI (singleton pattern)
 */
function getConversationAI(): ConversationAI {
    if (!conversationAI) {
        conversationAI = new ConversationAI({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL,
        });
    }
    return conversationAI;
}

/**
 * Handle transaction messages in private chat
 */
export async function handleTransaction(ctx: BotContext): Promise<void> {
    const isCallback = ctx.callbackQuery !== undefined;
    const callbackData = ctx.callbackQuery?.data;

    // Handle group confirmation callbacks
    if (isCallback && callbackData?.startsWith("log_invoice_")) {
        const action = callbackData.split("_")[2];
        if (action === "no") {
            await ctx.answerCallbackQuery("Oke, dibatalkan.");
            await ctx.editMessageText("Invoice tidak dicatat.");
            return;
        }
        // If "yes", we continue with processing the image
        if (!ctx.session.pendingFileId) {
            await ctx.answerCallbackQuery("Waduh, filenya udah ilang. Coba upload lagi ya.");
            return;
        }
        await ctx.answerCallbackQuery("Siapp, diproses ya...");
        await ctx.editMessageText("Memproses invoice...");
    }

    await ctx.replyWithChatAction("typing");

    const user = ctx.from;
    if (!user) return;

    const target = await getTargetContext(ctx);
    const period = await getTargetCurrentPeriod(target);

    if (!period) {
        await ctx.reply("Duh, budget belum diatur. Ribet nih. Setup dulu gih biar bisa dicatet.");
        await ctx.conversation.enter("onboardingConversation");
        return;
    }

    // Check tier for image processing
    const account = await getUserByTelegramId(user.id);
    const tier = account?.user?.tier || "standard";

    const isPhoto = ctx.message?.photo !== undefined;
    const isDocument = ctx.message?.document !== undefined;

    if ((isPhoto || isDocument) && tier === "standard") {
        await ctx.reply("Fitur upload invoice cuma buat tier Pro atau Family nih. Upgrade dulu gih! 🚀");
        return;
    }

    // Group confirmation flow
    if ((isPhoto || isDocument) && target.isGroup && !isCallback) {
        const fileId = ctx.message?.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message?.document?.file_id;
        if (fileId) {
            ctx.session.pendingFileId = fileId;
            const keyboard = new InlineKeyboard()
                .text("Ya, Catat", "log_invoice_yes")
                .text("Gak usah", "log_invoice_no");
            await ctx.reply("Wih ada invoice. Mau dicatat sekalian?", { reply_markup: keyboard });
            return;
        }
    }

    // Get message content or image
    let message = isCallback ? ctx.callbackQuery!.data!.split("_")[1] : ctx.message?.text;
    let imageBase64: string | undefined;
    let fileId: string | undefined;

    if (isPhoto || isDocument || (isCallback && callbackData === "log_invoice_yes")) {
        const telegramFileId = ctx.session.pendingFileId || (ctx.message?.photo ? ctx.message?.photo[ctx.message?.photo.length - 1].file_id : ctx.message?.document?.file_id);
        if (telegramFileId) {
            try {
                const file = await ctx.api.getFile(telegramFileId);
                const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

                // Download and convert to base64
                const response = await fetch(url);
                const buffer = await response.arrayBuffer();
                imageBase64 = Buffer.from(buffer).toString("base64");

                // Save metadata
                fileId = await saveFileMetadata({
                    userId: target.userId,
                    periodId: period.id,
                    fileName: ctx.message?.document?.file_name || `photo_${Date.now()}.jpg`,
                    fileType: ctx.message?.document?.mime_type || "image/jpeg",
                    fileSize: file.file_size || 0,
                    telegramFileId: telegramFileId,
                });

                ctx.session.pendingFileId = undefined; // Clear after use
                message = "Tolong catat transaksi dari invoice ini.";
            } catch (error) {
                console.error("Error processing file:", error);
                await ctx.reply("Waduh, gagal proses filenya. Coba lagi deh.");
                return;
            }
        }
    }

    if (!message && !imageBase64) return;

    const ai = getConversationAI();
    let messages = await ai.buildPrompt(target, period);

    if (imageBase64) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: message || "Catat transaksi ini" },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBase64}`,
                    },
                },
            ],
        } as any);
    } else {
        messages.push({ role: "user", content: message! });
    }

    const MAX_ITERATIONS = 5;
    let iteration = 0;

    try {
        while (iteration < MAX_ITERATIONS) {
            iteration++;

            const response = await ai.generateResponse(messages);

            if (!response) {
                await ctx.reply("Hmm... sistem lagi sibuk. 🤔 Coba lagi nanti deh.");
                break;
            }

            // Add assistant message to history
            messages.push(response);

            // Handle tool calls
            if (response.tool_calls && response.tool_calls.length > 0) {
                // Inject fileId into upsertTransaction arguments if available
                if (fileId) {
                    for (const toolCall of response.tool_calls) {
                        if (toolCall.function.name === "upsertTransaction") {
                            const args = JSON.parse(toolCall.function.arguments);
                            if (args.input && Array.isArray(args.input)) {
                                args.input = args.input.map((item: any) => ({ ...item, fileId }));
                                toolCall.function.arguments = JSON.stringify(args);
                            }
                        }
                    }
                }

                const toolResults = await toolCalls(
                    response.tool_calls,
                    target,
                    period,
                    ctx
                );

                // Add tool results to messages
                messages.push(...toolResults);

                if (response.tool_calls[0].function.name === "confirmTelegram") {
                    await ai.setTargetContext(target, messages);
                    break;
                }

                // Continue loop to get AI response after tool execution
                continue;
            }

            // Final response - send to user
            if (response.content) {
                await ctx.reply(response.content);
                if (isCallback) {
                    await ctx.answerCallbackQuery();
                }
                await ai.setTargetContext(target, messages);
            }

            break; // Exit loop after sending response
        }

        if (iteration >= MAX_ITERATIONS) {
            await ctx.reply("Waduh, kepikiran terlalu lama. 😑 Coba chat lagi ya.");
        }
    } catch (error: any) {
        console.error("Error in handleTransaction:", error);
        await ctx.reply("Anjir sistem lagi sibuk. 💥 Coba lagi nanti ya.");
    }
}