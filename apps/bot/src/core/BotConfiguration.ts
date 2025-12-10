import { Bot, session, GrammyError, HttpError } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { hydrate } from "@grammyjs/hydrate";
import { sequentialize } from "@grammyjs/runner";
import type { BotContext, SessionData } from "../types.js";
import { registrationConversation } from "../conversations/registration.js";
import { onboardingConversation } from "../conversations/onboarding.js";

/**
 * Configuration class for bot setup
 * Extracts configuration logic following Single Responsibility Principle
 */
export class BotConfiguration {
    private readonly bot: Bot<BotContext>;

    constructor(bot: Bot<BotContext>) {
        this.bot = bot;
    }

    /**
     * Configure middleware for the bot
     */
    configureMiddleware(): void {
        // Session management
        this.configureSession();

        // Core middleware
        this.bot.use(hydrate());

        // Conversations
        this.configureConversations();
    }

    /**
     * Configure session middleware
     */
    private configureSession(): void {
        function getSessionKey(ctx: BotContext): string | undefined {
            return ctx.chat?.id.toString();
        }

        this.bot.use(
            sequentialize(getSessionKey),
            session({
                initial: (): SessionData => ({
                    step: "idle",
                    registrationData: null,
                    onboardingData: null,
                    lastTransactionIds: [],
                    pendingTransactions: [],
                }),
            })
        );
    }

    /**
     * Configure conversation middleware
     */
    private configureConversations(): void {
        this.bot.use(conversations());
        this.bot.use(createConversation(registrationConversation));
        this.bot.use(createConversation(onboardingConversation));
    }

    /**
     * Configure error handling
     */
    configureErrorHandling(): void {
        this.bot.catch((err) => {
            const ctx = err.ctx;
            const e = err.error;

            console.error(`Error handling update ${ctx.update.update_id}:`);

            if (e instanceof GrammyError) {
                console.error(`Grammy error: ${e.description}`);
            } else if (e instanceof HttpError) {
                console.error(`HTTP error: ${e.error}`);
            } else {
                console.error(`Unknown error: ${e}`);
            }
        });
    }
}