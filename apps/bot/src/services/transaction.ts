import { db } from "@kodetama/db";
import { transactions, categories, aiUsage } from "@kodetama/db/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import type { TxType } from "@kodetama/shared";

export interface SaveTransactionData {
    userId: string;
    periodId: string;
    type: TxType;
    amount: number;
    description?: string;
    category?: string;
    categoryId?: string;
    bucket?: string;
    rawMessage?: string;
    aiConfidence?: number;
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
    if (data.type === "other") return "";

    let categoryId: string | undefined;

    // Handle category linking
    if (data.categoryId) {
        // Direct categoryId provided
        categoryId = data.categoryId;
    } else if (data.category) {
        // Category name provided - find or create it
        try {
            categoryId = await findOrCreateCategory(data.userId, null, data.category, data.bucket);
        } catch (error) {
            console.warn("Failed to find/create category:", error);
            // Continue without categoryId
        }
    }

    const [tx] = await db.insert(transactions).values({
        userId: data.userId,
        periodId: data.periodId,
        categoryId: categoryId,
        type: data.type,
        amount: data.amount.toString(),
        description: data.description,
        bucket: data.bucket,
        rawMessage: data.rawMessage,
        aiConfidence: data.aiConfidence?.toString(),
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