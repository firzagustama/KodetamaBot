import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { budgets, datePeriods } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";

export async function budgetRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /budgets/current
     * Get current period budget for authenticated user
     */
    fastify.get("/current", async (request, reply) => {
        // Get user from JWT (simplified - assumes middleware sets this)
        const userId = (request.user as { id?: string })?.id;

        if (!userId) {
            // Return sample data for now if no auth
            return {
                id: "sample-id",
                estimatedIncome: "8000000",
                needsAmount: "4000000",
                wantsAmount: "2400000",
                savingsAmount: "1600000",
                needsPercentage: 50,
                wantsPercentage: 30,
                savingsPercentage: 20,
                period: {
                    name: "Desember 2025",
                    startDate: "2025-12-01",
                    endDate: "2025-12-31",
                },
            };
        }

        // Find current period for user
        const currentPeriod = await db.query.datePeriods.findFirst({
            where: and(
                eq(datePeriods.userId, userId),
                eq(datePeriods.isCurrent, true)
            ),
        });

        if (!currentPeriod) {
            return reply.status(404).send({ error: "No active period found" });
        }

        const budget = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, currentPeriod.id),
        });

        if (!budget) {
            return reply.status(404).send({ error: "No budget found for current period" });
        }

        return {
            id: budget.id,
            estimatedIncome: budget.estimatedIncome,
            needsAmount: budget.needsAmount,
            wantsAmount: budget.wantsAmount,
            savingsAmount: budget.savingsAmount,
            needsPercentage: budget.needsPercentage,
            wantsPercentage: budget.wantsPercentage,
            savingsPercentage: budget.savingsPercentage,
            period: {
                id: currentPeriod.id,
                name: currentPeriod.name,
                startDate: currentPeriod.startDate.toISOString(),
                endDate: currentPeriod.endDate.toISOString(),
            },
        };
    });

    /**
     * GET /budgets/:periodId
     * Get budget by period
     */
    fastify.get<{
        Params: { periodId: string };
    }>("/:periodId", async (request, reply) => {
        const { periodId } = request.params;

        const period = await db.query.datePeriods.findFirst({
            where: eq(datePeriods.id, periodId),
        });

        if (!period) {
            return reply.status(404).send({ error: "Period not found" });
        }

        const budget = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, periodId),
        });

        if (!budget) {
            return reply.status(404).send({ error: "Budget not found" });
        }

        return {
            id: budget.id,
            estimatedIncome: budget.estimatedIncome,
            needsAmount: budget.needsAmount,
            wantsAmount: budget.wantsAmount,
            savingsAmount: budget.savingsAmount,
            needsPercentage: budget.needsPercentage,
            wantsPercentage: budget.wantsPercentage,
            savingsPercentage: budget.savingsPercentage,
            period: {
                id: period.id,
                name: period.name,
                startDate: period.startDate.toISOString(),
                endDate: period.endDate.toISOString(),
            },
        };
    });

    /**
     * PUT /budgets/:periodId
     * Update budget allocation
     */
    fastify.put<{
        Params: { periodId: string };
        Body: {
            estimatedIncome?: string;
            needsPercentage?: number;
            wantsPercentage?: number;
            savingsPercentage?: number;
        };
    }>("/:periodId", async (request, reply) => {
        const { periodId } = request.params;
        const { estimatedIncome, needsPercentage, wantsPercentage, savingsPercentage } = request.body;

        // Calculate amounts if income and percentages provided
        const income = estimatedIncome ? parseFloat(estimatedIncome) : undefined;
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (estimatedIncome) updateData.estimatedIncome = estimatedIncome;
        if (needsPercentage !== undefined) updateData.needsPercentage = needsPercentage;
        if (wantsPercentage !== undefined) updateData.wantsPercentage = wantsPercentage;
        if (savingsPercentage !== undefined) updateData.savingsPercentage = savingsPercentage;

        // Recalculate amounts if we have the data
        if (income && needsPercentage !== undefined) {
            updateData.needsAmount = (income * needsPercentage / 100).toFixed(2);
        }
        if (income && wantsPercentage !== undefined) {
            updateData.wantsAmount = (income * wantsPercentage / 100).toFixed(2);
        }
        if (income && savingsPercentage !== undefined) {
            updateData.savingsAmount = (income * savingsPercentage / 100).toFixed(2);
        }

        const updated = await db
            .update(budgets)
            .set(updateData)
            .where(eq(budgets.periodId, periodId))
            .returning();

        if (updated.length === 0) {
            return reply.status(404).send({ error: "Budget not found" });
        }

        return { ...updated[0], updated: true };
    });

    /**
     * POST /budgets
     * Create a new budget for a period
     */
    fastify.post<{
        Body: {
            periodId: string;
            estimatedIncome: string;
            needsPercentage: number;
            wantsPercentage: number;
            savingsPercentage: number;
        };
    }>("/", async (request) => {
        const { periodId, estimatedIncome, needsPercentage, wantsPercentage, savingsPercentage } = request.body;

        const income = parseFloat(estimatedIncome);

        const newBudget = await db
            .insert(budgets)
            .values({
                periodId,
                estimatedIncome,
                needsAmount: (income * needsPercentage / 100).toFixed(2),
                wantsAmount: (income * wantsPercentage / 100).toFixed(2),
                savingsAmount: (income * savingsPercentage / 100).toFixed(2),
                needsPercentage,
                wantsPercentage,
                savingsPercentage,
            })
            .returning();

        return newBudget[0];
    });
}
