import { useEffect, useState } from "react";

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
    const webApp = window.Telegram?.WebApp;

    // Fallback for development
    const devUser: TelegramUser | undefined = process.env.ADMIN_TELEGRAM_ID
        ? {
            id: parseInt(process.env.ADMIN_TELEGRAM_ID),
            first_name: "Admin",
            last_name: "Dev",
            username: "admindev",
            language_code: "id",
        }
        : undefined;

    const user = webApp?.initDataUnsafe?.user ?? devUser;
    const initData = webApp?.initData ?? "";

    useEffect(() => {
        if (webApp) {
            webApp.ready();
            setReady(true);
        } else {
            // Development fallback
            setReady(true);
        }
    }, []);

    const expand = () => webApp?.expand();
    const close = () => webApp?.close();

    const showMainButton = (text: string, onClick: () => void) => {
        if (webApp?.MainButton) {
            webApp.MainButton.text = text;
            webApp.MainButton.onClick(onClick);
            webApp.MainButton.show();
        }
    };

    const hideMainButton = () => {
        webApp?.MainButton.hide();
    };

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
