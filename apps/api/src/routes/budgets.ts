import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { buckets, budgets, datePeriods } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import { AIOrchestrator } from "@kodetama/ai";

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
 * Update budget allocation with full CRUD for buckets
 */
    fastify.put<{
        Params: { periodId: string };
        Body: {
            estimatedIncome?: string;
            buckets?: Array<{
                id: string;
                amount: number;
                name?: string;
                icon?: string;
            }>;
        };
    }>("/:periodId", {
        preHandler: loggingMiddleware,
    }, async (request, reply) => {
        const { periodId } = request.params;
        const { estimatedIncome, buckets: bucketUpdates } = request.body;

        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (estimatedIncome) updateData.estimatedIncome = estimatedIncome;

        // Update budget details
        if (Object.keys(updateData).length > 1) {
            await db
                .update(budgets)
                .set(updateData)
                .where(eq(budgets.periodId, periodId));
        }

        // Get the budget to work with buckets
        const budget = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, periodId),
        });

        if (!budget) {
            return reply.status(404).send({ error: "Budget not found" });
        }

        // Handle bucket CRUD operations
        if (bucketUpdates && bucketUpdates.length > 0) {
            // Get existing buckets
            const existingBuckets = await db.query.buckets.findMany({
                where: eq(buckets.budgetId, budget.id),
            });

            const existingBucketIds = new Set(existingBuckets.map(b => b.id));
            const incomingBucketIds = new Set(
                bucketUpdates
                    .filter(b => !b.id.startsWith('temp'))
                    .map(b => b.id)
            );

            // CREATE: Insert new buckets (id starts with 'temp')
            const newBuckets = bucketUpdates.filter(b => b.id.startsWith('temp'));
            for (const bucket of newBuckets) {
                await db.insert(buckets).values({
                    id: crypto.randomUUID(), // Generate real ID
                    budgetId: budget.id,
                    name: bucket.name || 'Unnamed Bucket',
                    amount: bucket.amount.toString(),
                    icon: bucket.icon || 'Wallet',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            // UPDATE: Update existing buckets
            const existingBucketUpdates = bucketUpdates.filter(b => !b.id.startsWith('temp'));
            for (const bucket of existingBucketUpdates) {
                await db
                    .update(buckets)
                    .set({
                        amount: bucket.amount.toString(),
                        ...(bucket.name ? { name: bucket.name } : {}),
                        ...(bucket.icon ? { icon: bucket.icon } : {}),
                        updatedAt: new Date(),
                    })
                    .where(eq(buckets.id, bucket.id));
            }

            // DELETE: Remove buckets that exist in DB but not in request
            const bucketsToDelete = existingBuckets.filter(
                b => !incomingBucketIds.has(b.id)
            );
            for (const bucket of bucketsToDelete) {
                await db.delete(buckets).where(eq(buckets.id, bucket.id));
            }
        } else {
            // If no buckets provided, delete all existing buckets
            await db.delete(buckets).where(eq(buckets.budgetId, budget.id));
        }

        // Fetch updated data to return
        const updatedBudget = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, periodId),
        });

        const updatedBuckets = await db.query.buckets.findMany({
            where: eq(buckets.budgetId, budget.id),
        });

        return {
            ...updatedBudget,
            buckets: updatedBuckets,
            updated: true
        };
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
    /**
     * POST /budgets/generate-description
     * Generate a description for a budget bucket using AI
     */
    fastify.post<{
        Body: {
            category: string;
            context?: string;
        };
    }>("/generate-description", {
        preHandler: [authenticate, loggingMiddleware],
    }, async (request) => {
        const { category, context } = request.body;
        const ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL,
        });

        const { result } = await ai.generateBucketDescription(category, context);
        return { description: result };
    });
}