import { useState, useMemo, useEffect } from "react";
import { initData, useSignal } from "@tma.js/sdk-react";

export function useAuth() {
    const initDataRaw = useSignal(initData.raw);
    const initDataStartParam = useSignal(initData.startParam);
    const [token, setToken] = useState<string>("");
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    const authenticate = useMemo<() => Promise<string | null>>(() => {
        return async () => {
            try {
                if (initDataRaw) {
                    localStorage.removeItem("auth_token");

                    const response = await fetch("/api/auth/telegram", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ initData: initDataRaw, startParam: initDataStartParam }),
                    });

                    const data = await response.json();

                    if (response.ok && data.token) {
                        setToken(data.token);
                        setAuthenticated(true);
                        localStorage.setItem("auth_token", data.token);
                        return data.token;
                    } else {
                        setAuthenticated(false);
                        return null;
                    }
                } else {
                    setAuthenticated(false);
                    return null;
                }
            } catch (error) {
                setAuthenticated(false);
                return null;
            } finally {
                setLoading(false);
            }
        };
    }, [initDataRaw, initDataStartParam]);

    useEffect(() => {
        if (initDataRaw) {
            authenticate();
        }
    }, [initDataRaw, initDataStartParam])
    return { token, authenticated, loading, authenticate };
}