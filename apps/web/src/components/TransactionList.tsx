import { useStore } from "../stores/useStore";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
    });
}

export default function TransactionList() {
    const { transactions } = useStore();

    const typeConfig = {
        income: { icon: "📈", color: "text-success", label: "Pemasukan" },
        expense: { icon: "📉", color: "text-error", label: "Pengeluaran" },
        transfer: { icon: "↔️", color: "text-primary", label: "Transfer" },
        adjustment: { icon: "⚙️", color: "text-base-content/70", label: "Penyesuaian" },
    };

    if (transactions.length === 0) {
        return (
            <div className="glass-card rounded-2xl p-8 text-center">
                <span className="text-4xl">📝</span>
                <p className="text-base-content/70 mt-2">Belum ada transaksi</p>
                <p className="text-sm text-base-content/60">
                    Kirim pesan ke bot untuk mencatat transaksi
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Transaksi Terkini</h2>
                <span className="text-sm text-base-content/70">
                    {transactions.length} item
                </span>
            </div>

            {transactions.map((tx) => {
                const config = typeConfig[tx.type];
                return (
                    <div
                        key={tx.id}
                        className="glass-card rounded-xl p-4 flex items-center gap-3"
                    >
                        <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center text-xl">
                            {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{tx.description}</p>
                            <p className="text-xs text-base-content/70">
                                {tx.category} • {tx.bucket}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className={`font-semibold ${config.color}`}>
                                {tx.type === "income" ? "+" : "-"}
                                {formatRupiah(tx.amount)}
                            </p>
                            <p className="text-xs text-base-content/60">
                                {formatDate(tx.transactionDate)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}