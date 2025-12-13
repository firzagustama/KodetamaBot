import type { Group, FamilyMember } from "@kodetama/shared";

/**
 * Repository interface for Group domain operations
 */
export interface IGroupRepository {
    /**
     * Find group by Telegram group ID
     */
    findByTelegramId(telegramGroupId: number): Promise<Group | null>;

    /**
     * Find group members by group ID
     */
    findMembers(groupId: string): Promise<FamilyMember[]>;

    /**
     * Check if user is a member of the group
     */
    isUserMember(userId: string, groupId: string): Promise<boolean>;

    /**
     * Save a new group
     */
    save(group: Omit<Group, "id" | "createdAt">): Promise<string>;

    /**
     * Add a member to the group
     */
    addMember(familyMember: Omit<FamilyMember, "id" | "joinedAt">): Promise<string>;

    /**
     * Remove a member from the group
     */
    removeMember(groupId: string, userId: string): Promise<boolean>;

    /**
     * Update a member's role in the group
     */
    updateMemberRole(groupId: string, userId: string, role: string): Promise<void>;

    /**
     * Find group with owner details
     */
    findWithOwner(groupId: string): Promise<(Group & { owner: { telegramAccount: { telegramId: number; username?: string; firstName?: string } } }) | null>;

    /**
     * Find groups owned by a user
     */
    findByOwner(ownerId: string): Promise<Group[]>;
}