import { db } from "@kodetama/db";
import { transactions, aiUsage } from "@kodetama/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { TxType } from "@kodetama/shared";

export interface SaveTransactionData {
    userId: string;
    periodId: string;
    type: TxType;
    amount: number;
    description?: string;
    category?: string;
    bucket?: string;
    rawMessage?: string;
    aiConfidence?: number;
}

/**
 * Save a new transaction
 */
export async function saveTransaction(data: SaveTransactionData): Promise<string> {
    const [tx] = await db.insert(transactions).values({
        userId: data.userId,
        periodId: data.periodId,
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
