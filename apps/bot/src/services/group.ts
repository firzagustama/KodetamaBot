import type {
    IGroupService,
    IGroupRepository,
    DomainResult,
    Group,
    FamilyMember
} from "@kodetama/shared";
import { GroupRepository } from "../infrastructure/repositories/index.js";
import { db } from "@kodetama/db";
import { groups } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";

/**
 * Application service for group operations
 * Uses repository pattern for data access
 * Following Clean Architecture principles
 */
export class GroupService implements IGroupService {
    constructor(
        private groupRepository: IGroupRepository
    ) { }

    /**
     * Create a new group
     */
    async createGroup(ownerData: {
        telegramGroupId: number;
        name: string;
        ownerId: string;
    }): Promise<DomainResult<string>> {
        try {
            // Check if group already exists
            const existingGroup = await this.groupRepository.findByTelegramId(ownerData.telegramGroupId);
            if (existingGroup) {
                return {
                    success: false,
                    error: "Group already exists with this Telegram group ID"
                };
            }

            // Create the group
            const groupId = await this.groupRepository.save({
                telegramGroupId: ownerData.telegramGroupId,
                name: ownerData.name,
                ownerId: ownerData.ownerId,
                isActive: true,
            });

            // Add owner as member with "owner" role
            await this.groupRepository.addMember({
                groupId,
                userId: ownerData.ownerId,
                role: "owner",
            });

            return { success: true, data: groupId };
        } catch (error) {
            return {
                success: false,
                error: `Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Invite a member to the group
     */
    async inviteMember(
        _telegramId: number,
        _groupId: string,
        _role: "member" | "admin",
        _inviterId: string
    ): Promise<DomainResult> {
        try {
            // Check if inviter has permission (owner or admin)
            // This would need proper user resolution, but for now assume inviter is valid

            // We need the userId for the invited telegramId
            // This service should not directly query telegram, should use UserRepository
            // For now, throw error as proper userId resolution is needed
            return {
                success: false,
                error: "User resolution not implemented - need to resolve telegramId to userId"
            };

            // In proper implementation:
            // const user = await this.userRepository.findByTelegramId(telegramId);
            // if (!user) return { success: false, error: "User not found" };

            // // Check if already member
            // const isAlreadyMember = await this.groupRepository.isUserMember(user.id, groupId);
            // if (isAlreadyMember) return { success: false, error: "User is already a member" };

            // // Add member
            // await this.groupRepository.addMember({
            //     groupId,
            //     userId: user.id,
            //     role,
            // });

            // return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Failed to invite member: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Remove a member from the group
     */
    async removeMemberFromGroup(
        memberUserId: string,
        groupId: string,
        requesterId: string
    ): Promise<DomainResult> {
        try {
            // Check if requester has permission (owner, admin, or self-removal)
            const groupWithOwner = await this.groupRepository.findWithOwner(groupId);
            if (!groupWithOwner) {
                return { success: false, error: "Group not found" };
            }

            // Only owner can remove members (for now - can be extended)
            if (groupWithOwner.ownerId !== requesterId) {
                return {
                    success: false,
                    error: "Only group owner can remove members"
                };
            }

            // Cannot remove owner
            if (memberUserId === groupWithOwner.ownerId) {
                return {
                    success: false,
                    error: "Cannot remove group owner"
                };
            }

            // Remove member
            const removed = await this.groupRepository.removeMember(groupId, memberUserId);
            if (!removed) {
                return { success: false, error: "Member not found in group" };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get group with its members
     */
    async getGroupWithMembers(groupId: string): Promise<DomainResult<Group & { members: FamilyMember[] }>> {
        try {
            const group = await db.query.groups.findFirst({
                where: eq(groups.id, groupId),
            }) as Group | null;

            if (!group) {
                return { success: false, error: "Group not found" };
            }

            const members = await this.groupRepository.findMembers(groupId);

            return {
                success: true,
                data: { ...group, members }
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to get group with members: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get all groups for a user
     */
    async getUserGroups(userId: string): Promise<DomainResult<Group[]>> {
        try {
            // Find groups where user is a member
            // This requires querying familyMembers then groups
            // For simplicity, return owned groups for now
            const ownedGroups = await this.groupRepository.findByOwner(userId);

            // TODO: Also include groups where user is a member but not owner
            // Need to query through familyMembers table

            return { success: true, data: ownedGroups };
        } catch (error) {
            return {
                success: false,
                error: `Failed to get user groups: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// =============================================================================
// LEGACY FUNCTIONS (for backward compatibility)
// These functions are kept for now but should be refactored to use the new service
// =============================================================================

// Create singleton instances for backward compatibility
let _groupRepository: GroupRepository | null = null;
let _groupService: GroupService | null = null;

function getLegacyGroupService(): GroupService {
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    if (!_groupService) {
        _groupService = new GroupService(_groupRepository);
    }
    return _groupService;
}

/**
 * LEGACY: Find group by Telegram ID
 */
export async function findGroupByTelegramId(telegramGroupId: number): Promise<Group | null> {
    getLegacyGroupService();
    // Direct call to repository method is acceptable for simple queries
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    return await _groupRepository.findByTelegramId(telegramGroupId);
}

/**
 * LEGACY: Check if group exists
 */
export async function groupExists(telegramGroupId: number): Promise<boolean> {
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    const group = await _groupRepository.findByTelegramId(telegramGroupId);
    return group !== null;
}

/**
 * LEGACY: Create a new group
 */
export async function createGroup(data: {
    telegramGroupId: number;
    name: string;
    ownerId: string;
}): Promise<string> {
    const service = getLegacyGroupService();
    const result = await service.createGroup(data);

    if (result.success && result.data) {
        return result.data;
    }

    throw new Error(result.error || "Failed to create group");
}

/**
 * LEGACY: Find group members
 */
export async function findGroupMembers(groupId: string): Promise<FamilyMember[]> {
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    return await _groupRepository.findMembers(groupId);
}

/**
 * LEGACY: Check if user is member
 */
export async function isUserGroupMember(userId: string, groupId: string): Promise<boolean> {
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    return await _groupRepository.isUserMember(userId, groupId);
}

/**
 * LEGACY: Add member to group
 */
export async function addGroupMember(data: {
    groupId: string;
    userId: string;
    role: string;
}): Promise<string> {
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    return await _groupRepository.addMember(data);
}

/**
 * LEGACY: Remove member from group
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
    if (!_groupRepository) {
        _groupRepository = new GroupRepository();
    }
    return await _groupRepository.removeMember(groupId, userId);
}