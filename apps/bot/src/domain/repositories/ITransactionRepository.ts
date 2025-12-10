import type {
    Transaction,
    TransactionWithCategory,
    PeriodTotals
} from "@kodetama/shared";

/**
 * Repository interface for Transaction domain operations
 */
export interface ITransactionRepository {
    /**
     * Find transaction by ID with category
     */
    findById(id: string): Promise<TransactionWithCategory | null>;

    /**
     * Find multiple transactions by IDs with categories
     */
    findByIds(ids: string[]): Promise<TransactionWithCategory[]>;

    /**
     * Find transactions for a specific user and period
     */
    findByUserAndPeriod(userId: string, periodId: string): Promise<TransactionWithCategory[]>;

    /**
     * Save a new transaction
     */
    save(transaction: Omit<Transaction, "id" | "createdAt">): Promise<string>;

    /**
     * Delete a transaction
     */
    delete(id: string): Promise<boolean>;

    /**
     * Get aggregated totals for a period
     */
    getPeriodTotals(userId: string, periodId: string): Promise<PeriodTotals>;

    /**
     * Get transaction summary grouped by bucket/type
     */
    getTransactionsSummary(userId: string, periodId: string): Promise<Array<{
        bucket: string | null;
        type: string;
        total: number;
        count: number;
    }>>;
}