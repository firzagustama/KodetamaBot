import type {
    User,
    UserWithTelegram,
    TelegramAccount
} from "@kodetama/shared";

/**
 * Repository interface for User domain operations
 * Following Domain-Driven Design principles
 */
export interface IUserRepository {
    /**
     * Find user with Telegram account by Telegram ID
     */
    findByTelegramId(telegramId: number): Promise<UserWithTelegram | null>;

    /**
     * Find user by database ID
     */
    findById(id: string): Promise<User | null>;

    /**
     * Check if a user is registered (has active account)
     */
    isRegistered(telegramId: number): Promise<boolean>;

    /**
     * Save a new user
     */
    save(userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<string>;

    /**
     * Save a Telegram account for a user
     */
    saveTelegramAccount(accountData: Omit<TelegramAccount, "id" | "createdAt">): Promise<string>;

    /**
     * Update user's income settings
     */
    updateUserIncomeSettings(userId: string, incomeDate: number, isIncomeUncertain: boolean): Promise<void>;

    /**
     * Update user data
     */
    update(userId: string, updates: Partial<Pick<User, "tier" | "isActive"> & { incomeDate?: number; isIncomeUncertain?: boolean }>): Promise<void>;
}