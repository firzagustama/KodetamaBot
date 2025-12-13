import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { db } from "@kodetama/db";
import { users, telegramAccounts, groups, familyMembers } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { loggingMiddleware } from "../middleware/loggingMiddleware.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

interface TelegramChat {
    id: number;
    type: string;
}

interface TelegramWidgetData {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

/**
 * Validate Telegram WebApp initData (for Mini App)
 */
function validateTelegramWebAppData(initData: string): { valid: boolean; user?: TelegramUser; chat?: TelegramChat } {
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

        const chatStr = params.get("chat");
        const chat = chatStr ? JSON.parse(chatStr) as TelegramChat : undefined;

        return { valid: true, user, chat };
    } catch {
        return { valid: false };
    }
}

/**
 * Verify Telegram Login Widget authentication
 * Based on: https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramWidget(data: TelegramWidgetData): boolean {
    const { hash, ...userData } = data;

    // Create data-check-string
    const dataCheckString = Object.keys(userData)
        .sort()
        .map((key) => `${key}=${userData[key as keyof typeof userData]}`)
        .join("\n");

    // Create secret key from bot token
    const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();

    // Create hash
    const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    // Compare hashes
    return hmac === hash;
}

/**
 * Check if auth data is not too old (24 hours default)
 */
function isAuthDataFresh(authDate: number, maxAgeSeconds: number = 86400): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now - authDate < maxAgeSeconds;
}

/**
 * Find or create user in database
 */
