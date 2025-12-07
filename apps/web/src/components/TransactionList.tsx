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
        adjustment: { icon: "⚙️", color: "text-base-content text-opacity-70", label: "Penyesuaian" },
    };

    if (transactions.length === 0) {
        return (
            <div className="card card-compact bg-base-200 bg-opacity-50">
                <div className="card-body text-center">
                    <span className="text-4xl">📝</span>
                    <div className="card-title text-base-content text-opacity-70">Belum ada transaksi</div>
                    <p className="text-sm text-base-content text-opacity-60">
                        Kirim pesan ke bot untuk mencatat transaksi
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Transaksi Terkini</h2>
                <span className="text-sm text-base-content text-opacity-70">
                    {transactions.length} item
                </span>
            </div>

            {transactions.map((tx) => {
                const config = typeConfig[tx.type];
                return (
                    <div
                        key={tx.id}
                        className="card card-compact bg-base-200 bg-opacity-50"
                    >
                        <div className="card-body">
                            <div className="flex items-center gap-3">
                                <div className="avatar placeholder">
                                    <div className="w-10 h-10 bg-base-content bg-opacity-10 rounded-full flex items-center justify-center text-xl">
                                        {config.icon}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{tx.description}</div>
                                    <div className="text-xs text-base-content text-opacity-70 flex items-center gap-2">
                                        <span className="badge badge-ghost badge-xs">{tx.category}</span>
                                        <span>•</span>
                                        <span>{tx.bucket}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-semibold ${config.color}`}>
                                        {tx.type === "income" ? "+" : "-"}
                                        {formatRupiah(tx.amount)}
                                    </div>
                                    <div className="text-xs text-base-content text-opacity-60">
                                        {formatDate(tx.transactionDate)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}