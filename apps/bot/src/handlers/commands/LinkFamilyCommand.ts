import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult } from "../../core/index.js";
import { IGroupService, IUserService } from "@kodetama/shared";

/**
 * Handles /link_family command - link group chat to family budget
 * Works for both private chats (personal budget) and group chats (family budget)
 */
export class LinkFamilyCommand extends CommandHandler {
    protected readonly commandName = "link_family";

    constructor(
        private groupService: IGroupService,
        private userService: IUserService
    ) {
        super();
    }

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        if (!ctx.chat || !ctx.from) {
            await ctx.reply("Boleh lewat chat atau grup ya");
            return { success: true };
        }

        const { id: userId } = ctx.from;
        const account = await this.userService.getUserByTelegramId(userId);
        if (!account || account.tier !== "family") {
            await ctx.reply("Anda belum terdaftar, silahkan daftar terlebih dahulu");
            return { success: true };
        }

        const { id: groupId, title: groupName } = ctx.chat;
        if (await this.groupService.groupExists(groupId)) {
            await ctx.reply("Grup sudah terdaftar");
            return { success: true };
        }

        await this.groupService.createGroup({
            telegramGroupId: groupId,
            name: groupName || "Family Group",
            ownerId: account.id
        });

        await ctx.reply("Grup berhasil terdaftar! Ketik /start untuk mulai mengatur budget");
        return { success: true };
    }
}