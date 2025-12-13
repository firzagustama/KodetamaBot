import { useStore } from "../stores/useStore";
import { useState, useEffect } from "react";
import {
    Save,
    Edit2,
    Wallet,
    AlertCircle
} from "lucide-react";
import { DynamicIcon } from "../utils/dynamicIcon";

// --- Types ---
interface CurrencyInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    color: 'primary' | 'success' | 'warning' | 'info';
    icon: React.ReactNode;
    maxLimit?: number;
}

interface ReadOnlyRowProps {
    label: string;
    amount: number;
    color: string;
    icon: React.ReactNode;
}

interface BudgetBucket {
    id: string;
    name: string;
    icon: string;
    amount: number;
    spent?: number;
    remaining?: number;
}

// --- Utility: Format Currency ---
function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

// --- Component: Currency Input ---
function CurrencyInput({
    label,
    value,
    onChange,
    color,
    icon,
    maxLimit
}: CurrencyInputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        onChange(Number(rawValue));
    };

    // Map color to Tailwind classes (static for purging)
    const borderColorClass = {
        primary: 'focus:border-primary focus:ring-primary',
        success: 'focus:border-success focus:ring-success',
        warning: 'focus:border-warning focus:ring-warning',
        info: 'focus:border-info focus:ring-info',
    }[color];

    return (
        <div className="form-control w-full">
            <label className="label pb-1">
                <span className="label-text font-medium flex items-center gap-2">
                    {icon} {label}
                </span>
            </label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 font-bold text-sm">
                    Rp
                </span>
                <input
                    type="tel"
                    value={value === 0 ? "" : new Intl.NumberFormat("id-ID").format(value)}
                    onChange={handleChange}
                    className={`input input-bordered w-full pl-10 font-mono font-bold focus:outline-none focus:ring-1 ${borderColorClass}`}
                    placeholder="0"
                />
            </div>
            {maxLimit && value > maxLimit && (
                <label className="label pt-1">
                    <span className="label-text-alt text-error flex items-center gap-1">
                        <AlertCircle size={12} /> Melebihi limit
                    </span>
                </label>
            )}
        </div>
    );
}

