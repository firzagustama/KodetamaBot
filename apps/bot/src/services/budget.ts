import { db } from "@kodetama/db";
import { buckets, budgets, transactions } from "@kodetama/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Get budget for a period
 */
export async function getBudget(periodId: string) {
    return await db.query.budgets.findFirst({
        where: eq(budgets.periodId, periodId),
        with: {
            buckets: true,
        },
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

    const spendingBuckets = <Record<string, number>>{}
    for (const s of spending) {
        spendingBuckets[s.bucket!] = s.total;
    }
    const bucketDetail = budget.buckets.map(b => {
        return {
            bucket: b.name,
            amount: parseFloat(b.amount),
            spent: spendingBuckets[b.name] ?? 0,
            remaining: parseFloat(b.amount) - (spendingBuckets[b.name] ?? 0),
        };
    });

    return {
        budget: {
            estimatedIncome: parseFloat(budget.estimatedIncome),
            buckets: bucketDetail,
        },
    };
}

/**
 * Create or update budget
 */
export async function upsertBudget(data: {
    periodId: string;
    estimatedIncome: number;
    needsPercent?: number;
    wantsPercent?: number;
    savingsPercent?: number;
}) {
    const existing = await getBudget(data.periodId);

    if (existing) {
        await db.update(budgets)
            .set({
                estimatedIncome: data.estimatedIncome.toString(),
                updatedAt: new Date(),
            })
            .where(eq(budgets.id, existing.id));

        // If percentages are provided, we might want to re-allocate, but for now let's just keep existing buckets
        // Or if it's a new "Unallocated" style, we might need to handle that.
        // For this task, we assume we are creating new budgets with Unallocated.
        // If updating, we might just leave buckets as is for now unless we want to support re-balancing.

        // If it was previously unallocated and now we have percentages, we might want to switch?
        // But the requirement is just to create "Unallocated" for new flows.

        return existing.id;
    }

    const [newBudget] = await db.insert(budgets).values({
        periodId: data.periodId,
        estimatedIncome: data.estimatedIncome.toString(),
    }).returning({ id: budgets.id });

    if (data.needsPercent !== undefined && data.wantsPercent !== undefined && data.savingsPercent !== undefined) {
        const needsAmount = Math.round(data.estimatedIncome * (data.needsPercent / 100));
        const wantsAmount = Math.round(data.estimatedIncome * (data.wantsPercent / 100));
        const savingsAmount = Math.round(data.estimatedIncome * (data.savingsPercent / 100));
        await createSplitBuckets(newBudget.id, needsAmount, wantsAmount, savingsAmount);
    } else {
        await createUnallocatedBucket(newBudget.id, data.estimatedIncome);
    }

    return newBudget.id;
}

async function createSplitBuckets(budgetId: string, needsAmount: number, wantsAmount: number, savingsAmount: number) {
    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Needs",
        description: "Essentials like rent, food, and utilities",
        icon: "Home",
        amount: needsAmount.toString(),
    });

    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Wants",
        description: "Non-essential expenses like entertainment and shopping",
        icon: "ShoppingBag",
        amount: wantsAmount.toString(),
    });

    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Savings",
        description: "Money set aside for future expenses",
        icon: "PiggyBank",
        amount: savingsAmount.toString(),
    });
}

async function createUnallocatedBucket(budgetId: string, amount: number) {
    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Unallocated",
        description: "Dana belum dialokasikan",
        icon: "Wallet", // Using Wallet icon for unallocated
        amount: amount.toString(),
    });
}