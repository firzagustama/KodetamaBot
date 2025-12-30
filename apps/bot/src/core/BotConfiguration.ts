import { Bot, session, GrammyError, HttpError } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { hydrate } from "@grammyjs/hydrate";
import { sequentialize } from "@grammyjs/runner";
import type { BotContext, SessionData } from "../types.js";
import { createRegistrationConversation } from "../conversations/registration.js";

import { IUserService, IPeriodService } from "@kodetama/shared";
import { createContextMiddleware } from "../middleware/context.js";

/**
 * Configuration class for bot setup
 * Extracts configuration logic following Single Responsibility Principle
 */
export class BotConfiguration {
    private readonly bot: Bot<BotContext>;
    private readonly userService: IUserService;
    private readonly periodService: IPeriodService;

    constructor(bot: Bot<BotContext>, userService: IUserService, periodService: IPeriodService) {
        this.bot = bot;
        this.userService = userService;
        this.periodService = periodService;
    }

    /**
     * Configure middleware for the bot
     */
    configureMiddleware(): void {
        // Session management
        this.configureSession();

        // Core middleware
        this.bot.use(hydrate());
        this.bot.use(createContextMiddleware(this.userService, this.periodService));

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
                    pendingTransactions: null,
                }),
            })
        );
    }

    /**
     * Configure conversation middleware
     */
    private configureConversations(): void {
        const registrationConversation = createRegistrationConversation(this.userService);

        this.bot.use(conversations());
        this.bot.use(createConversation(registrationConversation));
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