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
            {/* Income Stat */}
            <div className="card card-compact bg-base-200 bg-opacity-50">
                <div className="card-body">
                    <div className="text-sm text-base-content text-opacity-70">Penghasilan Bulan Ini</div>
                    <div className="text-2xl font-bold text-primary">
                        {formatRupiah(budget.estimatedIncome)}
                    </div>
                </div>
            </div>

            {/* Budget Summary */}
            <div className="grid grid-cols-3 gap-3">
                <BudgetCard
                    icon="🏠"
                    label="Needs"
                    allocated={byBucket.needs.allocated}
                    spent={byBucket.needs.spent}
                    color="success"
                />
                <BudgetCard
                    icon="🎮"
                    label="Wants"
                    allocated={byBucket.wants.allocated}
                    spent={byBucket.wants.spent}
                    color="warning"
                />
                <BudgetCard
                    icon="💵"
                    label="Savings"
                    allocated={byBucket.savings.allocated}
                    spent={byBucket.savings.spent}
                    color="info"
                />
            </div>

            {/* Spending Progress */}
            <div className="card card-compact bg-base-200 bg-opacity-50">
                <div className="card-body">
                    <h3 className="card-title text-base-content">Progress Pengeluaran</h3>
                    <BucketProgress
                        label="Needs"
                        spent={byBucket.needs.spent}
                        allocated={byBucket.needs.allocated}
                        color="success"
                    />
                    <BucketProgress
                        label="Wants"
                        spent={byBucket.wants.spent}
                        allocated={byBucket.wants.allocated}
                        color="warning"
                    />
                    <BucketProgress
                        label="Savings"
                        spent={byBucket.savings.spent}
                        allocated={byBucket.savings.allocated}
                        color="info"
                    />
                </div>
            </div>

            {/* Top Categories */}
            {summary.topCategories.length > 0 && (
                <div className="card card-compact bg-base-200 bg-opacity-50">
                    <div className="card-body">
                        <h3 className="card-title text-base-content">Kategori Teratas</h3>
                        <div className="space-y-2">
                            {summary.topCategories.map((cat, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-base-content text-opacity-80">{cat.name}</span>
                                    <div className="text-right">
                                        <span className="font-medium text-base-content">{formatRupiah(cat.amount)}</span>
                                        <span className="text-xs text-base-content text-opacity-50 ml-2 badge badge-ghost">
                                            {cat.percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="stat stat-compact bg-base-200 bg-opacity-50 rounded-xl p-4 text-center">
                    <div className="stat-desc text-base-content text-opacity-70">Total Pengeluaran</div>
                    <div className="stat-value text-lg text-error">
                        {formatRupiah(summary.totalExpenses)}
                    </div>
                </div>
                <div className="stat stat-compact bg-base-200 bg-opacity-50 rounded-xl p-4 text-center">
                    <div className="stat-desc text-base-content text-opacity-70">Sisa Budget</div>
                    <div className="stat-value text-lg text-success">
                        {formatRupiah(
                            budget.estimatedIncome - summary.totalExpenses
                        )}
                    </div>
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
    color: "success" | "warning" | "info";
}) {
    const remaining = allocated - spent;
    const colorClasses = {
        success: "border-success border-opacity-20 bg-success bg-opacity-80",
        warning: "border-warning border-opacity-20 bg-warning bg-opacity-80",
        info: "border-info border-opacity-20 bg-info bg-opacity-80",
    };

    return (
        <div className={`rounded-xl p-3 border ${colorClasses[color]}`}>
            <span className="text-lg">{icon}</span>
            <p className="text-xs text-base-content text-opacity-70 mt-1">{label}</p>
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
    color: "success" | "warning" | "info";
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
            <progress
                className={`progress progress-${isOverBudget ? "error" : color} w-full h-3`}
                value={percentage}
                max="100"
            ></progress>
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