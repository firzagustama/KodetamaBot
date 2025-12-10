// src/hooks/useKeyboardOpen.ts
import { useEffect, useState, useRef } from "react";

export function useKeyboardOpen() {
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const initialHeightRef = useRef(window.innerHeight);

    useEffect(() => {
        // Strategy 1: Check if window resizes significantly (Android)
        const handleResize = () => {
            const currentHeight = window.innerHeight;
            const initialHeight = initialHeightRef.current;

            // If height drops by more than 20%, assume keyboard is open
            const keyboardOpen = currentHeight < initialHeight * 0.80;

            setIsKeyboardOpen(keyboardOpen);

            console.log("handleResize", {
                currentHeight,
                initialHeight,
                keyboardOpen
            });
        };

        // Strategy 2: Check if an input is focused (iOS/Universal)
        const handleFocusIn = () => {
            const activeTag = document.activeElement?.tagName;
            const shouldOpen = activeTag === "INPUT" || activeTag === "TEXTAREA";

            if (shouldOpen) {
                setIsKeyboardOpen(true);
            }

            console.log("handleFocusIn", {
                activeTag,
                shouldOpen
            });
        };

        const handleFocusOut = () => {
            setIsKeyboardOpen(false);
            console.log("handleFocusOut - keyboard closed");
        };

        // Listeners
        window.addEventListener("resize", handleResize);
        window.addEventListener("focusin", handleFocusIn);
        window.addEventListener("focusout", handleFocusOut);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("focusin", handleFocusIn);
            window.removeEventListener("focusout", handleFocusOut);
        };
    }, []); // Empty dependency array is correct now

    return isKeyboardOpen;
}