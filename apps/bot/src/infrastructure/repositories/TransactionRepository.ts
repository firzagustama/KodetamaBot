import { db } from "@kodetama/db";
import { transactions } from "@kodetama/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type {
    Transaction,
    TransactionWithCategory,
    PeriodTotals,
    ITransactionRepository
} from "@kodetama/shared";

/**
 * Concrete implementation of TransactionRepository using Drizzle ORM
 * Following Repository Pattern - abstracts data access layer
 */
export class TransactionRepository implements ITransactionRepository {
    async findById(id: string): Promise<TransactionWithCategory | null> {
        const result = await db.query.transactions.findFirst({
            where: eq(transactions.id, id),
            with: {
                category: true,
            },
        });

        if (!result) return null;

        return {
            ...result,
            category: result.category || null,
        };
    }

    async findByIds(ids: string[]): Promise<TransactionWithCategory[]> {
        if (ids.length === 0) return [];

        const results = await db.query.transactions.findMany({
            where: inArray(transactions.id, ids),
            with: {
                category: true,
            },
        });

        return results.map(result => ({
            ...result,
            category: result.category || null,
        }));
    }

    async findByTargetAndPeriod(targetId: string, periodId: string): Promise<TransactionWithCategory[]> {
        const results = await db.query.transactions.findMany({
            where: and(
                eq(transactions.targetId, targetId),
                eq(transactions.periodId, periodId)
            ),
            with: {
                category: true,
            },
            orderBy: [desc(transactions.transactionDate)],
        });

        return results.map(result => ({
            ...result,
            category: result.category || null,
        }));
    }

    async findByVector(targetId: string, periodId: string, searchQuery: number[], treshold: number = 0.18): Promise<TransactionWithCategory[]> {
        const results = await db.query.transactions.findMany({
            where: and(
                eq(transactions.targetId, targetId),
                eq(transactions.periodId, periodId),
                sql`${transactions.embedding} <=> ${JSON.stringify(searchQuery)}::vector <= ${treshold}`
            ),
            with: {
                category: true,
            },
            limit: 5,
        });

        return results.map(result => ({
            ...result,
            category: result.category || null,
        }));
    }

    async save(transaction: Omit<Transaction, "id" | "createdAt">): Promise<string> {
        const dbType = transaction.type as "income" | "expense" | "transfer" | "adjustment";

        const [result] = await db.insert(transactions).values({
            ...transaction,
            targetId: transaction.targetId,
            type: dbType,
        }).returning({ id: transactions.id });

        return result.id;
    }

    async update(transaction: any): Promise<string> {
        const updateId = transaction.transactionId;
        const data = await db.query.transactions.findFirst({
            where: eq(transactions.id, updateId),
        });

        if (!data) {
            throw new Error("Transaction not found");
        }

        data.amount = transaction.amount;
        data.bucket = transaction.bucket;
        data.description = transaction.description;
        data.type = transaction.type;
        data.periodId = transaction.periodId;
        data.targetId = transaction.targetId;
        data.categoryId = transaction.categoryId;

        const [result] = await db.update(transactions).set(data)
            .where(eq(transactions.id, updateId))
            .returning({ id: transactions.id });

        return result.id;
    }

    async delete(id: string): Promise<boolean> {
        const result = await db.delete(transactions)
            .where(eq(transactions.id, id))
            .returning({ id: transactions.id });

        return result.length > 0;
    }

    async getPeriodTotals(targetId: string, periodId: string): Promise<PeriodTotals> {
        const results = await db
            .select({
                type: transactions.type,
                total: sql<number>`sum(${transactions.amount}::numeric)`.as("total"),
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.targetId, targetId),
                    eq(transactions.periodId, periodId)
                )
            )
            .groupBy(transactions.type);

        const totals = results.reduce(
            (acc, result) => {
                acc[result.type as keyof PeriodTotals] = result.total;
                return acc;
            },
            { income: 0, expense: 0, transfer: 0, balance: 0 } as PeriodTotals
        );

        // Calculate balance
        totals.balance = totals.income - totals.expense;

        return totals;
    }

    async getTransactionsSummary(targetId: string, periodId: string): Promise<Array<{
        bucket: string | null;
        type: string;
        total: number;
        count: number;
    }>> {
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
                    eq(transactions.targetId, targetId),
                    eq(transactions.periodId, periodId)
                )
            )
            .groupBy(transactions.bucket, transactions.type);

        return results.map(result => ({
            bucket: result.bucket,
            type: result.type,
            total: result.total,
            count: result.count,
        }));
    }
}