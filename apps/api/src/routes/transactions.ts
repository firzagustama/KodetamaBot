import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { transactions, budgets, datePeriods } from "@kodetama/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

import { authenticate } from "../middleware/auth.js";

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {

    // Helper function to resolve periodId (handles "default")
    async function resolvePeriodId(userId: string, periodId?: string): Promise<string | null> {
        if (!periodId) return null;
        if (periodId === "default") {
            const currentPeriod = await db.query.datePeriods.findFirst({
                where: and(eq(datePeriods.userId, userId), eq(datePeriods.isCurrent, true)),

            });
            return currentPeriod?.id ?? null;
        }

        return periodId;
    }

    /**
     * GET /transactions
     * List transactions for current period
     */
    fastify.get<{
        Querystring: {
            periodId?: string;
            page?: string;
            pageSize?: string;
        };
    }>("/", {
        preHandler: authenticate,
    }, async (request) => {
        const userId = (request.user as { id: string }).id;
        const { periodId: rawPeriodId, page = "1", pageSize = "20" } = request.query;

        // Resolve periodId (handles "default")
        const periodId = await resolvePeriodId(userId, rawPeriodId);
        const pageNum = parseInt(page);
        const pageSizeNum = parseInt(pageSize);
        const offset = (pageNum - 1) * pageSizeNum;

        // If no periodId provided, return empty list
        if (!periodId) {
            return {
                items: [],
                total: 0,
                page: pageNum,
                pageSize: pageSizeNum,
                hasMore: false,
            };
        }

        const items = await db.query.transactions.findMany({
            where: eq(transactions.periodId, periodId),
            orderBy: [desc(transactions.transactionDate)],
            limit: pageSizeNum,
            offset: offset,
            with: {
                category: true,
            },
        });

        // Get total count
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(transactions)
            .where(eq(transactions.periodId, periodId));

        const total = Number(countResult[0]?.count ?? 0);

        return {
            items: items.map((tx) => ({
                id: tx.id,
                type: tx.type,
                amount: tx.amount,
                category: tx.category?.name ?? "Uncategorized",
                bucket: tx.bucket,
                description: tx.description,
                transactionDate: tx.transactionDate.toISOString(),
            })),
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            hasMore: offset + items.length < total,
        };
    });

    /**
     * POST /transactions
     * Create a new transaction
     */
    fastify.post<{
        Body: {
            userId: string;
            periodId: string;
            type: "income" | "expense" | "transfer" | "adjustment";
            amount: string;
            categoryId?: string;
            bucket?: string;
            description?: string;
            rawMessage?: string;
            transactionDate?: string;
        };
    }>("/", async (request) => {
        const { userId, periodId, type, amount, categoryId, bucket, description, rawMessage, transactionDate } = request.body;

        const newTx = await db
            .insert(transactions)
            .values({
                userId,
                periodId,
                type,
                amount,
                categoryId: categoryId ?? null,
                bucket: bucket ?? null,
                description: description ?? null,
                rawMessage: rawMessage ?? null,
                transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
            })
            .returning();

        return newTx[0];
    });

    /**
     * DELETE /transactions/:id
     * Delete a transaction
     */
    fastify.delete<{
        Params: { id: string };
    }>("/:id", async (request, reply) => {
        const { id } = request.params;

        const deleted = await db
            .delete(transactions)
            .where(eq(transactions.id, id))
            .returning();

        if (deleted.length === 0) {
            return reply.status(404).send({ error: "Transaction not found" });
        }

        return { id, deleted: true };
    });

    /**
     * GET /transactions/summary
     * Get spending summary for current period
     */
    fastify.get<{
        Querystring: { periodId?: string };
    }>("/summary", {
        preHandler: authenticate,
    }, async (request) => {
        const userId = (request.user as { id: string }).id;
        const { periodId: rawPeriodId } = request.query;

        // Resolve periodId (handles "default")
        const periodId = await resolvePeriodId(userId, rawPeriodId);

        // Return empty data if no periodId
        if (!periodId) {
            return {
                totalIncome: 0,
                totalExpenses: 0,
                totalSavings: 0,
                byBucket: {
                    needs: { allocated: 0, spent: 0, remaining: 0 },
                    wants: { allocated: 0, spent: 0, remaining: 0 },
                    savings: { allocated: 0, spent: 0, remaining: 0 },
                },
                topCategories: [],
            };
        }

        // Get budget for period
        const budget = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, periodId),
        });

        // Get all transactions for period
        const txs = await db.query.transactions.findMany({
            where: eq(transactions.periodId, periodId),
            with: { category: true },
        });

        // Calculate totals
        let totalIncome = 0;
        let totalExpenses = 0;
        const bucketSpending: Record<string, number> = { needs: 0, wants: 0, savings: 0 };
        const categorySpending: Record<string, number> = {};

        for (const tx of txs) {
            const amount = parseFloat(tx.amount);
            if (tx.type === "income") {
                totalIncome += amount;
            } else if (tx.type === "expense") {
                totalExpenses += amount;
                if (tx.bucket) {
                    bucketSpending[tx.bucket] = (bucketSpending[tx.bucket] ?? 0) + amount;
                }
                const catName = tx.category?.name ?? "Lainnya";
                categorySpending[catName] = (categorySpending[catName] ?? 0) + amount;
            }
        }

        // Build top categories
        const sortedCategories = Object.entries(categorySpending)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
            }));

        const needsAllocated = budget ? parseFloat(budget.needsAmount) : 0;
        const wantsAllocated = budget ? parseFloat(budget.wantsAmount) : 0;
        const savingsAllocated = budget ? parseFloat(budget.savingsAmount) : 0;

        return {
            totalIncome,
            totalExpenses,
            totalSavings: savingsAllocated,
            byBucket: {
                needs: {
                    allocated: needsAllocated,
                    spent: bucketSpending.needs ?? 0,
                    remaining: needsAllocated - (bucketSpending.needs ?? 0),
                },
                wants: {
                    allocated: wantsAllocated,
                    spent: bucketSpending.wants ?? 0,
                    remaining: wantsAllocated - (bucketSpending.wants ?? 0),
                },
                savings: {
                    allocated: savingsAllocated,
                    spent: bucketSpending.savings ?? 0,
                    remaining: savingsAllocated - (bucketSpending.savings ?? 0),
                },
            },
            topCategories: sortedCategories,
        };
    });
}