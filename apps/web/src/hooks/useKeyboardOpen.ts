import { useState, useEffect, useRef } from "react";
import { viewport, useSignal } from "@tma.js/sdk-react";

export function useKeyboardOpen() {
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    // Capture the initial stable height on mount
    const initialStableHeight = useRef<number | null>(null);

    // Track current viewport height
    const height = useSignal(viewport.height);
    const stableHeight = useSignal(viewport.stableHeight);

    useEffect(() => {
        // Mount viewport if not already mounted
        try {
            if (!viewport.isMounted()) {
                viewport.mount();
            }
        } catch (error) {
            // Already mounted or not available
        }
    }, []);

    useEffect(() => {
        if (initialStableHeight.current == null || initialStableHeight.current < stableHeight) {
            initialStableHeight.current = stableHeight;
        }
    }, [stableHeight]);

    useEffect(() => {
        // Compare current height against the INITIAL stable height
        if (initialStableHeight.current && height) {
            // If current height is significantly less than initial height, keyboard is open
            const isOpen = height < initialStableHeight.current * 0.75;
            setIsKeyboardOpen(isOpen);
        }
    }, [height]);

    return isKeyboardOpen;
}