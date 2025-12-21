import "dotenv/config";

// Core architecture components
import { Bot } from "grammy";
import type { BotContext } from "./types.js";
import {
    BotConfiguration,
    CommandRegistry,
    BotRunner,
    MessageProcessor
} from "./core/index.js";

// Command handlers
import { StartCommand, HelpCommand, BudgetCommand, DashboardCommand, JoinFamilyCommand, LinkFamilyCommand, UndoCommand, SummaryCommand } from "./handlers/commands/index.js";

// Event handlers
import { handleAdminCallback } from "./handlers/admin.js";

// Callback handlers
import { TransactionCallbackHandler } from "./handlers/callbacks/index.js";



// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
}
// After the check, we know BOT_TOKEN is defined
const BOT_TOKEN_STR = BOT_TOKEN as string;

// =============================================================================
// APPLICATION SETUP - Following SOLID Principles
// =============================================================================

async function createBotApplication() {
    // 1. Create bot instance
    const bot = new Bot<BotContext>(BOT_TOKEN_STR);

    // 2. Configure middleware and error handling
    const botConfig = new BotConfiguration(bot);
    botConfig.configureMiddleware();
    botConfig.configureErrorHandling();

    // 3. Create command registry and register handlers (Open/Closed Principle)
    const commandRegistry = new CommandRegistry();
    commandRegistry.register(new StartCommand());
    commandRegistry.register(new HelpCommand());
    commandRegistry.register(new BudgetCommand());
    commandRegistry.register(new DashboardCommand());
    commandRegistry.register(new JoinFamilyCommand());
    commandRegistry.register(new LinkFamilyCommand());
    commandRegistry.register(new UndoCommand());
    commandRegistry.register(new SummaryCommand());

    // 4. Create message processor with command routing
    const messageProcessor = new MessageProcessor(commandRegistry);

    // 5. Create transaction callback handler
    const transactionCallbackHandler = new TransactionCallbackHandler(
        new (await import("./useCases/TransactionUseCase.js")).TransactionUseCase(
            new (await import("@kodetama/ai")).AIOrchestrator({
                apiKey: process.env.OPENROUTER_API_KEY ?? "",
                model: process.env.OPENROUTER_MODEL,
            })
        )
    );

    // 6. Wire up event handlers
    setupEventHandlers(bot, messageProcessor, transactionCallbackHandler);

    return { bot, messageProcessor };
}

function setupEventHandlers(
    bot: Bot<BotContext>,
    messageProcessor: MessageProcessor,
    transactionCallbackHandler: TransactionCallbackHandler
) {
    // Command handling - all commands go through registry
    bot.on("message:text", async (ctx) => {
        const message = ctx.message;
        if (!message?.text) return;

        if (message.text.startsWith("/")) {
            // Handle commands
            await messageProcessor.processCommand(ctx);
        } else {
            // Handle regular messages
            await messageProcessor.processMessage(ctx);
        }
    });

    // Callback query handling
    bot.on("callback_query:data", async (ctx) => {
        const data = ctx.callbackQuery?.data;
        if (!data) return;

        // Admin approval callbacks
        if (data.startsWith("approve_") || data.startsWith("reject_")) {
            await handleAdminCallback(ctx);
            return;
        }

        // Try transaction callback handler first
        if (transactionCallbackHandler.canHandle(ctx)) {
            await transactionCallbackHandler.handle(ctx);
            return;
        }

        // Amount confirmation callbacks
        if (data.startsWith("confirm_amount_")) {
            // TODO: Handle amount confirmation - could be moved to a separate handler
            await ctx.answerCallbackQuery("Konfirmasi diterima!");
            return;
        }

        // Education callbacks
        if (data === "setup_budget") {
            await ctx.answerCallbackQuery();
            await ctx.reply("Oke, ayo atur budget! Ketik /budget untuk mulai.");
            return;
        }

        if (data === "dismiss_education") {
            await ctx.answerCallbackQuery("Oke, nanti aja.");
            await ctx.deleteMessage();
            return;
        }

        await ctx.answerCallbackQuery();
    });

    // Voice message handler (Pro tier)
    bot.on("message:voice", async (ctx) => {
        await ctx.reply(
            "Fitur voice note untuk tier Pro akan segera hadir! 🎤\n" +
            "Untuk saat ini, silakan ketik transaksi secara manual."
        );
    });

    // Document/photo handler (invoice upload, Pro tier)
    bot.on(["message:document", "message:photo"], async (ctx) => {
        await ctx.reply(
            "Fitur upload invoice untuk tier Pro akan segera hadir! 📄\n" +
            "Untuk saat ini, silakan ketik transaksi secara manual."
        );
    });
}



// =============================================================================
// APPLICATION STARTUP
// =============================================================================

async function main() {
    try {
        // Create the bot application using dependency injection pattern
        const { bot } = await createBotApplication();

        // Create bot runner and start the bot
        const runner = new BotRunner(bot, {
            token: BOT_TOKEN_STR,
            mode: process.env.BOT_MODE ?? "polling",
            webhookUrl: process.env.WEBHOOK_URL ?? "",
            port: parseInt(process.env.BOT_PORT || "3000"),
        });

        await runner.run();
    } catch (error) {
        console.error("Failed to start bot:", error);
        process.exit(1);
    }
}

main();