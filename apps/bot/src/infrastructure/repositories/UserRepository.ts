import { db } from "@kodetama/db";
import { users, telegramAccounts } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";
import type {
    User,
    UserWithTelegram,
    TelegramAccount,
    IUserRepository
} from "@kodetama/shared";

/**
 * Concrete implementation of UserRepository using Drizzle ORM
 * Following Repository Pattern - abstracts data access layer
 */
export class UserRepository implements IUserRepository {
    async findByTelegramId(telegramId: number): Promise<UserWithTelegram | null> {
        const account = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramId),
        });

        if (!account) return null;

        const user = await db.query.users.findFirst({
            where: eq(users.id, account.userId),
        });

        if (!user) return null;

        return {
            ...user,
            telegramAccount: account,
        };
    }

    async findById(id: string): Promise<User | null> {
        const user = await db.query.users.findFirst({
            where: eq(users.id, id),
        });

        return user || null;
    }

    async isRegistered(telegramId: number): Promise<boolean> {
        const account = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramId),
        });

        if (!account) return false;

        const user = await db.query.users.findFirst({
            where: eq(users.id, account.userId),
        });

        return user !== undefined && user.isActive === true;
    }

    async save(userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<string> {
        const [result] = await db.insert(users).values({
            ...userData,
            updatedAt: new Date(),
        }).returning({ id: users.id });

        return result.id;
    }

    async saveTelegramAccount(accountData: Omit<TelegramAccount, "id" | "createdAt" | "username" | "firstName" | "lastName"> & { username?: string, firstName?: string, lastName?: string }): Promise<string> {
        // Convert undefined to null for database storage
        const accountForDb = {
            ...accountData,
            username: accountData.username ?? null,
            firstName: accountData.firstName ?? null,
            lastName: accountData.lastName ?? null,
        };

        const [result] = await db.insert(telegramAccounts).values(accountForDb)
            .returning({ id: telegramAccounts.id });

        return result.id;
    }

    async updateUserIncomeSettings(
        userId: string,
        incomeDate: number,
        isIncomeUncertain: boolean
    ): Promise<void> {
        await db.update(users)
            .set({
                incomeDate,
                isIncomeUncertain,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    }

    async update(
        userId: string,
        updates: Partial<Pick<User, "tier" | "isActive"> & { incomeDate?: number; isIncomeUncertain?: boolean }>
    ): Promise<void> {
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (updates.tier !== undefined) updateData.tier = updates.tier;
        if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
        if (updates.incomeDate !== undefined) updateData.incomeDate = updates.incomeDate;
        if (updates.isIncomeUncertain !== undefined) updateData.isIncomeUncertain = updates.isIncomeUncertain;

        await db.update(users)
            .set(updateData)
            .where(eq(users.id, userId));
    }
}