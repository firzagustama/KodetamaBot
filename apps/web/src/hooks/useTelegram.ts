import { useEffect, useState, useCallback, useRef } from "react";

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}

interface TelegramWebApp {
    ready: () => void;
    expand: () => void;
    close: () => void;
    initData: string;
    initDataUnsafe: {
        user?: TelegramUser;
        start_param?: string;
    };
    themeParams: {
        bg_color?: string;
        text_color?: string;
        button_color?: string;
        button_text_color?: string;
    };
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
    };
    BackButton: {
        isVisible: boolean;
        show: () => void;
        hide: () => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
    };
}

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

export function useTelegram() {
    const [ready, setReady] = useState(false);
    const isMountedRef = useRef(true);
    const [webApp] = useState(() => window.Telegram?.WebApp);

    const user = webApp?.initDataUnsafe?.user;
    const initData = webApp?.initData;

    useEffect(() => {
        isMountedRef.current = true;

        // Add a small delay for iOS to ensure WebApp is fully loaded
        const initWebApp = async () => {
            if (webApp) {
                try {
                    // Call ready() synchronously
                    webApp.ready();

                    // Small delay before setting ready state (iOS fix)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    if (isMountedRef.current) {
                        setReady(true);
                    }
                } catch (error) {
                    console.error("Error initializing Telegram WebApp:", error);
                    if (isMountedRef.current) {
                        setReady(true); // Still set ready even on error
                    }
                }
            }
        };

        initWebApp();

        return () => {
            isMountedRef.current = false;
        };
    }, [webApp]);

    const expand = useCallback(() => {
        try {
            webApp?.expand();
        } catch (error) {
            console.error("Error expanding WebApp:", error);
        }
    }, [webApp]);

    const close = useCallback(() => {
        try {
            webApp?.close();
        } catch (error) {
            console.error("Error closing WebApp:", error);
        }
    }, [webApp]);

    const showMainButton = useCallback((text: string, onClick: () => void) => {
        try {
            if (webApp?.MainButton) {
                webApp.MainButton.text = text;
                webApp.MainButton.onClick(onClick);
                webApp.MainButton.show();
            }
        } catch (error) {
            console.error("Error showing main button:", error);
        }
    }, [webApp]);

    const hideMainButton = useCallback(() => {
        try {
            webApp?.MainButton.hide();
        } catch (error) {
            console.error("Error hiding main button:", error);
        }
    }, [webApp]);

    return {
        webApp,
        user,
        initData,
        ready,
        expand,
        close,
        showMainButton,
        hideMainButton,
    };
}