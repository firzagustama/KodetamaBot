import { useState, useEffect } from "react";
import { viewport, useSignal } from "@tma.js/sdk-react";

export function useKeyboardOpen() {
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    // Track viewport height and stable height using signals
    const height = useSignal(viewport.height);
    const stableHeight = useSignal(viewport.stableHeight);
    const isStable = useSignal(viewport.isStable);

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
        // If viewport height is significantly less than stable height, keyboard is likely open
        // We use 0.75 as threshold (if height is less than 75% of stable height)
        if (isStable && stableHeight && height) {
            const isOpen = height < stableHeight * 0.75;
            setIsKeyboardOpen(isOpen);
        }
    }, [height, stableHeight, isStable]);

    return isKeyboardOpen;
}