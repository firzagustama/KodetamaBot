import { useState, useEffect } from "react";
import { useTelegram } from "./useTelegram";

interface UseAuthReturn {
    token: string | null;
    authenticated: boolean;
    loading: boolean;
    error: string | null;
    setToken: (token: string) => void;
    logout: () => void;
}

export function useAuth(): UseAuthReturn {
    const { initDataRaw, webApp } = useTelegram();
    const [token, setTokenState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const authenticateUser = async () => {
            try {
                // 1. Check if we have a stored token (from widget login)
                const storedToken = localStorage.getItem("auth_token");
                if (storedToken) {
                    console.log("Found stored token, verifying...");
                    // Verify the stored token is still valid
                    const isValid = await verifyToken(storedToken);
                    if (isValid) {
                        console.log("Stored token is valid");
                        setTokenState(storedToken);
                        setLoading(false);
                        return;
                    } else {
                        console.log("Stored token is invalid, removing...");
                        localStorage.removeItem("auth_token");
                    }
                }

                // 2. Telegram Auth
                if (initDataRaw && webApp) {
                    console.log("Authenticating with Telegram Mini App initDataRaw");
                    const response = await fetch("/api/auth/telegram", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ initData: initDataRaw }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Authentication failed");
                    }

                    const data = await response.json();
                    setTokenState(data.token);
                    localStorage.setItem("auth_token", data.token);
                    setError(null);
                }

            } catch (err) {
                console.error("Auth error:", err);
                setError(err instanceof Error ? err.message : "Authentication failed");
            } finally {
                setLoading(false);
            }
        };

        authenticateUser();
    }, [initDataRaw, webApp]);

    const setToken = (newToken: string) => {
        console.log("Setting new token");
        if (!newToken) {
            // If empty token, treat as logout
            setTokenState(null);
            localStorage.removeItem("auth_token");
            setError(null);
            return;
        }

        setTokenState(newToken);
        localStorage.setItem("auth_token", newToken);
        setError(null);
    };

    const logout = () => {
        console.log("Logging out");
        setTokenState(null);
        localStorage.removeItem("auth_token");
        setError(null);
    };

    return {
        token,
        authenticated: !!token,
        loading,
        error,
        setToken,
        logout,
    };
}

// Helper function to verify token validity
async function verifyToken(token: string): Promise<boolean> {
    try {
        const response = await fetch("/api/auth/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.ok;
    } catch (error) {
        console.error("Token verification failed:", error);
        return false;
    }
}