// --- Component: Read-only Row ---
function ReadOnlyRow({ label, amount, color, icon }: ReadOnlyRowProps) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-base-200 ${color} bg-opacity-10`}>
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-base-content/60 font-medium">{label}</p>
                    <p className="font-bold text-lg">{formatRupiah(amount)}</p>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---
export default function BudgetManager() {
    const { budget, updateBudget } = useStore();
    const [editing, setEditing] = useState(false);

    // Local state for form
    const [income, setIncome] = useState(0);
    const [beforeIncome, setBeforeIncome] = useState(0);
    const [buckets, setBuckets] = useState<BudgetBucket[]>([]);
    const [beforeBuckets, setBeforeBuckets] = useState<BudgetBucket[]>([]);

    // Sync state when budget loads
    useEffect(() => {
        if (budget) {
            setIncome(budget.estimatedIncome || 0);

            // Ensure byBucket is an array
            if (Array.isArray(budget.buckets)) {
                setBuckets(budget.buckets);
            } else if (budget.buckets) {
                // If it's a single object, wrap it in an array
                setBuckets([budget.buckets as any]);
            } else {
                // Provide default buckets if none exist
                setBuckets([]);
            }
        }
    }, [budget]);

    // Loading state
    if (!budget) {
        return (
            <div className="space-y-6 pb-20">
                <div className="animate-pulse h-64 bg-base-200 rounded-3xl" />
            </div>
        );
    }

    // Error state - no buckets
    if (!buckets || buckets.length === 0) {
        return (
            <div className="space-y-6 pb-20">
                <div className="alert alert-warning">
                    <AlertCircle size={20} />
                    <span>Tidak ada kategori budget. Silakan setup budget terlebih dahulu.</span>
                </div>
            </div>
        );
    }

    // Calculations
    const totalAllocated = buckets.reduce((sum, bucket) => sum + Number(bucket.amount || 0), 0);
    const savings = income - totalAllocated;
    const isOverBudget = savings < 0;

    // Handlers
    const handleEdit = () => {
        setBeforeIncome(income);
        setBeforeBuckets([...buckets]);
        setEditing(true);
    };

    const handleBucketChange = (id: string, value: number) => {
        setBuckets(prev =>
            prev.map(bucket =>
                bucket.id === id
                    ? { ...bucket, allocated: value }
                    : bucket
            )
        );
    };

    const handleSave = async () => {
        if (isOverBudget || income === 0) return;

        try {
            await updateBudget({
                estimatedIncome: income,
                buckets: buckets as any,
            });
            setEditing(false);
        } catch (error) {
            console.error('Failed to save budget:', error);
            alert('Gagal menyimpan budget. Silakan coba lagi.');
        }
    };

    const handleCancel = () => {
        setIncome(beforeIncome);
        setBuckets(beforeBuckets);
        setEditing(false);
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">

            {/* Header Area */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="font-bold text-lg">Atur Budget</h2>
                    <p className="text-xs text-base-content/60">
                        {budget.period?.name || 'Current Period'}
                    </p>
                </div>
                {!editing && (
                    <button
                        onClick={handleEdit}
                        className="btn btn-sm btn-ghost text-primary"
                    >
                        <Edit2 size={16} /> Edit
                    </button>
                )}
            </div>

            {/* Main Form / Display Card */}
            <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">

                {/* 1. INCOME SECTION (Top) */}
                <div className="bg-base-200/50 p-5 border-b border-base-200">
                    {editing ? (
                        <CurrencyInput
                            label="Pemasukan Bulanan"
                            icon={<Wallet size={16} className="text-primary" />}
                            value={income}
                            onChange={setIncome}
                            color="primary"
                        />
                    ) : (
                        <div className="text-center py-2">
                            <span className="text-sm text-base-content/60 block mb-1">
                                Pemasukan Total
                            </span>
                            <span className="text-3xl font-black text-primary tracking-tight">
                                {formatRupiah(income)}
                            </span>
                        </div>
                    )}
                </div>

                {/* 2. ALLOCATION INPUTS */}
                <div className="p-5 space-y-5">
                    {buckets.map((bucket) => (
                        <div key={bucket.id} className="relative">
                            {editing ? (
                                <CurrencyInput
                                    label={bucket.name}
                                    icon={
                                        bucket.icon ? (
                                            <DynamicIcon name={bucket.icon} size={16} />
                                        ) : (
                                            <Wallet size={16} />
                                        )
                                    }
                                    value={bucket.amount || 0}
                                    onChange={(value) => handleBucketChange(bucket.id, value)}
                                    color="primary"
                                    maxLimit={income}
                                />
                            ) : (
                                <ReadOnlyRow
                                    label={bucket.name}
                                    amount={bucket.amount || 0}
                                    color="text-primary"
                                    icon={
                                        bucket.icon ? (
                                            <DynamicIcon name={bucket.icon} size={18} />
                                        ) : (
                                            <Wallet size={18} />
                                        )
                                    }
                                />
                            )}
                            <div className="absolute top-0 right-0 text-xs font-bold text-base-content/40 bg-base-200 px-2 py-0.5 rounded-md">
                                {income > 0 ? Math.round(((bucket.amount || 0) / income) * 100) : 0}%
                            </div>
                        </div>
                    ))}

                    {/* Divider */}
                    <div className="divider my-0"></div>

                    {/* Savings (Calculated) */}
                    <div className={`rounded-xl p-4 transition-colors ${isOverBudget
                        ? 'bg-error/10 border border-error/20'
                        : 'bg-warning/10 border border-warning/20'
                        }`}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2 font-semibold">
                                <Wallet
                                    size={18}
                                    className={isOverBudget ? "text-error" : "text-warning"}
                                />
                                <span>Unallocated</span>
                            </div>
                            <span className="text-xs font-bold opacity-50">
                                {income > 0 ? Math.round((savings / income) * 100) : 0}%
                            </span>
                        </div>

                        <div className={`text-2xl font-bold ${isOverBudget ? "text-error" : "text-warning"
                            }`}>
                            {savings < 0 ? "-" : ""}{formatRupiah(Math.abs(savings))}
                        </div>

                        {isOverBudget && (
                            <p className="text-xs text-error mt-1 font-medium">
                                Oops! Budget melebihi pemasukan.
                            </p>
                        )}
                    </div>

                </div>

                {/* 3. VISUAL BAR */}
                {!isOverBudget && income > 0 && (
                    <div className="w-full h-2 flex bg-base-300">
                        {buckets.map((bucket, index) => {
                            const percentage = Math.min(((bucket.amount || 0) / income) * 100, 100);
                            const colorClass =
                                index === 0 ? 'bg-success' :
                                    index === 1 ? 'bg-warning' :
                                        'bg-primary';

                            return percentage > 0 ? (
                                <div
                                    key={bucket.id}
                                    style={{ width: `${percentage}%` }}
                                    className={`h-full ${colorClass}`}
                                />
                            ) : null;
                        })}
                        {savings > 0 && (
                            <div
                                style={{ width: `${(savings / income) * 100}%` }}
                                className="h-full bg-info"
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {editing && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-base-100/80 backdrop-blur-md border-t border-base-200 z-30 flex gap-3 max-w-md mx-auto">
                    <button
                        onClick={handleCancel}
                        className="btn flex-1"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isOverBudget || income === 0}
                        className="btn btn-primary flex-1 gap-2"
                    >
                        <Save size={18} /> Simpan
                    </button>
                </div>
            )}
        </div>
    );
}