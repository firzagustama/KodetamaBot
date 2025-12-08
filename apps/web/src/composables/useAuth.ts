import { ref, computed, onMounted, watch, type Ref, type ComputedRef } from "vue";
import { useTelegram } from "./useTelegram";

interface UseAuthReturn {
    token: Ref<string | null>;
    authenticated: ComputedRef<boolean>;
    loading: Ref<boolean>;
    error: Ref<string | null>;
    setToken: (token: string) => void;
    logout: () => void;
}

export function useAuth(): UseAuthReturn {
    const { initData, webApp } = useTelegram();
    const token = ref<string | null>(null);
    const loading = ref(true);
    const error = ref<string | null>(null);

    const authenticated = computed(() => !!token.value);

    // Helper function to verify token validity
    async function verifyToken(tokenValue: string): Promise<boolean> {
        try {
            const response = await fetch("/api/auth/me", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenValue}`,
                },
            });
            return response.ok;
        } catch (error) {
            console.error("Token verification failed:", error);
            return false;
        }
    }

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
                    token.value = storedToken;
                    loading.value = false;
                    return;
                } else {
                    console.log("Stored token is invalid, removing...");
                    localStorage.removeItem("auth_token");
                }
            }

            // 2. If in Telegram Mini App, use initData
            if (webApp && initData) {
                console.log("Authenticating with Telegram Mini App initData");
                const response = await fetch("/api/auth/telegram", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ initData }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Authentication failed");
                }

                const data = await response.json();
                console.log("Mini App auth successful");
                token.value = data.token;
                localStorage.setItem("auth_token", data.token);
                error.value = null;
            } else if (!webApp) {
                // 3. Not in Telegram Mini App, and no stored token
                console.log("Not in Mini App, showing widget login");
                error.value = null; // Don't show error, just show login page
            }
        } catch (err) {
            console.error("Auth error:", err);
            error.value = err instanceof Error ? err.message : "Authentication failed";
        } finally {
            loading.value = false;
        }
    };

    const setToken = (newToken: string) => {
        console.log("Setting new token");
        if (!newToken) {
            // If empty token, treat as logout
            token.value = null;
            localStorage.removeItem("auth_token");
            error.value = null;
            return;
        }

        token.value = newToken;
        localStorage.setItem("auth_token", newToken);
        error.value = null;
    };

    const logout = () => {
        console.log("Logging out");
        token.value = null;
        localStorage.removeItem("auth_token");
        error.value = null;
    };

    onMounted(() => {
        authenticateUser();
    });

    // Watch for changes in webApp or initData to re-authenticate
    watch([webApp, initData], () => {
        if (webApp && initData && !token.value) {
            authenticateUser();
        }
    });

    return {
        token,
        authenticated,
        loading,
        error,
        setToken,
        logout,
    };
}