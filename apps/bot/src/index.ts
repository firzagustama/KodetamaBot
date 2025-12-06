import "dotenv/config";
import { Bot, session, GrammyError, HttpError, InlineKeyboard } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { hydrate } from "@grammyjs/hydrate";
import { run, sequentialize } from "@grammyjs/runner";
import type { BotContext, SessionData } from "./types.js";
import { registrationConversation } from "./conversations/registration.js";
import { onboardingConversation } from "./conversations/onboarding.js";
import { handleTransaction } from "./handlers/transaction.js";
import { handleGroupMessage } from "./handlers/group.js";
import { handleAdminCallback } from "./handlers/admin.js";
import { logger } from "./utils/logger.js";
import { formatRupiah } from "@kodetama/shared";
import {
    isUserRegistered,
    getUserByTelegramId,
    getBudgetSummary,
    getLastTransaction,
    deleteTransaction,
    getPeriodTotals,
    resolvePeriodId,
    getCurrentPeriod,
    saveTransaction,
    trackAiUsage,
} from "./services/index.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const BOT_MODE = process.env.BOT_MODE ?? "polling";
const WEB_APP_URL = process.env.WEB_APP_URL;

// =============================================================================
// BOT SETUP
// =============================================================================

const bot = new Bot<BotContext>(BOT_TOKEN);

// Session middleware
function getSessionKey(ctx: BotContext): string | undefined {
    return ctx.chat?.id.toString();
}

bot.use(
    sequentialize(getSessionKey),
    session({
        initial: (): SessionData => ({
            step: "idle",
            registrationData: null,
            onboardingData: null,
            lastTransactionId: null,
            pendingTransaction: null,
        }),
    })
);

// Hydrate for edit/reply helpers
bot.use(hydrate());

// Conversations middleware
bot.use(conversations());
bot.use(createConversation(registrationConversation));
bot.use(createConversation(onboardingConversation));

/**
 * Save transaction to DB and send confirmation message
 */
async function saveAndConfirmTransaction(
    ctx: BotContext,
    parsed: any,
    usage: any,
    userId: string,
    rawMessage: string
): Promise<void> {
    // Ensure period exists and get period ID
    const periodId = await resolvePeriodId(userId);
    if (!periodId) {
        await ctx.reply("Sepertinya kamu belum mengatur budget. Mari kita setup dulu!");
        await ctx.conversation.enter("onboardingConversation");
        return;
    }

    // Save transaction to database
    const transactionId = await saveTransaction({
        userId,
        periodId,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        bucket: parsed.bucket,
        rawMessage,
        aiConfidence: parsed.confidence,
    });

    // Store last transaction ID in session for undo
    ctx.session.lastTransactionId = transactionId;

    // Track AI usage
    if (usage) {
        await trackAiUsage({
            userId,
            model: usage.model ?? "unknown",
            operation: "parse_transaction",
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
        });
    }

    // Build confirmation message
    const bucketEmoji: Record<string, string> = {
        needs: "🏠",
        wants: "🎮",
        savings: "💵",
    };

    await ctx.reply(
        `*Transaksi Tercatat!*\n\n` +
        `📝 *${parsed.description}*
` +
        `💰 Jumlah: ${formatRupiah(parsed.amount)}\n` +
        `📂 Kategori: ${parsed.category}\n` +
        `${bucketEmoji[parsed.bucket] ?? "📦"} Bucket: ${parsed.bucket}\n` +
        `_Ketik /undo untuk membatalkan_\n\n` +
        `${parsed.message}`,
        { parse_mode: "Markdown" }
    );
}

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

