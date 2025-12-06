import { useTelegram } from "./hooks/useTelegram";
import { useStore } from "./stores/useStore";
import Dashboard from "./components/Dashboard";
import BudgetManager from "./components/BudgetManager";
import TransactionList from "./components/TransactionList";
import GoogleIntegration from "./components/GoogleIntegration";
import { useEffect, useState } from "react";

type Tab = "dashboard" | "budget" | "transactions" | "google";

function App() {
    const { user, ready, expand } = useTelegram();
    const { fetchBudget, fetchTransactions } = useStore();
    const [activeTab, setActiveTab] = useState<Tab>("dashboard");

    useEffect(() => {
        if (ready) {
            expand();
            fetchBudget();
            fetchTransactions();
        }
    }, [ready]);

    if (!ready) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-primary-500 text-white p-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-lg font-bold">
                            {user?.first_name?.[0] ?? "K"}
                        </span>
                    </div>
                    <div>
                        <h1 className="font-semibold">
                            Halo, {user?.first_name ?? "User"} 👋
                        </h1>
                        <p className="text-sm text-white/80">Desember 2025</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-4">
                {activeTab === "dashboard" && <Dashboard />}
                {activeTab === "budget" && <BudgetManager />}
                {activeTab === "transactions" && <TransactionList />}
                {activeTab === "google" && <GoogleIntegration />}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around">
                <NavButton
                    icon="📊"
                    label="Dashboard"
                    active={activeTab === "dashboard"}
                    onClick={() => setActiveTab("dashboard")}
                />
                <NavButton
                    icon="💰"
                    label="Budget"
                    active={activeTab === "budget"}
                    onClick={() => setActiveTab("budget")}
                />
                <NavButton
                    icon="📝"
                    label="Transaksi"
                    active={activeTab === "transactions"}
                    onClick={() => setActiveTab("transactions")}
                />
                <NavButton
                    icon="📁"
                    label="Google"
                    active={activeTab === "google"}
                    onClick={() => setActiveTab("google")}
                />
            </nav>
        </div>
    );
}

function NavButton({
    icon,
    label,
    active,
    onClick,
}: {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${active
                    ? "text-primary-500 bg-primary-50"
                    : "text-slate-500 hover:text-primary-500"
                }`}
        >
            <span className="text-xl">{icon}</span>
            <span className="text-xs mt-1">{label}</span>
        </button>
    );
}

export default App;
