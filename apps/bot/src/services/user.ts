import { db } from "@kodetama/db";
import { users, telegramAccounts, pendingRegistrations } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import type { Tier } from "@kodetama/shared";

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(telegramId: number) {
    const account = await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.telegramId, telegramId),
    });

    if (!account) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, account.userId),
    });

    return user ? { ...account, userId: account.userId, user } : null;
}

/**
 * Check if user is registered
 */
export async function isUserRegistered(telegramId: number): Promise<boolean> {
    const account = await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.telegramId, telegramId),
    });

    if (!account) return false;

    const user = await db.query.users.findFirst({
        where: eq(users.id, account.userId),
    });

    return user !== undefined && user.isActive === true;
}

/**
 * Create new user with Telegram account
 */
export async function createUser(data: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    tier: Tier;
}): Promise<string> {
    const [user] = await db.insert(users).values({
        tier: data.tier,
        isActive: true,
    }).returning({ id: users.id });

    await db.insert(telegramAccounts).values({
        userId: user.id,
        telegramId: data.telegramId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
    });

    return user.id;
}

/**
 * Save pending registration
 */
export async function savePendingRegistration(data: {
    telegramId: number;
    username?: string;
    firstName?: string;
    requestedTier: Tier;
    adminMessageId?: number;
}): Promise<string> {
    const [registration] = await db.insert(pendingRegistrations).values({
        telegramId: data.telegramId,
        username: data.username,
        firstName: data.firstName,
        requestedTier: data.requestedTier,
        adminMessageId: data.adminMessageId,
        status: "pending",
    }).returning({ id: pendingRegistrations.id });

    return registration.id;
}

/**
 * Get pending registration by Telegram ID
 */
export async function getPendingRegistration(telegramId: number) {
    return await db.query.pendingRegistrations.findFirst({
        where: and(
            eq(pendingRegistrations.telegramId, telegramId),
            eq(pendingRegistrations.status, "pending")
        ),
    });
}

/**
 * Update registration status
 */
export async function updateRegistrationStatus(
    telegramId: number,
    status: "approved" | "rejected",
    adminTelegramId: number
) {
    await db.update(pendingRegistrations)
        .set({
            status,
            processedBy: adminTelegramId,
            processedAt: new Date(),
        })
        .where(eq(pendingRegistrations.telegramId, telegramId));
}

/**
 * Approve registration and create user
 */
export async function approveRegistration(
    telegramId: number,
    adminTelegramId: number
): Promise<string | null> {
    const pending = await getPendingRegistration(telegramId);
    if (!pending) return null;

    // Create user
    const userId = await createUser({
        telegramId: pending.telegramId,
        username: pending.username ?? undefined,
        firstName: pending.firstName ?? undefined,
        tier: pending.requestedTier,
    });

    // Update registration status
    await updateRegistrationStatus(telegramId, "approved", adminTelegramId);

    return userId;
}

/**
 * Reject registration
 */
export async function rejectRegistration(
    telegramId: number,
    adminTelegramId: number
): Promise<void> {
    await updateRegistrationStatus(telegramId, "rejected", adminTelegramId);
}

/**
 * Update user income settings
 */
export async function updateUserIncomeSettings(
    userId: string,
    incomeDate: number,
    isIncomeUncertain: boolean
) {
    await db.update(users)
        .set({
            incomeDate,
            isIncomeUncertain,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
}
