import { db } from "@kodetama/db";
import { datePeriods } from "@kodetama/db/schema";
import { eq, and, desc, gte, lte, lt, ne } from "drizzle-orm";
import type { IDatePeriodRepository, DatePeriod, Period } from "@kodetama/shared";

export class DatePeriodRepository implements IDatePeriodRepository {
    async findById(id: string): Promise<Period | null> {
        const result = await db.query.datePeriods.findFirst({
            where: eq(datePeriods.id, id),
            with: {
                budget: {
                    with: {
                        buckets: true
                    }
                }
            }
        });
        return (result as Period) || null;
    }

    async findCurrentByTargetId(targetId: string): Promise<Period | null> {
        const result = await db.query.datePeriods.findFirst({
            where: and(
                eq(datePeriods.targetId, targetId),
                eq(datePeriods.isCurrent, true)
            ),
            with: {
                budget: {
                    with: {
                        buckets: true
                    }
                }
            }
        });
        return (result as Period) || null;
    }

    async save(period: Omit<DatePeriod, "id" | "createdAt">): Promise<string> {
        const [result] = await db.insert(datePeriods).values(period).returning({ id: datePeriods.id });
        return result.id;
    }

    async setCurrent(targetId: string, periodId: string): Promise<void> {
        // Unset current for all periods of this target
        await db.update(datePeriods)
            .set({ isCurrent: false })
            .where(eq(datePeriods.targetId, targetId));

        // Set new current
        await db.update(datePeriods)
            .set({ isCurrent: true })
            .where(eq(datePeriods.id, periodId));
    }

    async findByTargetDateRange(targetId: string, startDate: Date, endDate: Date): Promise<DatePeriod[]> {
        return await db.query.datePeriods.findMany({
            where: and(
                eq(datePeriods.targetId, targetId),
                gte(datePeriods.startDate, startDate),
                lte(datePeriods.endDate, endDate)
            ),
            orderBy: [desc(datePeriods.startDate)]
        });
    }

    // Helper method not in interface but useful for implementation
    async findByName(targetId: string, name: string): Promise<DatePeriod | null> {
        const result = await db.query.datePeriods.findFirst({
            where: and(
                eq(datePeriods.targetId, targetId),
                eq(datePeriods.name, name)
            )
        });
        return result || null;
    }

    async findPreviousByTargetId(targetId: string, beforePeriodId: string): Promise<Period | null> {
        // Find the current period's startDate first
        const currentPeriod = await db.query.datePeriods.findFirst({
            where: eq(datePeriods.id, beforePeriodId)
        });
        if (!currentPeriod) return null;

        // Find the most recent period before currentPeriod's startDate
        const result = await db.query.datePeriods.findFirst({
            where: and(
                eq(datePeriods.targetId, targetId),
                ne(datePeriods.id, beforePeriodId),
                lt(datePeriods.startDate, currentPeriod.startDate)
            ),
            orderBy: [desc(datePeriods.startDate)],
            with: {
                budget: {
                    with: {
                        buckets: true
                    }
                }
            }
        });
        return (result as Period) || null;
    }
}
