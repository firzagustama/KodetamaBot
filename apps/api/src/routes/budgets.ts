import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { buckets, budgets, datePeriods } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";

import { authenticate } from "../middleware/auth.js";
import { loggingMiddleware } from "../middleware/loggingMiddleware.js";

export async function budgetRoutes(fastify: FastifyInstance): Promise<void> {

    /**
     * GET /budgets/current
     * Get current period budget for authenticated user
     */
    fastify.get("/current", {
        preHandler: [authenticate, loggingMiddleware],
    }, async (request, reply) => {
        const payload = request.user as { id: string; targetId: string; targetType: "user" | "group" };

        // Find current period for target context
        const currentPeriod = await db.query.datePeriods.findFirst({
            where: and(
                payload.targetType === "group"
                    ? eq(datePeriods.groupId, payload.targetId)
                    : eq(datePeriods.userId, payload.targetId),
                eq(datePeriods.isCurrent, true)
            ),
        });
        console.log(payload)

        if (!currentPeriod) {
            return reply.status(403).send({ error: "Current period not found" });
        }

        const budget = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, currentPeriod.id),
        });

        if (!budget) {
            return reply.status(403).send({ error: "Budget not found" });
        }

        const bucket = await db.query.buckets.findMany({
            where: eq(buckets.budgetId, budget.id),
        });

        return {
            id: budget.id,
            estimatedIncome: budget.estimatedIncome,
            buckets: bucket,
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
    }>("/:periodId", {
        preHandler: [loggingMiddleware],
    }, async (request, reply) => {
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

        const bucket = await db.query.buckets.findMany({
            where: eq(buckets.budgetId, budget.id),
        });

        return {
            id: budget.id,
            estimatedIncome: budget.estimatedIncome,
            buckets: bucket,
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
    }>("/:periodId", {
        preHandler: loggingMiddleware,
    }, async (request, reply) => {
        const { periodId } = request.params;
        const { estimatedIncome, needsPercentage, wantsPercentage, savingsPercentage } = request.body;

        // Calculate amounts if income and percentages provided
        const income = estimatedIncome ? parseFloat(estimatedIncome) : undefined;
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (estimatedIncome) updateData.estimatedIncome = estimatedIncome;
        if (needsPercentage !== undefined) updateData.needsPercentage = needsPercentage.toString();
        if (wantsPercentage !== undefined) updateData.wantsPercentage = wantsPercentage.toString();
        if (savingsPercentage !== undefined) updateData.savingsPercentage = savingsPercentage.toString();

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

        console.log("[DATABASE] insert to db", updateData);
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
    }>("/", {
        preHandler: loggingMiddleware,
    }, async (request) => {
        const { periodId, estimatedIncome, needsPercentage, wantsPercentage, savingsPercentage } = request.body;

        const income = parseFloat(estimatedIncome);

        const newBudget = await db
            .insert(budgets)
            .values({
                periodId,
                estimatedIncome,
                // needsAmount: (income * needsPercentage / 100).toFixed(2),
                // wantsAmount: (income * wantsPercentage / 100).toFixed(2),
                // savingsAmount: (income * savingsPercentage / 100).toFixed(2),
                // needsPercentage: needsPercentage.toString(),
                // wantsPercentage: wantsPercentage.toString(),
                // savingsPercentage: savingsPercentage.toString(),
            })
            .returning();

        return newBudget[0];
    });
}