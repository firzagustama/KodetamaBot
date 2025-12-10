import { useAuth } from "./hooks/useAuth";
import { useTelegram } from "./hooks/useTelegram";
import { useStore } from "./stores/useStore";
import { useKeyboardOpen } from "./hooks/useKeyboardOpen";
import Dashboard from "./components/Dashboard";
import BudgetManager from "./components/BudgetManager";
import TransactionList from "./components/TransactionList";
import GoogleIntegration from "./components/GoogleIntegration";
import { setupSwipeBehavior } from "./utils/telegramBridge";
import { useEffect, useState, useRef } from "react";
import { StartBotInfo } from "./components/StartBotInfo";
import { NavButton } from "./components/NavButton";

type Tab = "dashboard" | "budget" | "transactions" | "google";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME;

function App() {
    const { ready, expand, webApp, requestFullscreen, initDataRaw } = useTelegram();
    const { token, authenticated, loading: authLoading } = useAuth();
    const { budget } = useStore();
    const isKeyboardOpen = useKeyboardOpen();

    const setToken = useStore((state) => state.setToken);
    const setOn401Handler = useStore((state) => state.setOn401Handler);
    const fetchBudget = useStore((state) => state.fetchBudget);
    const fetchTransactions = useStore((state) => state.fetchTransactions);

    const [activeTab, setActiveTab] = useState<Tab>("dashboard");
    const [uiReady, setUiReady] = useState(false);
    const [isMiniApp, setIsMiniApp] = useState(false);

    const hasExpanded = useRef(false);
    const hasFetched = useRef(false);
    const hasRequestedFullscreen = useRef(false); // ✅ Prevent infinite loop

    // Check if running inside Telegram Mini App
    useEffect(() => {
        const isInTelegram = !!webApp;
        setIsMiniApp(isInTelegram);
        console.log("Running in Telegram Mini App:", isInTelegram);
    }, [webApp]);

    // ✅ Initialize Mini App (only once)
    useEffect(() => {
        if (isMiniApp && ready && !hasExpanded.current) {
            hasExpanded.current = true;

            setTimeout(() => {
                // Expand viewport
                expand?.();

                // Disable vertical swipe to prevent app closing on scroll
                setupSwipeBehavior(false);
                console.log("✅ Disabled vertical swipe behavior");

                // Request fullscreen ONCE (optional - remove if you don't want auto-fullscreen)
                if (!hasRequestedFullscreen.current) {
                    hasRequestedFullscreen.current = true;
                    // Uncomment if you want auto-fullscreen:
                    requestFullscreen();
                }

                setUiReady(true);
            }, 150);
        } else if (!isMiniApp) {
            setUiReady(true);
        }
    }, [isMiniApp, ready, expand, requestFullscreen]);

    // ✅ Set token in store when authenticated
    useEffect(() => {
        if (token) {
            setToken(token);
        }
    }, [token, setToken]);

    // ✅ Set up 401 handler for seamless token renewal
    useEffect(() => {
        const handle401 = async (): Promise<string | null> => {
            if (!initDataRaw) {
                console.log('[401] No Telegram initData available for re-auth');
                return null;
            }

            try {
                console.log('[401] Attempting re-authentication with Telegram...');

                const response = await fetch('/api/auth/telegram', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ initData: initDataRaw }),
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error('[401] Re-auth failed:', data.error);
                    return null;
                }

                console.log('[401] Re-auth successful, got new token');
                const newToken = data.token;

                if (newToken) {
                    setToken(newToken);
                    localStorage.setItem('auth_token', newToken);
                    return newToken;
                }

                return null;
            } catch (error) {
                console.error('[401] Re-auth error:', error);
                return null;
            }
        };

        setOn401Handler(handle401);
    }, [initDataRaw, setToken, setOn401Handler]);

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
            <div className="max-h-screen bg-base-100 text-base-content antialiased selection:bg-primary selection:text-primary-content font-sans">
                <StartBotInfo
                    botUsername={BOT_USERNAME}
                    isMiniApp={isMiniApp}
                />
            </div>
        );
    }

    // ✅ Main UI (Authenticated)
    return (
        <div className="min-h-screen bg-base-100 text-base-content transition-colors duration-300">
            {/* Header - Fixed at top */}
            <header className="fixed left-0 right-0 z-10 text-primary-content bg-base-200 py-16 px-4 pb-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                        <h1 className="font-semibold">Periode</h1>
                        <p className="text-sm text-primary-content text-opacity-80">
                            {budget?.period.name ?? "Dashboard"}
                        </p>
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
            {!isKeyboardOpen && (
                <div className="fixed bottom-0 left-0 right-0 z-10 flex pb-10 bg-base-200 border-t border-base-300">
                    <NavButton
                        icon="Dashboard"
                        label="Dashboard"
                        active={activeTab === "dashboard"}
                        onClick={() => setActiveTab("dashboard")}
                    />
                    <NavButton
                        icon="Budget"
                        label="Budget"
                        active={activeTab === "budget"}
                        onClick={() => setActiveTab("budget")}
                    />
                    <NavButton
                        icon="Transaksi"
                        label="Transaksi"
                        active={activeTab === "transactions"}
                        onClick={() => setActiveTab("transactions")}
                    />
                    <NavButton
                        icon="Google"
                        label="Google"
                        active={activeTab === "google"}
                        onClick={() => setActiveTab("google")}
                    />
                </div>
            )}
        </div>
    );
}

export default App;