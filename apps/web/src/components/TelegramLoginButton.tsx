import { useEffect, useRef } from "react";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

interface TelegramLoginButtonProps {
    botName: string; // Your bot username (without @)
    buttonSize?: "large" | "medium" | "small";
    cornerRadius?: number;
    requestAccess?: boolean;
    usePic?: boolean;
    lang?: string;
    onAuth: (user: TelegramUser) => void;
}

declare global {
    interface Window {
        onTelegramAuth?: (user: TelegramUser) => void;
    }
}

export function TelegramLoginButton({
    botName,
    buttonSize = "large",
    cornerRadius = 20,
    requestAccess = true,
    usePic = true,
    lang = "en",
    onAuth,
}: TelegramLoginButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scriptLoadedRef = useRef(false);

    useEffect(() => {
        // Set up GLOBAL callback function (required by Telegram)
        // This MUST be a global function, not a local one
        window.onTelegramAuth = (user: TelegramUser) => {
            console.log("Telegram OAuth callback received:", user);
            onAuth(user);
        };

        // Only load script once
        if (!scriptLoadedRef.current && containerRef.current) {
            scriptLoadedRef.current = true;

            // Clear any existing content
            containerRef.current.innerHTML = '';

            // Create script element
            const script = document.createElement("script");
            script.src = "https://telegram.org/js/telegram-widget.js?22";
            script.async = true;
            script.setAttribute("data-telegram-login", botName);
            script.setAttribute("data-size", buttonSize);
            script.setAttribute("data-radius", cornerRadius.toString());
            script.setAttribute("data-request-access", requestAccess ? "write" : "read");
            script.setAttribute("data-userpic", usePic.toString());
            script.setAttribute("data-lang", lang);

            // CRITICAL: This must reference the GLOBAL function
            script.setAttribute("data-onauth", "onTelegramAuth(user)");

            // Add error handling
            script.onerror = () => {
                console.error("Failed to load Telegram widget script");
            };

            script.onload = () => {
                console.log("Telegram widget script loaded successfully");
            };

            // Append to container
            containerRef.current.appendChild(script);
        }

        // Cleanup
        return () => {
            // Don't delete the global function on unmount
            // as Telegram might call it after unmount
        };
    }, [botName, buttonSize, cornerRadius, requestAccess, usePic, lang, onAuth]);

    return (
        <div>
            <div ref={containerRef} className="flex justify-center" />
            <noscript>
                <div className="text-center text-sm text-slate-500 mt-2">
                    JavaScript harus diaktifkan untuk login dengan Telegram
                </div>
            </noscript>
        </div>
    );
}