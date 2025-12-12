import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { transactions, budgets, datePeriods } from "@kodetama/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

import { authenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { loggingMiddleware } from "../middleware/loggingMiddleware.js";

// Indonesian date formatting helper
function formatIndonesianDate(date: Date): string {
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// Helper to get date-only string (YYYY-MM-DD)
function getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {

    // Helper function to resolve periodId (handles "default")
    async function resolvePeriodId(targetId: string, targetType: "user" | "group", periodId?: string): Promise<string | null> {
        if (!periodId) return null;
        if (periodId === "default") {
            const currentPeriod = await db.query.datePeriods.findFirst({
                where: and(
                    targetType === "group"
                        ? eq(datePeriods.groupId, targetId)
                        : eq(datePeriods.userId, targetId),
                    eq(datePeriods.isCurrent, true)
                ),

            });
            return currentPeriod?.id ?? null;
        }

        return periodId;
    }

    /**
     * GET /transactions
     * List transactions for current period, grouped by day
     */
    fastify.get<{
        Querystring: {
            periodId?: string;
            page?: string;
            pageSize?: string;
        };
    }>("/", {
        preHandler: [authenticate, loggingMiddleware],
    }, async (request, reply) => {
        const payload = request.user as { id: string; targetId: string; targetType: "user" | "group" };
        const { periodId: rawPeriodId, page = "1", pageSize = "20" } = request.query;

        // Resolve periodId (handles "default")
        const periodId = await resolvePeriodId(payload.targetId, payload.targetType, rawPeriodId);
        const pageNum = parseInt(page);
        const pageSizeNum = parseInt(pageSize);
        const offset = (pageNum - 1) * pageSizeNum;

        // If no periodId provided, return empty list
        if (!periodId) {
            return reply.status(403).send({
                message: "No default period found",
            });
        }

        try {
            // Get period information first
            const period = await db.query.datePeriods.findFirst({
                where: eq(datePeriods.id, periodId),
            });

            if (!period) {
                return {
                    days: [],
                    total: 0,
                    page: pageNum,
                    pageSize: pageSizeNum,
                    hasMore: false,
                };
            }

            // Get all transactions for the period to group by day
            const allTransactions = await db.query.transactions.findMany({
                where: eq(transactions.periodId, periodId),
                orderBy: [desc(transactions.transactionDate)],
                with: {
                    category: true,
                },
            });

            // Group transactions by date
            const transactionsByDate: Record<string, any[]> = {};
            for (const tx of allTransactions) {
                const dateStr = getDateKey(tx.transactionDate);
                if (!transactionsByDate[dateStr]) {
                    transactionsByDate[dateStr] = [];
                }
                transactionsByDate[dateStr].push({
                    id: tx.id,
                    type: tx.type,
                    amount: tx.amount,
                    category: tx.category?.name ?? "Uncategorized",
                    bucket: tx.bucket,
                    description: tx.description,
                    transactionDate: tx.transactionDate.toISOString(),
                });
            }

            // Generate all dates in the period range (for empty days)
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            const allDatesInPeriod: string[] = [];
            const currentDay = new Date(startDate);

            while (currentDay <= endDate) {
                allDatesInPeriod.push(getDateKey(currentDay));
                currentDay.setDate(currentDay.getDate() + 1);
            }

            // Create paginated list of transactions (flatten for pagination)
            const allTxs = allTransactions.slice(offset, offset + pageSizeNum);

            // Group the transactions by day (only include days that have transactions in this page)
            const daysMap: Record<string, any[]> = {};
            for (const tx of allTxs) {
                const dateStr = getDateKey(tx.transactionDate);
                if (!daysMap[dateStr]) {
                    daysMap[dateStr] = [];
                }
                daysMap[dateStr].push({
                    id: tx.id,
                    type: tx.type,
                    amount: tx.amount,
                    category: tx.category?.name ?? "Uncategorized",
                    bucket: tx.bucket,
                    description: tx.description,
                    transactionDate: tx.transactionDate.toISOString(),
                });
            }

            // Create final days array (only days that appear in this page)
            const days = Object.entries(daysMap)
                .sort(([a], [b]) => b.localeCompare(a)) // Sort by date desc
                .map(([dateStr, dayTransactions]) => ({
                    date: dateStr,
                    formattedDate: formatIndonesianDate(new Date(dateStr)),
                    transactions: dayTransactions,
                }));

            return {
                days,
                total: allTransactions.length,
                page: pageNum,
                pageSize: pageSizeNum,
                hasMore: offset + pageSizeNum < allTransactions.length,
            };
        } catch (err) {
            logger.error("Database error in transaction list", {
                targetId: payload.targetId,
                targetType: payload.targetType,
                periodId,
                error: err instanceof Error ? err.message : 'Unknown database error'
            });
            return {
                days: [],
                total: 0,
                page: pageNum,
                pageSize: pageSizeNum,
                hasMore: false,
            };
        }
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
        const clientIP = request.ip || 'unknown';

        logger.info("New transaction creation attempt", {
            userId,
            periodId,
            type,
            amount,
            bucket,
            ip: clientIP
        });

        try {
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

            logger.info("Transaction created successfully", {
                transactionId: newTx[0].id,
                userId,
                type,
                amount: parseFloat(amount),
                bucket,
                ip: clientIP
            });

            return newTx[0];
        } catch (err) {
            logger.error("Failed to create transaction", {
                userId,
                periodId,
                type,
                amount,
                error: err instanceof Error ? err.message : 'Unknown database error'
            });
            throw err;
        }
    });

    /**
     * DELETE /transactions/:id
     * Delete a transaction
     */
    fastify.delete<{
        Params: { id: string };
    }>("/:id", async (request, reply) => {
        const { id } = request.params;
        const clientIP = request.ip || 'unknown';

        logger.info("Transaction deletion attempt", {
            transactionId: id,
            ip: clientIP
        });

        try {
            const deleted = await db
                .delete(transactions)
                .where(eq(transactions.id, id))
                .returning();

            if (deleted.length === 0) {
                logger.warn("Transaction deletion failed: not found", {
                    transactionId: id,
                    ip: clientIP
                });
                return reply.status(404).send({ error: "Transaction not found" });
            }

            const deletedTx = deleted[0];
            logger.info("Transaction deleted successfully", {
                transactionId: id,
                userId: deletedTx.userId,
                type: deletedTx.type,
                amount: parseFloat(deletedTx.amount),
                ip: clientIP
            });

            return { id, deleted: true };
        } catch (err) {
            logger.error("Failed to delete transaction", {
                transactionId: id,
                error: err instanceof Error ? err.message : 'Unknown database error'
            });
            throw err;
        }
    });

    /**
     * GET /transactions/summary
     * Get spending summary for current period
     */
    fastify.get<{
        Querystring: { periodId?: string };
    }>("/summary", {
        preHandler: [authenticate, loggingMiddleware]
    }, async (request) => {
        const payload = request.user as { id: string; targetId: string; targetType: "user" | "group" };
        const { periodId: rawPeriodId } = request.query;

        // Resolve periodId (handles "default")
        const periodId = await resolvePeriodId(payload.targetId, payload.targetType, rawPeriodId);

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