bot.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    // Check if user is already registered
    let isRegistered = false;
    try {
        isRegistered = await isUserRegistered(user.id);
    } catch (error) {
        logger.error("Error checking registration:", error);
    }

    if (!isRegistered) {
        await ctx.conversation.enter("registrationConversation");
    } else {
        // Check if user has completed onboarding (has active period)
        const account = await getUserByTelegramId(user.id);
        if (account) {
            const currentPeriod = await resolvePeriodId(account.userId);
            if (!currentPeriod) {
                await ctx.reply("Sepertinya kamu belum mengatur budget. Mari kita setup dulu!");
                await ctx.conversation.enter("onboardingConversation");
                return;
            }
        }

        // Build keyboard with Mini App if URL is configured
        const keyboard = new InlineKeyboard();
        let hasWebApp = false;

        if (WEB_APP_URL) {
            try {
                // Basic validation to prevent obvious crashes
                new URL(WEB_APP_URL);
                keyboard.webApp("📊 Buka Dashboard", WEB_APP_URL);
                hasWebApp = true;
            } catch (e) {
                logger.warn(`Invalid WEB_APP_URL: ${WEB_APP_URL}`);
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
        } catch (error) {
            // Fallback if Telegram rejects the button (e.g. invalid URL)
            logger.warn("Failed to send welcome message with keyboard, retrying without:", error);
            await ctx.reply(welcomeMessage, {
                parse_mode: "Markdown",
            });
        }
    }
});

bot.command("help", async (ctx) => {
    await ctx.reply(
        "🤖 *Kodetama Bot - Asisten Keuangan*\n\n" +
        "*Cara Mencatat Transaksi:*\n" +
        "Kirim pesan natural seperti:\n" +
        "• `makan 20rb` → pengeluaran makanan\n" +
        "• `gaji 8jt` → pemasukan gaji\n" +
        "• `bensin 150rb` → pengeluaran transportasi\n" +
        "• `transfer ke mama 500k` → transfer\n\n" +
        "*Format Angka:*\n" +
        "• `rb` atau `ribu` = ribuan (20rb = 20.000)\n" +
        "• `jt` atau `juta` = jutaan (1,5jt = 1.500.000)\n" +
        "• `k` = ribuan (500k = 500.000)\n\n" +
        "*Perintah:*\n" +
        "/start - Mulai atau registrasi\n" +
        "/help - Bantuan\n" +
        "/budget - Lihat budget\n" +
        "/summary - Ringkasan bulan ini\n" +
        "/undo - Batalkan transaksi terakhir\n" +
        "/wallet - Lihat saldo\n" +
        "/export - Export ke Google Sheets\n" +
        "/cancel - Batalkan percakapan",
        { parse_mode: "Markdown" }
    );
});

bot.command("budget", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    try {
        const account = await getUserByTelegramId(user.id);
        if (!account) {
            await ctx.reply("Kamu belum terdaftar. Ketik /start untuk mendaftar.");
            return;
        }

        const period = await getCurrentPeriod(account.userId);
        if (!period) {
            await ctx.reply(
                "Belum ada budget yang diatur.\n" +
                "Buka Dashboard untuk mengatur budget bulan ini."
            );
            return;
        }

        const summary = await getBudgetSummary(account.userId, period.id);
        if (!summary) {
            await ctx.reply(
                "Belum ada budget yang diatur untuk bulan ini.\n" +
                "Buka Dashboard untuk mengatur budget."
            );
            return;
        }

        const progressBar = (percent: number) => {
            const filled = Math.min(Math.floor(percent / 10), 10);
            const empty = 10 - filled;
            const bar = "█".repeat(filled) + "░".repeat(empty);
            const emoji = percent > 90 ? "🔴" : percent > 75 ? "🟡" : "🟢";
            return `${emoji} ${bar} ${percent}%`;
        };

        await ctx.reply(
            `💰 *Budget ${period.name}*\n\n` +
            `📊 *Estimasi Pendapatan:* ${formatRupiah(summary.budget.estimatedIncome)}\n\n` +
            `*🏠 Needs (${summary.budget.needsPercent}%)*\n` +
            `${progressBar(summary.percentage.needs)}\n` +
            `${formatRupiah(summary.spent.needs)} / ${formatRupiah(summary.budget.needs)}\n` +
            `Sisa: ${formatRupiah(summary.remaining.needs)}\n\n` +
            `*🎮 Wants (${summary.budget.wantsPercent}%)*\n` +
            `${progressBar(summary.percentage.wants)}\n` +
            `${formatRupiah(summary.spent.wants)} / ${formatRupiah(summary.budget.wants)}\n` +
            `Sisa: ${formatRupiah(summary.remaining.wants)}\n\n` +
            `*💵 Savings (${summary.budget.savingsPercent}%)*\n` +
            `${progressBar(summary.percentage.savings)}\n` +
            `${formatRupiah(summary.spent.savings)} / ${formatRupiah(summary.budget.savings)}\n` +
            `Sisa: ${formatRupiah(summary.remaining.savings)}`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        logger.error("Error fetching budget:", error);
        await ctx.reply("Terjadi kesalahan saat mengambil data budget.");
    }
});

