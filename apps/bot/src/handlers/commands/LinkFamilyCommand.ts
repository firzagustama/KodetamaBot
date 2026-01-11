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

        const chatType = ctx.chat.type;
        if (chatType !== "group" && chatType !== "supergroup") {
            await ctx.reply("⚠️ Perintah ini hanya bisa digunakan di dalam grup.\n\nSilakan tambahkan saya ke grup keluarga Anda, lalu ketik /link_family di sana.");
            return { success: true };
        }

        const { id: userId } = ctx.from;
        const account = ctx.userContext || await this.userService.getUserByTelegramId(userId);

        if (!account) {
            await ctx.reply("Anda belum terdaftar. Silakan ketik /start untuk mendaftar.");
            return { success: true };
        }

        if (account.tier !== "family") {
            await ctx.reply(`Maaf, fitur ini hanya untuk tier **Family**. Tier Anda saat ini: **${account.tier}**.\n\nJika ini kesalahan, silakan hubungi admin.`);
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