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

    async save(group: Omit<Group, "id" | "createdAt">): Promise<string> {
        const [savedGroup] = await db.insert(groups).values(group).returning({ id: groups.id });
        return savedGroup.id;
    }

    async addMember(familyMember: Omit<FamilyMember, "id" | "joinedAt">): Promise<string> {
        const [savedMember] = await db.insert(familyMembers).values(familyMember).returning({ id: familyMembers.id });
        return savedMember.id;
    }

    async removeMember(groupId: string, userId: string): Promise<boolean> {
        const result = await db.delete(familyMembers)
            .where(and(
                eq(familyMembers.groupId, groupId),
                eq(familyMembers.userId, userId)
            ))
            .returning({ id: familyMembers.id });

        return result.length > 0;
    }

    async updateMemberRole(groupId: string, userId: string, role: string): Promise<void> {
        await db.update(familyMembers)
            .set({ role })
            .where(and(
                eq(familyMembers.groupId, groupId),
                eq(familyMembers.userId, userId)
            ));
    }

    async findWithOwner(groupId: string): Promise<(Group & { owner: { telegramAccount: { telegramId: number; username?: string; firstName?: string } } }) | null> {
        const result = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
            with: {
                owner: {
                    with: {
                        telegramAccount: {
                            columns: {
                                telegramId: true,
                                username: true,
                                firstName: true,
                            }
                        }
                    }
                }
            }
        });

        return result as any || null;
    }

    async findByOwner(ownerId: string): Promise<Group[]> {
        return await db.query.groups.findMany({
            where: and(
                eq(groups.ownerId, ownerId),
                eq(groups.isActive, true)
            ),
        });
    }
}