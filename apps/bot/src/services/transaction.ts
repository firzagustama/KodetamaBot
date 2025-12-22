import { db } from "@kodetama/db";
import { transactions, categories, aiUsage, budgets } from "@kodetama/db/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import type { TargetContext, TxType } from "@kodetama/shared";
import { UpsertTransactionParams } from "@kodetama/ai";

interface Transaction {
    userId: string;
    periodId: string;
    type: TxType;
    amount: number;
    description?: string;
    category?: string;
    categoryId?: string;
    bucket?: string;
    aiConfidence?: number;
}
export interface SaveTransactionData {
    userId: string;
    periodId: string;
    transaction: Transaction;
    rawMessage?: string;
    groupId?: string;
}

/**
 * Find or create a category and return its ID
 */
async function findOrCreateCategory(
    userId: string | null = null,
    groupId: string | null = null,
    categoryName: string,
    bucket?: string
): Promise<string> {
    // First try to find existing category (case-insensitive)
    const conditions = [ilike(categories.name, categoryName)];

    if (userId) {
        conditions.push(eq(categories.userId, userId));
    } else if (groupId) {
        conditions.push(eq(categories.groupId, groupId));
    }

    const whereClause = and(...conditions);

    const existing = await db.query.categories.findFirst({
        where: whereClause,
    });

    if (existing) {
        return existing.id;
    }

    // Create new category
    const [newCat] = await db.insert(categories).values({
        userId,
        groupId,
        name: categoryName,
        bucket: bucket || "needs", // default bucket
        isDefault: false,
    }).returning({ id: categories.id });

    return newCat.id;
}

/**
 * Save a new transaction
 */
export async function saveTransaction(data: SaveTransactionData): Promise<string> {
    let categoryId: string | undefined;

    // Handle category linking
    if (data.transaction.categoryId) {
        // Direct categoryId provided
        categoryId = data.transaction.categoryId;
    } else if (data.transaction.category) {
        // Category name provided - find or create it
        try {
            categoryId = await findOrCreateCategory(
                data.groupId ? null : data.userId,
                data.groupId || null,
                data.transaction.category,
                data.transaction.bucket
            );
        } catch (error) {
            console.warn("Failed to find/create category:", error);
            // Continue without categoryId
        }
    }

    const [tx] = await db.insert(transactions).values({
        userId: data.userId,
        periodId: data.periodId,
        categoryId: categoryId,
        groupId: data.groupId,
        type: data.transaction.type,
        amount: data.transaction.amount.toString(),
        description: data.transaction.description,
        bucket: data.transaction.bucket,
        rawMessage: data.rawMessage,
        aiConfidence: data.transaction.aiConfidence?.toString(),
    }).returning({ id: transactions.id });

    return tx.id;
}

/**
 * Get last transaction for user (for undo)
 */
export async function getLastTransaction(userId: string) {
    return await db.query.transactions.findFirst({
        where: eq(transactions.userId, userId),
        orderBy: desc(transactions.createdAt),
    });
}

export async function getTransactions(ids: string[]) {
    return await db.query.transactions.findMany({
        where: (transactions, { inArray }) =>
            inArray(transactions.id, ids),
    });
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(transactionId: string): Promise<boolean> {
    const result = await db.delete(transactions)
        .where(eq(transactions.id, transactionId))
        .returning({ id: transactions.id });

    return result.length > 0;
}

/**
 * Get transactions summary for a period grouped by bucket
 */
export async function getTransactionsSummary(userId: string, periodId: string) {
    const results = await db
        .select({
            bucket: transactions.bucket,
            type: transactions.type,
            total: sql<number>`sum(${transactions.amount}::numeric)`.as("total"),
            count: sql<number>`count(*)`.as("count"),
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.periodId, periodId)
            )
        )
        .groupBy(transactions.bucket, transactions.type);

    return results;
}

/**
 * Get All Transaction in current period
 */
