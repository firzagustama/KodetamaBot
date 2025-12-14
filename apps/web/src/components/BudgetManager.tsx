import { useState, useEffect } from "react";
import {
    Save,
    Edit2,
    Wallet,
    AlertCircle,
    Plus,
    Trash2,
    Wand2,
} from "lucide-react";
import { DynamicIcon } from "../utils/dynamicIcon"
import { useStore } from "../stores/useStore";

// --- Types ---
interface CurrencyInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    color: 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'accent' | 'neutral';
    icon?: React.ReactNode;
    maxLimit?: number;
}

interface ReadOnlyRowProps {
    label: string;
    amount: number;
    color: string;
}

interface BudgetBucket {
    id: string;
    name: string;
    description?: string;
    icon: string;
    amount: number;
    spent?: number;
    remaining?: number;
    category?: string;
    isSystem?: boolean;
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
function ReadOnlyRow({ label, description, amount, color, percentage }: ReadOnlyRowProps & { description?: string, percentage?: number }) {
    return (
        <div className="flex items-center justify-between group py-2">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-base-200 ${color} bg-opacity-10`}>
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

// --- Component: Bucket Item ---
function BucketItem({
    bucket,
    editing,
    income,
    onChange,
    onDelete,
    onGenerateDescription,
    generatingId
}: {
    bucket: BudgetBucket;
    editing: boolean;
    income: number;
    onChange: (id: string, field: keyof BudgetBucket, value: any) => void;
    onDelete: (id: string) => void;
    onGenerateDescription: (id: string, name: string) => void;
    generatingId: string | null;
}) {
    const percentage = income > 0 ? ((bucket.amount || 0) / income) * 100 : 0;
    const colorKey = bucket.category === 'needs' ? 'primary' :
        bucket.category === 'wants' ? 'secondary' :
            bucket.category === 'savings' ? 'success' : 'neutral';

    const colorTextClass = bucket.category === 'needs' ? 'text-blue-500' :
        bucket.category === 'wants' ? 'text-purple-500' :
            bucket.category === 'savings' ? 'text-green-500' : 'text-base-content/50';

    const colorBgClass = bucket.category === 'needs' ? 'bg-blue-500' :
        bucket.category === 'wants' ? 'bg-purple-500' :
            bucket.category === 'savings' ? 'bg-green-500' : 'bg-base-content/20';

    const focusClass = bucket.category === 'needs' ? 'focus-within:border-blue-500 focus-within:ring-blue-500/20' :
        bucket.category === 'wants' ? 'focus-within:border-purple-500 focus-within:ring-purple-500/20' :
            bucket.category === 'savings' ? 'focus-within:border-green-500 focus-within:ring-green-500/20' :
                'focus-within:border-base-content/20';

    if (editing && !bucket.isSystem) {
        return (
            <div className={`p-4 bg-base-100 rounded-2xl border border-base-200 shadow-sm space-y-4 focus-within:ring-1 transition-all ${focusClass}`}>
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 space-y-2">
                        <input
                            id={`bucket-name-${bucket.id}`}
                            type="text"
                            value={bucket.name}
                            onChange={(e) => onChange(bucket.id, "name", e.target.value)}
                            className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0 placeholder:text-base-content/30"
                            placeholder="Nama Kategori"
                            autoComplete="off"
                        />
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={bucket.description || ""}
                                onChange={(e) => onChange(bucket.id, "description", e.target.value)}
                                className="input input-xs input-bordered w-full bg-base-200/50 focus:bg-base-100"
                                placeholder="Deskripsi (opsional)"
                            />
                            <button
                                className={`btn btn-xs btn-square ${generatingId === bucket.id ? 'btn-disabled' : `btn-ghost ${colorTextClass}`}`}
                                onClick={() => onGenerateDescription(bucket.id, bucket.name)}
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
                        onClick={() => onDelete(bucket.id)}
                        title="Hapus Kategori"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                <div className="pt-2 border-t border-base-200/50">
                    <CurrencyInput
                        label="Alokasi"
                        value={bucket.amount || 0}
                        onChange={(value) => onChange(bucket.id, "amount", value)}
                        color={colorKey as any}
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
        );
    }

    return (
        <ReadOnlyRow
            label={bucket.name}
            description={bucket.description}
            amount={bucket.amount || 0}
            color={colorTextClass}
            percentage={Math.round(percentage)}
        />
    );
}

// --- Component: Bucket Section (Simplified) ---
function BucketSection({
    title,
    icon,
    colorClass,
    btnHoverClass,
    categoryBuckets,
    editing,
    income,
    onChange,
    onDelete,
    onGenerateDescription,
    generatingId,
    onAddBucket
}: {
    title: string;
    icon: React.ReactNode;
    colorClass: string;
    btnHoverClass: string;
    categoryBuckets: BudgetBucket[];
    editing: boolean;
    income: number;
    onChange: (id: string, field: keyof BudgetBucket, value: any) => void;
    onDelete: (bucketId: string) => void;
    onGenerateDescription: (bucketId: string, bucketName: string) => void;
    generatingId: string | null;
    onAddBucket: () => void;
}) {
    // Don't render section if no buckets and not editing
    if (categoryBuckets.length === 0 && !editing) return null;

    return (
        <div className="mb-6">
            <h3 className={`font-bold text-sm ${colorClass} mb-3 flex items-center gap-2 uppercase tracking-wider opacity-80`}>
                {icon} {title}
            </h3>
            <div className="space-y-3">
                {categoryBuckets.map((bucket) => (
                    <BucketItem
                        key={bucket.id}
                        bucket={bucket}
                        editing={editing}
                        income={income}
                        onChange={onChange}
                        onDelete={onDelete}
                        onGenerateDescription={onGenerateDescription}
                        generatingId={generatingId}
                    />
                ))}
                {editing && (
                    <button
                        className={`btn btn-outline btn-block btn-sm border-dashed border-base-300 ${btnHoverClass} hover:text-white transition-all h-10 rounded-xl gap-2 opacity-60 hover:opacity-100`}
                        onClick={onAddBucket}
                    >
                        <Plus size={14} /> Add {title.split(' ')[0]}
                    </button>
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
            setBuckets(budget.buckets);
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
    }, [buckets.length, editing, beforeBuckets.length]);

    // Calculations
    const totalAllocated = buckets.reduce((sum, bucket) => sum + Number(bucket.amount || 0), 0);
    const savings = income - totalAllocated;
    const isOverBudget = savings < 0;

    // Filter buckets by category
    const needsBuckets = buckets.filter(b => b.category === 'needs' && !b.isSystem);
    const wantsBuckets = buckets.filter(b => b.category === 'wants' && !b.isSystem);
    const savingsBuckets = buckets.filter(b => b.category === 'savings' && !b.isSystem);
    const systemBuckets = buckets.filter(b => b.isSystem);

    // Handlers
    const handleEdit = () => {
        setBeforeIncome(income);
        setBeforeBuckets(buckets);
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

    const handleAddBucket = (category: string) => {
        const newBucket: BudgetBucket = {
            id: `temp-${Date.now()}`,
            name: "Kategori Baru",
            description: "",
            icon: "Wallet",
            amount: 0,
            category,
            isSystem: false,
        };
        setBuckets([...buckets, newBucket]);
    };

    const handleDeleteBucket = (id: string) => {
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
            // Transform flat array to API format
            const bucketsPayload = buckets.map(bucket => ({
                id: bucket.id,
                name: bucket.name,
                description: bucket.description || "",
                amount: bucket.amount,
                icon: bucket.icon,
                category: bucket.category,
                isSystem: bucket.isSystem || false,
            }));

            await updateBudget({
                estimatedIncome: income,
                buckets: bucketsPayload as any,
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

                    {/* Needs Section */}
                    <BucketSection
                        title="Needs (Kebutuhan)"
                        icon={<DynamicIcon name="Home" size={16} />}
                        colorClass="text-blue-500"
                        btnHoverClass="hover:border-blue-500 hover:bg-blue-500"
                        categoryBuckets={needsBuckets}
                        editing={editing}
                        income={income}
                        onChange={handleBucketChange}
                        onDelete={handleDeleteBucket}
                        onGenerateDescription={handleGenerateDescription}
                        generatingId={generatingId}
                        onAddBucket={() => handleAddBucket('needs')}
                    />

                    {/* Wants Section */}
                    <BucketSection
                        title="Wants (Keinginan)"
                        icon={<DynamicIcon name="ShoppingBag" size={16} />}
                        colorClass="text-purple-500"
                        btnHoverClass="hover:border-purple-500 hover:bg-purple-500"
                        categoryBuckets={wantsBuckets}
                        editing={editing}
                        income={income}
                        onChange={handleBucketChange}
                        onDelete={handleDeleteBucket}
                        onGenerateDescription={handleGenerateDescription}
                        generatingId={generatingId}
                        onAddBucket={() => handleAddBucket('wants')}
                    />

                    {/* Savings Section */}
                    <BucketSection
                        title="Savings (Tabungan)"
                        icon={<DynamicIcon name="PiggyBank" size={16} />}
                        colorClass="text-green-500"
                        btnHoverClass="hover:border-green-500 hover:bg-green-500"
                        categoryBuckets={savingsBuckets}
                        editing={editing}
                        income={income}
                        onChange={handleBucketChange}
                        onDelete={handleDeleteBucket}
                        onGenerateDescription={handleGenerateDescription}
                        generatingId={generatingId}
                        onAddBucket={() => handleAddBucket('savings')}
                    />

                    {/* System / Unallocated */}
                    {systemBuckets.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-bold text-sm text-base-content/50 mb-3 flex items-center gap-2 uppercase tracking-wider">
                                <Wallet size={16} /> System
                            </h3>
                            <div className="space-y-3">
                                {systemBuckets.map((bucket) => (
                                    <BucketItem
                                        key={bucket.id}
                                        bucket={bucket}
                                        editing={editing}
                                        income={income}
                                        onChange={handleBucketChange}
                                        onDelete={handleDeleteBucket}
                                        onGenerateDescription={handleGenerateDescription}
                                        generatingId={generatingId}
                                    />
                                ))}
                            </div>
                        </div>
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
                        {buckets.map((bucket) => {
                            const percentage = Math.min(((bucket.amount || 0) / income) * 100, 100);
                            const colorClass = bucket.category === 'needs' ? 'bg-blue-500' :
                                bucket.category === 'wants' ? 'bg-purple-500' :
                                    bucket.category === 'savings' ? 'bg-green-500' :
                                        'bg-yellow-500';

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