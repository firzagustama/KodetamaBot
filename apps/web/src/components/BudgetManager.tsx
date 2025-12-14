import { useStore } from "../stores/useStore";
import { useState, useEffect } from "react";
import {
    Save,
    Edit2,
    Wallet,
    AlertCircle,
    Plus,
    Trash2,
    Wand2
} from "lucide-react";
import { DynamicIcon } from "../utils/dynamicIcon";

// --- Types ---
interface CurrencyInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    color: 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'accent' | 'neutral';
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
    description?: string;
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
        secondary: 'focus:border-secondary focus:ring-secondary',
        accent: 'focus:border-accent focus:ring-accent',
        neutral: 'focus:border-neutral focus:ring-neutral',
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
// --- Component: Read-only Row ---
function ReadOnlyRow({ label, description, amount, color, icon, percentage }: ReadOnlyRowProps & { description?: string, percentage?: number }) {
    return (
        <div className="flex items-center justify-between group py-2">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-base-200 ${color} bg-opacity-10`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-bold">{label}</p>
                    {description && (
                        <p className="text-xs text-base-content/60 line-clamp-1">{description}</p>
                    )}
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold text-lg">{formatRupiah(amount)}</p>
                {percentage !== undefined && (
                    <p className="text-xs text-base-content/40 font-bold">{percentage}%</p>
                )}
            </div>
        </div>
    );
}

// --- Main Component ---
export default function BudgetManager() {
    const { budget, updateBudget, generateBucketDescription } = useStore();
    const [editing, setEditing] = useState(false);

    // Local state for form
    const [income, setIncome] = useState(0);
    const [beforeIncome, setBeforeIncome] = useState(0);
    const [buckets, setBuckets] = useState<BudgetBucket[]>([]);
    const [beforeBuckets, setBeforeBuckets] = useState<BudgetBucket[]>([]);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

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

    // Auto-focus for new buckets
    useEffect(() => {
        if (editing && buckets.length > beforeBuckets.length) {
            // A new bucket was added, focus the last one's name input
            const lastBucketId = buckets[buckets.length - 1].id;
            const element = document.getElementById(`bucket-name-${lastBucketId}`);
            if (element) {
                element.focus();
                // Select all text
                (element as HTMLInputElement).select();
            }
        }
    }, [buckets.length, editing]);

    // Calculations
    const totalAllocated = buckets.reduce((sum, bucket) => sum + Number(bucket.amount || 0), 0);
    const savings = income - totalAllocated;
    const isOverBudget = savings < 0;

    // Handlers
    const handleEdit = () => {
        setBeforeIncome(income);
        setBeforeBuckets(JSON.parse(JSON.stringify(buckets))); // Deep copy
        setEditing(true);
    };

    const handleBucketChange = (id: string, field: keyof BudgetBucket, value: any) => {
        setBuckets(prev =>
            prev.map(bucket =>
                bucket.id === id
                    ? { ...bucket, [field]: value }
                    : bucket
            )
        );
    };

    const handleAddBucket = () => {
        const newBucket: BudgetBucket = {
            id: `temp-${Date.now()}`,
            name: "Kategori Baru",
            description: "",
            icon: "Wallet",
            amount: 0,
        };
        setBuckets([...buckets, newBucket]);
    };

    const handleDeleteBucket = (id: string) => {
        // Optional: Add confirmation or "undo" toast here if needed
        // For now, just smooth removal
        setBuckets(prev => prev.filter(b => b.id !== id));
    };

    const handleGenerateDescription = async (id: string, name: string) => {
        setGeneratingId(id);
        const description = await generateBucketDescription(name);
        if (description) {
            handleBucketChange(id, "description", description);
        }
        setGeneratingId(null);
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
        <div className="space-y-6 pb-24 animate-fade-in">

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
            <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden transition-all duration-300">

                {/* 1. INCOME SECTION (Top) */}
                <div className="bg-base-200/50 p-6 border-b border-base-200">
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
                            <span className="text-sm text-base-content/60 block mb-1 font-medium">
                                Pemasukan Total
                            </span>
                            <span className="text-4xl font-black text-primary tracking-tight">
                                {formatRupiah(income)}
                            </span>
                        </div>
                    )}
                </div>

                {/* 2. ALLOCATION INPUTS */}
                <div className="p-5 space-y-4">
                    {buckets.length === 0 && (
                        <div className="text-center py-10 opacity-50">
                            <Wallet size={48} className="mx-auto mb-2 opacity-20" />
                            <p>Belum ada kategori budget.</p>
                            {editing && <p className="text-xs">Klik "Tambah Kategori" untuk memulai.</p>}
                        </div>
                    )}

                    {buckets.map((bucket, index) => {
                        const percentage = income > 0 ? ((bucket.amount || 0) / income) * 100 : 0;
                        const colorKey = ['primary', 'secondary', 'accent', 'neutral'][index % 4] as 'primary' | 'secondary' | 'accent' | 'neutral';
                        const colorTextClass = `text-${colorKey}`;
                        const colorBgClass = `bg-${colorKey}`;

                        const focusClass = {
                            primary: 'focus-within:border-primary focus-within:ring-primary/20',
                            secondary: 'focus-within:border-secondary focus-within:ring-secondary/20',
                            accent: 'focus-within:border-accent focus-within:ring-accent/20',
                            neutral: 'focus-within:border-neutral focus-within:ring-neutral/20',
                        }[colorKey];

                        return (
                            <div key={bucket.id} className="relative group transition-all duration-300 ease-in-out">
                                {editing ? (
                                    <div className={`p-4 bg-base-100 rounded-2xl border border-base-200 shadow-sm space-y-4 focus-within:ring-1 transition-all ${focusClass}`}>
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1 space-y-2">
                                                <input
                                                    id={`bucket-name-${bucket.id}`}
                                                    type="text"
                                                    value={bucket.name}
                                                    onChange={(e) => handleBucketChange(bucket.id, "name", e.target.value)}
                                                    className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0 placeholder:text-base-content/30"
                                                    placeholder="Nama Kategori"
                                                    autoComplete="off"
                                                />
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={bucket.description || ""}
                                                        onChange={(e) => handleBucketChange(bucket.id, "description", e.target.value)}
                                                        className="input input-xs input-bordered w-full bg-base-200/50 focus:bg-base-100"
                                                        placeholder="Deskripsi (opsional)"
                                                    />
                                                    <button
                                                        className={`btn btn-xs btn-square ${generatingId === bucket.id ? 'btn-disabled' : `btn-ghost ${colorTextClass}`}`}
                                                        onClick={() => handleGenerateDescription(bucket.id, bucket.name)}
                                                        disabled={generatingId === bucket.id || !bucket.name}
                                                        title="Generate description with AI"
                                                    >
                                                        {generatingId === bucket.id ? (
                                                            <span className="loading loading-spinner loading-xs"></span>
                                                        ) : (
                                                            <Wand2 size={14} />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-sm btn-square btn-ghost text-base-content/30 hover:text-error hover:bg-error/10 transition-colors"
                                                onClick={() => handleDeleteBucket(bucket.id)}
                                                title="Hapus Kategori"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        <div className="pt-2 border-t border-base-200/50">
                                            <CurrencyInput
                                                label="Alokasi"
                                                icon={
                                                    <span className={colorTextClass}>
                                                        {bucket.icon ? (
                                                            <DynamicIcon name={bucket.icon} size={16} />
                                                        ) : (
                                                            <Wallet size={16} />
                                                        )}
                                                    </span>
                                                }
                                                value={bucket.amount || 0}
                                                onChange={(value) => handleBucketChange(bucket.id, "amount", value)}
                                                color={colorKey}
                                                maxLimit={income}
                                            />
                                            {/* Mini Progress Bar in Edit Mode */}
                                            <div className="mt-2 w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`${colorBgClass} h-full transition-all duration-500`}
                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                            </div>
                                            <div className="text-right text-[10px] text-base-content/40 mt-1 font-medium">
                                                {Math.round(percentage)}% dari total
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <ReadOnlyRow
                                        label={bucket.name}
                                        description={bucket.description}
                                        amount={bucket.amount || 0}
                                        color={colorTextClass}
                                        icon={
                                            bucket.icon ? (
                                                <DynamicIcon name={bucket.icon} size={18} />
                                            ) : (
                                                <Wallet size={18} />
                                            )
                                        }
                                        percentage={Math.round(percentage)}
                                    />
                                )}
                            </div>
                        )
                    })}

                    {editing && (
                        <button
                            className="btn btn-outline btn-block btn-sm border-dashed border-base-300 hover:border-primary hover:bg-primary hover:text-white transition-all h-12 rounded-xl gap-2"
                            onClick={handleAddBucket}
                        >
                            <Plus size={18} /> Tambah Kategori
                        </button>
                    )}

                    {/* Divider */}
                    <div className="divider my-2 opacity-50"></div>

                    {/* Savings (Calculated) */}
                    <div className={`rounded-2xl p-5 transition-all duration-300 ${isOverBudget
                        ? 'bg-error/5 border border-error/20'
                        : 'bg-success/5 border border-success/20'
                        }`}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider opacity-70">
                                <Wallet
                                    size={16}
                                    className={isOverBudget ? "text-error" : "text-success"}
                                />
                                <span>{isOverBudget ? "Over Budget" : "Sisa Budget (Unallocated)"}</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isOverBudget ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                                {income > 0 ? Math.round((savings / income) * 100) : 0}%
                            </span>
                        </div>

                        <div className={`text-3xl font-black tracking-tight ${isOverBudget ? "text-error" : "text-success"
                            }`}>
                            {savings < 0 ? "-" : ""}{formatRupiah(Math.abs(savings))}
                        </div>

                        {isOverBudget && (
                            <p className="text-xs text-error mt-2 font-medium flex items-center gap-1">
                                <AlertCircle size={12} />
                                Total alokasi melebihi pemasukan bulanan.
                            </p>
                        )}
                    </div>

                </div>

                {/* 3. VISUAL BAR */}
                {!isOverBudget && income > 0 && (
                    <div className="w-full h-3 flex bg-base-200">
                        {buckets.map((bucket, index) => {
                            const percentage = Math.min(((bucket.amount || 0) / income) * 100, 100);
                            const colorClass =
                                index === 0 ? 'bg-primary' :
                                    index === 1 ? 'bg-secondary' :
                                        index === 2 ? 'bg-accent' :
                                            'bg-neutral';

                            return percentage > 0 ? (
                                <div
                                    key={bucket.id}
                                    style={{ width: `${percentage}%` }}
                                    className={`h-full ${colorClass} first:rounded-bl-3xl last:rounded-br-3xl`}
                                    title={`${bucket.name}: ${Math.round(percentage)}%`}
                                />
                            ) : null;
                        })}
                        {savings > 0 && (
                            <div
                                style={{ width: `${(savings / income) * 100}%` }}
                                className="h-full bg-success/30 last:rounded-br-3xl"
                                title={`Sisa: ${Math.round((savings / income) * 100)}%`}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {editing && (
                <div className="fixed bottom-6 left-4 right-4 z-30 flex gap-3 max-w-md mx-auto">
                    <button
                        onClick={handleCancel}
                        className="btn flex-1 bg-base-100 shadow-lg border-base-200 rounded-2xl h-14 font-bold"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isOverBudget || income === 0}
                        className="btn btn-primary flex-1 gap-2 shadow-lg shadow-primary/30 rounded-2xl h-14 font-bold text-lg"
                    >
                        <Save size={20} /> Simpan
                    </button>
                </div>
            )}
        </div>
    );
}