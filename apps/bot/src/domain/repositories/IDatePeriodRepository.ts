import type { DatePeriod } from "@kodetama/shared";

/**
 * Repository interface for DatePeriod domain operations
 */
export interface IDatePeriodRepository {
    /**
     * Find date period by ID
     */
    findById(id: string): Promise<DatePeriod | null>;

    /**
     * Find the current active period for a user
     */
    findCurrentByUserId(userId: string): Promise<DatePeriod | null>;

    /**
     * Save a new date period
     */
    save(period: Omit<DatePeriod, "id" | "createdAt">): Promise<string>;

    /**
     * Set a period as current for a user (deactivating others)
     */
    setCurrent(userId: string, periodId: string): Promise<void>;

    /**
     * Find periods for a user within a date range
     */
    findByUserDateRange(userId: string, startDate: Date, endDate: Date): Promise<DatePeriod[]>;
}