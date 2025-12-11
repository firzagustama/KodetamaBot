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

    async findByUserAndPeriod(userId: string, periodId: string): Promise<TransactionWithCategory[]> {
        const results = await db.query.transactions.findMany({
            where: and(
                eq(transactions.userId, userId),
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

    async save(transaction: Omit<Transaction, "id" | "createdAt">): Promise<string> {
        const dbType = transaction.type as "income" | "expense" | "transfer" | "adjustment";

        const [result] = await db.insert(transactions).values({
            ...transaction,
            type: dbType,
        }).returning({ id: transactions.id });

        return result.id;
    }

    async delete(id: string): Promise<boolean> {
        const result = await db.delete(transactions)
            .where(eq(transactions.id, id))
            .returning({ id: transactions.id });

        return result.length > 0;
    }

    async getPeriodTotals(userId: string, periodId: string): Promise<PeriodTotals> {
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

    async getTransactionsSummary(userId: string, periodId: string): Promise<Array<{
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
                    eq(transactions.userId, userId),
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