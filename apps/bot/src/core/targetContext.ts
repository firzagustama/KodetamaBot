import type { BotContext } from "../types.js";
import { GroupRepository } from "../infrastructure/repositories/index.js";
import { getUserByTelegramId } from "../services/index.js";

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
        throw new Error("Kamu belum terdaftar, ketik /start untuk memulai");
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
        throw new Error("Grup ini belum terdaftar, ketika /link_family untuk mengaktifkan grup ini.");
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