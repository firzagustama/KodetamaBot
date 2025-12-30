import { ITransactionService, ITransactionRepository, ICategoryRepository, TransactionWithCategory, PeriodTotals } from "@kodetama/shared";

export class TransactionService implements ITransactionService {
    constructor(
        private transactionRepo: ITransactionRepository,
        private categoryRepo: ICategoryRepository
    ) { }

    async saveTransaction(params: any): Promise<string> {
        // Resolve category if needed
        let categoryId = params.transaction.categoryId;
        if (!categoryId && params.transaction.category) {
            categoryId = await this.categoryRepo.findOrCreate(
                params.targetId,
                params.transaction.category,
                params.transaction.bucket
            );
        }

        return await this.transactionRepo.save({
            ...params.transaction,
            userId: params.userId,
            targetId: params.targetId,
            periodId: params.periodId,
            categoryId,
            rawMessage: params.rawMessage
        });
    }

    async getAllTransactions(targetId: string, periodId: string): Promise<TransactionWithCategory[]> {
        return await this.transactionRepo.findByTargetAndPeriod(targetId, periodId);
    }

    async getTransactionsSummary(targetId: string, periodId: string): Promise<any[]> {
        return await this.transactionRepo.getTransactionsSummary(targetId, periodId);
    }

    async getPeriodTotals(targetId: string, periodId: string): Promise<PeriodTotals> {
        return await this.transactionRepo.getPeriodTotals(targetId, periodId);
    }

    async getTransactionCount(targetId: string, periodId: string): Promise<number> {
        const transactions = await this.transactionRepo.findByTargetAndPeriod(targetId, periodId);
        return transactions.length;
    }

    async recommendSetupBuckets(targetId: string, periodId: string): Promise<boolean> {
        // Logic to check if setup is recommended
        const count = await this.getTransactionCount(targetId, periodId);
        return count >= 5; // Example logic
    }

    async upsertTransaction(params: any): Promise<string> {
        return await this.saveTransaction(params);
    }

    async getTransactionHistory(targetId: string, periodId: string, limit: number = 5): Promise<string> {
        const transactions = await this.transactionRepo.findByTargetAndPeriod(targetId, periodId);
        // Format logic would go here or be delegated to a formatter
        return transactions.slice(0, limit).map(t => `${t.amount} - ${t.description}`).join("\n");
    }

    async searchTransactionsByKeyword(targetId: string, periodId: string, keyword: string): Promise<TransactionWithCategory[]> {
        const transactions = await this.transactionRepo.findByTargetAndPeriod(targetId, periodId);
        return transactions.filter(t =>
            t.description?.toLowerCase().includes(keyword.toLowerCase()) ||
            t.category?.name.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    async trackAiUsage(_params: any): Promise<void> {
        // Implementation
    }

    async deleteTransaction(id: string): Promise<boolean> {
        return await this.transactionRepo.delete(id);
    }
}
