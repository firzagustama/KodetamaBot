import {
    LayoutDashboard,
    PieChart,
    ReceiptText,
    CloudLightning,
    HelpCircle
} from "lucide-react";
import { hapticFeedback } from "@tma.js/sdk-react";

type NavButtonProps = {
    icon: string; // Keeping string to match your current architecture
    label: string;
    active: boolean;
    onClick: () => void;
};

export function NavButton({ icon, label, active, onClick }: NavButtonProps) {

    // 1. Map string keys to Lucide Components
    // This allows you to keep passing strings from the parent, but use modern icons internally.
    const getIcon = (name: string, isActive: boolean) => {
        const size = 24; // Standard mobile icon size
        const strokeWidth = isActive ? 2.5 : 2; // Thicker lines when active

        switch (name) {
            case "Dashboard":
                return <LayoutDashboard size={size} strokeWidth={strokeWidth} />;
            case "Budget":
                return <PieChart size={size} strokeWidth={strokeWidth} />;
            case "Transaksi":
                return <ReceiptText size={size} strokeWidth={strokeWidth} />;
            case "Google":
                return <CloudLightning size={size} strokeWidth={strokeWidth} />;
            default:
                return <HelpCircle size={size} strokeWidth={strokeWidth} />;
        }
    };

    // 2. Enhanced Click Handler with Haptics
    const handlePress = () => {
        // Trigger Telegram Haptic Feedback
        if (hapticFeedback) {
            hapticFeedback.selectionChanged();
        }
        onClick();
    };

    return (
        <button
            onClick={handlePress}
            className={`
                group relative flex flex-col items-center justify-center flex-1 h-full
                transition-all duration-200 select-none
                active:scale-95 pt-4 /* Button shrinks slightly on press */
            `}
        >
            {/* Active State Indicator (Top Light) */}
            {active && (
                <span className="absolute top-0 w-8 h-1 bg-primary rounded-b-lg shadow-[0_0_8px_rgba(var(--p),0.6)] animate-in fade-in zoom-in duration-200"></span>
            )}

            {/* Icon Container */}
            <div className={`
                transition-colors duration-200 mb-1
                ${active ? "text-primary drop-shadow-sm" : "text-base-content/40 group-hover:text-base-content/60"}
            `}>
                {getIcon(icon, active)}
            </div>

            {/* Label */}
            <span className={`
                text-[10px] font-medium tracking-wide transition-colors duration-200
                ${active ? "text-base-content font-bold" : "text-base-content/40"}
            `}>
                {label}
            </span>
        </button>
    );
}