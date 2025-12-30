import type { BotContext } from "../../types.js";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import { IUserService, IGroupService, IPeriodService, IBudgetService } from "@kodetama/shared";
import { InlineKeyboard } from "grammy";

/**
 * Handles /start command - registration and welcome flow
 */
export class StartCommand extends CommandHandler {
    protected readonly commandName = "start";

    constructor(
        private userService: IUserService,
        private groupService: IGroupService,
        private periodService: IPeriodService,
        private budgetService: IBudgetService
    ) {
        super();
    }

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        const user = ctx.from;
        if (!user) {
            return { success: false, error: new Error("No user information") };
        }

        // ✅ Extract payload safely (Grammy)
        const text = ctx.message?.text ?? "";
        const payload = text.split(" ").slice(1).join(" ") || null;

        if (payload) {
            if (payload.startsWith("join_")) {
                // @ts-ignore - registerFamilyMember might have different signature in service
                await this.groupService.inviteMember(
                    user.id,
                    payload.split("_")[1],
                    "member",
                    "system" // Placeholder for inviterId
                );

                await ctx.reply("Berhasil bergabung ke keluarga! Langsung aja catat keuangan di group sambil mention gue ya!");
                return { success: true };
            }
        }

        // Check if user is already registered
        let isRegistered = false;
        try {
            const result = await this.userService.getUserForRegistration(user.id);
            isRegistered = result.success;
        } catch (error) {
            console.error("Error checking registration:", error);
            return { success: false, error: error as Error };
        }

        if (!isRegistered) {
            // Start registration conversation
            await ctx.conversation.enter("registrationConversation");
            return { success: true };
        }

        // Get target context for period resolution
        const target = ctx.targetContext || await getTargetContext(ctx);
        const targetId = target.groupId || target.userId!;

        // Silent onboarding: Ensure period and budget exist
        let currentPeriodId = ctx.periodContext?.id || await this.periodService.resolvePeriodId(targetId);

        if (!currentPeriodId) {
            // Create default period and budget
            const now = new Date();
            const incomeDate = 1; // Default
            currentPeriodId = await this.periodService.ensurePeriodExists(targetId, now, incomeDate);

            // Create default unallocated budget
            await this.budgetService.upsertBudget({
                periodId: currentPeriodId,
                estimatedIncome: 0,
            });
        }

        // Build keyboard with Mini App if URL is configured
        const keyboard = new InlineKeyboard();
        let hasWebApp = false;

        const WEB_APP_URL = process.env.WEB_APP_URL;
        if (WEB_APP_URL) {
            try {
                // Basic validation to prevent obvious crashes
                new URL(WEB_APP_URL);
                keyboard.webApp("Dashboard", WEB_APP_URL);
                hasWebApp = true;
            } catch (e) {
                console.warn(`Invalid WEB_APP_URL: ${WEB_APP_URL}`);
            }
        }

        const welcomeMessage =
            "Selamat datang kembali! 👋\n\n" +
            "Gue siap bantu catat keuangan lo. Fitur yang bisa lo pake:\n" +
            "✅ **Catat Transaksi**: `makan 20rb`, `gaji 10jt`\n" +
            "✅ **Upload Invoice**: Kirim foto struk/invoice (Pro/Family)\n" +
            "✅ **Voice Note**: Rekam pengeluaran lo (Pro/Family)\n" +
            "✅ **Budgeting**: Otomatis tracking budget bulanan\n\n" +
            "Langsung aja chat pengeluaran pertama lo sekarang! 👇";

        try {
            await ctx.reply(welcomeMessage, {
                parse_mode: "Markdown",
                reply_markup: hasWebApp ? keyboard : undefined,
            });
            return { success: true };
        } catch (error) {
            // Fallback if Telegram rejects the button (e.g. invalid URL)
            console.warn("Failed to send welcome message with keyboard, retrying without:", error);
            await ctx.reply(welcomeMessage, {
                parse_mode: "Markdown",
            });
            return { success: true };
        }
    }
}