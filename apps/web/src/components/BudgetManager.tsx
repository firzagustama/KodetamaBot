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
    const [income, setIncome] = useState(budget?.estimatedIncome ?? 0);

    if (!budget) {
        return <div className="animate-pulse h-40 bg-base-200 rounded-2xl" />;
    }

    const savings = 100 - needs - wants;

    const handleSave = async () => {
        await updateBudget({
            estimatedIncome: income,
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
            <div className="card card-compact bg-base-200 bg-opacity-50">
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-base-content text-opacity-70">Periode</div>
                            <div className="font-semibold">{budget.period.name}</div>
                        </div>
                        <button
                            onClick={() => setEditing(!editing)}
                            className={`btn btn-sm ${editing ? 'btn-outline' : 'btn-primary'}`}
                        >
                            {editing ? "Batal" : "Edit"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Income */}
            <div className="card card-compact bg-base-200 bg-opacity-50">
                <div className="card-body">
                    <div className="text-sm text-base-content text-opacity-70">Penghasilan Bulanan</div>
                    {editing ? (
                        <input
                            type="number"
                            value={income}
                            onChange={(e) => setIncome(Number(e.target.value))}
                            className="input input-bordered w-full"
                        />
                    ) : (
                        <div className="text-2xl font-bold text-primary">
                            {formatRupiah(income)}
                        </div>
                    )}
                </div>
            </div>

            {/* Budget Allocation */}
            <div className="card card-compact bg-base-200 bg-opacity-50">
                <div className="card-body space-y-4">
                    <h3 className="card-title text-base-content">Alokasi Budget (Total: 100%)</h3>

                    <AllocationSlider
                        icon="🏠"
                        label="Needs"
                        value={needs}
                        onChange={setNeeds}
                        amount={income * (needs / 100)}
                        disabled={!editing}
                        max={100 - wants}
                        color="success"
                    />

                    <AllocationSlider
                        icon="🎮"
                        label="Wants"
                        value={wants}
                        onChange={setWants}
                        amount={income * (wants / 100)}
                        disabled={!editing}
                        max={100 - needs}
                        color="warning"
                    />

                    <AllocationSlider
                        icon="💵"
                        label="Savings"
                        value={savings}
                        onChange={() => { }}
                        amount={income * (savings / 100)}
                        disabled={true}
                        max={100}
                        color="info"
                    />

                    {editing && (
                        <button
                            onClick={handleSave}
                            className="btn btn-primary w-full"
                        >
                            Simpan Perubahan
                        </button>
                    )}
                </div>
            </div>

            {/* Tips */}
            <div className="alert alert-info">
                <span>💡</span>
                <div>
                    <div className="font-medium">Tips</div>
                    <div className="text-sm text-base-content text-opacity-80">
                        Setiap rupiah harus punya tujuan.
                        Alokasikan 50% untuk needs, 30% untuk wants, dan 20% untuk savings.
                    </div>
                </div>
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
    color: "success" | "warning" | "info";
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="font-medium">{label}</span>
                </div>
                <div className="text-right">
                    <span className="font-semibold">{value}%</span>
                    <span className="text-base-content text-opacity-50 text-sm ml-2">
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
                className={`range range-${color} w-full ${disabled ? "opacity-50" : ""}`}
            />
        </div>
    );
}