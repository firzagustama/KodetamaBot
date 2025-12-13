import { createElement } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

interface DynamicIconProps {
    name: string;
    size?: number;
    color?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({
    name,
    size = 24,
    color = "currentColor",
}) => {
    const Icons = LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>;
    const IconComponent = Icons[name];

    if (!IconComponent) return null;

    return createElement(IconComponent, { size, color });
};