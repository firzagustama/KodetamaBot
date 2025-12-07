import { useAuth } from "./hooks/useAuth";
import { useTelegram } from "./hooks/useTelegram";
import { useStore } from "./stores/useStore";
import Dashboard from "./components/Dashboard";
import BudgetManager from "./components/BudgetManager";
import TransactionList from "./components/TransactionList";
import GoogleIntegration from "./components/GoogleIntegration";
import { TelegramLoginButton } from "./components/TelegramLoginButton";
import { useEffect, useState, useRef } from "react";

type Tab = "dashboard" | "budget" | "transactions" | "google";

// Replace with your actual bot username
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME;

function App() {
    const { user, ready, expand, webApp } = useTelegram();
    const { token, authenticated, loading: authLoading } = useAuth();
    const { budget } = useStore();

    const setToken = useStore((state) => state.setToken);
    const fetchBudget = useStore((state) => state.fetchBudget);
    const fetchTransactions = useStore((state) => state.fetchTransactions);

    const [activeTab, setActiveTab] = useState<Tab>("dashboard");
    const [uiReady, setUiReady] = useState(false);
    const [isMiniApp, setIsMiniApp] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const hasExpanded = useRef(false);
    const hasFetched = useRef(false);

    // Check if running inside Telegram Mini App
    useEffect(() => {
        const isInTelegram = !!webApp;
        setIsMiniApp(isInTelegram);
        console.log("Running in Telegram Mini App:", isInTelegram);
    }, [webApp]);

    // ✅ Call tg.ready() first (only for mini app)
    useEffect(() => {
        if (isMiniApp && ready && !hasExpanded.current) {
            hasExpanded.current = true;
            setTimeout(() => {
                expand?.();
                setUiReady(true);
            }, 150);
        } else if (!isMiniApp) {
            // Not in mini app, show UI immediately
            setUiReady(true);
        }
    }, [isMiniApp, ready, expand]);

    // ✅ Set token in store when authenticated
    useEffect(() => {
        if (token) {
            setToken(token);
        }
    }, [token, setToken]);

    // ✅ Fetch budget/transactions in background
    useEffect(() => {
        if (authenticated && !hasFetched.current) {
            hasFetched.current = true;
            fetchBudget()
                .then(() => fetchTransactions())
                .catch((error) => {
                    console.error("Error fetching data:", error);
                    hasFetched.current = false;
                });
        }
    }, [authenticated, fetchBudget, fetchTransactions]);

    // Handle Telegram Widget Login
    const handleTelegramAuth = async (telegramUser: {
        id: number;
        first_name: string;
        last_name?: string;
        username?: string;
        photo_url?: string;
        auth_date: number;
        hash: string;
    }) => {
        setIsLoggingIn(true);
        setLoginError(null);

        try {
            console.log("Telegram Widget user data:", telegramUser);

            // Call your backend API
            const response = await fetch("/api/auth/telegram-widget", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(telegramUser),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Authentication failed");
            }

            console.log("Widget auth successful:", data);

            // Set token in store (this will trigger authenticated state)
            if (data.token) {
                setToken(data.token);
                // Store in localStorage for persistence
                localStorage.setItem("auth_token", data.token);
            }
        } catch (error) {
            console.error("Error during Telegram widget login:", error);
            const errorMessage = error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.";
            setLoginError(errorMessage);
        } finally {
            setIsLoggingIn(false);
            window.location.reload();
        }
    };

    // Loading / skeleton UI
    if (!uiReady || authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 bg-base-100 text-base-content">
                <span className="loading loading-spinner loading-lg"></span>
                <p className="text-sm text-base-content text-opacity-70">Memuat...</p>
            </div>
        );
    }

    // Not authenticated - Show login page
    if (!authenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-base-200">
                <div className="bg-base-100 rounded-2xl shadow-xl p-8 max-w-md w-full">
                    {/* Logo/Icon */}
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-4">💰</div>
                        <h1 className="text-2xl font-bold text-base-content">Kodetama Finance</h1>
                        <p className="text-base-content text-opacity-70 text-sm mt-2">
                            Kelola keuangan Anda dengan mudah
                        </p>
                    </div>

                    {/* Error message from widget auth */}
                    {loginError && (
                        <div className="alert alert-error mb-4">
                            <span>❌</span>
                            <span>{loginError}</span>
                        </div>
                    )}

                    {/* Info message if not in mini app */}
                    {!isMiniApp && !loginError && (
                        <div className="alert alert-info mb-4">
                            <span>ℹ️</span>
                            <span>
                                Anda juga bisa membuka aplikasi ini dari bot Telegram untuk pengalaman yang lebih baik.
                            </span>
                        </div>
                    )}

                    {/* Login Options */}
                    <div className="space-y-4">
                        {/* Telegram Login Widget */}
                        <div className="text-center">
                            <div className="text-sm text-base-content text-opacity-80 mb-4">
                                Login dengan akun Telegram Anda:
                            </div>

                            {isLoggingIn ? (
                                <div className="flex flex-col items-center gap-2 py-4">
                                    <span className="loading loading-spinner loading-md"></span>
                                    <p className="text-sm text-base-content text-opacity-70">Memproses login...</p>
                                </div>
                            ) : (
                                <TelegramLoginButton
                                    botName={BOT_USERNAME}
                                    buttonSize="large"
                                    cornerRadius={10}
                                    requestAccess={true}
                                    usePic={true}
                                    lang="en"
                                    onAuth={handleTelegramAuth}
                                />
                            )}
                        </div>

                        {/* Divider */}
                        <div className="divider">atau</div>

                        {/* Mini App Link */}
                        <div className="card card-compact bg-base-200">
                            <div className="card-body text-center">
                                <div className="text-sm text-base-content text-opacity-80 mb-2">
                                    Gunakan di Telegram Mini App
                                </div>
                                <a
                                    href={`https://t.me/${BOT_USERNAME}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary btn-sm"
                                >
                                    <span>Buka Bot</span>
                                    <span>→</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-base-content text-opacity-50">
                            Dengan login, Anda menyetujui penggunaan data Telegram Anda
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ✅ Main UI (Authenticated)
    return (
        <div className="min-h-screen pb-20 bg-base-100 text-base-content transition-colors duration-300">
            {/* Header */}
            <header className="sticky top-0 z-10 text-primary-content p-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                        <div className="w-10 h-10 bg-primary-content bg-opacity-20 rounded-full">
                            <span className="text-lg font-bold">{user?.first_name?.[0] ?? "K"}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h1 className="font-semibold">Halo, {user?.first_name ?? "User"} 👋</h1>
                        <p className="text-sm text-primary-content text-opacity-80">{budget?.period.name ?? "Dashboard"}</p>
                    </div>
                    {/* Logout button */}
                    <button
                        onClick={() => {
                            setToken("");
                            localStorage.removeItem("auth_token");
                            window.location.reload();
                        }}
                        className="btn btn-ghost btn-sm text-primary-content text-opacity-80 hover:text-primary-content"
                    >
                        Keluar
                    </button>
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
            <nav className="dock">
                <NavButton icon="📊" label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
                <NavButton icon="💰" label="Budget" active={activeTab === "budget"} onClick={() => setActiveTab("budget")} />
                <NavButton icon="📝" label="Transaksi" active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
                <NavButton icon="📁" label="Google" active={activeTab === "google"} onClick={() => setActiveTab("google")} />
            </nav>
        </div>
    );
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`btn btn-ghost btn-sm flex flex-col h-auto py-2 px-3 ${active ? "btn-active text-primary" : "text-base-content text-opacity-60"}`}
        >
            <span className="text-xl">{icon}</span>
            <span className="text-xs mt-1">{label}</span>
        </button>
    );
}

export default App;