import type { BotContext } from "../types.js";
import { CommandRegistry } from "./CommandRegistry.js";

/**
 * Processes incoming messages and routes them appropriately
 * Following Single Responsibility Principle - only handles message routing
 */
export class MessageProcessor {
    private readonly commandRegistry: CommandRegistry;
    private readonly groupMessageHandler: (ctx: BotContext) => Promise<void>;
    private readonly transactionHandler: (ctx: BotContext) => Promise<void>;

    constructor(
        commandRegistry: CommandRegistry,
        groupMessageHandler: (ctx: BotContext) => Promise<void>,
        transactionHandler: (ctx: BotContext) => Promise<void>
    ) {
        this.commandRegistry = commandRegistry;
        this.groupMessageHandler = groupMessageHandler;
        this.transactionHandler = transactionHandler;
    }

    /**
     * Process a message context and route it to appropriate handler
     */
    async processMessage(ctx: BotContext): Promise<void> {
        const message = ctx.message;
        if (!message?.text) return;

        // Skip commands - they're handled separately
        if (message.text.startsWith("/")) {
            // Commands are handled by command registry
            return;
        }

        // Route based on context
        if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
            // Group message handler
            await this.groupMessageHandler(ctx);
        } else if (ctx.chat?.type === "private") {
            // Private message - likely transaction parsing
            await this.transactionHandler(ctx);
        }
    }

    /**
     * Handle command messages
     */
    async processCommand(ctx: BotContext): Promise<void> {
        const handler = this.commandRegistry.getHandler(ctx);
        if (handler) {
            await handler.handle(ctx);
        }
    }
}