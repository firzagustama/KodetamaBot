import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import {
    isUserRegistered,
} from "../../services/index.js";

/**
 * Handles /start command - registration and welcome flow
 */
export class StartCommand extends CommandHandler {
    protected readonly commandName = "start";

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        const user = ctx.from;
        if (!user) {
            return { success: false, error: new Error("No user information") };
        }

        // Check if user is already registered
        let isRegistered = false;
        try {
            isRegistered = await isUserRegistered(user.id);
        } catch (error) {
            console.error("Error checking registration:", error);
            return { success: false, error: error as Error };
        }

        if (!isRegistered) {
            // Start registration conversation
            await ctx.conversation.enter("registrationConversation");
            return { success: true };
        }

        // Get target context for period resolution
        const target = await getTargetContext(ctx);
        console.log("target", target);
        const currentPeriod = await this.resolvePeriodId(target);
        if (!currentPeriod) {
            // Start onboarding - use context-appropriate message
            const onboardingMessage = target.isGroup
                ? "Sepertinya grup ini belum memiliki budget yang diatur. Mari kita setup dulu untuk mulai mencatat transaksi grup!"
                : "Sepertinya kamu belum mengatur budget. Mari kita setup dulu!";
            await ctx.reply(onboardingMessage);
            await ctx.conversation.enter("onboardingConversation");
            return { success: true };
        }

        // Build keyboard with Mini App if URL is configured
        const keyboard = new InlineKeyboard();
        let hasWebApp = false;

        const WEB_APP_URL = process.env.WEB_APP_URL;
        if (WEB_APP_URL) {
            try {
                // Basic validation to prevent obvious crashes
                new URL(WEB_APP_URL);
                keyboard.webApp("Dashboard", WEB_APP_URL);
                hasWebApp = true;
            } catch (e) {
                console.warn(`Invalid WEB_APP_URL: ${WEB_APP_URL}`);
            }
        }

        const welcomeMessage =
            "Selamat datang kembali! 👋\n\n" +
            "Kamu bisa langsung mencatat transaksi dengan mengirim pesan seperti:\n" +
            "• `makan 20rb` - pengeluaran\n" +
            "• `gaji 8jt` - pemasukan\n\n" +
            "Atau gunakan menu untuk fitur lainnya.";

        try {
            await ctx.reply(welcomeMessage, {
                parse_mode: "Markdown",
                reply_markup: hasWebApp ? keyboard : undefined,
            });
            return { success: true };
        } catch (error) {
            // Fallback if Telegram rejects the button (e.g. invalid URL)
            console.warn("Failed to send welcome message with keyboard, retrying without:", error);
            await ctx.reply(welcomeMessage, {
                parse_mode: "Markdown",
            });
            return { success: true };
        }
    }

    private async resolvePeriodId(target: { targetId: string; isGroup: boolean; userId: string }): Promise<string | null> {
        // Import here to avoid circular dependency
        const { getCurrentPeriod, getCurrentGroupPeriod } = await import("../../services/index.js");
        const period = target.isGroup
            ? await getCurrentGroupPeriod(target.targetId, target.userId)
            : await getCurrentPeriod(target.targetId);
        return period?.id ?? null;
    }
}

// Import InlineKeyboard here to avoid import issues
import { InlineKeyboard } from "grammy";