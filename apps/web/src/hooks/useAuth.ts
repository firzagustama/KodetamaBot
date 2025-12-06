import { useEffect, useState, useCallback, useRef } from "react";
import { useTelegram } from "./useTelegram";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface User {
    id: string;
    tier: "standard" | "pro" | "family";
    isActive: boolean;
    telegram: {
        id: number;
        username?: string;
        firstName: string;
        lastName?: string;
    };
}

interface AuthState {
    token: string | null;
    user: User | null;
    loading: boolean;
    error: string | null;
    authenticated: boolean;
}

/**
 * Hook for managing Telegram WebApp authentication
 * Authenticates with the backend using Telegram's initData
 */
export function useAuth() {
    const { initData, user: telegramUser, ready } = useTelegram();
    const [state, setState] = useState<AuthState>({
        token: null,
        user: null,
        loading: true,
        error: null,
        authenticated: false,
    });

    const authenticate = useCallback(async () => {
        // Don't attempt auth until Telegram SDK is ready
        if (!ready) return;

        // Check if we have initData (real Telegram environment)
        if (!initData) {
            // Development fallback - use VITE_DEV_TELEGRAM_ID if available
            const devTelegramId = import.meta.env.VITE_DEV_TELEGRAM_ID;

            if (import.meta.env.DEV && devTelegramId) {
                console.log("🔧 Dev mode: Authenticating with VITE_DEV_TELEGRAM_ID");
                try {
                    const response = await fetch(`${API_URL}/auth/dev`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ telegramId: parseInt(devTelegramId) }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error ?? "Dev authentication failed");
                    }

                    const data = await response.json();

                    setState({
                        token: data.token,
                        user: data.user,
                        loading: false,
                        error: null,
                        authenticated: true,
                    });

                    localStorage.setItem("kodetama_token", data.token);
                    return;
                } catch (err) {
                    console.error("Dev authentication error:", err);
                    setState({
                        token: null,
                        user: null,
                        loading: false,
                        error: err instanceof Error ? err.message : "Dev authentication failed",
                        authenticated: false,
                    });
                    return;
                }
            }

            setState({
                token: null,
                user: null,
                loading: false,
                error: import.meta.env.DEV
                    ? "No Telegram WebApp detected. Set VITE_DEV_TELEGRAM_ID in .env for dev mode."
                    : "Authentication required",
                authenticated: false,
            });
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/telegram`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ initData }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error ?? "Authentication failed");
            }

            const data = await response.json();

            setState({
                token: data.token,
                user: data.user,
                loading: false,
                error: null,
                authenticated: true,
            });

            // Store token in localStorage for persistence
            localStorage.setItem("kodetama_token", data.token);
        } catch (err) {
            console.error("Authentication error:", err);
            setState({
                token: null,
                user: null,
                loading: false,
                error: err instanceof Error ? err.message : "Authentication failed",
                authenticated: false,
            });
        }
    }, [initData, ready]);

    const authAttempted = useRef(false);

    // Try to restore token from localStorage on mount
    useEffect(() => {
        // Prevent double execution in Strict Mode
        if (authAttempted.current) return;

        const storedToken = localStorage.getItem("kodetama_token");

        if (storedToken && !state.token) {
            authAttempted.current = true;
            // Validate stored token by calling /auth/me
            fetch(`${API_URL}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                },
            })
                .then((res) => {
                    if (res.ok) return res.json();
                    throw new Error("Token expired");
                })
                .then((data) => {
                    setState({
                        token: storedToken,
                        user: data.user,
                        loading: false,
                        error: null,
                        authenticated: true,
                    });
                })
                .catch(() => {
                    // Token invalid, clear and re-authenticate
                    localStorage.removeItem("kodetama_token");
                    // Reset attempt flag to allow authenticate() to run
                    authAttempted.current = false;
                    // Trigger re-run to hit the else if block
                    setState(prev => ({ ...prev, token: null }));
                });
        } else if (ready && !state.authenticated && !state.error) {
            authAttempted.current = true;
            authenticate();
        }
    }, [ready, authenticate, state.authenticated, state.error, state.token]);

    const logout = useCallback(() => {
        localStorage.removeItem("kodetama_token");
        setState({
            token: null,
            user: null,
            loading: false,
            error: null,
            authenticated: false,
        });
    }, []);

    return {
        ...state,
        telegramUser,
        authenticate,
        logout,
    };
}
