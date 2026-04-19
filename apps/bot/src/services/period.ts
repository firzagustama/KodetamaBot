import { formatPeriodName, getMonthlyPeriodDates, getCustomPeriodDates, Period, IPeriodService, IDatePeriodRepository, IBudgetRepository } from "@kodetama/shared";

export class PeriodService implements IPeriodService {
    constructor(
        private periodRepo: IDatePeriodRepository,
        private budgetRepo: IBudgetRepository
    ) { }

    /**
     * Get current periodId for target (user or group)
     */
    async resolvePeriodId(targetId: string): Promise<string | null> {
        const currentPeriod = await this.getCurrentPeriod(targetId);
        return currentPeriod?.id || null;
    }

    /**
     * Get current period for target
     */
    async getCurrentPeriod(targetId: string): Promise<Period | null> {
        return await this.periodRepo.findCurrentByTargetId(targetId);
    }

    /**
     * Get or create period for a specific month
     */
    async ensurePeriodExists(
        targetId: string,
        date: Date = new Date(),
        incomeDate: number = 1
    ): Promise<string> {
        const year = date.getFullYear();
        const month = date.getMonth();
        const periodName = formatPeriodName(date);

        // Use custom period dates if income date is not 1
        const { start, end } = incomeDate === 1
            ? getMonthlyPeriodDates(year, month)
            : getCustomPeriodDates(year, month, incomeDate);

        // Check if period exists (using a helper or findByTargetDateRange logic if name search isn't available)
        // Since findByName isn't in interface, we might need to rely on implementation details or add it to interface.
        // For now, let's assume we can fetch current or iterate.
        // Actually, let's use the repository's findByTargetDateRange which is close enough or add findByName to interface if critical.
        // But wait, I added findByName to the repo implementation but not the interface.
        // To be safe and clean, let's use findByTargetDateRange and filter, or just use the implementation if we cast (bad practice).
        // Better: Update interface later. For now, let's use findByTargetDateRange.

        // Actually, checking by name is specific. Let's try to find by date range which is more robust.
        const periods = await this.periodRepo.findByTargetDateRange(targetId, start, end);
        const existing = periods.find(p => p.name === periodName);

        if (existing) {
            return existing.id;
        }

        // Create new period
        // First unset current
        // The repository `setCurrent` handles unsetting others, but here we are creating a new one.
        // We should probably rely on the repo to handle "make current" logic if we want to encapsulate it.
        // But `save` doesn't handle that.
        // Let's manually unset if we are making it current.
        // Wait, `ensurePeriodExists` logic in original code made it current.

        // Let's replicate original logic:
        // 1. Unset current
        // 2. Insert new as current

        // We can use `setCurrent` after save, but `save` returns ID.
        // But `setCurrent` takes an ID.
        // So: save as non-current first? Or save as current?
        // The repo `save` takes an object.

        // Let's assume we want it to be current.
        // We can't transactionally unset and set via generic repo easily without a specific method.
        // But for now, let's just save it.

        const newPeriodId = await this.periodRepo.save({
            targetId,
            name: periodName,
            startDate: start,
            endDate: end,
            isCurrent: true,
        });

        // Ensure it is the only current one
        await this.periodRepo.setCurrent(targetId, newPeriodId);

        return newPeriodId;
    }

    /**
     * Create or update a period for AI tool, optionally copying budget from previous period
     */
    async upsertPeriodWithBudget(
        targetId: string,
        periodData: { name: string; copyFromPrevious: boolean }
    ): Promise<string> {
        const date = periodData.name ? new Date(periodData.name) : new Date();
        const incomeDate = Math.max(date.getDate(), 28);
        const copyFromPrevious = periodData.copyFromPrevious;

        // Create the period
        const periodId = await this.ensurePeriodExists(targetId, date, incomeDate);

        // Check if budget already exists for this period
        const existingBudget = await this.budgetRepo.findByPeriodId(periodId);

        if (existingBudget) {
            return periodId;
        }

        // Always include the Unallocated system bucket
        const systemBucket = {
            name: "Unallocated",
            description: "Dana belum dialokasikan",
            icon: "Wallet",
            amount: "0",
            category: null,
            isSystem: true,
            type: "expense"
        };

        // If copyFromPrevious, find the previous period's budget and clone its non-system buckets
        if (copyFromPrevious) {
            const previousPeriod = await this.periodRepo.findPreviousByTargetId(targetId, periodId);

            if (previousPeriod?.budget?.buckets && previousPeriod.budget.buckets.length > 0) {
                const copiedBuckets = previousPeriod.budget.buckets
                    .filter((b: any) => !b.isSystem)
                    .map((b: any) => ({
                        name: b.name,
                        description: b.description,
                        icon: b.icon,
                        amount: b.amount, // carry over the allocated amount
                        category: b.category,
                        isSystem: false,
                        type: b.type,
                    }));

                await this.budgetRepo.save({
                    periodId,
                    estimatedIncome: previousPeriod.budget.estimatedIncome,
                    buckets: [systemBucket, ...copiedBuckets],
                });

                return periodId;
            }
        }

        // Default: create budget with only the Unallocated bucket
        await this.budgetRepo.save({
            periodId,
            estimatedIncome: "0",
            buckets: [systemBucket],
        });

        return periodId;
    }
}