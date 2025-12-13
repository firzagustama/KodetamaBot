import { Bot } from "grammy";
import type { BotContext } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Handles bot startup and lifecycle management
 * Following Single Responsibility Principle
 */
export class BotRunner {
    private readonly bot: Bot<BotContext>;
    private readonly token: string;
    private readonly mode: string;
    private readonly webhookUrl?: string;
    private readonly port?: number;

    constructor(bot: Bot<BotContext>, config: {
        token: string;
        mode?: string;
        webhookUrl?: string;
        port?: number;
    }) {
        this.bot = bot;
        this.token = config.token;
        this.mode = config.mode ?? "polling";
        this.webhookUrl = config.webhookUrl;
        this.port = config.port ?? 3000;
    }

    /**
     * Validate configuration
     */
    validateConfig(): void {
        if (!this.token) {
            throw new Error("TELEGRAM_BOT_TOKEN is required");
        }

        if (this.mode === "webhook" && !this.webhookUrl) {
            throw new Error("WEBHOOK_URL is required for webhook mode");
        }
    }

    /**
     * Set bot commands menu
     */
    private async setBotCommands(): Promise<void> {
        await this.bot.api.setMyCommands([
            { command: "start", description: "Mulai atau registrasi" },
            { command: "help", description: "Bantuan penggunaan" },
            { command: "dashboard", description: "Dashboard" },
            // { command: "budget", description: "Lihat budget bulan ini" },
            // { command: "summary", description: "Ringkasan transaksi" },
            { command: "undo", description: "Batalkan transaksi terakhir" },
            // { command: "wallet", description: "Lihat saldo wallet" },
            // { command: "export", description: "Export ke Google Sheets" },
            { command: "join_family", description: "Join family" },
            { command: "link_family", description: "Hubungkan grup telegram" },
            // { command: "cancel", description: "Batalkan percakapan" },
        ]);

        logger.info("Bot commands menu set");
    }

    /**
     * Start bot in polling mode
     */
    private startPolling(): void {
        this.bot.start();
        logger.info("Bot is running with polling...");
    }

    /**
     * Start bot in webhook mode
     */
    private async startWebhook(): Promise<void> {
        const { createServer } = await import("http");
        const { webhookCallback } = await import("grammy");

        const server = createServer(webhookCallback(this.bot, "http"));
        const PORT = this.port;

        server.on("error", (err) => {
            logger.error("Bot webhook server error:", err);
        });

        server.listen(PORT, "0.0.0.0", async () => {
            logger.info(`Bot webhook server listening on port ${PORT}`);

            try {
                // Set webhook after server is ready
                await this.bot.api.setWebhook(this.webhookUrl!);
                logger.info(`Webhook set to ${this.webhookUrl}`);
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
    }

    /**
     * Run the bot
     */
    async run(): Promise<void> {
        this.validateConfig();

        logger.info(`Starting Kodetama Bot in ${this.mode} mode...`);

        // Set bot commands menu
        await this.setBotCommands();

        if (this.mode === "webhook") {
            await this.startWebhook();
        } else {
            this.startPolling();
        }
    }
}