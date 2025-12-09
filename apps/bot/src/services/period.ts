import { db } from "@kodetama/db";
import { datePeriods } from "@kodetama/db/schema";
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