bot.command("summary", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    try {
        const account = await getUserByTelegramId(user.id);
        if (!account) {
            await ctx.reply("Kamu belum terdaftar. Ketik /start untuk mendaftar.");
            return;
        }

        const period = await getCurrentPeriod(account.userId);
        if (!period) {
            await ctx.reply("Belum ada transaksi yang tercatat bulan ini.");
            return;
        }

        const totals = await getPeriodTotals(account.userId, period.id);

        await ctx.reply(
            `📊 *Ringkasan ${period.name}*\n\n` +
            `📈 *Pemasukan:* ${formatRupiah(totals.income)}\n` +
            `📉 *Pengeluaran:* ${formatRupiah(totals.expense)}\n` +
            `↔️ *Transfer:* ${formatRupiah(totals.transfer)}\n\n` +
            `💰 *Saldo:* ${formatRupiah(totals.balance)}\n\n` +
            `_Ketik /budget untuk melihat detail budget_`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        logger.error("Error fetching summary:", error);
        await ctx.reply("Terjadi kesalahan saat mengambil data ringkasan.");
    }
});

bot.command("undo", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    try {
        const account = await getUserByTelegramId(user.id);
        if (!account) {
            await ctx.reply("Kamu belum terdaftar. Ketik /start untuk mendaftar.");
            return;
        }

        // Get last transaction from session or DB
        const lastTxId = ctx.session.lastTransactionId;
        const lastTx = await getLastTransaction(account.userId);

        if (!lastTx) {
            await ctx.reply("Tidak ada transaksi yang bisa dibatalkan.");
            return;
        }

        // Only allow undo if it matches session or is recent (within 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (lastTx.createdAt < fiveMinutesAgo && lastTx.id !== lastTxId) {
            await ctx.reply(
                "Transaksi terakhir sudah lebih dari 5 menit yang lalu.\n" +
                "Untuk keamanan, hanya transaksi terbaru yang bisa dibatalkan."
            );
            return;
        }

        const deleted = await deleteTransaction(lastTx.id);
        if (deleted) {
            ctx.session.lastTransactionId = null;
            await ctx.reply(
                "✅ *Transaksi Dibatalkan*\n\n" +
                `📝 ${lastTx.description ?? "Transaksi"}\n` +
                `💰 ${formatRupiah(parseFloat(lastTx.amount))}`,
                { parse_mode: "Markdown" }
            );
        } else {
            await ctx.reply("Gagal membatalkan transaksi.");
        }
    } catch (error) {
        logger.error("Error undoing transaction:", error);
        await ctx.reply("Terjadi kesalahan saat membatalkan transaksi.");
    }
});

bot.command("wallet", async (ctx) => {
    // Placeholder - wallet feature would need additional DB tables
    await ctx.reply(
        "💳 *Fitur Wallet*\n\n" +
        "Fitur ini akan segera hadir!\n\n" +
        "Nantinya kamu bisa:\n" +
        "• Mengelola beberapa rekening/wallet\n" +
        "• Melihat saldo masing-masing\n" +
        "• Mencatat transfer antar wallet",
        { parse_mode: "Markdown" }
    );
});

