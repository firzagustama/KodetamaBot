import type { PendingRegistration } from "@kodetama/shared";

/**
 * Repository interface for PendingRegistration domain operations
 */
export interface IPendingRegistrationRepository {
    /**
     * Find pending registration by Telegram ID
     */
    findByTelegramId(telegramId: number): Promise<PendingRegistration | null>;

    /**
     * Save a new pending registration
     */
    save(registration: Omit<PendingRegistration, "id" | "createdAt">): Promise<string>;

    /**
     * Update registration status
     */
    updateStatus(
        telegramId: number,
        status: PendingRegistration["status"],
        adminTelegramId: number
    ): Promise<void>;
}