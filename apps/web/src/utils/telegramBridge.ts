/**
 * Telegram Mini Apps Bridge
 * Based on: https://docs.telegram-mini-apps.com/platform/methods
 */

interface MessageJSON {
    eventType: string;
    eventData?: any;
}

/**
 * Posts an event to Telegram native app
 * Handles all platforms: Web, Desktop, Mobile, Windows Phone
 */
export function postEvent(eventType: string, eventData?: any): void {
    const webApp = window.Telegram?.WebApp;

    // Web version (iframe)
    if (window.parent !== window) {
        const message: MessageJSON = {
            eventType,
            eventData,
        };

        try {
            window.parent.postMessage(JSON.stringify(message), 'https://web.telegram.org');
        } catch (error) {
            console.error('Failed to post event to web parent:', error);
        }
    }

    // Desktop and Mobile (TelegramWebviewProxy)
    if ('TelegramWebviewProxy' in window) {
        try {
            (window as any).TelegramWebviewProxy.postEvent(
                eventType,
                JSON.stringify(eventData || {})
            );
        } catch (error) {
            console.error('Failed to post event via TelegramWebviewProxy:', error);
        }
    }

    // Windows Phone
    if ('external' in window && 'notify' in (window as any).external) {
        const message: MessageJSON = {
            eventType,
            eventData,
        };

        try {
            (window as any).external.notify(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to post event to Windows Phone:', error);
        }
    }

    // Fallback: Try using WebApp methods directly if available
    if (webApp) {
        try {
            // Some methods can be called directly
            switch (eventType) {
                case 'web_app_ready':
                    webApp.ready?.();
                    break;
                case 'web_app_expand':
                    webApp.expand?.();
                    break;
                case 'web_app_close':
                    webApp.close?.();
                    break;
            }
        } catch (error) {
            console.error('Failed to call WebApp method directly:', error);
        }
    }
}

/**
 * Request fullscreen mode
 * Available since Telegram v8.0
 */
export function requestFullscreen(): void {
    postEvent('web_app_request_fullscreen');
}

/**
 * Exit fullscreen mode
 * Available since Telegram v8.0
 */
export function exitFullscreen(): void {
    postEvent('web_app_exit_fullscreen');
}

/**
 * Expand the Mini App viewport
 */
export function expand(): void {
    postEvent('web_app_expand');
}

/**
 * Close the Mini App
 */
export function close(): void {
    postEvent('web_app_close');
}

/**
 * Notify Telegram that app is ready
 */
export function ready(): void {
    postEvent('web_app_ready');
}

/**
 * Setup back button
 */
export function setupBackButton(isVisible: boolean): void {
    postEvent('web_app_setup_back_button', { is_visible: isVisible });
}

/**
 * Setup main button
 */
export function setupMainButton(params: {
    is_visible?: boolean;
    is_active?: boolean;
    is_progress_visible?: boolean;
    text?: string;
    color?: string;
    text_color?: string;
    has_shine_effect?: boolean;
}): void {
    postEvent('web_app_setup_main_button', params);
}

/**
 * Set header color
 */
export function setHeaderColor(colorKey: 'bg_color' | 'secondary_bg_color'): void {
    postEvent('web_app_set_header_color', { color_key: colorKey });
}

/**
 * Set background color
 */
export function setBackgroundColor(color: string): void {
    postEvent('web_app_set_background_color', { color });
}

/**
 * Trigger haptic feedback
 */
export function hapticFeedback(
    type: 'impact' | 'notification' | 'selection_change',
    params?: {
        impact_style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
        notification_type?: 'error' | 'success' | 'warning';
    }
): void {
    postEvent('web_app_trigger_haptic_feedback', { type, ...params });
}

/**
 * Open link in browser
 */
export function openLink(url: string, tryInstantView?: boolean): void {
    postEvent('web_app_open_link', { url, try_instant_view: tryInstantView });
}

/**
 * Open Telegram link
 */
export function openTelegramLink(pathFull: string): void {
    postEvent('web_app_open_tg_link', { path_full: pathFull });
}

/**
 * Show popup
 */
export function showPopup(params: {
    title: string;
    message: string;
    buttons: Array<{
        id: string;
        type: 'default' | 'destructive' | 'ok' | 'close' | 'cancel';
        text?: string;
    }>;
}): void {
    postEvent('web_app_open_popup', params);
}

/**
 * Open QR scanner
 */
export function openScanQrPopup(text?: string): void {
    postEvent('web_app_open_scan_qr_popup', { text });
}

/**
 * Close QR scanner
 */
export function closeScanQrPopup(): void {
    postEvent('web_app_close_scan_qr_popup');
}

/**
 * Read text from clipboard
 */
export function readTextFromClipboard(reqId: string): void {
    postEvent('web_app_read_text_from_clipboard', { req_id: reqId });
}

/**
 * Request theme information
 */
export function requestTheme(): void {
    postEvent('web_app_request_theme');
}

/**
 * Request viewport information
 */
export function requestViewport(): void {
    postEvent('web_app_request_viewport');
}

/**
 * Setup closing behavior
 */
export function setupClosingBehavior(needConfirmation: boolean): void {
    postEvent('web_app_setup_closing_behavior', { need_confirmation: needConfirmation });
}

/**
 * Setup swipe behavior
 */
export function setupSwipeBehavior(allowVerticalSwipe: boolean): void {
    postEvent('web_app_setup_swipe_behavior', { allow_vertical_swipe: allowVerticalSwipe });
}