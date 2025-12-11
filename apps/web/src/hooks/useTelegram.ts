import { useEffect, useState, useCallback, useRef } from "react";
import { initData, useSignal } from "@tma.js/sdk-react";
import {
    ready as bridgeReady,
    expand as bridgeExpand,
    close as bridgeClose,
    requestFullscreen as bridgeRequestFullscreen,
    exitFullscreen as bridgeExitFullscreen,
    setupMainButton,
    setupBackButton,
    hapticFeedback,
} from "../utils/telegramBridge";

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

    // Viewport info
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;

    // Fullscreen (v8.0+)
    requestFullscreen?: () => void;
    exitFullscreen?: () => void;
    isFullscreen?: boolean;

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
    const initDataRaw = useSignal(initData.raw)
    const [ready, setReady] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const isMountedRef = useRef(true);
    const [webApp] = useState(() => window.Telegram?.WebApp);

    const user = webApp?.initDataUnsafe?.user;
    const isFullscreenSupported = typeof webApp?.isFullscreen !== 'undefined';

    useEffect(() => {
        isMountedRef.current = true;
        const initWebApp = async () => {
            if (webApp) {
                try {
                    // Use bridge implementation for cross-platform support
                    bridgeReady();

                    // Initialize states
                    setIsFullscreen(true);
                    setIsExpanded(true);

                    // Small delay before setting ready state (iOS fix)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    if (isMountedRef.current) {
                        setReady(true);
                        console.log('✅ Telegram WebApp initialized');
                    }
                } catch (error) {
                    console.error("Error initializing Telegram WebApp:", error);
                    if (isMountedRef.current) {
                        setReady(true);
                    }
                }
            }
        };

        initWebApp();

        return () => {
            isMountedRef.current = false;
        };
    }, [webApp]);

    /**
     * Expand viewport using bridge
     */
    const expand = useCallback(() => {
        try {
            bridgeExpand();
            setTimeout(() => setIsExpanded(true), 100);
        } catch (error) {
            console.error("Error expanding WebApp:", error);
        }
    }, []);

    /**
     * Close Mini App using bridge
     */
    const close = useCallback(() => {
        try {
            bridgeClose();
        } catch (error) {
            console.error("Error closing WebApp:", error);
        }
    }, []);

    /**
     * Request fullscreen mode (v8.0+)
     */
    const requestFullscreen = useCallback(() => {
        try {
            bridgeRequestFullscreen();
            setTimeout(() => {
                setIsFullscreen(true);
                console.log("✅ Fullscreen mode activated");
            }, 100);
        } catch (error) {
            console.error("Error requesting fullscreen:", error);
        }
    }, []);

    /**
     * Exit fullscreen mode
     */
    const exitFullscreen = useCallback(() => {
        try {
            bridgeExitFullscreen();
            setTimeout(() => {
                setIsFullscreen(false);
                console.log("✅ Exited fullscreen mode");
            }, 100);
        } catch (error) {
            console.error("Error exiting fullscreen:", error);
        }
    }, []);

    /**
     * Toggle fullscreen mode
     */
    const toggleFullscreen = useCallback(() => {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            requestFullscreen();
        }
    }, [isFullscreen, requestFullscreen, exitFullscreen]);

    /**
     * Show main button
     */
    const showMainButton = useCallback((text: string, onClick: () => void) => {
        try {
            setupMainButton({
                is_visible: true,
                is_active: true,
                text: text,
            });

            // Also set up click handler using WebApp API
            if (webApp?.MainButton) {
                webApp.MainButton.onClick(onClick);
            }
        } catch (error) {
            console.error("Error showing main button:", error);
        }
    }, [webApp]);

    /**
     * Hide main button
     */
    const hideMainButton = useCallback(() => {
        try {
            setupMainButton({ is_visible: false });
        } catch (error) {
            console.error("Error hiding main button:", error);
        }
    }, []);

    /**
     * Show back button
     */
    const showBackButton = useCallback((onClick?: () => void) => {
        try {
            setupBackButton(true);

            if (onClick && webApp?.BackButton) {
                webApp.BackButton.onClick(onClick);
            }
        } catch (error) {
            console.error("Error showing back button:", error);
        }
    }, [webApp]);

    /**
     * Hide back button
     */
    const hideBackButton = useCallback(() => {
        try {
            setupBackButton(false);
        } catch (error) {
            console.error("Error hiding back button:", error);
        }
    }, []);

    /**
     * Trigger haptic feedback
     */
    const vibrate = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
        try {
            if (type === 'success' || type === 'error' || type === 'warning') {
                hapticFeedback('notification', { notification_type: type });
            } else {
                hapticFeedback('impact', { impact_style: type });
            }
        } catch (error) {
            console.error("Error triggering haptic feedback:", error);
        }
    }, []);

    return {
        webApp,
        user,
        initDataRaw,
        ready,

        // Viewport control
        expand,
        close,
        isExpanded,

        // Fullscreen control (v8.0+)
        requestFullscreen,
        exitFullscreen,
        toggleFullscreen,
        isFullscreen,
        isFullscreenSupported,

        // Viewport info
        viewportHeight: webApp?.viewportHeight || 0,
        viewportStableHeight: webApp?.viewportStableHeight || 0,

        // Buttons
        showMainButton,
        hideMainButton,
        showBackButton,
        hideBackButton,

        // Haptic feedback
        vibrate,
    };
}