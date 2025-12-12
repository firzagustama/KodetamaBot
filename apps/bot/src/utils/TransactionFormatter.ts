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
        return `*Udah, kecatet.* 😐\n\n` +
            `📝 *${transaction.description}*\n` +
            `💸 Duit: ${formatRupiah(transaction.amount)}\n` +
            `📂 Buat: ${transaction.category}\n` +
            `${this.bucketEmoji[transaction.bucket] ?? "📦"} Pos: ${transaction.bucket}\n` +
            `_Salah ketik? /undo aja cepetan._`;
    }

    /**
     * Format a single transaction confirmation message (edited version for callbacks)
     */
    static formatTransactionConfirmationForEdit(transaction: any): string {
        return `*Udah, kecatet.* 😐\n\n` +
            `📝 *${transaction.description}*\n` +
            `💸 Duit: ${formatRupiah(transaction.amount)}\n` +
            `📂 Buat: ${transaction.category}\n` +
            `${this.bucketEmoji[transaction.bucket] ?? "📦"} Pos: ${transaction.bucket}\n` +
            `_Salah ketik? /undo aja cepetan._\n\n` +
            `${transaction.message}`;
    }

    /**
     * Format multiple transactions confirmation request
     */
    static formatMultipleTransactionsConfirmation(
        transactions: any[],
    ): string {
        let message = `⚠️ *Cek dulu, bener gak nih?* (${transactions.length} item)\n\n`;

        transactions.forEach((t) => {
            const typeEmoji = t.type === "income" ? "📥" : "📤";
            const confidenceWarning = t.confidence < 0.9 ? " 🤨" : "";
            t.amount = t.suggestedAmount;

            message += `\n${typeEmoji} *${t.description}*${confidenceWarning}\n`;
            message += `💸 ${formatRupiah(t.amount)}${t.confidence < 0.9 ? "?" : ""}\n`;
            message += `📂 ${t.category} ${this.bucketEmoji[t.bucket] ?? "📦"}\n`;
        });

        message += `\nGimana? Bungkus?`;
        return message;
    }

    /**
     * Get keyboard for multiple transactions confirmation
     */
    static getMultipleTransactionsKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text("👊 Sikat", "confirm_multiple_transactions")
            .row()
            .text("✋ Gak jadi", "reject_multiple_transactions");
    }

    /**
     * Format multiple transactions success summary
     */
    static formatMultipleTransactionsSuccess(transactions: any[]): string {
        let summary = `✅ *Beres. ${transactions.length} data masuk.* 💨\n\n`;

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

        summary += `\n_Mau batalin semua? /undo_`;
        return summary;
    }

    /**
     * Format single transaction with confidence check
     */
    static formatLowConfidenceTransaction(transaction: any, rawMessage: string, aiMessage: string): string {
        const confidenceLabel = transaction.confidence >= 0.7 ? "⚠️" : "❓";

        // Saitama style: Confused but trying to help
        let message = `${confidenceLabel} *Hah? Maksudnya gini?* 🤨\n\n`;
        message += `Tadi nulis: "${rawMessage}"\n\n`;
        message += `Mungkin maksudnya:\n`;
        message += `💝 *${transaction.description}*\n`;
        message += `💸 Duit: ${formatRupiah(transaction.amount)}\n`;
        message += `📂 Buat: ${transaction.category}\n`;
        message += `${this.bucketEmoji[transaction.bucket] ?? "📦"} Pos: ${transaction.bucket}\n`;
        if (aiMessage) {
            message += `\nKata AI: ${aiMessage}\n\n`;
        } else {
            message += `\n`;
        }
        message += `Bener gak?`;

        return message;
    }

    /**
     * Get keyboard for single transaction confirmation
     */
    static getSingleTransactionKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text("Yoi, bener", "confirm_transaction")
            .text("Ngaco", "reject_transaction");
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

        // Saitama style: Annoyed by ambiguity
        const text = `🤔 *Nulis angka yang jelas napa...*\n\n` +
            `Tadi nulis: "${message}"\n\n` +
            `Yang mana nih:\n` +
            `• ${formatRupiah(transaction.suggestedAmount!)} (${(transaction.suggestedAmount! / 1000).toFixed(0)}rb)?\n` +
            `• ${formatRupiah(transaction.amount)}?\n\n` +
            `Pencet yang bener:`;

        return { text, keyboard };
    }

    /**
     * Format rejection message
     */
    static formatRejectionMessage(originalText?: string): string {
        // Saitama style: Indifferent rejection
        return `${originalText ?? "Konfirmasi Transaksi"}\n\n❌ *Yaudah, batal.*\n\nCoba tulis lagi yang bener.`;
    }
}