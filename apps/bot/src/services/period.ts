import { db } from "@kodetama/db";
import { datePeriods, telegramAccounts } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import { formatPeriodName, getMonthlyPeriodDates, getCustomPeriodDates } from "@kodetama/shared";

/**
 * Get current periodId for user
 */
export async function resolvePeriodId(userId: string) {
    const currentPeriod = await getCurrentPeriod(userId);
    return currentPeriod?.id;
}

/**
 * Get current period for user
 */
export async function getCurrentPeriod(userId: string) {
    return await db.query.datePeriods.findFirst({
        where: and(
            eq(datePeriods.userId, userId),
            eq(datePeriods.isCurrent, true)
        ),
    });
}

/**
 * Get or create period for a specific month
 */
export async function ensurePeriodExists(
    userId: string,
    date: Date = new Date(),
    incomeDate: number = 1
): Promise<string> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const periodName = formatPeriodName(date);

    // Use custom period dates if income date is not 1
    const { start, end } = incomeDate === 1
        ? getMonthlyPeriodDates(year, month)
        : getCustomPeriodDates(year, month, incomeDate);

    // Check if period exists
    const existing = await db.query.datePeriods.findFirst({
        where: and(
            eq(datePeriods.userId, userId),
            eq(datePeriods.name, periodName)
        ),
    });

    if (existing) {
        return existing.id;
    }

    // Unset current flag on all periods
    await db.update(datePeriods)
        .set({ isCurrent: false })
        .where(eq(datePeriods.userId, userId));

    // Create new period
    const [newPeriod] = await db.insert(datePeriods).values({
        userId,
        name: periodName,
        startDate: start,
        endDate: end,
        isCurrent: true,
    }).returning({ id: datePeriods.id });

    return newPeriod.id;
}

/**
 * Get all periods for user
 */
export async function getUserPeriods(userId: string) {
    return await db.query.datePeriods.findMany({
        where: and(eq(datePeriods.userId, userId), eq(datePeriods.isCurrent, true))
    });
}

// =============================================================================
// GROUP PERIOD FUNCTIONS (Family tier)
// =============================================================================

/**
 * Get current periodId for group
 */
export async function resolveGroupPeriodId(groupId: string, userId?: string) {
    const currentPeriod = await getCurrentGroupPeriod(groupId, userId);
    return currentPeriod?.id;
}

/**
 * Get current period for group, optionally checking user's income settings
 */
export async function getCurrentGroupPeriod(groupId: string, userId?: string) {
    // First try to find existing current group period
    const currentPeriod = await db.query.datePeriods.findFirst({
        where: and(
            eq(datePeriods.groupId, groupId),
            eq(datePeriods.isCurrent, true)
        ),
    });

    if (currentPeriod) {
        return currentPeriod;
    }

    // If no current period, create one using group owner's or provided user's settings
    // Get the first available user's income settings for period calculation
    const ownerUser = userId ? await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.userId, userId),
        with: {
            user: true
        }
    }) : null;

    const incomeDate = ownerUser?.user?.incomeDate ?? 1;

    // Create period for current date
    const periodId = await ensureGroupPeriodExists(groupId, new Date(), incomeDate);
    return await db.query.datePeriods.findFirst({
        where: eq(datePeriods.id, periodId),
    });
}

/**
 * Get or create period for a specific group and month
 */
export async function ensureGroupPeriodExists(
    groupId: string,
    date: Date = new Date(),
    incomeDate: number = 1
): Promise<string> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const periodName = formatPeriodName(date);

    // Use custom period dates if income date is not 1
    const { start, end } = incomeDate === 1
        ? getMonthlyPeriodDates(year, month)
        : getCustomPeriodDates(year, month, incomeDate);

    // Check if group period exists
    const existing = await db.query.datePeriods.findFirst({
        where: and(
            eq(datePeriods.groupId, groupId),
            eq(datePeriods.name, periodName)
        ),
    });

    if (existing) {
        return existing.id;
    }

    // Unset current flag on all group periods
    await db.update(datePeriods)
        .set({ isCurrent: false })
        .where(eq(datePeriods.groupId, groupId));

    // Create new group period
    const [newPeriod] = await db.insert(datePeriods).values({
        groupId,
        name: periodName,
        startDate: start,
        endDate: end,
        isCurrent: true,
    }).returning({ id: datePeriods.id });

    return newPeriod.id;
}