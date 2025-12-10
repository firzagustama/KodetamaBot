import { useStore } from "../stores/useStore";
import { useState, useEffect } from "react";
import {
    Save,
    Edit2,
    Wallet,
    Home,
    ShoppingBag,
    PiggyBank,
    AlertCircle
} from "lucide-react";

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
// Handles the "Type numbers, see Rupiah" logic
function CurrencyInput({ label, value, onChange, color, icon, maxLimit }: any) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Remove non-numeric characters to get raw number
        const rawValue = e.target.value.replace(/\D/g, "");
        onChange(Number(rawValue));
    };

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
                    type="tel" // Triggers numeric keypad on mobile
                    value={value === 0 ? "" : new Intl.NumberFormat("id-ID").format(value)}
                    onChange={handleChange}
                    className={`input input-bordered w-full pl-10 font-mono font-bold focus:outline-none focus:border-${color} focus:ring-1 focus:ring-${color}`}
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

export default function BudgetManager() {
    const { budget, updateBudget } = useStore();
    const [editing, setEditing] = useState(false);

    // Local State for Form
    const [income, setIncome] = useState(0);
    const [needs, setNeeds] = useState(0);
    const [wants, setWants] = useState(0);

    const [beforeIncome, setBeforeIncome] = useState(0);
    const [beforeNeeds, setBeforeNeeds] = useState(0);
    const [beforeWants, setBeforeWants] = useState(0);

    // Sync state when budget loads
    useEffect(() => {
        if (budget) {
            setIncome(budget.estimatedIncome);
            // Calculate nominals based on percentage if nominals aren't saved (fallback), 
            // or use stored nominals if your backend supports it.
            // Assuming store has 'needsAmount' or we derive from %
            setNeeds(budget.needsAmount || Math.round(budget.estimatedIncome * (budget.needsPercentage / 100)));
            setWants(budget.wantsAmount || Math.round(budget.estimatedIncome * (budget.wantsPercentage / 100)));
        }
    }, [budget]);

    if (!budget) {
        return <div className="animate-pulse h-64 bg-base-200 rounded-3xl" />;
    }

    // Calculations
    const totalAllocated = needs + wants;
    const savings = income - totalAllocated;
    const isOverBudget = savings < 0;

    // Edit Handler
    const handleEdit = () => {
        setBeforeIncome(income);
        setBeforeNeeds(needs);
        setBeforeWants(wants);
        setEditing(true);
    };

    // Save Handler
    const handleSave = async () => {
        if (isOverBudget) return; // Prevent saving invalid budget

        // Convert back to percentages for data consistency
        const needsPct = income > 0 ? (needs / income) * 100 : 0;
        const wantsPct = income > 0 ? (wants / income) * 100 : 0;
        const savingsPct = income > 0 ? (savings / income) * 100 : 0;

        await updateBudget({
            estimatedIncome: income,
            needsAmount: needs,
            wantsAmount: wants,
            savingsAmount: savings,
            needsPercentage: needsPct,
            wantsPercentage: wantsPct,
            savingsPercentage: savingsPct,
        });
        setEditing(false);
    };

    // Cancel Handler
    const handleCancel = () => {
        setIncome(beforeIncome);
        setNeeds(beforeNeeds);
        setWants(beforeWants);
        setEditing(false);
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">

            {/* Header Area */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="font-bold text-lg">Atur Budget</h2>
                    <p className="text-xs text-base-content/60">{budget.period.name}</p>
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
                            <span className="text-sm text-base-content/60 block mb-1">Pemasukan Total</span>
                            <span className="text-3xl font-black text-primary tracking-tight">
                                {formatRupiah(income)}
                            </span>
                        </div>
                    )}
                </div>

                {/* 2. ALLOCATION INPUTS */}
                <div className="p-5 space-y-5">

                    {/* Needs */}
                    <div className="relative">
                        {editing ? (
                            <CurrencyInput
                                label="Kebutuhan (Needs)"
                                icon={<Home size={16} className="text-success" />}
                                value={needs}
                                onChange={setNeeds}
                                color="success"
                            />
                        ) : (
                            <ReadOnlyRow
                                label="Kebutuhan (Needs)"
                                amount={needs}
                                color="text-success"
                                icon={<Home size={18} />}
                            />
                        )}
                        {/* Percentage Badge */}
                        <div className="absolute top-0 right-0 text-xs font-bold text-base-content/40 bg-base-200 px-2 py-0.5 rounded-md">
                            {income > 0 ? Math.round((needs / income) * 100) : 0}%
                        </div>
                    </div>

                    {/* Wants */}
                    <div className="relative">
                        {editing ? (
                            <CurrencyInput
                                label="Keinginan (Wants)"
                                icon={<ShoppingBag size={16} className="text-warning" />}
                                value={wants}
                                onChange={setWants}
                                color="warning"
                            />
                        ) : (
                            <ReadOnlyRow
                                label="Keinginan (Wants)"
                                amount={wants}
                                color="text-warning"
                                icon={<ShoppingBag size={18} />}
                            />
                        )}
                        <div className="absolute top-0 right-0 text-xs font-bold text-base-content/40 bg-base-200 px-2 py-0.5 rounded-md">
                            {income > 0 ? Math.round((wants / income) * 100) : 0}%
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="divider my-0"></div>

                    {/* Savings (Calculated) */}
                    <div className={`rounded-xl p-4 transition-colors ${isOverBudget ? 'bg-error/10 border border-error/20' : 'bg-info/10 border border-info/20'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2 font-semibold">
                                <PiggyBank size={18} className={isOverBudget ? "text-error" : "text-info"} />
                                <span>Tabungan (Sisa)</span>
                            </div>
                            <span className="text-xs font-bold opacity-50">
                                {income > 0 ? Math.round((savings / income) * 100) : 0}%
                            </span>
                        </div>

                        <div className={`text-2xl font-bold ${isOverBudget ? "text-error" : "text-info"}`}>
                            {savings < 0 ? "-" : ""}{formatRupiah(Math.abs(savings))}
                        </div>

                        {isOverBudget && (
                            <p className="text-xs text-error mt-1 font-medium">
                                Oops! Budget melebihi pemasukan.
                            </p>
                        )}
                    </div>

                </div>

                {/* 3. VISUAL BAR (Only in Edit Mode or Always? Let's keep it clean) */}
                <div className="w-full h-2 flex bg-base-300">
                    <div style={{ width: `${Math.min((needs / income) * 100, 100)}%` }} className="h-full bg-success"></div>
                    <div style={{ width: `${Math.min((wants / income) * 100, 100)}%` }} className="h-full bg-warning"></div>
                    {savings > 0 && <div style={{ width: `${(savings / income) * 100}%` }} className="h-full bg-info"></div>}
                </div>
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

// Sub-component for Read-only view
function ReadOnlyRow({ label, amount, color, icon }: any) {
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