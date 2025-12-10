import type { BotContext } from "../types.js";

export interface CommandExecutionResult {
    success: boolean;
    message?: string;
    error?: Error;
}

/**
 * Base class for command handlers implementing Single Responsibility Principle
 * Each command should inherit from this and implement execute()
 */
export abstract class CommandHandler {
    protected abstract readonly commandName: string;

    /**
     * Execute the command logic
     */
    abstract execute(ctx: BotContext): Promise<CommandExecutionResult>;

    /**
     * Check if this handler can handle the given context
     */
    canHandle(ctx: BotContext): boolean {
        const message = ctx.message;
        if (!message?.text) return false;

        // Remove leading slash and split by space to get command name
        const parts = message.text.trim().split(/\s+/);
        let command = parts[0].toLowerCase();

        // Strip @botname suffix for group commands like "/start@botname"
        const atIndex = command.indexOf('@');
        if (atIndex !== -1) {
            command = command.substring(0, atIndex);
        }

        return command === `/${this.commandName}`;
    }

    /**
     * Handle command execution with error wrapping
     */
    async handle(ctx: BotContext): Promise<void> {
        try {
            const result = await this.execute(ctx);
            if (!result.success && result.error) {
                throw result.error;
            }
        } catch (error) {
            console.error(`Error handling command ${this.commandName}:`, error);

            // Send user-friendly error message
            await ctx.reply(
                "Maaf, terjadi kesalahan saat memproses perintah. Silakan coba lagi."
            ).catch(console.error);
        }
    }
}