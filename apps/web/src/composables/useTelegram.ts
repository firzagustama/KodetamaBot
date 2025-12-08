import { ref, computed, onMounted, onUnmounted, type Ref } from "vue";
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
    const ready = ref(false);
    const isFullscreen = ref(false);
    const isExpanded = ref(false);
    const isMounted = ref(true);
    const webApp = ref(window.Telegram?.WebApp);

    const user = computed(() => webApp.value?.initDataUnsafe?.user);
    const initData = computed(() => webApp.value?.initData);
    const isFullscreenSupported = computed(() => typeof webApp.value?.isFullscreen !== 'undefined');

    onMounted(async () => {
        if (webApp.value) {
            try {
                // Use bridge implementation for cross-platform support
                bridgeReady();

                // Initialize states
                isFullscreen.value = webApp.value.isFullscreen || false;
                isExpanded.value = webApp.value.isExpanded || false;

                // Small delay before setting ready state (iOS fix)
                await new Promise(resolve => setTimeout(resolve, 100));

                if (isMounted.value) {
                    ready.value = true;
                    console.log('✅ Telegram WebApp initialized');
                }
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
                if (isMounted.value) {
                    ready.value = true;
                }
            }
        } else {
            // No webApp available, still set ready
            ready.value = true;
        }
    });

    onUnmounted(() => {
        isMounted.value = false;
    });

    /**
     * Expand viewport using bridge
     */
    const expand = () => {
        try {
            bridgeExpand();
            setTimeout(() => isExpanded.value = true, 100);
        } catch (error) {
            console.error("Error expanding WebApp:", error);
        }
    };

    /**
     * Close Mini App using bridge
     */
    const close = () => {
        try {
            bridgeClose();
        } catch (error) {
            console.error("Error closing WebApp:", error);
        }
    };

    /**
     * Request fullscreen mode (v8.0+)
     */
    const requestFullscreen = () => {
        try {
            bridgeRequestFullscreen();
            setTimeout(() => {
                isFullscreen.value = true;
                console.log("✅ Fullscreen mode activated");
            }, 100);
        } catch (error) {
            console.error("Error requesting fullscreen:", error);
        }
    };

    /**
     * Exit fullscreen mode
     */
    const exitFullscreen = () => {
        try {
            bridgeExitFullscreen();
            setTimeout(() => {
                isFullscreen.value = false;
                console.log("✅ Exited fullscreen mode");
            }, 100);
        } catch (error) {
            console.error("Error exiting fullscreen:", error);
        }
    };

    /**
     * Toggle fullscreen mode
     */
    const toggleFullscreen = () => {
        if (isFullscreen.value) {
            exitFullscreen();
        } else {
            requestFullscreen();
        }
    };

    /**
     * Show main button
     */
    const showMainButton = (text: string, onClick: () => void) => {
        try {
            setupMainButton({
                is_visible: true,
                is_active: true,
                text: text,
            });

            // Also set up click handler using WebApp API
            if (webApp.value?.MainButton) {
                webApp.value.MainButton.onClick(onClick);
            }
        } catch (error) {
            console.error("Error showing main button:", error);
        }
    };

    /**
     * Hide main button
     */
    const hideMainButton = () => {
        try {
            setupMainButton({ is_visible: false });
        } catch (error) {
            console.error("Error hiding main button:", error);
        }
    };

    /**
     * Show back button
     */
    const showBackButton = (onClick?: () => void) => {
        try {
            setupBackButton(true);

            if (onClick && webApp.value?.BackButton) {
                webApp.value.BackButton.onClick(onClick);
            }
        } catch (error) {
            console.error("Error showing back button:", error);
        }
    };

    /**
     * Hide back button
     */
    const hideBackButton = () => {
        try {
            setupBackButton(false);
        } catch (error) {
            console.error("Error hiding back button:", error);
        }
    };

    /**
     * Trigger haptic feedback
     */
    const vibrate = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
        try {
            if (type === 'success' || type === 'error' || type === 'warning') {
                hapticFeedback('notification', { notification_type: type });
            } else {
                hapticFeedback('impact', { impact_style: type });
            }
        } catch (error) {
            console.error("Error triggering haptic feedback:", error);
        }
    };

    return {
        webApp: webApp as Ref<TelegramWebApp | undefined>,
        user,
        initData,
        ready: ready as Ref<boolean>,

        // Viewport control
        expand,
        close,
        isExpanded: isExpanded as Ref<boolean>,

        // Fullscreen control (v8.0+)
        requestFullscreen,
        exitFullscreen,
        toggleFullscreen,
        isFullscreen: isFullscreen as Ref<boolean>,
        isFullscreenSupported,

        // Viewport info
        viewportHeight: computed(() => webApp.value?.viewportHeight || 0),
        viewportStableHeight: computed(() => webApp.value?.viewportStableHeight || 0),

        // Buttons
        showMainButton,
        hideMainButton,
        showBackButton,
        hideBackButton,

        // Haptic feedback
        vibrate,
    };
}