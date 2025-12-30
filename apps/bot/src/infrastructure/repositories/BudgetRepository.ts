import { db } from "@kodetama/db";
import { budgets, buckets } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";
import type { IBudgetRepository, Budget, PeriodBudget } from "@kodetama/shared";

export class BudgetRepository implements IBudgetRepository {
    async findByPeriodId(periodId: string): Promise<PeriodBudget | null> {
        const result = await db.query.budgets.findFirst({
            where: eq(budgets.periodId, periodId),
            with: {
                buckets: true
            }
        });
        return result as PeriodBudget | null;
    }

    async save(budget: Omit<Budget, "id" | "createdAt" | "updatedAt"> & { buckets?: any[] }): Promise<string> {
        const { buckets: bucketData, ...budgetFields } = budget;
        const [result] = await db.insert(budgets).values(budgetFields).returning({ id: budgets.id });

        // Save buckets if present
        if (bucketData && bucketData.length > 0) {
            await db.insert(buckets).values(
                bucketData.map((b: any) => ({
                    ...b,
                    budgetId: result.id
                }))
            );
        }

        return result.id;
    }

    async update(budgetId: string, updates: Partial<Pick<Budget, "estimatedIncome" | "needsAmount" | "wantsAmount" | "savingsAmount" | "needsPercentage" | "wantsPercentage" | "savingsPercentage">>): Promise<void> {
        await db.update(budgets)
            .set(updates)
            .where(eq(budgets.id, budgetId));
    }

    async saveBucket(bucket: any): Promise<string> {
        const [result] = await db.insert(buckets).values(bucket).returning({ id: buckets.id });
        return result.id;
    }

    async updateBucket(bucketId: string, updates: any): Promise<void> {
        await db.update(buckets)
            .set(updates)
            .where(eq(buckets.id, bucketId));
    }

    async deleteBucket(bucketId: string): Promise<void> {
        await db.delete(buckets)
            .where(eq(buckets.id, bucketId));
    }
}
