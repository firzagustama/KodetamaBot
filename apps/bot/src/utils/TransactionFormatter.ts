import { formatRupiah } from "@kodetama/shared";
import { InlineKeyboard } from "grammy";

/**
 * Utility class for formatting transaction-related messages
 * Following Single Responsibility Principle - only handles formatting
 */
export class TransactionFormatter {
    private static readonly bucketEmoji: Record<string, string> = {
        needs: "🏠",
        wants: "🎮",
        savings: "💵",
    };

    /**
     * Format a single transaction confirmation message
     */
    static formatTransactionConfirmation(transaction: any): string {
        return `*Transaksi Tercatat!*\n\n` +
               `📝 *${transaction.description}*\n` +
               `💰 Jumlah: ${formatRupiah(transaction.amount)}\n` +
               `📂 Kategori: ${transaction.category}\n` +
               `${this.bucketEmoji[transaction.bucket] ?? "📦"} Bucket: ${transaction.bucket}\n` +
               `_Ketik /undo untuk membatalkan_`;
    }

    /**
     * Format a single transaction confirmation message (edited version for callbacks)
     */
    static formatTransactionConfirmationForEdit(transaction: any): string {
        return `*Transaksi Tercatat!*\n\n` +
               `📝 *${transaction.description}*\n` +
               `💰 Jumlah: ${formatRupiah(transaction.amount)}\n` +
               `📂 Kategori: ${transaction.category}\n` +
               `${this.bucketEmoji[transaction.bucket] ?? "📦"} Bucket: ${transaction.bucket}\n` +
               `_Ketik /undo untuk membatalkan_\n\n` +
               `${transaction.message}`;
    }

    /**
     * Format multiple transactions confirmation request
     */
    static formatMultipleTransactionsConfirmation(
        transactions: any[],
        rawMessage: string
    ): string {
        let message = `⚠️ *Konfirmasi ${transactions.length} Transaksi*\n\n`;
        message += `Kamu menulis:\n"${rawMessage}"\n\n`;
        message += `Hasil parsing:\n`;

        transactions.forEach((t, idx) => {
            const typeEmoji = t.type === "income" ? "📥" : "📤";
            const confidenceWarning = t.confidence < 0.9 ? " ⚠️" : "";

            message += `\n${idx + 1}. ${typeEmoji} *${t.description}*${confidenceWarning}\n`;
            message += `   💰 ${formatRupiah(t.amount)}\n`;
            message += `   📂 ${t.category} ${this.bucketEmoji[t.bucket] ?? "📦"}\n`;
        });

        message += `\nSemua benar?`;
        return message;
    }

    /**
     * Get keyboard for multiple transactions confirmation
     */
    static getMultipleTransactionsKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text("✅ Ya, Simpan Semua", "confirm_multiple_transactions")
            .row()
            .text("❌ Batal", "reject_multiple_transactions");
    }

    /**
     * Format multiple transactions success summary
     */
    static formatMultipleTransactionsSuccess(transactions: any[]): string {
        let summary = `✅ *${transactions.length} Transaksi Tersimpan!*\n\n`;

        // Group by type for summary
        const income = transactions.filter(t => t.type === "income");
        const expense = transactions.filter(t => t.type === "expense");

        if (income.length > 0) {
            const totalIncome = income.reduce((sum: number, t: any) => sum + t.amount, 0);
            summary += `📥 *Pemasukan:* ${formatRupiah(totalIncome)}\n`;
            income.forEach((t: any) => {
                summary += `   • ${t.description}: ${formatRupiah(t.amount)}\n`;
            });
            summary += `\n`;
        }

        if (expense.length > 0) {
            const totalExpense = expense.reduce((sum: number, t: any) => sum + t.amount, 0);
            summary += `📤 *Pengeluaran:* ${formatRupiah(totalExpense)}\n`;
            expense.forEach((t: any) => {
                summary += `   • ${t.description}: ${formatRupiah(t.amount)}\n`;
            });
        }

        summary += `\n_Ketik /undo untuk membatalkan semua_`;
        return summary;
    }

    /**
     * Format single transaction with confidence check
     */
    static formatLowConfidenceTransaction(transaction: any, rawMessage: string, aiMessage: string): string {
        const confidenceLabel = transaction.confidence >= 0.7 ? "⚠️" : "❓";

        let message = `${confidenceLabel} *Konfirmasi Transaksi*\n\n`;
        message += `Kamu menulis: "${rawMessage}"\n\n`;
        message += `💝 *${transaction.description}*\n`;
        message += `💰 Jumlah: ${formatRupiah(transaction.amount)}\n`;
        message += `📂 Kategori: ${transaction.category}\n`;
        message += `${this.bucketEmoji[transaction.bucket] ?? "📦"} Bucket: ${transaction.bucket}\n`;
        if (aiMessage) {
            message += `${aiMessage}\n\n`;
        } else {
            message += `\n`;
        }
        message += `Boleh?`;

        return message;
    }

    /**
     * Get keyboard for single transaction confirmation
     */
    static getSingleTransactionKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text("Ok", "confirm_transaction")
            .text("Bukan", "reject_transaction");
    }

    /**
     * Get keyboard for amount confirmation
     */
    static formatAmountConfirmation(message: string, transaction: any): { text: string; keyboard: InlineKeyboard } {
        const keyboard = new InlineKeyboard()
            .text(
                `💰 ${formatRupiah(transaction.suggestedAmount!)}`,
                `confirm_amount_${transaction.suggestedAmount}`
            )
            .row()
            .text(
                `💵 ${formatRupiah(transaction.amount)}`,
                `confirm_amount_${transaction.amount}`
            );

        const text = `🤔 *Konfirmasi Jumlah*\n\n` +
                    `Kamu menulis: "${message}"\n\n` +
                    `Maksudnya:\n` +
                    `• ${formatRupiah(transaction.suggestedAmount!)} (${(transaction.suggestedAmount! / 1000).toFixed(0)}rb)?\n` +
                    `• ${formatRupiah(transaction.amount)}?\n\n` +
                    `Pilih yang benar:`;

        return { text, keyboard };
    }

    /**
     * Format rejection message
     */
    static formatRejectionMessage(originalText?: string): string {
        return `${originalText ?? "Konfirmasi Transaksi"}\n\n❌ *Transaksi Dibatalkan*\n\nSilakan ulangi dengan pesan yang lebih jelas.`;
    }
}