async function findOrCreateUser(telegramUser: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
}): Promise<{ userId: string; isNewUser: boolean }> {
    // Look up user by telegram ID
    let telegramAccount = await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.telegramId, telegramUser.id),
    });

    let userId: string;
    let isNewUser = false;

    if (!telegramAccount) {
        logger.info("Creating new user account", {
            telegramUserId: telegramUser.id,
            username: telegramUser.username
        });

        const newUser = await db
            .insert(users)
            .values({
                tier: "standard",
                isActive: true,
            })
            .returning();

        userId = newUser[0].id;
        isNewUser = true;

        await db.insert(telegramAccounts).values({
            userId,
            telegramId: telegramUser.id,
            username: telegramUser.username ?? null,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name ?? null,
        });

        logger.info("New user created successfully", {
            userId,
            telegramUserId: telegramUser.id
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
            .where(eq(telegramAccounts.telegramId, telegramUser.id))
            .catch((err) => {
                logger.error("Failed to update telegram account", {
                    userId,
                    telegramUserId: telegramUser.id,
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            });
    }

    return { userId, isNewUser };
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /auth/telegram
     * Validate Telegram WebApp initData (Mini App) and return JWT
     */
    fastify.post<{
        Body: { initData: string; startParam: string };
    }>("/telegram", {
        preHandler: [loggingMiddleware],
    }, async (request, reply) => {
        const { initData, startParam } = request.body;

        if (!initData) {
            return reply.status(400).send({ error: "initData is required" });
        }

        const { valid, user: telegramUser, chat: telegramChat } = validateTelegramWebAppData(initData);

        if (!valid || !telegramUser) {
            return reply.status(401).send({ error: "Invalid initData" });
        }

        const user = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramUser.id),
        });
        if (!user) {
            return reply.status(403).send({ error: "User not found" });
        }

        try {
            const { userId } = await findOrCreateUser(telegramUser);

            // Get full user record
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });

            if (!user) {
                logger.error("User record not found after authentication", { userId, telegramUserId: telegramUser.id });
                return reply.status(500).send({ error: "User account not found" });
            }

            // Determine target context for JWT
            let targetId = userId;
            let targetType: "user" | "group" = "user";

            if (startParam) {
                // Check if group exists and user is member
                const group = await db.query.groups.findFirst({
                    where: eq(groups.id, startParam),
                });

                if (group) {
                    // Check if user is member of the group
                    const member = await db.query.familyMembers.findFirst({
                        where: and(
                            eq(familyMembers.groupId, group.id),
                            eq(familyMembers.userId, userId)
                        ),
                    });

                    const isMember = member !== undefined;

                    if (isMember) {
                        targetId = group.id;
                        targetType = "group";
                    }
                }
            }

            const token = fastify.jwt.sign(
                { id: userId, telegramId: telegramUser.id, targetId, targetType },
                { expiresIn: "7d" }
            );

            return {
                token,
                user: {
                    id: user.id,
                    tier: user.tier,
                    isActive: user.isActive,
                    telegram: {
                        id: telegramUser.id,
                        username: telegramUser.username,
                        firstName: telegramUser.first_name,
                        lastName: telegramUser.last_name,
                    },
                },
                context: {
                    targetId,
                    targetType,
                },
            };
        } catch (err) {
            logger.error("Failed to authenticate user", {
                telegramUserId: telegramUser.id,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
            return reply.status(500).send({ error: "Failed to authenticate user" });
        }
    });

    /**
     * POST /auth/telegram-widget
     * Authenticate user via Telegram Login Widget (Website)
     */
    fastify.post<{
        Body: TelegramWidgetData;
    }>("/telegram-widget", {
        preHandler: [loggingMiddleware],
    }, async (request, reply) => {
        const authData = request.body;
        const clientIP = request.ip || 'unknown';
        const userAgent = request.headers['user-agent'] || 'unknown';

        logger.info("Telegram Widget auth attempt", {
            ip: clientIP,
            userAgent,
            telegramUserId: authData.id
        });

        // Validate required fields
        if (!authData.id || !authData.first_name || !authData.auth_date || !authData.hash) {
            logger.warn("Widget auth failed: missing required fields", { ip: clientIP });
            return reply.status(400).send({
                error: "Missing required fields",
            });
        }

        // Verify the authentication
        const isValid = verifyTelegramWidget(authData);
        if (!isValid) {
            logger.warn("Widget auth failed: invalid hash", {
                ip: clientIP,
                telegramUserId: authData.id
            });
            return reply.status(401).send({
                error: "Invalid authentication data",
            });
        }

        // Check if auth data is fresh (not older than 24 hours)
        if (!isAuthDataFresh(authData.auth_date)) {
            logger.warn("Widget auth failed: auth data too old", {
                ip: clientIP,
                telegramUserId: authData.id,
                authDate: authData.auth_date
            });
            return reply.status(401).send({
                error: "Authentication data is too old",
            });
        }

        logger.info("Widget auth validation successful", {
            ip: clientIP,
            telegramUserId: authData.id,
            username: authData.username
        });

        try {
            const { userId, isNewUser } = await findOrCreateUser({
                id: authData.id,
                first_name: authData.first_name,
                last_name: authData.last_name,
                username: authData.username,
            });

            // Get full user record
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });

            if (!user) {
                logger.error("User record not found after widget authentication", {
                    userId,
                    telegramUserId: authData.id
                });
                return reply.status(500).send({ error: "User account not found" });
            }

            const token = fastify.jwt.sign(
                { id: userId, telegramId: authData.id },
                { expiresIn: "30d" } // Longer expiry for widget login
            );

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    tier: user.tier,
                    isActive: user.isActive,
                    telegram: {
                        id: authData.id,
                        username: authData.username,
                        firstName: authData.first_name,
                        lastName: authData.last_name,
                        photoUrl: authData.photo_url,
                    },
                },
            };
        } catch (err) {
            logger.error("Failed to authenticate widget user", {
                telegramUserId: authData.id,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
            return reply.status(500).send({ error: "Failed to authenticate user" });
        }
    });

    /**
     * GET /auth/me
     * Get current authenticated user
     */
    fastify.get("/me", {
        preHandler: [async (request, reply) => {
            try {
                await request.jwtVerify();
            } catch (err) {
                logger.warn("JWT verification failed in /auth/me", {
                    ip: request.ip,
                    error: err instanceof Error ? err.message : 'Unknown JWT error'
                });
                return reply.status(401).send({ error: "Unauthorized" });
            }
        }, loggingMiddleware],
    }, async (request, reply) => {
        const payload = request.user as { id: string; telegramId: number };

        try {
            const user = await db.query.users.findFirst({
                where: eq(users.id, payload.id),
            });

            const telegram = await db.query.telegramAccounts.findFirst({
                where: eq(telegramAccounts.userId, payload.id),
            });

            if (!user) {
                logger.error("User not found in /auth/me", {
                    userId: payload.id,
                    telegramId: payload.telegramId
                });
                return reply.status(403).send({ error: "User not found" });
            }

            return {
                user: {
                    id: user.id,
                    tier: user.tier,
                    isActive: user.isActive,
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
        } catch (err) {
            logger.error("Database error in /auth/me", {
                userId: payload.id,
                error: err instanceof Error ? err.message : 'Unknown database error'
            });
            return { error: "Internal server error" };
        }
    });
}