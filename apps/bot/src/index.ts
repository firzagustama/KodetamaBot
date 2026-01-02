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

// Repositories
import {
    UserRepository,
    GroupRepository,
    DatePeriodRepository,
    BudgetRepository,
    TransactionRepository,
    CategoryRepository,
    PendingRegistrationRepository
} from "./infrastructure/repositories/index.js";

// Services
import { UserService } from "./services/user.js";
import { GroupService } from "./services/group.js";
import { PeriodService } from "./services/period.js";
import { BudgetService } from "./services/budget.js";
import { TransactionService } from "./services/transaction.js";
import { FileService } from "./services/file.js";

// Tool handlers
import {
    ToolExecutor,
    ConfirmTelegramTool,
    InsertTransactionTool,
    DeleteTransactionTool,
    UpsertBucketTool,
    UpdateTransactionTool,
    DeleteBucketTool,
    UpsertPeriodTool,
    GetTransactionHistoryTool,
    GetBudgetStatusTool,
    SearchTransactionsTool,
    GetFinancialSummaryTool
} from "./handlers/tools/index.js";

// Use Cases
import { TransactionUseCase } from "./useCases/TransactionUseCase.js";

// AI
import { AIOrchestrator, ConversationAI } from "@kodetama/ai";

// Command handlers
import {
    StartCommand,
    HelpCommand,
    BudgetCommand,
    DashboardCommand,
    JoinFamilyCommand,
    LinkFamilyCommand,
    UndoCommand,
    SummaryCommand,
    ExportExcelCommand,
    CancelCommand
} from "./handlers/commands/index.js";

// Event handlers
import { createAdminCallbackHandler } from "./handlers/admin.js";
import { TransactionCallbackHandler } from "./handlers/callbacks/index.js";
import { createTransactionHandler } from "./handlers/transaction.js";
import { createGroupMessageHandler } from "./handlers/group.js";
import { Scheduler } from "./utils/Scheduler.js";



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
    // 1. Initialize Repositories
    const userRepository = new UserRepository();
    const groupRepository = new GroupRepository();
    const datePeriodRepository = new DatePeriodRepository();
    const budgetRepository = new BudgetRepository();
    const transactionRepository = new TransactionRepository();
    const categoryRepository = new CategoryRepository();
    const pendingRegistrationRepository = new PendingRegistrationRepository();

    // 2. Initialize Services
    const userService = new UserService(userRepository, pendingRegistrationRepository);
    const groupService = new GroupService(groupRepository);
    const periodService = new PeriodService(datePeriodRepository, budgetRepository);
    const budgetService = new BudgetService(budgetRepository, transactionRepository);
    const transactionService = new TransactionService(
        transactionRepository,
        categoryRepository
    );
    const fileService = new FileService();

    // 3. Initialize AI Services
    const aiConfig = {
        apiKey: process.env.OPENROUTER_API_KEY ?? "",
        model: process.env.OPENROUTER_MODEL,
    };
    const aiOrchestrator = new AIOrchestrator(aiConfig);
    const conversationAI = new ConversationAI(aiConfig);

    // 4. Initialize Use Cases
    const transactionUseCase = new TransactionUseCase(
        aiOrchestrator,
        transactionService,
        periodService,
        budgetService
    );

    // 5. Create bot instance
    const bot = new Bot<BotContext>(BOT_TOKEN_STR);

    // 6. Configure middleware and error handling
    const botConfig = new BotConfiguration(bot, userService, periodService);
    botConfig.configureMiddleware();
    botConfig.configureErrorHandling();

    // 7. Create command registry and register handlers
    const commandRegistry = new CommandRegistry();
    commandRegistry.register(new StartCommand(userService, groupService, periodService, budgetService));
    commandRegistry.register(new HelpCommand());
    commandRegistry.register(new BudgetCommand(periodService, budgetService));
    commandRegistry.register(new DashboardCommand(periodService));
    commandRegistry.register(new JoinFamilyCommand(groupService));
    commandRegistry.register(new LinkFamilyCommand(groupService, userService));
    commandRegistry.register(new UndoCommand(transactionUseCase));
    commandRegistry.register(new SummaryCommand(transactionService, periodService, budgetService));
    commandRegistry.register(new ExportExcelCommand(transactionService, periodService));
    commandRegistry.register(new CancelCommand());

    // 8. Create transaction callback handler
    const transactionCallbackHandler = new TransactionCallbackHandler(transactionUseCase);

    // 10. Create and configure ToolExecutor with all tool handlers
    const toolExecutor = new ToolExecutor(aiOrchestrator);
    toolExecutor.register(new ConfirmTelegramTool());
    toolExecutor.register(new InsertTransactionTool(transactionService, budgetService));
    toolExecutor.register(new DeleteTransactionTool(transactionService));
    toolExecutor.register(new UpsertBucketTool(budgetService));
    toolExecutor.register(new UpdateTransactionTool(transactionService, budgetService));
    toolExecutor.register(new DeleteBucketTool(budgetService));
    toolExecutor.register(new UpsertPeriodTool(periodService));
    toolExecutor.register(new GetTransactionHistoryTool(transactionService));
    toolExecutor.register(new GetBudgetStatusTool(budgetService));
    toolExecutor.register(new SearchTransactionsTool(transactionService));
    toolExecutor.register(new GetFinancialSummaryTool(transactionService));

    // 11. Create transaction handler (factory)
    const transactionHandler = createTransactionHandler(
        conversationAI,
        periodService,
        budgetService,
        userService,
        fileService,
        toolExecutor
    );

    // 12. Create group message handler (factory)
    const groupMessageHandler = createGroupMessageHandler(transactionHandler);

    // 13. Create message processor with handlers
    const messageProcessor = new MessageProcessor(commandRegistry, groupMessageHandler, transactionHandler);

    // 14. Create admin handler
    const adminHandler = createAdminCallbackHandler(userService, periodService, budgetService);

    // LAST Wire up event handlers
    setupEventHandlers(bot, messageProcessor, transactionCallbackHandler, transactionHandler, adminHandler);

    return { bot, messageProcessor };
}

function setupEventHandlers(
    bot: Bot<BotContext>,
    messageProcessor: MessageProcessor,
    transactionCallbackHandler: TransactionCallbackHandler,
    transactionHandler: (ctx: BotContext) => Promise<void>,
    adminHandler: (ctx: BotContext) => Promise<void>
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
            await adminHandler(ctx)
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

        if (data.startsWith("ai_") || data.startsWith("log_invoice_")) {
            await transactionHandler(ctx);
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
        await transactionHandler(ctx);
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

        // Init scheduler
        const scheduler = new Scheduler();
        scheduler.init();
    } catch (error) {
        console.error("Failed to start bot:", error);
        process.exit(1);
    }
}

main();