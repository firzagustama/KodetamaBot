import { useStore } from "../stores/useStore";
import { useEffect } from "react";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function Dashboard() {
    const { budget, summary, fetchSummary } = useStore();

    useEffect(() => {
        if (!budget) return;
        fetchSummary();
    }, [budget]);

    if (!budget || !summary) {
        return <DashboardSkeleton />;
    }

    const { byBucket } = summary;

    return (
        <div className="space-y-4">
            {/* Income Card */}
            <div className="glass-card rounded-2xl p-4">
                <p className="text-sm text-base-content/70">Penghasilan Bulan Ini</p>
                <p className="text-2xl font-bold text-primary">
                    {formatRupiah(budget.estimatedIncome)}
                </p>
            </div>

            {/* Budget Summary */}
            <div className="grid grid-cols-3 gap-3">
                <BudgetCard
                    icon="🏠"
                    label="Needs"
                    allocated={byBucket.needs.allocated}
                    spent={byBucket.needs.spent}
                    color="emerald"
                />
                <BudgetCard
                    icon="🎮"
                    label="Wants"
                    allocated={byBucket.wants.allocated}
                    spent={byBucket.wants.spent}
                    color="amber"
                />
                <BudgetCard
                    icon="💵"
                    label="Savings"
                    allocated={byBucket.savings.allocated}
                    spent={byBucket.savings.spent}
                    color="sky"
                />
            </div>

            {/* Spending Progress */}
            <div className="glass-card rounded-2xl p-4 space-y-4">
                <h3 className="font-semibold text-base-content">Progress Pengeluaran</h3>

                <BucketProgress
                    label="Kebutuhan"
                    spent={byBucket.needs.spent}
                    allocated={byBucket.needs.allocated}
                    color="bg-primary"
                />
                <BucketProgress
                    label="Wants"
                    spent={byBucket.wants.spent}
                    allocated={byBucket.wants.allocated}
                    color="bg-warning"
                />
                <BucketProgress
                    label="Tabungan"
                    spent={byBucket.savings.spent}
                    allocated={byBucket.savings.allocated}
                    color="bg-info"
                />
            </div>

            {/* Top Categories */}
            <div className="glass-card rounded-2xl p-4">
                <h3 className="font-semibold mb-3 text-base-content">Kategori Teratas</h3>
                <div className="space-y-2">
                    {summary.topCategories.map((cat, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-base-content/80">{cat.name}</span>
                            <div className="text-right">
                                <span className="font-medium text-base-content">{formatRupiah(cat.amount)}</span>
                                <span className="text-xs text-base-content/50 ml-2">
                                    {cat.percentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-xs text-base-content/70">Total Pengeluaran</p>
                    <p className="text-lg font-bold text-error">
                        {formatRupiah(summary.totalExpenses)}
                    </p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-xs text-base-content/70">Sisa Budget</p>
                    <p className="text-lg font-bold text-success">
                        {formatRupiah(
                            budget.estimatedIncome - summary.totalExpenses
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

function BudgetCard({
    icon,
    label,
    allocated,
    spent,
    color,
}: {
    icon: string;
    label: string;
    allocated: number;
    spent: number;
    color: "emerald" | "amber" | "sky";
}) {
    const remaining = allocated - spent;
    const colorClasses = {
        emerald: "border-success/20 bg-success/10",
        amber: "border-warning/20 bg-warning/10",
        sky: "border-info/20 bg-info/10",
    };

    return (
        <div className={`rounded-xl p-3 border ${colorClasses[color]}`}>
            <span className="text-lg">{icon}</span>
            <p className="text-xs text-base-content/70 mt-1">{label}</p>
            <p className="text-sm font-semibold text-base-content">
                {remaining >= 0 ? formatRupiah(remaining) : `-${formatRupiah(-remaining)}`}
            </p>
        </div>
    );
}

function BucketProgress({
    label,
    spent,
    allocated,
    color,
}: {
    label: string;
    spent: number;
    allocated: number;
    color: string;
}) {
    const percentage = Math.min((spent / allocated) * 100, 100);
    const isOverBudget = spent > allocated;

    return (
        <div>
            <div className="flex justify-between text-sm mb-1 text-base-content">
                <span>{label}</span>
                <span className={isOverBudget ? "text-error" : ""}>
                    {formatRupiah(spent)} / {formatRupiah(allocated)}
                </span>
            </div>
            <div className="progress-bar">
                <div
                    className={`progress-fill ${isOverBudget ? "bg-error" : color}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-base-200 rounded-2xl" />
            <div className="grid grid-cols-3 gap-3">
                <div className="h-20 bg-base-200 rounded-xl" />
                <div className="h-20 bg-base-200 rounded-xl" />
                <div className="h-20 bg-base-200 rounded-xl" />
            </div>
            <div className="h-40 bg-base-200 rounded-2xl" />
        </div>
    );
}