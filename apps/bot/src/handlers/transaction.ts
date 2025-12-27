import type { BotContext } from "../types.js";
import { ConversationAI } from "@kodetama/ai";
import { getTargetCurrentPeriod } from "../services/period.js";
import { getTargetContext } from "../core/targetContext.js";
import { toolCalls } from "./tools/index.js";

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

    await ctx.replyWithChatAction("typing");
    const message = isCallback ? ctx.callbackQuery!.data!.split("_")[1] : ctx.message?.text;
    const user = ctx.from;

    if (!message || !user) return;

    const target = await getTargetContext(ctx);
    const period = await getTargetCurrentPeriod(target);

    if (!period) {
        await ctx.reply("Duh, budget belum diatur. Ribet nih. Setup dulu gih biar bisa dicatet.");
        await ctx.conversation.enter("onboardingConversation");
        return;
    }

    const ai = getConversationAI();
    let messages = await ai.buildPrompt(target, period);
    messages.push({ role: "user", content: message });

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