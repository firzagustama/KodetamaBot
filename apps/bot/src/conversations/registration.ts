import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types.js";
import type { Tier } from "@kodetama/shared";
import { logger } from "../utils/logger.js";
import { savePendingRegistration, getPendingRegistration } from "../services/index.js";

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

/**
 * Registration conversation flow
 * 1. Welcome message
 * 2. Tier selection
 * 3. Send approval request to admin
 * 4. Wait for approval
 */
export async function registrationConversation(
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
        const existing = await getPendingRegistration(user.id);
        if (existing) {
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
        "*Ya udah, selamat datang.*\n\n" +
        "Gue asisten keuangan biasa. Bantu atur duit kamu.\n\n" +
        "Pilih tier yang cocok:",
        { parse_mode: "Markdown" }
    );

    // Tier selection keyboard
    const tierKeyboard = new InlineKeyboard()
        .text("Standard - Gratis", "tier_standard")
        .row()
        .text("Pro - Premium", "tier_pro")
        .row()
        .text("Family - Grup", "tier_family");

    await ctx.reply(
        "Tier apa?:\n\n" +
        "*Standard* (Gratis)\n" +
        "• Catat transaksi via chat\n" +
        "• Export ke Google Sheets\n" +
        "• Analitik dasar\n" +
        "• Klasifikasi smart\n\n" +
        "*Pro* (Premium)\n" +
        "• Semua fitur Standard\n" +
        "• Upload invoice → Google Drive\n" +
        "• Voice note → transaksi\n" +
        "• Auto-kategorisasi\n" +
        "• Ringkasan bulanan smart\n\n" +
        "*Family* (Grup)\n" +
        "• Setara fitur Pro\n" +
        "• Untuk grup Telegram\n" +
        "• Anggota grup bisa catat pengeluaran\n" +
        "• Wallet dan kategori bersama",
        { parse_mode: "Markdown", reply_markup: tierKeyboard }
    );

    // Wait for tier selection
    const tierResponse = await conversation.waitForCallbackQuery(/^tier_/);
    const selectedTier = tierResponse.callbackQuery.data.replace("tier_", "") as Tier;

    await tierResponse.answerCallbackQuery(`Tier ${selectedTier} dipilih.`);

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
    };

    try {
        const adminMessage = await ctx.api.sendMessage(
            parseInt(ADMIN_TELEGRAM_ID),
            `🆕 *Registrasi Baru*\n\n` +
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
            const registrationId = await savePendingRegistration({
                telegramId: user.id,
                username: user.username,
                firstName: user.first_name,
                requestedTier: selectedTier,
                adminMessageId: adminMessage.message_id,
            });

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
        "✨ *Terima kasih!*\n\n" +
        "Permintaan registrasimu sudah dikirim ke admin untuk di-review.\n" +
        "Kamu akan mendapat notifikasi setelah disetujui.\n\n" +
        "⏳ Mohon tunggu...",
        { parse_mode: "Markdown" }
    );
}