export async function getAllTransactions(target: TargetContext, periodId: string) {
    const condition = target.groupId ?
        eq(transactions.groupId, target.groupId) :
        eq(transactions.userId, target.userId!);

    return await db.query.transactions.findMany({
        where: and(
            condition,
            eq(transactions.periodId, periodId)
        ),
    });
}

/**
 * Get total income and expenses for a period
 */
export async function getPeriodTotals(userId: string, periodId: string) {
    const results = await db
        .select({
            type: transactions.type,
            total: sql<number>`sum(${transactions.amount}::numeric)`.as("total"),
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.periodId, periodId)
            )
        )
        .groupBy(transactions.type);

    const income = results.find(r => r.type === "income")?.total ?? 0;
    const expense = results.find(r => r.type === "expense")?.total ?? 0;
    const transfer = results.find(r => r.type === "transfer")?.total ?? 0;

    return { income, expense, transfer, balance: income - expense };
}

/**
 * Track AI usage
 */
export async function trackAiUsage(data: {
    userId: string;
    model: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    cost?: number;
}) {
    await db.insert(aiUsage).values({
        userId: data.userId,
        model: data.model,
        operation: data.operation,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cost: data.cost?.toString(),
    });
}

/**
 * Get total transaction count for a user in a period
 */
export async function getTransactionCount(userId: string, periodId: string): Promise<number> {
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.periodId, periodId)));

    return Number(result[0]?.count ?? 0);
}

/**
 * Recommend to setup buckets
 */
export async function recommendSetupBuckets(userId: string, periodId: string): Promise<boolean> {
    const txCount = await getTransactionCount(userId, periodId);
    const budget = await db.query.budgets.findFirst({
        where: eq(budgets.periodId, periodId),
        with: {
            buckets: true,
        },
    });
    return (!budget || budget.buckets.length === 1) && txCount >= 5;
}

export async function upsertTransaction(
    target: TargetContext,
    periodId: string,
    dataArray: UpsertTransactionParams[]
): Promise<string[]> {

    // 1. VALIDATE ALL FIRST (fail fast)
    for (const data of dataArray) {
        if (data.confidence < 0.8) {
            throw new Error(`AI not confident for "${data.description}": ${data.confirmationMessage}`);
        }
        if (data.amount <= 0) {
            throw new Error(`Invalid amount for "${data.description}"`);
        }
    }

    // 2. PREPARE CATEGORIES (avoid duplicate queries)
    const uniqueCategories = [...new Set(dataArray.map(d => d.category))];
    const categoryMap = new Map<string, string>();

    for (const category of uniqueCategories) {
        const categoryId = await findOrCreateCategory(target.targetId, periodId, category);
        categoryMap.set(category, categoryId);
    }

    // 3. SEPARATE UPDATES vs INSERTS
    const updates = dataArray.filter(d => d.transactionId);
    const inserts = dataArray.filter(d => !d.transactionId);

    const resultIds: string[] = [];

    // 4. USE DB TRANSACTION (all or nothing)
    await db.transaction(async (tx) => {

        // BULK UPDATE
        if (updates.length > 0) {
            for (const data of updates) {
                await tx.update(transactions)
                    .set({
                        type: data.type,
                        amount: data.amount.toString(),
                        description: data.description,
                        categoryId: categoryMap.get(data.category)!,
                        bucket: data.bucket,
                        aiConfidence: data.confidence.toString(),
                    })
                    .where(eq(transactions.id, data.transactionId!));

                resultIds.push(data.transactionId!);
            }
        }

        // BULK INSERT
        if (inserts.length > 0) {
            const insertData = inserts.map(data => ({
                userId: target.userId!,
                groupId: target.groupId,
                periodId: periodId,
                type: data.type,
                amount: data.amount.toString(),
                description: data.description,
                categoryId: categoryMap.get(data.category)!,
                bucket: data.bucket,
                aiConfidence: data.confidence.toString(),
            }));

            const inserted = await tx.insert(transactions)
                .values(insertData)
                .returning({ id: transactions.id });

            resultIds.push(...inserted.map(r => r.id));
        }
    });

    return resultIds;
}
