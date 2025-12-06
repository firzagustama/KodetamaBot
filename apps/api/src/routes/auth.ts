import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { db } from "@kodetama/db";
import { users, telegramAccounts } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

/**
 * Validate Telegram WebApp initData
 */
function validateTelegramWebAppData(initData: string): { valid: boolean; user?: TelegramUser } {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get("hash");
        params.delete("hash");

        // Sort params alphabetically
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join("\n");

        // Create secret key
        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(BOT_TOKEN)
            .digest();

        // Calculate hash
        const calculatedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");

        if (calculatedHash !== hash) {
            return { valid: false };
        }

        const userStr = params.get("user");
        const user = userStr ? JSON.parse(userStr) as TelegramUser : undefined;

        return { valid: true, user };
    } catch {
        return { valid: false };
    }
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /auth/telegram
     * Validate Telegram WebApp initData and return JWT
     */
    fastify.post<{
        Body: { initData: string };
    }>("/telegram", async (request, reply) => {
        const { initData } = request.body;

        if (!initData) {
            return reply.status(400).send({ error: "initData is required" });
        }

        const { valid, user: telegramUser } = validateTelegramWebAppData(initData);

        if (!valid || !telegramUser) {
            return reply.status(401).send({ error: "Invalid initData" });
        }

        // Look up user by telegram ID
        let telegramAccount = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramUser.id),
        });

        let userId: string;

        if (!telegramAccount) {
            // Create new user and telegram account
            const newUser = await db
                .insert(users)
                .values({
                    tier: "standard",
                    isActive: true,
                })
                .returning();

            userId = newUser[0].id;

            await db.insert(telegramAccounts).values({
                userId,
                telegramId: telegramUser.id,
                username: telegramUser.username ?? null,
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name ?? null,
            });
        } else {
            userId = telegramAccount.userId;

            // Update telegram account info
            await db
                .update(telegramAccounts)
                .set({
                    username: telegramUser.username ?? null,
                    firstName: telegramUser.first_name,
                    lastName: telegramUser.last_name ?? null,
                })
                .where(eq(telegramAccounts.telegramId, telegramUser.id));
        }

        // Get full user record
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        const token = fastify.jwt.sign(
            { id: userId, telegramId: telegramUser.id },
            { expiresIn: "7d" }
        );

        return {
            token,
            user: {
                id: user?.id,
                tier: user?.tier,
                isActive: user?.isActive,
                telegram: {
                    id: telegramUser.id,
                    username: telegramUser.username,
                    firstName: telegramUser.first_name,
                    lastName: telegramUser.last_name,
                },
            },
        };
    });

    /**
     * POST /auth/dev
     * Development only: Authenticate with just a telegram ID
     */
    fastify.post<{
        Body: { telegramId: number };
    }>("/dev", async (request, reply) => {
        // Only allow in development
        if (process.env.NODE_ENV === "production") {
            return reply.status(404).send({ error: "Not found" });
        }

        const { telegramId } = request.body;

        if (!telegramId) {
            return reply.status(400).send({ error: "telegramId is required" });
        }

        // Look up user by telegram ID
        let telegramAccount = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramId),
        });

        let userId: string;

        if (!telegramAccount) {
            // Create new user and telegram account
            const newUser = await db
                .insert(users)
                .values({
                    tier: "standard",
                    isActive: true,
                })
                .returning();

            userId = newUser[0].id;

            await db.insert(telegramAccounts).values({
                userId,
                telegramId,
                username: "dev_user",
                firstName: "Dev User",
                lastName: null,
            });
        } else {
            userId = telegramAccount.userId;
        }

        // Get full user record
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        const token = fastify.jwt.sign(
            { id: userId, telegramId },
            { expiresIn: "7d" }
        );

        return {
            token,
            user: {
                id: user?.id,
                tier: user?.tier,
                isActive: user?.isActive,
                telegram: {
                    id: telegramId,
                    username: telegramAccount?.username ?? "dev_user",
                    firstName: telegramAccount?.firstName ?? "Dev User",
                    lastName: telegramAccount?.lastName,
                },
            },
        };
    });

    /**
     * GET /auth/me
     * Get current authenticated user
     */
    fastify.get("/me", {
        preHandler: async (request, reply) => {
            try {
                await request.jwtVerify();
            } catch {
                return reply.status(401).send({ error: "Unauthorized" });
            }
        },
    }, async (request) => {
        const payload = request.user as { id: string; telegramId: number };

        const user = await db.query.users.findFirst({
            where: eq(users.id, payload.id),
        });

        const telegram = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.userId, payload.id),
        });

        return {
            user: {
                id: user?.id,
                tier: user?.tier,
                isActive: user?.isActive,
                telegram: telegram
                    ? {
                        id: telegram.telegramId,
                        username: telegram.username,
                        firstName: telegram.firstName,
                        lastName: telegram.lastName,
                    }
                    : null,
            },
        };
    });
}
