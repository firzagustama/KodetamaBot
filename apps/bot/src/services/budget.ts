import { UpdateBucketInput } from "@kodetama/ai";
import { IBudgetService, IBudgetRepository, ITransactionRepository, PeriodBudget } from "@kodetama/shared";

export class BudgetService implements IBudgetService {
    constructor(
        private budgetRepo: IBudgetRepository,
        private transactionRepo: ITransactionRepository
    ) { }

    /**
     * Get budget for a period
     */
    async getBudget(periodId: string): Promise<PeriodBudget | null> {
        return await this.budgetRepo.findByPeriodId(periodId) as PeriodBudget | null;
    }

    /**
     * Get budget summary with spending data
     */
    async getBudgetSummary(targetId: string, periodId: string): Promise<{ budget: PeriodBudget; spending: any[] } | null> {
        // Get budget
        const budget = await this.getBudget(periodId);

        if (!budget) {
            return null;
        }

        // Get spending by bucket
        const summmary = await this.transactionRepo.getTransactionsSummary(targetId, periodId);

        // Calculate total amount and spent for each bucket
        const sum: Record<string, { bucket: string, amount: number; spent: number; remaining: number }> = {};
        budget.buckets.forEach((bucket: any) => {
            if (!bucket.isSystem) {
                sum[bucket.name] = { bucket: bucket.name, amount: parseFloat(bucket.amount), spent: 0, remaining: 0 };
            }
        });
        summmary.forEach((item: any) => {
            if (!sum[item.bucket]) {
                sum[item.bucket] = { bucket: item.bucket, amount: 0, spent: 0, remaining: 0 };
            }

            switch (item.type) {
                case 'income':
                    if (sum[item.bucket].amount == 0) {
                        sum[item.bucket].amount = parseFloat(item.total);
                    }
                    sum[item.bucket].spent -= parseFloat(item.total);
                    break;
                case 'expense':
                    sum[item.bucket].spent += parseFloat(item.total);
                    break;
            }
        });
        const spending = Object.values(sum);
        spending.forEach((item: any) => {
            item.remaining = item.amount - item.spent;
        });
        return {
            budget,
            spending
        };
    }

    /**
     * Upsert budget (create or update)
     */
    async upsertBudget(params: any): Promise<string> {
        // Implementation depends on params structure.
        // Assuming params contains periodId and estimatedIncome.
        const { periodId, estimatedIncome } = params;

        const existing = await this.budgetRepo.findByPeriodId(periodId);
        if (existing) {
            await this.budgetRepo.update(existing.id, { estimatedIncome });
            return existing.id;
        }

        return await this.budgetRepo.save({
            periodId,
            estimatedIncome: estimatedIncome || "0",
            buckets: [{
                name: "Unallocated",
                description: "Dana belum dialokasikan",
                icon: "Wallet",
                amount: "0",
                category: null,
                isSystem: true,
                type: "expense"
            }]
        });
    }

    /**
     * AI Tool: Update bucket
     */
    async updateBucket(periodId: string, args: UpdateBucketInput): Promise<void> {
        const budget = await this.budgetRepo.findByPeriodId(periodId);
        if (!budget) throw new Error("Budget not found for period");

        // Find if bucket exists by name
        const existing = budget.buckets.find((b: any) => b.name.toLowerCase() === args.name.toLowerCase());
        if (!existing) throw new Error("Bucket not found");

        await this.budgetRepo.updateBucket(existing.id, {
            amount: args.amount?.toString(),
            description: args.description,
            category: args.category,
            embedding: args.embedding
        });
    }

    /**
     * AI Tool: Insert bucket
     */
    async insertBucket(periodId: string, args: any): Promise<void> {
        const budget = await this.budgetRepo.findByPeriodId(periodId);
        if (!budget) throw new Error("Budget not found for period");

        // Create
        await this.budgetRepo.saveBucket({
            budgetId: budget.id,
            name: args.name,
            amount: args.amount?.toString() || "0",
            description: args.description,
            category: args.category,
            isSystem: false,
            embedding: args.embedding
        });
    }

    /**
     * AI Tool: Delete bucket
     */
    async deleteBucket(periodId: string, args: any): Promise<void> {
        const budget = await this.budgetRepo.findByPeriodId(periodId);
        if (!budget) throw new Error("Budget not found for period");

        const bucket = budget.buckets.find((b: any) => b.name.toLowerCase() === args.name.toLowerCase());
        if (!bucket) throw new Error("Bucket not found");
        if (bucket.isSystem) throw new Error("Cannot delete system bucket");

        await this.budgetRepo.deleteBucket(bucket.id);
    }
}