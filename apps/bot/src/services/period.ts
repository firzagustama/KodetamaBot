import { db } from "@kodetama/db";
import { datePeriods, budgets, buckets } from "@kodetama/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { formatPeriodName, getMonthlyPeriodDates, getCustomPeriodDates, TargetContext, Period } from "@kodetama/shared";

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
export async function resolveGroupPeriodId(groupId: string) {
    const currentPeriod = await getCurrentGroupPeriod(groupId);
    return currentPeriod?.id;
}

/**
 * Get current period based on TargetContext
 */
export async function getTargetCurrentPeriod(target: TargetContext): Promise<Period | undefined> {
    return await db.query.datePeriods.findFirst({
        where: and(
            eq(datePeriods.isCurrent, true),
            target.groupId ?
                eq(datePeriods.groupId, target.groupId) :
                eq(datePeriods.userId, target.userId!)
        ),
        with: {
            budget: {
                with: {
                    buckets: true
                }
            }
        }
    })
}

/**
 * Get current period for group, optionally checking user's income settings
 */
export async function getCurrentGroupPeriod(groupId: string) {
    // First try to find existing current group period
    const currentPeriod = await db.query.datePeriods.findFirst({
        where: and(
            eq(datePeriods.groupId, groupId),
            eq(datePeriods.isCurrent, true)
        ),
    });

    return currentPeriod;
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

// =============================================================================
// AI TOOL: UPSERT PERIOD WITH BUDGET COPY
// =============================================================================

export interface UpsertPeriodOptions {
    name?: string;
    incomeDate?: number;
    makeCurrent?: boolean;
    copyFromPrevious?: boolean;
}

/**
 * Create or update a period for AI tool, optionally copying budget from previous period
 */
export async function upsertPeriodWithBudget(
    target: TargetContext,
    options: UpsertPeriodOptions = {}
): Promise<{ periodId: string; budgetCopied: boolean }> {
    const date = options.name ? new Date(options.name) : new Date();
    const incomeDate = options.incomeDate ?? 1;
    const copyFromPrevious = options.copyFromPrevious ?? true;

    // Create the period
    let periodId: string;
    if (target.groupId) {
        periodId = await ensureGroupPeriodExists(target.groupId, date, incomeDate);
    } else {
        periodId = await ensurePeriodExists(target.userId!, date, incomeDate);
    }

    // Check if budget already exists for this period
    const existingBudget = await db.query.budgets.findFirst({
        where: eq(budgets.periodId, periodId),
    });

    if (existingBudget) {
        return { periodId, budgetCopied: false };
    }

    // If copyFromPrevious, find the previous period's budget
    if (copyFromPrevious) {
        const previousPeriod = await db.query.datePeriods.findFirst({
            where: and(
                target.groupId
                    ? eq(datePeriods.groupId, target.groupId)
                    : eq(datePeriods.userId, target.userId!),
            ),
            orderBy: [desc(datePeriods.createdAt)],
            with: {
                budget: {
                    with: {
                        buckets: true,
                    },
                },
            },
        });

        if (previousPeriod?.budget) {
            // Create new budget with same estimated income
            const [newBudget] = await db.insert(budgets).values({
                periodId: periodId,
                estimatedIncome: previousPeriod.budget.estimatedIncome,
            }).returning({ id: budgets.id });

            // Copy all buckets
            if (previousPeriod.budget.buckets.length > 0) {
                await db.insert(buckets).values(
                    previousPeriod.budget.buckets.map(bucket => ({
                        budgetId: newBudget.id,
                        name: bucket.name,
                        description: bucket.description,
                        icon: bucket.icon,
                        amount: bucket.amount,
                        category: bucket.category,
                        isSystem: bucket.isSystem,
                    }))
                );
            }

            return { periodId, budgetCopied: true };
        }
    }

    return { periodId, budgetCopied: false };
}