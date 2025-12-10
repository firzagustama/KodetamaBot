import type { BotContext } from "../types.js";
import { CommandHandler } from "./CommandHandler.js";

/**
 * Registry for managing command handlers
 * Implements Open/Closed Principle - new commands can be added without modifying existing code
 */
export class CommandRegistry {
    private handlers: CommandHandler[] = [];

    /**
     * Register a command handler
     */
    register(handler: CommandHandler): void {
        // Check for duplicates
        if (this.handlers.some(h => h["commandName"] === handler["commandName"])) {
            throw new Error(`Command handler for '${handler["commandName"]}' is already registered`);
        }
        this.handlers.push(handler);
    }

    /**
     * Find and return handler for the given context
     */
    getHandler(ctx: BotContext): CommandHandler | null {
        return this.handlers.find(handler => handler.canHandle(ctx)) || null;
    }

    /**
     * Get all registered command names (for help, logging, etc.)
     */
    getRegisteredCommands(): string[] {
        return this.handlers.map(handler => handler["commandName"]);
    }

    /**
     * Get handler by command name
     */
    getHandlerByName(commandName: string): CommandHandler | null {
        return this.handlers.find(handler => handler["commandName"] === commandName) || null;
    }

    /**
     * Remove a command handler
     */
    unregister(commandName: string): boolean {
        const index = this.handlers.findIndex(handler => handler["commandName"] === commandName);
        if (index !== -1) {
            this.handlers.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Clear all handlers
     */
    clear(): void {
        this.handlers = [];
    }
}