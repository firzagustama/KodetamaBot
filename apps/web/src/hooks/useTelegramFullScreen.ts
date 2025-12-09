import { useEffect, useCallback, useState } from "react";
import {
    requestFullscreen as bridgeRequestFullscreen,
    exitFullscreen as bridgeExitFullscreen,
    expand as bridgeExpand,
    postEvent
} from "../utils/telegramBridge";

/**
 * Hook to manage Telegram Mini App fullscreen mode
 * Uses the official Telegram Mini Apps bridge implementation
 * Requires Telegram WebApp version 8.0+
 */
export function useTelegramFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [viewportStableHeight, setViewportStableHeight] = useState(0);
    const webApp = window.Telegram?.WebApp;

    useEffect(() => {
        if (!webApp) return;

        // Check if fullscreen is supported (v8.0+)
        // Note: isFullscreen property might not exist on older versions
        const supported = typeof webApp.isFullscreen !== 'undefined' ||
            typeof webApp.requestFullscreen === 'function';
        setIsSupported(supported);

        // Initialize states
        setIsFullscreen(webApp.isFullscreen || false);
        setIsExpanded(webApp.isExpanded || false);
        setViewportHeight(webApp.viewportHeight || 0);
        setViewportStableHeight(webApp.viewportStableHeight || 0);

        console.log('Telegram WebApp Info:', {
            fullscreenSupported: supported,
            isFullscreen: webApp.isFullscreen,
            isExpanded: webApp.isExpanded,
            viewportHeight: webApp.viewportHeight,
        });

        // Listen for viewport changes
        const handleViewportChanged = (event: any) => {
            console.log('Viewport changed:', event);
            if (webApp) {
                setIsFullscreen(webApp.isFullscreen || false);
                setIsExpanded(webApp.isExpanded || false);
                setViewportHeight(webApp.viewportHeight || 0);
                setViewportStableHeight(webApp.viewportStableHeight || 0);
            }
        };

        // Listen for fullscreen changes (if supported)
        window.addEventListener('telegram-viewport-changed', handleViewportChanged);

        return () => {
            window.removeEventListener('telegram-viewport-changed', handleViewportChanged);
        };
    }, [webApp]);

    /**
     * Request fullscreen mode using the bridge
     */
    const requestFullscreen = useCallback(() => {
        try {
            // Use bridge implementation for cross-platform support
            bridgeRequestFullscreen();

            // Optimistically update state
            setTimeout(() => {
                setIsFullscreen(true);
                console.log('✅ Fullscreen mode requested');
            }, 100);
        } catch (error) {
            console.error('Failed to request fullscreen:', error);
        }
    }, []);

    /**
     * Exit fullscreen mode using the bridge
     */
    const exitFullscreen = useCallback(() => {
        try {
            // Use bridge implementation for cross-platform support
            bridgeExitFullscreen();

            // Optimistically update state
            setTimeout(() => {
                setIsFullscreen(false);
                console.log('✅ Exited fullscreen mode');
            }, 100);
        } catch (error) {
            console.error('Failed to exit fullscreen:', error);
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
     * Expand the Mini App (not fullscreen, but expands viewport)
     */
    const expand = useCallback(() => {
        try {
            // Use bridge implementation for cross-platform support
            bridgeExpand();

            // Optimistically update state
            setTimeout(() => {
                setIsExpanded(true);
                console.log('✅ Mini App expanded');
            }, 100);
        } catch (error) {
            console.error('Failed to expand:', error);
        }
    }, []);

    /**
     * Request viewport information update
     */
    const requestViewportUpdate = useCallback(() => {
        postEvent('web_app_request_viewport');
    }, []);

    return {
        // States
        isFullscreen,
        isExpanded,
        isSupported,

        // Methods
        requestFullscreen,
        exitFullscreen,
        toggleFullscreen,
        expand,
        requestViewportUpdate,

        // Viewport info
        viewportHeight,
        viewportStableHeight,
    };
}