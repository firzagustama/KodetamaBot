import type {
    IUserService,
    DomainResult,
    UserWithTelegram,
    IUserRepository,
    IPendingRegistrationRepository
} from "@kodetama/shared";

/**
 * Application service for user operations
 * Uses repository pattern for data access
 * Following Clean Architecture principles
 */
export class UserService implements IUserService {
    constructor(
        private userRepository: IUserRepository,
        private registrationRepository: IPendingRegistrationRepository
    ) { }

    /**
     * Get user for registration flow
     */
    async getUserForRegistration(telegramId: number): Promise<DomainResult<UserWithTelegram>> {
        try {
            const user = await this.userRepository.findByTelegramId(telegramId);
            if (user) {
                return { success: true, data: user };
            }

            return {
                success: false,
                error: "User not found - needs registration"
            };
        } catch (error) {
            return {
                success: false,
                error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Register a new user with Telegram account
     */
    async registerNewUser(telegramData: {
        telegramId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        tier: UserWithTelegram["tier"];
    }): Promise<DomainResult<string>> {
        try {
            // Create user first
            const userId = await this.userRepository.save({
                tier: telegramData.tier,
                isActive: true,
            });

            // Create Telegram account
            await this.userRepository.saveTelegramAccount({
                userId,
                telegramId: telegramData.telegramId,
                username: telegramData.username,
                firstName: telegramData.firstName,
                lastName: telegramData.lastName,
            });

            return { success: true, data: userId };
        } catch (error) {
            return {
                success: false,
                error: `Failed to register user: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Update user's income settings
     */
    async updateUserIncomeSettings(
        userId: string,
        incomeDate: number,
        isIncomeUncertain: boolean
    ): Promise<DomainResult> {
        try {
            await this.userRepository.updateUserIncomeSettings(userId, incomeDate, isIncomeUncertain);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Failed to update income settings: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Approve a pending registration
     */
    async approveRegistration(
        telegramId: number,
        adminTelegramId: number
    ): Promise<DomainResult<string>> {
        try {
            const pending = await this.registrationRepository.findByTelegramId(telegramId);
            if (!pending) {
                return { success: false, error: "No pending registration found" };
            }

            // Create the user
            const result = await this.registerNewUser({
                telegramId: pending.telegramId,
                username: pending.username || undefined,
                firstName: pending.firstName || undefined,
                tier: pending.requestedTier,
            });

            if (!result.success) {
                return result;
            }

            // Update registration status
            await this.registrationRepository.updateStatus(
                telegramId,
                "approved",
                adminTelegramId
            );

            return { success: true, data: result.data };
        } catch (error) {
            return {
                success: false,
                error: `Failed to approve registration: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Reject a pending registration
     */
    async rejectRegistration(
        telegramId: number,
        adminTelegramId: number
    ): Promise<DomainResult> {
        try {
            await this.registrationRepository.updateStatus(telegramId, "rejected", adminTelegramId);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Failed to reject registration: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// =============================================================================
// LEGACY FUNCTIONS (for backward compatibility)
// These functions are kept for now but should be refactored to use the new service
// =============================================================================

import type { Tier } from "@kodetama/shared";
import { UserRepository } from "../infrastructure/repositories/index.js";
import { db } from "@kodetama/db";
import { familyMembers, pendingRegistrations, telegramAccounts } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";

// Create singleton instances for backward compatibility
let _userRepository: UserRepository | null = null;
let _userService: UserService | null = null;

function getLegacyUserService(): UserService {
    if (!_userRepository) {
        _userRepository = new UserRepository();
    }
    if (!_userService) {
        // We need to create a temporary registration repository
        // This will be replaced with proper DI later
        _userService = new UserService(_userRepository, {
            findByTelegramId: async (telegramId: number) => {
                const result = await db.query.pendingRegistrations.findFirst({
                    where: and(
                        eq(pendingRegistrations.telegramId, telegramId),
                        eq(pendingRegistrations.status, "pending")
                    ),
                });
                return result || null;
            },
            save: async (data: any) => {
                const [registration] = await db.insert(pendingRegistrations).values({
                    ...data,
                    status: "pending",
                }).returning({ id: pendingRegistrations.id });
                return registration.id;
            },
            updateStatus: async (telegramId: number, status: any, adminTelegramId: number) => {
                await db.update(pendingRegistrations)
                    .set({
                        status,
                        processedBy: adminTelegramId,
                        processedAt: new Date(),
                    })
                    .where(eq(pendingRegistrations.telegramId, telegramId));
            },
        } as any);
    }
    return _userService;
}

/**
 * LEGACY: Get user by Telegram ID - uses new repository internally
 */
export async function getUserByTelegramId(telegramId: number) {
    const service = getLegacyUserService();
    const result = await service.getUserForRegistration(telegramId);

    if (result.success && result.data) {
        return {
            ...result.data.telegramAccount,
            userId: result.data.telegramAccount.userId,
            user: result.data,
        };
    }

    return null;
}

export async function registerFamilyMember(telegramData: {
    telegramId: number;
    groupId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
}): Promise<void> {
    const service = getLegacyUserService();
    const account = await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.telegramId, telegramData.telegramId),
    });

    let userId: string;
    if (!account) {
        const user = await service.registerNewUser({
            telegramId: telegramData.telegramId,
            username: telegramData.username,
            firstName: telegramData.firstName,
            lastName: telegramData.lastName,
            tier: "family_member",
        });
        userId = user.data!;
    } else {
        userId = account.userId;
    }

    const existInGroup = await db.query.familyMembers.findFirst({
        where: and(
            eq(familyMembers.userId, userId),
            eq(familyMembers.groupId, telegramData.groupId)
        ),
    });

    if (existInGroup) {
        return;
    }

    await db.insert(familyMembers).values({
        userId,
        groupId: telegramData.groupId,
        role: "member"
    });
}

/**
 * LEGACY: Check if user is registered
 */
export async function isUserRegistered(telegramId: number): Promise<boolean> {
    if (!_userRepository) {
        _userRepository = new UserRepository();
    }
    return await _userRepository.isRegistered(telegramId);
}

/**
 * LEGACY: Create new user with Telegram account
 */
export async function createUser(data: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    tier: Tier;
}): Promise<string> {
    const service = getLegacyUserService();
    const result = await service.registerNewUser(data);

    if (result.success && result.data) {
        return result.data;
    }

    throw new Error(result.error || "Failed to create user");
}

/**
 * LEGACY: Save pending registration - direct DB access for now
 */
export async function savePendingRegistration(data: {
    telegramId: number;
    username?: string;
    firstName?: string;
    requestedTier: Tier;
    adminMessageId?: number;
}): Promise<string> {
    const [registration] = await db.insert(pendingRegistrations).values({
        telegramId: data.telegramId,
        username: data.username,
        firstName: data.firstName,
        requestedTier: data.requestedTier,
        adminMessageId: data.adminMessageId,
        status: "pending",
    }).returning({ id: pendingRegistrations.id });

    return registration.id;
}

/**
 * LEGACY: Get pending registration by Telegram ID - direct DB access for now
 */
export async function getPendingRegistration(telegramId: number) {
    return await db.query.pendingRegistrations.findFirst({
        where: and(
            eq(pendingRegistrations.telegramId, telegramId),
            eq(pendingRegistrations.status, "pending")
        ),
    });
}

/**
 * LEGACY: Update registration status - direct DB access for now
 */
export async function updateRegistrationStatus(
    telegramId: number,
    status: "approved" | "rejected",
    adminTelegramId: number
) {
    await db.update(pendingRegistrations)
        .set({
            status,
            processedBy: adminTelegramId,
            processedAt: new Date(),
        })
        .where(eq(pendingRegistrations.telegramId, telegramId));
}

/**
 * LEGACY: Approve registration and create user - uses new service
 */
export async function approveRegistration(
    telegramId: number,
    adminTelegramId: number
): Promise<string | null> {
    const service = getLegacyUserService();
    const result = await service.approveRegistration(telegramId, adminTelegramId);

    return result.success ? result.data || null : null;
}

/**
 * LEGACY: Reject registration - uses new service
 */
export async function rejectRegistration(
    telegramId: number,
    adminTelegramId: number
): Promise<void> {
    const service = getLegacyUserService();
    const result = await service.rejectRegistration(telegramId, adminTelegramId);

    if (!result.success) {
        throw new Error(result.error || "Failed to reject registration");
    }
}

/**
 * LEGACY: Update user income settings - direct DB access for now
 */
export async function updateUserIncomeSettings(
    userId: string,
    incomeDate: number,
    isIncomeUncertain: boolean
) {
    if (!_userRepository) {
        _userRepository = new UserRepository();
    }
    await _userRepository.updateUserIncomeSettings(userId, incomeDate, isIncomeUncertain);
}