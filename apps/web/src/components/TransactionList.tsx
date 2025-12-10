import { useStore } from "../stores/useStore";
import {
    ArrowUpRight,
    ArrowDownLeft,
    ArrowRightLeft,
    Settings,
    Receipt,
    Calendar,
    Tag
} from "lucide-react";

// --- Helpers ---
function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0, // Simplify for mobile readability
    }).format(amount);
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Smart Date Labels (Hari ini, Kemarin, or Full Date)
    if (date.toDateString() === today.toDateString()) {
        return "Hari Ini";
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return "Kemarin";
    }

    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long", // "Oktober" instead of "Okt" looks better in headers
        year: "numeric",
    });
}

function getDateKey(dateStr: string): string {
    return new Date(dateStr).toISOString().split('T')[0];
}

// --- Component ---
export default function TransactionList() {
    const { transactions } = useStore();

    // 1. Empty State
    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center">
                    <Receipt size={40} className="text-base-content/30" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-base-content">Belum ada transaksi</h3>
                    <p className="text-sm text-base-content/50 max-w-xs mx-auto">
                        Mulai catat pengeluaranmu dengan mengirim pesan ke bot Telegram.
                    </p>
                </div>
            </div>
        );
    }

    // 2. Grouping Logic
    const transactionsByDate: Record<string, typeof transactions> = {};
    for (const tx of transactions) {
        const dateKey = getDateKey(tx.transactionDate);
        if (!transactionsByDate[dateKey]) {
            transactionsByDate[dateKey] = [];
        }
        transactionsByDate[dateKey].push(tx);
    }

    // Sort: Newest dates first
    const sortedDates = Object.keys(transactionsByDate).sort((a, b) => b.localeCompare(a));

    return (
        <div className="space-y-6 pb-6 animate-fade-in">
            {/* Header Summary */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-lg font-bold">Riwayat Transaksi</h2>
                    <p className="text-xs text-base-content/60">
                        Total {transactions.length} aktivitas tercatat
                    </p>
                </div>
            </div>

            {/* List Groups */}
            <div className="space-y-5">
                {sortedDates.map((dateKey) => {
                    const dayTransactions = transactionsByDate[dateKey];
                    // Sort within day: newest first (assuming ID correlates with time or you have a timestamp)
                    // dayTransactions.sort((a, b) => b.id - a.id); 

                    const totalDayAmount = dayTransactions.reduce((sum, tx) =>
                        sum + (tx.type === "income" ? tx.amount : -tx.amount), 0
                    );

                    return (
                        <div key={dateKey} className="space-y-2">
                            {/* Date Header */}
                            <div className="sticky top-0 z-10 flex items-center justify-between px-2 py-2 bg-base-100/95 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-base-content/40" />
                                    <h3 className="text-sm font-bold text-base-content">
                                        {formatDate(dayTransactions[0].transactionDate)}
                                    </h3>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${totalDayAmount >= 0
                                        ? "bg-success/10 text-success"
                                        : "bg-base-200 text-base-content/60"
                                    }`}>
                                    {totalDayAmount >= 0 ? "+" : ""}
                                    {formatRupiah(Math.abs(totalDayAmount))}
                                </span>
                            </div>

                            {/* Transactions Sheet */}
                            <div className="bg-base-100 border border-base-200 shadow-sm rounded-2xl overflow-hidden divide-y divide-base-200">
                                {dayTransactions.map((tx) => (
                                    <TransactionItem key={tx.id} tx={tx} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- Sub-Component: Individual Row ---
function TransactionItem({ tx }: { tx: any }) {

    // Configuration for icons/colors
    const getConfig = (type: string) => {
        switch (type) {
            case "income":
                return {
                    icon: <ArrowUpRight size={18} />,
                    bg: "bg-success/10",
                    text: "text-success",
                    sign: "+"
                };
            case "expense":
                return {
                    icon: <ArrowDownLeft size={18} />,
                    bg: "bg-error/10",
                    text: "text-error",
                    sign: "-"
                };
            case "transfer":
                return {
                    icon: <ArrowRightLeft size={18} />,
                    bg: "bg-info/10",
                    text: "text-info",
                    sign: ""
                };
            default:
                return {
                    icon: <Settings size={18} />,
                    bg: "bg-base-200",
                    text: "text-base-content/60",
                    sign: ""
                };
        }
    };

    const config = getConfig(tx.type);

    return (
        <div className="flex items-center justify-between p-3.5 hover:bg-base-200/30 transition-colors active:bg-base-200/50">
            <div className="flex items-center gap-3.5 overflow-hidden">
                {/* Icon Circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bg} ${config.text}`}>
                    {config.icon}
                </div>

                {/* Text Details */}
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate text-base-content">
                        {tx.description}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-base-content/50">
                        <Tag size={10} />
                        <span className="truncate max-w-[120px]">{tx.category}</span>
                        <span className="text-base-content/20">•</span>
                        <span>{tx.bucket}</span>
                    </div>
                </div>
            </div>

            {/* Amount */}
            <div className={`text-sm font-bold whitespace-nowrap ${config.text}`}>
                {config.sign} {formatRupiah(tx.amount)}
            </div>
        </div>
    );
}