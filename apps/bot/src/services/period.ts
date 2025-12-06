import { db } from "@kodetama/db";
import { datePeriods } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import { formatPeriodName, getMonthlyPeriodDates } from "@kodetama/shared";

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
export async function ensurePeriodExists(userId: string, date: Date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const periodName = formatPeriodName(date);
    const { start, end } = getMonthlyPeriodDates(year, month);

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
        where: eq(datePeriods.userId, userId),
        orderBy: (periods, { desc }) => desc(periods.startDate),
    });
}
