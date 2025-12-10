import { db } from "@kodetama/db";
import { budgets, transactions } from "@kodetama/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Get budget for a period
 */
export async function getBudget(periodId: string) {
    return await db.query.budgets.findFirst({
        where: eq(budgets.periodId, periodId),
    });
}

/**
 * Get budget summary with spending data
 * @param targetId - User ID (personal) or Group ID (family)
 * @param periodId - Period ID
 * @param isGroupContext - Whether this is for a group budget
 */
export async function getBudgetSummary(targetId: string, periodId: string, isGroupContext = false) {
    // Get budget
    const budget = await getBudget(periodId);

    if (!budget) {
        return null;
    }

    // Get spending by bucket - filter by target context
    const spending = await db
        .select({
            bucket: transactions.bucket,
            total: sql<number>`sum(${transactions.amount}::numeric)`.as("total"),
        })
        .from(transactions)
        .where(
            and(
                isGroupContext
                    ? eq(transactions.groupId, targetId)
                    : eq(transactions.userId, targetId),
                eq(transactions.periodId, periodId),
                eq(transactions.type, "expense")
            )
        )
        .groupBy(transactions.bucket);

    const needsSpent = spending.find(s => s.bucket === "needs")?.total ?? 0;
    const wantsSpent = spending.find(s => s.bucket === "wants")?.total ?? 0;
    const savingsSpent = spending.find(s => s.bucket === "savings")?.total ?? 0;

    const needsBudget = parseFloat(budget.needsAmount);
    const wantsBudget = parseFloat(budget.wantsAmount);
    const savingsBudget = parseFloat(budget.savingsAmount);

    return {
        budget: {
            estimatedIncome: parseFloat(budget.estimatedIncome),
            needs: needsBudget,
            wants: wantsBudget,
            savings: savingsBudget,
            needsPercent: budget.needsPercentage,
            wantsPercent: budget.wantsPercentage,
            savingsPercent: budget.savingsPercentage,
        },
        spent: {
            needs: needsSpent,
            wants: wantsSpent,
            savings: savingsSpent,
            total: needsSpent + wantsSpent + savingsSpent,
        },
        remaining: {
            needs: needsBudget - needsSpent,
            wants: wantsBudget - wantsSpent,
            savings: savingsBudget - savingsSpent,
        },
        percentage: {
            needs: needsBudget > 0 ? Math.round((needsSpent / needsBudget) * 100) : 0,
            wants: wantsBudget > 0 ? Math.round((wantsSpent / wantsBudget) * 100) : 0,
            savings: savingsBudget > 0 ? Math.round((savingsSpent / savingsBudget) * 100) : 0,
        },
    };
}

/**
 * Create or update budget
 */
export async function upsertBudget(data: {
    periodId: string;
    estimatedIncome: number;
    needsPercent: number;
    wantsPercent: number;
    savingsPercent: number;
}) {
    const needsAmount = Math.round(data.estimatedIncome * (data.needsPercent / 100));
    const wantsAmount = Math.round(data.estimatedIncome * (data.wantsPercent / 100));
    const savingsAmount = Math.round(data.estimatedIncome * (data.savingsPercent / 100));

    const existing = await getBudget(data.periodId);

    if (existing) {
        await db.update(budgets)
            .set({
                estimatedIncome: data.estimatedIncome.toString(),
                needsAmount: needsAmount.toString(),
                wantsAmount: wantsAmount.toString(),
                savingsAmount: savingsAmount.toString(),
                needsPercentage: data.needsPercent.toString(),
                wantsPercentage: data.wantsPercent.toString(),
                savingsPercentage: data.savingsPercent.toString(),
                updatedAt: new Date(),
            })
            .where(eq(budgets.id, existing.id));

        return existing.id;
    }

    const [newBudget] = await db.insert(budgets).values({
        periodId: data.periodId,
        estimatedIncome: data.estimatedIncome.toString(),
        needsAmount: needsAmount.toString(),
        wantsAmount: wantsAmount.toString(),
        savingsAmount: savingsAmount.toString(),
        needsPercentage: data.needsPercent.toString(),
        wantsPercentage: data.wantsPercent.toString(),
        savingsPercentage: data.savingsPercent.toString(),
    }).returning({ id: budgets.id });

    return newBudget.id;
}