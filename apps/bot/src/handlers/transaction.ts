import type { BotContext } from "../types.js";
import { getTargetContext } from "../core/targetContext.js";
import { InlineKeyboard } from "grammy";
import { IPeriodService, IBudgetService, IUserService, IFileService, IConversationAI } from "@kodetama/shared";
import { ToolExecutor } from "./tools/ToolExecutor.js";

/**
 * Factory to create transaction handler with injected services
 */
export function createTransactionHandler(
    conversationAI: IConversationAI,
    periodService: IPeriodService,
    budgetService: IBudgetService,
    userService: IUserService,
    fileService: IFileService,
    toolExecutor: ToolExecutor
) {
    return async (ctx: BotContext): Promise<void> => {
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
                await ctx.deleteMessage();
                return;
            }
            await ctx.answerCallbackQuery("Siapp, diproses ya...");
            await ctx.editMessageText("Memproses invoice...");
        }

        await ctx.replyWithChatAction("typing");

        const user = ctx.from;
        if (!user) return;

        const target = ctx.targetContext || await getTargetContext(ctx);
        const targetId = target.groupId || target.userId!;
        let period = ctx.periodContext || await periodService.getCurrentPeriod(targetId);

        // Silent Setup: If no period, create one
        if (!period) {
            const now = new Date();
            const incomeDate = 1; // Default
            const periodId = await periodService.ensurePeriodExists(targetId, now, incomeDate);

            // Create default unallocated budget
            await budgetService.upsertBudget({
                periodId: periodId,
                estimatedIncome: 0,
            });

            // Fetch the newly created period
            period = await periodService.getCurrentPeriod(targetId);
        }

        if (!period) {
            // Should not happen after silent setup, but just in case
            await ctx.reply("Ada masalah sistem saat setup budget otomatis. Coba lagi nanti ya.");
            return;
        }

        // Check tier for image processing
        const userContext = await userService.getUserByTelegramId(user.id);
        const tier = (userContext as any)?.user?.tier || "standard";

        const isPhoto = ctx.message?.photo !== undefined;
        const isDocument = ctx.message?.document !== undefined;

        if ((isPhoto || isDocument) && tier === "standard") {
            await ctx.reply("Fitur upload invoice cuma buat tier Pro atau Family nih. Upgrade dulu gih! 🚀");
            return;
        }

        // Group confirmation flow
        if ((isPhoto || isDocument) && target.isGroup && !isCallback) {
            const fileId = ctx.message?.photo ? ctx.message.photo[ctx.message.photo.length - 2].file_id : ctx.message?.document?.file_id;
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
                    fileId = await fileService.saveFileMetadata({
                        userId: target.userId!,
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

        let messages = await conversationAI.buildPrompt(target, period);

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
            // Answer callback query early to prevent timeout
            if (isCallback) {
                await ctx.answerCallbackQuery("Diproses ya...");
            }

            while (iteration < MAX_ITERATIONS) {
                iteration++;

                const response = await conversationAI.generateResponse(messages);

                if (!response) {
                    await ctx.reply("Hmm... sistem lagi sibuk. 🤔 Coba lagi nanti deh.");
                    await conversationAI.setTargetContext(target, messages);
                    break;
                }

                // Add assistant message to history
                messages.push(response);

                // Handle tool calls
                if (response.tool_calls && response.tool_calls.length > 0) {
                    // Inject fileId into insertTransaction arguments if available
                    if (fileId) {
                        for (const toolCall of response.tool_calls) {
                            if (toolCall.function.name === "insertTransaction") {
                                const args = JSON.parse(toolCall.function.arguments);
                                if (args.input && Array.isArray(args.input)) {
                                    args.input = args.input.map((item: any) => ({ ...item, fileId }));
                                    toolCall.function.arguments = JSON.stringify(args);
                                }
                            }
                        }
                    }

                    try {
                        const toolResults = await toolExecutor.execute(
                            response.tool_calls,
                            target,
                            period,
                            ctx
                        );

                        // Add tool results to messages
                        messages.push(...toolResults);

                        // Save context after tool execution
                        await conversationAI.setTargetContext(target, messages);

                        // Continue loop to get AI response after tool execution
                        continue;
                    } catch (toolError) {
                        console.error("Error executing tools:", toolError);
                        await ctx.reply("Waduh, ada error waktu eksekusi tools. 🔧 Coba lagi ya.");
                        await conversationAI.setTargetContext(target, messages);
                        break;
                    }
                }

                // Final response (or text-only response) - send to user
                if (response.content) {
                    await ctx.reply(response.content);
                }

                // Save context after successful completion
                await conversationAI.setTargetContext(target, messages);
                break; // Exit loop after sending final response
            }

            // Check if we hit max iterations (loop exited naturally without break)
            if (iteration >= MAX_ITERATIONS) {
                await ctx.reply("Waduh, kepikiran terlalu lama. 😑 Coba chat lagi ya.");
                await conversationAI.setTargetContext(target, messages);
            }
        } catch (error: any) {
            console.error("Error in handleTransaction:", error);
            await ctx.reply("Anjir sistem lagi sibuk. 💥 Coba lagi nanti ya.");
            // Try to save context even on unexpected errors
            try {
                await conversationAI.setTargetContext(target, messages);
            } catch (saveError) {
                console.error("Failed to save context after error:", saveError);
            }
        }
    };
}