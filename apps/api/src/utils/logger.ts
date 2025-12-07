import * as fs from "fs";
import * as path from "path";

const LOG_DIR = process.env.LOG_DIR ?? "./logs";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[LOG_LEVEL as LogLevel];
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? " " + args.map((a) => JSON.stringify(a)).join(" ") : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
}

function writeToFile(level: LogLevel, formatted: string): void {
    const filename = level === "error" ? "api-error.log" : "api-info.log";
    const filepath = path.join(LOG_DIR, filename);
    fs.appendFileSync(filepath, formatted + "\n");
}

export const logger = {
    debug(message: string, ...args: unknown[]): void {
        if (shouldLog("debug")) {
            const formatted = formatMessage("debug", message, ...args);
            console.debug(formatted);
            writeToFile("debug", formatted);
        }
    },

    info(message: string, ...args: unknown[]): void {
        if (shouldLog("info")) {
            const formatted = formatMessage("info", message, ...args);
            console.log(formatted);
            writeToFile("info", formatted);
        }
    },

    warn(message: string, ...args: unknown[]): void {
        if (shouldLog("warn")) {
            const formatted = formatMessage("warn", message, ...args);
            console.warn(formatted);
            writeToFile("warn", formatted);
        }
    },

    error(message: string, ...args: unknown[]): void {
        if (shouldLog("error")) {
            const formatted = formatMessage("error", message, ...args);
            console.error(formatted);
            writeToFile("error", formatted);
        }
    },
};