bot.command("export", async (ctx) => {
    // TODO: Implement Google Sheets export
    await ctx.reply(
        "📤 *Export ke Google Sheets*\n\n" +
        "Fitur ini akan segera hadir!\n\n" +
        "Nantinya kamu bisa:\n" +
        "• Export transaksi ke spreadsheet\n" +
        "• Sinkronisasi otomatis\n" +
        "• Template laporan keuangan",
        { parse_mode: "Markdown" }
    );
});

bot.command("cancel", async (ctx) => {
    await ctx.conversation.exit();
    ctx.session.step = "idle";
    ctx.session.registrationData = null;
    ctx.session.onboardingData = null;
    ctx.session.pendingTransaction = null;

    await ctx.reply(
        "❌ Percakapan dibatalkan.\n\n" +
        "Ketik /start untuk memulai lagi atau langsung kirim transaksi."
    );
});

// =============================================================================
// CALLBACK QUERY HANDLERS
// =============================================================================

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Admin approval callbacks
    if (data.startsWith("approve_") || data.startsWith("reject_")) {
        await handleAdminCallback(ctx);
        return;
    }

    // Amount confirmation callbacks
    if (data.startsWith("confirm_amount_")) {
        // TODO: Handle amount confirmation
        await ctx.answerCallbackQuery("Konfirmasi diterima!");
        return;
    }

    // Transaction confirmation callbacks
    if (data === "confirm_transaction") {
        const { pendingTransaction } = ctx.session;

        if (!pendingTransaction) {
            await ctx.answerCallbackQuery("Tidak ada konfirmasi yang sedang berlangsung.");
            return;
        }

        try {
            await saveAndConfirmTransaction(
                ctx,
                pendingTransaction.parsed,
                pendingTransaction.usage,
                pendingTransaction.userId,
                pendingTransaction.rawMessage
            );

            ctx.session.pendingTransaction = null;
            await ctx.answerCallbackQuery("✅ Transaksi dikonfirmasi!");
        } catch (error) {
            logger.error("Error saving confirmed transaction:", error);
            await ctx.answerCallbackQuery("❌ Terjadi kesalahan saat menyimpan transaksi.");
        }

        return;
    }

    if (data === "reject_transaction") {
        const { pendingTransaction } = ctx.session;

        if (!pendingTransaction) {
            await ctx.answerCallbackQuery("Tidak ada konfirmasi yang sedang berlangsung.");
            return;
        }

        ctx.session.pendingTransaction = null;

        try {
            await ctx.editMessageText(
                `${ctx.callbackQuery.message?.text ?? "Konfirmasi Transaksi"}\n\n❌ *Transaksi Dibatalkan*\n\nSilakan ulangi dengan pesan yang lebih jelas.`,
                { parse_mode: "Markdown" }
            );
            await ctx.answerCallbackQuery("Transaksi dibatalkan.");
        } catch (editError) {
            logger.error("Error editing rejected transaction message:", editError);
            await ctx.answerCallbackQuery("Transaksi dibatalkan.");
        }

        return;
    }

    await ctx.answerCallbackQuery();
});

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

// Group message handler (Family tier)
bot.on("message:text").filter(
    (ctx) => ctx.chat.type === "group" || ctx.chat.type === "supergroup",
    async (ctx) => {
        await handleGroupMessage(ctx);
    }
);

// Private message handler (transaction parsing)
bot.on("message:text").filter(
    (ctx) => ctx.chat.type === "private",
    async (ctx) => {
        await handleTransaction(ctx);
    }
);

// Voice message handler (Pro tier)
bot.on("message:voice", async (ctx) => {
    // TODO: Implement voice transcription
    await ctx.reply(
        "Fitur voice note untuk tier Pro akan segera hadir! 🎤\n" +
        "Untuk saat ini, silakan ketik transaksi secara manual."
    );
});

