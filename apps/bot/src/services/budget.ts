import { deleteBucketParams, UpsertBucketParams } from "@kodetama/ai";
import { db } from "@kodetama/db";
import { buckets, budgets, transactions } from "@kodetama/db/schema";
import { Period } from "@kodetama/shared";
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

export async function getBuckets(periodId: string) {
    const budget = await getBudget(periodId);
    if (!budget) {
        return null;
    }
    return await db.query.buckets.findMany({
        where: eq(buckets.budgetId, budget.id),
    });
}

async function createSplitBuckets(budgetId: string, needsAmount: number, wantsAmount: number, savingsAmount: number) {
    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Needs",
        description: "Essentials like rent, food, and utilities",
        icon: "Home",
        amount: needsAmount.toString(),
        category: "needs",
        isSystem: false,
    });

    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Wants",
        description: "Non-essential expenses like entertainment and shopping",
        icon: "ShoppingBag",
        amount: wantsAmount.toString(),
        category: "wants",
        isSystem: false,
    });

    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Savings",
        description: "Money set aside for future expenses",
        icon: "PiggyBank",
        amount: savingsAmount.toString(),
        category: "savings",
        isSystem: false,
    });
}

async function createUnallocatedBucket(budgetId: string, amount: number) {
    await db.insert(buckets).values({
        budgetId: budgetId,
        name: "Unallocated",
        description: "Dana belum dialokasikan",
        icon: "Wallet", // Using Wallet icon for unallocated
        amount: amount.toString(),
        category: null,
        isSystem: true,
    });
}

export async function upsertBucket(periodId: string, data: UpsertBucketParams) {
    const icon = data.category === "needs" ? "Home" : data.category === "wants" ? "ShoppingBag" : "PiggyBank";
    if (data.amount <= 0) {
        throw new Error("Amount must be greater than 0");
    }

    if (data.bucketId) {
        await db.update(transactions).set({
            bucket: data.name,
        }).where(and(eq(transactions.bucket, data.name), eq(transactions.periodId, periodId)));

        await db.update(buckets).set({
            name: data.name,
            description: data.description,
            amount: data.amount.toString(),
            category: data.category,
            icon: icon,
            isSystem: false,
        }).where(eq(buckets.id, data.bucketId));
    } else {
        const budget = await getBudget(periodId);
        let budgetId: string;
        if (!budget) {
            budgetId = await upsertBudget({
                periodId: periodId,
                estimatedIncome: 0,
            });
        } else {
            budgetId = budget.id;
        }

        await db.insert(buckets).values({
            budgetId: budgetId,
            name: data.name,
            description: data.description,
            amount: data.amount.toString(),
            category: data.category,
            icon: icon,
            isSystem: false,
        });
    }
}

export async function deleteBucket(period: Period, data: deleteBucketParams) {
    if (data.confidence < 0.8) {
        throw new Error("Confidence must be greater than or equal 0.8, confirmationMessage: " + data.confirmationMessage);
    }
    const bucket = await db.query.buckets.findMany({
        where: and(eq(buckets.name, data.name), eq(buckets.budgetId, period.budget!.id)),
    });
    if (!bucket || bucket.length === 0) {
        throw new Error("Bucket not found");
    } else if (bucket.length > 1) {
        throw new Error("Multiple buckets found: " + bucket.map(b => `${b.name} (${b.description})`).join("\n"));
    }

    await db.update(transactions).set({
        bucket: data.moveBucket,
    }).where(and(eq(transactions.bucket, bucket[0].name), eq(transactions.periodId, period.id)));
    await db.delete(buckets).where(eq(buckets.id, bucket[0].id));
}