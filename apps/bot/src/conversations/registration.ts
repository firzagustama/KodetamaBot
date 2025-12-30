import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import type { Tier } from "@kodetama/shared";
import { logger } from "../utils/logger.js";
import type { IUserService } from "@kodetama/shared";

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

/**
 * Registration conversation flow
 * 1. Welcome message
 * 2. Tier selection
 * 3. Send approval request to admin
 * 4. Wait for approval
 */
export function createRegistrationConversation(
    userService: IUserService
) {
    return async function registrationConversation(
        conversation: Conversation<BotContext>,
        ctx: BotContext
    ): Promise<void> {
        const user = ctx.from;
        if (!user) {
            await ctx.reply("Maaf, terjadi kesalahan. Silakan coba lagi.");
            return;
        }

        // Check if user already has pending registration
        try {
            const existing = await userService.getPendingRegistration(user.id);
            if (existing.success && existing.data) {
                await ctx.reply(
                    "*Registrasi pending.*\n\n" +
                    "Kamu sudah punya registrasi yang nunggu approval admin.\n" +
                    "Tunggu konfirmasi.",
                    { parse_mode: "Markdown" }
                );
                return;
            }
        } catch (error) {
            // DB might not be connected, continue with registration
            logger.warn("Could not check existing registration:", error);
        }

        // Welcome message
        await ctx.reply(
            "*Selamat datang di Kodetama Bot!* 🤖\n\n" +
            "Gue bisa bantu lo:\n" +
            "✅ Catat pengeluaran via chat (`makan 20rb`)\n" +
            "✅ Kirim foto struk/invoice buat dicatat\n" +
            "✅ Analisis keuangan simpel\n\n" +
            "⚠️ *PENTING: Bot ini masih tahap BETA.*\n" +
            "Mungkin ada bug atau fitur yang berubah.",
            { parse_mode: "Markdown" }
        );

        // Beta confirmation keyboard
        const betaKeyboard = new InlineKeyboard()
            .text("🚀 Gas", "beta_yes")
            .text("❌ Gak", "beta_no");

        await ctx.reply(
            "Mau ikutan jadi Beta Tester?\n" +
            "_Psst_ lo juga bisa pakai bot ini di grup bareng keluarga loh...",
            { parse_mode: "Markdown", reply_markup: betaKeyboard }
        );

        // Wait for beta selection
        const betaResponse = await conversation.waitForCallbackQuery(/^beta_/);
        const betaChoice = betaResponse.callbackQuery.data;
        await betaResponse.answerCallbackQuery();

        if (betaChoice === "beta_no") {
            await ctx.reply("Oke, siap. Kalau berubah pikiran, ketik /start lagi ya. 👋");
            return;
        }

        // Default to Family tier for beta testers
        const selectedTier: Tier = "family";

        // Store registration data in session
        conversation.session.registrationData = {
            telegramId: user.id,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            selectedTier,
        };

        // Send approval request to admin
        if (!ADMIN_TELEGRAM_ID) {
            logger.error("ADMIN_TELEGRAM_ID not configured");
            await ctx.reply(
                "Maaf, sistem sedang dalam maintenance. Silakan coba lagi nanti."
            );
            return;
        }

        const approvalKeyboard = new InlineKeyboard()
            .text("✅ Approve", `approve_${user.id}`)
            .text("❌ Reject", `reject_${user.id}`);

        const tierLabels: Record<Tier, string> = {
            standard: "📊 Standard",
            pro: "⭐ Pro",
            family: "👨‍👩‍👧‍👦 Family",
            family_member: "👨‍👩‍👧‍👦 Family Member",
        };

        try {
            const adminMessage = await ctx.api.sendMessage(
                parseInt(ADMIN_TELEGRAM_ID),
                `🆕 *Registrasi Baru (BETA)*\n\n` +
                `👤 *User:* ${user.first_name} ${user.last_name ?? ""}\n` +
                `📛 *Username:* @${user.username ?? "tidak ada"}\n` +
                `🆔 *ID:* \`${user.id}\`\n` +
                `📦 *Tier:* ${tierLabels[selectedTier]}\n\n` +
                `Waktu: ${new Date().toLocaleString("id-ID")}`,
                { parse_mode: "Markdown", reply_markup: approvalKeyboard }
            );

            logger.info(`Registration request sent to admin for user ${user.id}`);

            // Save to database
            try {
                const savePendingRegistration = await userService.savePendingRegistration({
                    telegramId: user.id,
                    username: user.username,
                    firstName: user.first_name,
                    requestedTier: selectedTier,
                    adminMessageId: adminMessage.message_id,
                })
                if (!savePendingRegistration.success) {
                    await ctx.reply("Maaf, sistem lagi sibuk. Silakan coba lagi nanti.");
                    return;
                }
                const registrationId = savePendingRegistration.data;
                conversation.session.registrationData.registrationId = registrationId;
                logger.info(`Registration saved to DB: ${registrationId}`);
            } catch (dbError) {
                // Log but don't fail - admin can still approve manually
                logger.error("Failed to save registration to DB:", dbError);
            }

        } catch (error) {
            logger.error("Failed to send approval request to admin:", error);
            await ctx.reply(
                "Maaf, gagal mengirim request ke admin. Silakan coba lagi nanti."
            );
            return;
        }

        // Notify user that request is pending
        await ctx.reply(
            "✨ *Sip, Request Terkirim!*\n\n" +
            "Admin lagi review pendaftaran lo.\n" +
            "Tunggu notifikasi selanjutnya ya.\n\n" +
            "⏳ *Status: Pending Approval*",
            { parse_mode: "Markdown" }
        );
    }
}