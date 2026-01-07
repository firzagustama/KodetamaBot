import { formatRupiah, Transaction, ITransactionService, IPeriodService, IBudgetService } from "@kodetama/shared";
import { CommandHandler, CommandExecutionResult, getTargetContext } from "../../core/index.js";
import { BotContext } from "../../types.js";

export class SummaryCommand extends CommandHandler {
    protected readonly commandName = "summary";

    constructor(
        private transactionService: ITransactionService,
        private periodService: IPeriodService,
        private budgetService: IBudgetService
    ) {
        super();
    }

    async execute(ctx: BotContext): Promise<CommandExecutionResult> {
        const target = ctx.targetContext || await getTargetContext(ctx);
        const targetId = target.groupId || target.userId!;
        const period = ctx.periodContext || await this.periodService.getCurrentPeriod(targetId);

        if (!period) {
            await ctx.reply("Duh, budget belum diatur. Setup dulu gih. 🤷");
            return { success: true };
        }

        const transactions = await this.transactionService.getAllTransactions(targetId, period.id);
        if (!transactions || transactions.length === 0) {
            await ctx.reply("Belum ada transaksi nih. Kosong. 📭");
            return { success: true };
        }

        // Get budget data
        const budgetData = await this.budgetService.getBudget(period.id);
        const buckets = budgetData?.buckets;

        // Separate income and expenses
        const expenses = transactions.filter(t => t.type === "expense");
        const incomes = transactions.filter(t => t.type === "income");

        // Group by bucket
        const groupedExpenses = this.groupByBucket(expenses as unknown as Transaction[]);
        const groupedIncomes = this.groupByBucket(incomes as unknown as Transaction[]);

        // Calculate totals
        const totalExpense = this.calculateTotal(expenses as unknown as Transaction[]);
        const totalIncome = this.calculateTotal(incomes as unknown as Transaction[]);
        const balance = totalIncome - totalExpense;

        // Build response
        let response = `📊 *Ringkasan ${period.name}*\n`;
        response += `${this.formatPeriodDates(period)}\n\n`;

        // Income section
        let incomeBucket: Record<string, number> = {};
        if (incomes.length > 0) {
            response += `💰 *Pemasukan* (${incomes.length})\n`;
            for (const [bucket, items] of Object.entries(groupedIncomes)) {
                const bucketTotal = this.calculateTotal(items);
                response += `\n*${bucket}* · ${formatRupiah(bucketTotal)}\n`;
                items.slice(0, 3).forEach(t => {
                    response += `  · ${t.description} · ${formatRupiah(Number(t.amount))}\n`;
                });
                if (items.length > 3) {
                    response += `  · _dan ${items.length - 3} lainnya_\n`;
                }
                incomeBucket[bucket] = bucketTotal;
            }
            response += `\n*Total Pemasukan:* ${formatRupiah(totalIncome)}\n\n`;
        }

        // Expense section with budget comparison
        if (expenses.length > 0) {
            response += `💸 *Pengeluaran* (${expenses.length})\n`;
            for (const [bucket, items] of Object.entries(groupedExpenses)) {
                const bucketTotal = this.calculateTotal(items) - incomeBucket[bucket] || 0;
                const budget = buckets?.find((b: any) => b.name === bucket);

                response += `\n*${bucket}* · ${formatRupiah(bucketTotal)}`;

                // Show budget status
                if (budget) {
                    const percentage = (bucketTotal / Number(budget.amount)) * 100;
                    const remaining = Number(budget.amount) - bucketTotal;
                    response += ` / ${formatRupiah(Number(budget.amount))}`;
                    response += this.getBudgetEmoji(percentage);
                    response += `\n  Sisa: ${formatRupiah(remaining)} (${(100 - percentage).toFixed(0)}%)`;
                }
                response += `\n`;

                items.slice(0, 3).forEach(t => {
                    response += `  · ${t.description} · ${formatRupiah(Number(t.amount))}\n`;
                });
                if (items.length > 3) {
                    response += `  · _dan ${items.length - 3} lainnya_\n`;
                }
            }
            response += `\n*Total Pengeluaran:* ${formatRupiah(totalExpense)}\n\n`;
        }

        // Balance
        response += `━━━━━━━━━━━━━━━\n`;
        response += `💼 *Saldo:* ${formatRupiah(balance)}`;
        response += balance >= 0 ? " ✅" : " ⚠️";
        response += `\n\n`;

        // Insights (Saitama style)
        response += this.generateInsights(expenses as unknown as Transaction[], incomes as unknown as Transaction[], buckets, balance);

        await ctx.reply(response, { parse_mode: "Markdown" });
        return { success: true };
    }

    private groupByBucket(transactions: Transaction[]): Record<string, Transaction[]> {
        return transactions.reduce((acc, transaction) => {
            const bucket = transaction.bucket || "Lainnya";
            if (!acc[bucket]) {
                acc[bucket] = [];
            }
            acc[bucket].push(transaction);
            return acc;
        }, {} as Record<string, Transaction[]>);
    }

    private calculateTotal(transactions: Transaction[]): number {
        return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    }

    private formatPeriodDates(period: any): string {
        const start = new Date(period.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const end = new Date(period.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${start} - ${end}`;
    }

    private getBudgetEmoji(percentage: number): string {
        if (percentage >= 90) return " 🚨";
        if (percentage >= 75) return " ⚠️";
        if (percentage >= 50) return " 📊";
        return " ✅";
    }

    private generateInsights(
        expenses: Transaction[],
        incomes: Transaction[],
        budgets: any[] | undefined,
        balance: number
    ): string {
        let insights = "*Insights:*\n";

        // Top spending category
        if (expenses.length > 0) {
            const grouped = this.groupByBucket(expenses);
            const topCategory = Object.entries(grouped)
                .map(([bucket, items]) => ({ bucket, total: this.calculateTotal(items) }))
                .sort((a, b) => b.total - a.total)[0];

            insights += `· Pengeluaran terbesar: *${topCategory.bucket}* (${formatRupiah(topCategory.total)})\n`;
        }

        // Budget warnings
        if (budgets) {
            const warnings = budgets.filter(b => {
                const spent = expenses
                    .filter(e => e.bucket === b.name)
                    .reduce((sum, e) => sum + Number(e.amount), 0);
                return (spent / Number(b.amount)) >= 0.8;
            });

            if (warnings.length > 0) {
                insights += `· ⚠️ ${warnings.length} kategori hampir habis budgetnya\n`;
            }
        }

        // Balance status
        if (balance < 0) {
            insights += `· 🚨 Defisit ${formatRupiah(Math.abs(balance))}. Kurangi pengeluaran!\n`;
        } else if (balance > 0) {
            const savingRate = incomes.length > 0 ? (balance / this.calculateTotal(incomes)) * 100 : 0;
            insights += `· ✅ Surplus ${formatRupiah(balance)} (${savingRate.toFixed(0)}% dari income)\n`;
        }

        // Saitama comment
        insights += `\n_"${this.getSaitamaComment(balance, expenses.length)}"_`;

        return insights;
    }

    private getSaitamaComment(balance: number, expenseCount: number): string {
        if (balance < 0) {
            return "Waduh, minus. Hemat dikit kali ya. 😑";
        }
        if (balance === 0) {
            return "Pas-pasan. Ya udahlah. 🤷";
        }
        if (expenseCount > 50) {
            return "Banyak banget transaksinya. Rajin ya. 💪";
        }
        if (balance > 1000000) {
            return "Lumayan tuh. Jangan boros ya. 👍";
        }
        return "Oke lah. Standar aja. ✅";
    }
}