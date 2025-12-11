import { useAuth } from "./hooks/useAuth";
import { useStore } from "./stores/useStore";
import { useKeyboardOpen } from "./hooks/useKeyboardOpen";
import Dashboard from "./components/Dashboard";
import BudgetManager from "./components/BudgetManager";
import TransactionList from "./components/TransactionList";
import GoogleIntegration from "./components/GoogleIntegration";
import { useEffect, useState, useRef } from "react";
import { StartBotInfo } from "./components/StartBotInfo";
import { NavButton } from "./components/NavButton";
import {
    miniApp,
    viewport,
    themeParams,
    swipeBehavior,
    useLaunchParams,
    useSignal,
} from "@tma.js/sdk-react";

type Tab = "dashboard" | "budget" | "transactions" | "google";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME;

function App() {
    const lp = useLaunchParams();

    // Use signals to track component state
    const isExpanded = useSignal(viewport.isExpanded);

    const { token, authenticated, loading: authLoading, authenticate } = useAuth();
    const { budget } = useStore();
    const isKeyboardOpen = useKeyboardOpen();

    const setToken = useStore((state) => state.setToken);
    const setOn401Handler = useStore((state) => state.setOn401Handler);
    const fetchBudget = useStore((state) => state.fetchBudget);
    const fetchTransactions = useStore((state) => state.fetchTransactions);

    const [activeTab, setActiveTab] = useState<Tab>("dashboard");
    const [uiReady, setUiReady] = useState(false);
    const [isMiniApp, setIsMiniApp] = useState(false);

    const hasInitialized = useRef(false);
    const hasFetched = useRef(false);

    // Check if running inside Telegram Mini App
    useEffect(() => {
        const isInTelegram = lp && lp.platform !== "unknown";
        setIsMiniApp(isInTelegram);
        console.log("Running in Telegram Mini App:", isInTelegram);
        console.log("Platform:", lp?.platform);
        console.log("Version:", lp?.version);
    }, [lp]);

    // ✅ Initialize Mini App components (only once)
    useEffect(() => {
        if (isMiniApp && !hasInitialized.current) {
            hasInitialized.current = true;

            setTimeout(() => {
                try {
                    // Mount components before using them
                    miniApp.mount();
                    viewport.mount();
                    themeParams.mount();
                    swipeBehavior.mount();

                    // Expand viewport to full height
                    if (!isExpanded) {
                        viewport.requestFullscreen(); // change here for expanded or fullscreen
                    }

                    // Disable vertical swipe to prevent app closing on scroll
                    swipeBehavior.disableVertical();

                    // Set closing behavior
                    miniApp.ready();

                    setUiReady(true);
                } catch (error) {
                    console.error("Error initializing Mini App:", error);
                    setUiReady(true);
                }
            }, 150);
        } else if (!isMiniApp) {
            setUiReady(true);
        }
    }, [isMiniApp, isExpanded]);

    // ✅ Set token in store when authenticated
    useEffect(() => {
        if (token) {
            setToken(token);
        }
    }, [token, setToken]);

    // ✅ Set up 401 handler for seamless token renewal
    useEffect(() => {
        setOn401Handler(authenticate);
    }, [lp, setToken, setOn401Handler]);

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
                <StartBotInfo botUsername={BOT_USERNAME} isMiniApp={isMiniApp} />
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