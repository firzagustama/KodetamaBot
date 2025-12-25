import { CommandHandler } from "../../core/CommandHandler.js";
import type { BotContext } from "../../types.js";

/**
 * Cancel Command Handler
 * Handles /cancel command to exit active conversations and clear state
 */
export class CancelCommand extends CommandHandler {
    protected commandName = "cancel";

    async execute(ctx: BotContext): Promise<{ success: boolean; message?: string; error?: Error }> {
        try {
            // Exit any active conversation
            console.log("Canceling conversation...");
            await ctx.conversation.exit();

            // Clear relevant session data if needed
            ctx.session.step = "idle";
            ctx.session.pendingTransactions = null;

            await ctx.reply("Aksi telah dibatalkan. Kamu sekarang berada di menu utama.");

            return { success: true };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }
}
