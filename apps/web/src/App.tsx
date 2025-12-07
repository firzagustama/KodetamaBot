import { useAuth } from "./hooks/useAuth";
import { useTelegram } from "./hooks/useTelegram";
import { useStore } from "./stores/useStore";
import Dashboard from "./components/Dashboard";
import BudgetManager from "./components/BudgetManager";
import TransactionList from "./components/TransactionList";
import GoogleIntegration from "./components/GoogleIntegration";
import { TelegramLoginButton } from "./components/TelegramLoginButton";
import { setupSwipeBehavior } from "./utils/telegramBridge";
import { useEffect, useState, useRef } from "react";

type Tab = "dashboard" | "budget" | "transactions" | "google";

// Replace with your actual bot username
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME;

function App() {
    const { isFullscreen, toggleFullscreen } = useTelegram();
    const { ready, expand, webApp } = useTelegram();
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

    // Toggle fullscreen
    useEffect(() => {
        if (!isFullscreen) {
            toggleFullscreen();
        }
    }, [isFullscreen]);

    // Check if running inside Telegram Mini App
    useEffect(() => {
        const isInTelegram = !!webApp;
        setIsMiniApp(isInTelegram);
        console.log("Running in Telegram Mini App :", isInTelegram);
    }, [webApp]);

    // ✅ Call tg.ready() first (only for mini app)
    useEffect(() => {
        if (isMiniApp && ready && !hasExpanded.current) {
            hasExpanded.current = true;
            setTimeout(() => {
                expand?.();
                // Disable vertical swipe to prevent app closing on scroll
                setupSwipeBehavior(false);
                console.log("✅ Disabled vertical swipe behavior to prevent closing on scroll");
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
        <div className="min-h-screen bg-base-100 text-base-content transition-colors duration-300">
            {/* Header - Fixed at top */}
            <header className="fixed pt-16 left-0 right-0 z-10 text-primary-content bg-base-200 p-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                        <h1 className="font-semibold">Periode</h1>
                        <p className="text-sm text-primary-content text-opacity-80">{budget?.period.name ?? "Dashboard"}</p>
                    </div>
                    {/* Logout button */}
                    {!isMiniApp && (
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
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="min-h-screen pt-36 pb-28 px-4 overflow-y-auto">
                {activeTab === "dashboard" && <Dashboard />}
                {activeTab === "budget" && <BudgetManager />}
                {activeTab === "transactions" && <TransactionList />}
                {activeTab === "google" && <GoogleIntegration />}
            </main>

            {/* Bottom Navigation - Fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-10 flex pt-4 pb-10 bg-base-200 border-t border-base-300">
                <NavButton icon="Dashboard" label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
                <NavButton icon="Budget" label="Budget" active={activeTab === "budget"} onClick={() => setActiveTab("budget")} />
                <NavButton icon="Transaksi" label="Transaksi" active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
                <NavButton icon="Google" label="Google" active={activeTab === "google"} onClick={() => setActiveTab("google")} />
            </div>
        </div>
    );
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    const iconPath = [
        ["Google", <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />],
        ["Dashboard", <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v15a1 1 0 0 0 1 1h15M8 16l2.5-5.5 3 3L17.273 7 20 9.667" />],
        ["Budget", <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8H5m12 0a1 1 0 0 1 1 1v2.6M17 8l-4-4M5 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6M5 8l4-4 4 4m6 4h-4a2 2 0 1 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" />],
        ["Transaksi", <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12M9 3v14m7 0v4" />],
    ]
    return (
        <button
            onClick={onClick}
            className={`${active ? "text-primary" : "text-base-content"} flex flex-col items-center gap-1 flex-1`}
        >
            <svg className={`w-6 h-6 ${active ? "text-primary" : "text-base-content"}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                {iconPath.find((item) => item[0] === icon)?.[1]}
            </svg>
            <span className="text-xs">{label}</span>
        </button>
    );
}

export default App;