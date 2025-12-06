import { useStore } from "../stores/useStore";
import { useState } from "react";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function BudgetManager() {
    const { budget, updateBudget } = useStore();
    const [editing, setEditing] = useState(false);
    const [needs, setNeeds] = useState(budget?.needsPercentage ?? 50);
    const [wants, setWants] = useState(budget?.wantsPercentage ?? 30);

    if (!budget) {
        return <div className="animate-pulse h-40 bg-slate-200 rounded-2xl" />;
    }

    const savings = 100 - needs - wants;
    const income = budget.estimatedIncome;

    const handleSave = async () => {
        await updateBudget({
            needsPercentage: needs,
            wantsPercentage: wants,
            savingsPercentage: savings,
            needsAmount: Math.round(income * (needs / 100)),
            wantsAmount: Math.round(income * (wants / 100)),
            savingsAmount: Math.round(income * (savings / 100)),
        });
        setEditing(false);
    };

    return (
        <div className="space-y-4">
            {/* Period Header */}
            <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500">Periode</p>
                        <p className="font-semibold">{budget.period.name}</p>
                    </div>
                    <button
                        onClick={() => setEditing(!editing)}
                        className="px-3 py-1.5 text-sm bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200 transition-colors"
                    >
                        {editing ? "Batal" : "Edit"}
                    </button>
                </div>
            </div>

            {/* Income */}
            <div className="glass-card rounded-2xl p-4">
                <p className="text-sm text-slate-500">Penghasilan Bulanan</p>
                <p className="text-2xl font-bold text-primary-600">
                    {formatRupiah(income)}
                </p>
            </div>

            {/* Budget Allocation */}
            <div className="glass-card rounded-2xl p-4 space-y-4">
                <h3 className="font-semibold">Alokasi Budget (Total: 100%)</h3>

                <AllocationSlider
                    icon="🏠"
                    label="Kebutuhan"
                    value={needs}
                    onChange={setNeeds}
                    amount={income * (needs / 100)}
                    disabled={!editing}
                    max={100 - wants}
                    color="emerald"
                />

                <AllocationSlider
                    icon="🎮"
                    label="Keinginan"
                    value={wants}
                    onChange={setWants}
                    amount={income * (wants / 100)}
                    disabled={!editing}
                    max={100 - needs}
                    color="amber"
                />

                <AllocationSlider
                    icon="💵"
                    label="Tabungan"
                    value={savings}
                    onChange={() => { }}
                    amount={income * (savings / 100)}
                    disabled={true}
                    max={100}
                    color="sky"
                />

                {editing && (
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                    >
                        Simpan Perubahan
                    </button>
                )}
            </div>

            {/* ZBB Tips */}
            <div className="bg-gradient-to-r from-primary-50 to-sky-50 rounded-2xl p-4 border border-primary-100">
                <h4 className="font-medium text-primary-700 flex items-center gap-2">
                    💡 Tips ZBB
                </h4>
                <p className="text-sm text-slate-600 mt-2">
                    Dengan Zero-Based Budgeting, setiap rupiah punya tujuan.
                    Alokasikan 50% untuk kebutuhan, 30% untuk keinginan, dan 20% untuk tabungan.
                </p>
            </div>
        </div>
    );
}

function AllocationSlider({
    icon,
    label,
    value,
    onChange,
    amount,
    disabled,
    max,
    color,
}: {
    icon: string;
    label: string;
    value: number;
    onChange: (v: number) => void;
    amount: number;
    disabled: boolean;
    max: number;
    color: "emerald" | "amber" | "sky";
}) {
    const colorClasses = {
        emerald: "accent-emerald-500",
        amber: "accent-amber-500",
        sky: "accent-sky-500",
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="font-medium">{label}</span>
                </div>
                <div className="text-right">
                    <span className="font-semibold">{value}%</span>
                    <span className="text-slate-400 text-sm ml-2">
                        {formatRupiah(amount)}
                    </span>
                </div>
            </div>
            <input
                type="range"
                min="0"
                max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                disabled={disabled}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${colorClasses[color]} ${disabled ? "opacity-50" : ""
                    }`}
            />
        </div>
    );
}
