import type { BotContext } from "../types.js";
import { GroupRepository } from "../infrastructure/repositories/index.js";
import { getUserByTelegramId } from "../services/index.js";
import { db } from "@kodetama/db";
import { groups, users, familyMembers } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";

export interface TargetContext {
    isGroup: boolean;
    targetId: string; // userId for private, groupId for group
    userId: string; // always the individual user
    groupId?: string; // present only in group context
}

/**
 * Determine the target context from bot context
 * Returns information about whether we're in group or private chat
 * and the appropriate targetId for operations
 */
export async function getTargetContext(ctx: BotContext): Promise<TargetContext> {
    const user = ctx.from;
    if (!user) {
        throw new Error("No user information");
    }

    const account = await getUserByTelegramId(user.id);
    if (!account) {
        throw new Error("User not registered");
    }

    // Check if this is a group chat
    const isGroupChat = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

    if (!isGroupChat) {
        // Private chat - use individual userId
        return {
            isGroup: false,
            targetId: account.userId,
            userId: account.userId,
        };
    }

    // Group chat - need to verify group exists and user is member
    const groupRepo = new GroupRepository();
    let group = await groupRepo.findByTelegramId(ctx.chat!.id);

    if (!group) {
        // Check if user can register this group (Family tier)
        const userRecord = await db.query.users.findFirst({
            where: eq(users.id, account.userId),
        });

        if (userRecord?.tier === "family") {
            // Auto-create group for Family tier user
            const [newGroup] = await db.insert(groups).values({
                telegramGroupId: ctx.chat!.id,
                name: ctx.chat!.title || `Group ${ctx.chat!.id}`,
                ownerId: account.userId,
                isActive: true,
            }).returning();

            group = newGroup;

            // Add owner as family member
            await db.insert(familyMembers).values({
                groupId: newGroup.id,
                userId: account.userId,
                role: "owner",
            });
        } else {
            throw new Error("Grup ini belum terdaftar untuk fitur keluarga. Hubungi owner grup atau upgrade ke tier Family!");
        }
    }

    const isMember = await groupRepo.isUserMember(account.userId, group.id);
    if (!isMember) {
        throw new Error("Kamu bukan anggota grup keluarga ini.");
    }

    return {
        isGroup: true,
        targetId: group.id,
        userId: account.userId,
        groupId: group.id,
    };
}