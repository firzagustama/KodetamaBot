import { db } from "@kodetama/db";
import { groups, familyMembers } from "@kodetama/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type {
    Group,
    FamilyMember,
    IGroupRepository
} from "@kodetama/shared";

/**
 * Concrete implementation of GroupRepository using Drizzle ORM
 * Following Repository Pattern - abstracts data access layer
 */
export class GroupRepository implements IGroupRepository {
    async findByTelegramId(telegramGroupId: number): Promise<Group | null> {
        const group = await db.query.groups.findFirst({
            where: and(
                sql`${groups.telegramGroupId} = ${telegramGroupId}`,
                eq(groups.isActive, true)
            ),
        });

        return group || null;
    }

    async findMembers(groupId: string): Promise<FamilyMember[]> {
        const members = await db.query.familyMembers.findMany({
            where: eq(familyMembers.groupId, groupId),
        });

        return members;
    }

    async isUserMember(userId: string, groupId: string): Promise<boolean> {
        const member = await db.query.familyMembers.findFirst({
            where: and(
                eq(familyMembers.groupId, groupId),
                eq(familyMembers.userId, userId)
            ),
        });

        return member !== undefined;
    }
}