// Document/photo handler (invoice upload, Pro tier)
bot.on(["message:document", "message:photo"], async (ctx) => {
    // TODO: Implement invoice upload
    await ctx.reply(
        "Fitur upload invoice untuk tier Pro akan segera hadir! 📄\n" +
        "Untuk saat ini, silakan ketik transaksi secara manual."
    );
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    logger.error(`Error handling update ${ctx.update.update_id}:`);

    if (e instanceof GrammyError) {
        logger.error(`Grammy error: ${e.description}`);
    } else if (e instanceof HttpError) {
        logger.error(`HTTP error: ${e.error}`);
    } else {
        logger.error(`Unknown error: ${e}`);
    }
});

// =============================================================================
// SET BOT COMMANDS MENU
// =============================================================================

async function setBotCommands() {
    await bot.api.setMyCommands([
        { command: "start", description: "Mulai atau registrasi" },
        { command: "help", description: "Bantuan penggunaan" },
        { command: "budget", description: "Lihat budget bulan ini" },
        { command: "summary", description: "Ringkasan transaksi" },
        { command: "undo", description: "Batalkan transaksi terakhir" },
        { command: "wallet", description: "Lihat saldo wallet" },
        { command: "export", description: "Export ke Google Sheets" },
        { command: "cancel", description: "Batalkan percakapan" },
    ]);

    // Set Menu Button to Web App if URL is configured
    if (process.env.WEB_APP_URL) {
        try {
            await bot.api.setChatMenuButton({
                menu_button: {
                    type: "web_app",
                    text: "📊 Dashboard",
                    web_app: { url: process.env.WEB_APP_URL },
                },
            });
            logger.info("Bot menu button set to Web App");
        } catch (error) {
            logger.error("Failed to set bot menu button:", error);
        }
    }

    logger.info("Bot commands menu set");
}

// =============================================================================
// START BOT
// =============================================================================

async function main() {
    logger.info(`Starting Kodetama Bot in ${BOT_MODE} mode...`);

    // Set bot commands menu
    await setBotCommands();

    if (BOT_MODE === "webhook") {
        // Webhook mode for production
        const WEBHOOK_URL = process.env.WEBHOOK_URL;
        if (!WEBHOOK_URL) {
            throw new Error("WEBHOOK_URL is required for webhook mode");
        }

        // Start webhook server
        const { createServer } = await import("http");
        const { webhookCallback } = await import("grammy");

        const server = createServer(webhookCallback(bot, "http"));
        const PORT = parseInt(process.env.BOT_PORT ?? "3000");

        server.on("error", (err) => {
            logger.error("Bot webhook server error:", err);
        });

        server.listen(PORT, "0.0.0.0", async () => {
            logger.info(`Bot webhook server listening on port ${PORT}`);

            try {
                // Set webhook after server is ready
                await bot.api.setWebhook(WEBHOOK_URL);
                logger.info(`Webhook set to ${WEBHOOK_URL}`);
            } catch (err) {
                logger.error("Failed to set webhook:", err);
            }
        });

        // Graceful shutdown
        const stop = (signal: string) => {
            logger.info(`Stopping bot (received ${signal})...`);
            server.close();
            process.exit(0);
        };
        process.once("SIGINT", () => stop("SIGINT"));
        process.once("SIGTERM", () => stop("SIGTERM"));

        // Global error handlers
        process.on("uncaughtException", (err) => {
            logger.error("Uncaught Exception:", err);
        });
        process.on("unhandledRejection", (reason) => {
            logger.error("Unhandled Rejection:", reason);
        });
    } else {
        // Polling mode for development
        await bot.api.deleteWebhook();
        run(bot);
        logger.info("Bot is running with polling...");
    }
}

main().catch((err) => {
    logger.error("Failed to start bot:", err);
    process.exit(1);
});