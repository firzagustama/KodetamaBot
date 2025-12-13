import { useStore } from "../stores/useStore";
import { useEffect } from "react";
import { DynamicIcon } from "../utils/dynamicIcon";
import { ArrowDownRight, ArrowUpRight, Target, Wallet } from "lucide-react";

// Helper for currency formatting
function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

// Helper to calculate percentages
const getPercent = (current: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((current / total) * 100, 100);
};

export default function Dashboard() {
    const { budget, summary, fetchSummary } = useStore();

    useEffect(() => {
        if (!budget) return;
        console.log("fetchSummary")
        fetchSummary();
    }, [budget]);

    if (!budget || !summary) {
        return <DashboardSkeleton />;
    }

    const { byBucket, totalExpenses } = summary;
    const remainingBudget = budget.estimatedIncome - totalExpenses;
    const spendingPercentage = getPercent(totalExpenses, budget.estimatedIncome);

    return (
        <div className="space-y-6 pb-6 animate-fade-in">

            {/* 1. HERO CARD: Net Position */}
            <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-content shadow-xl shadow-primary/20 p-6">
                {/* Decorative background circles */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-black/10 blur-xl"></div>

                <div className="relative z-10 flex flex-col gap-1">
                    <span className="text-sm font-medium opacity-80 flex items-center gap-2">
                        <Wallet size={16} />
                        Sisa Budget
                    </span>
                    <h2 className="text-3xl font-bold tracking-tight">
                        {formatRupiah(remainingBudget)}
                    </h2>

                    <div className="mt-4 flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                            <span className="opacity-70 text-xs">Pemasukan</span>
                            <span className="font-semibold flex items-center gap-1">
                                <ArrowUpRight size={14} className="text-primary-content/70" />
                                {formatRupiah(budget.estimatedIncome)}
                            </span>
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div className="flex flex-col text-right">
                            <span className="opacity-70 text-xs">Pengeluaran</span>
                            <span className="font-semibold flex items-center justify-end gap-1">
                                <ArrowDownRight size={14} className="text-primary-content/70" />
                                {formatRupiah(totalExpenses)}
                            </span>
                        </div>
                    </div>

                    {/* Mini Progress Bar inside Hero */}
                    <div className="mt-4 w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-full ${remainingBudget < 0 ? 'bg-error' : 'bg-white'} transition-all duration-500`}
                            style={{ width: `${spendingPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 2. THE BIG THREE: Buckets */}
            <div className="grid grid-cols-3 gap-3">
                {byBucket.map((bucket) => (
                    <BucketCard
                        key={bucket.id}
                        icon={<DynamicIcon name={bucket.icon} size={18} />}
                        label={bucket.name}
                        allocated={bucket.allocated}
                        spent={bucket.spent}
                        colorClass="text-secondary bg-secondary/10 border-secondary/20"
                        barClass="progress-secondary"
                    />
                ))}
            </div>

            {/* 3. DETAILED BREAKDOWN */}
            <div className="bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-base-100 bg-base-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-base-content flex items-center gap-2">
                        <Target size={18} className="text-primary" />
                        Detail Pengeluaran
                    </h3>
                </div>

                <div className="p-4 space-y-5">
                    {byBucket.map((bucket) => (
                        <BucketRow
                            key={bucket.id}
                            label={bucket.name}
                            spent={bucket.spent}
                            allocated={bucket.allocated}
                        />
                    ))}
                </div>
            </div>

            {/* 4. TOP CATEGORIES */}
            {summary.topCategories.length > 0 && (
                <div className="space-y-3">
                    <h3 className="px-1 text-sm font-bold text-base-content/40 uppercase tracking-wider">
                        Pengeluaran Terbesar
                    </h3>
                    <div className="flex flex-col gap-2">
                        {summary.topCategories.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-base-100 border border-base-200 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center text-lg">
                                        {/* Simple Emoji or Icon mapping could go here */}
                                        🏷️
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm text-base-content">{cat.name}</span>
                                        <span className="text-[10px] text-base-content/50 font-medium">
                                            {cat.percentage.toFixed(1)}% dari total
                                        </span>
                                    </div>
                                </div>
                                <span className="font-bold text-sm text-base-content">
                                    {formatRupiah(cat.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* --- SUB COMPONENTS --- */

function BucketCard({ icon, label, allocated, spent, colorClass }: any) {
    const remaining = allocated - spent;
    const isNegative = remaining < 0;

    return (
        <div className={`flex flex-col p-3 rounded-2xl border ${colorClass} transition-transform active:scale-95`}>
            <div className="flex justify-between items-start mb-2">
                <div className="p-1.5 rounded-lg bg-base-100/50 backdrop-blur-sm">
                    {icon}
                </div>
            </div>
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-wide mb-0.5">{label}</span>
            <span className={`text-xs font-bold truncate ${isNegative ? 'text-error' : ''}`}>
                {remaining >= 0 ? formatRupiah(remaining) : `-${formatRupiah(Math.abs(remaining))}`}
            </span>
        </div>
    );
}

function BucketRow({ label, spent, allocated }: any) {
    const percent = getPercent(spent, allocated);
    const isOver = spent > allocated;
    const color = spent / allocated > 0.8 ? "warning" : "success";

    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
                <span className="text-base-content/70">{label}</span>
                <span className={isOver ? "text-error font-bold" : "text-base-content"}>
                    {Math.round(percent)}%
                </span>
            </div>
            <progress
                className={`progress progress-${isOver ? 'error' : color} w-full h-2.5 bg-base-200`}
                value={percent}
                max="100"
            ></progress>
            <div className="flex justify-between text-[10px] text-base-content/40">
                <span>Terpakai: {formatRupiah(spent)}</span>
                <span>Limit: {formatRupiah(allocated)}</span>
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse p-1">
            <div className="h-48 bg-base-300 rounded-3xl" />
            <div className="grid grid-cols-3 gap-3">
                <div className="h-24 bg-base-200 rounded-2xl" />
                <div className="h-24 bg-base-200 rounded-2xl" />
                <div className="h-24 bg-base-200 rounded-2xl" />
            </div>
            <div className="h-40 bg-base-200 rounded-3xl" />
        </div>
    );
}