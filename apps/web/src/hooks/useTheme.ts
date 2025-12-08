import { useEffect, useState } from "react";

// Hook to detect and apply system theme preference with DaisyUI
export function useTheme() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Check system preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Set initial theme
        const applyTheme = () => {
            const prefersDark = mediaQuery.matches;
            setIsDark(prefersDark);

            // Apply DaisyUI theme via data-theme attribute
            if (prefersDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.documentElement.classList.add('dark'); // For any legacy CSS that still uses class
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                document.documentElement.classList.remove('dark');
            }
        };

        // Apply theme on mount
        applyTheme();

        // Listen for changes
        mediaQuery.addEventListener('change', applyTheme);

        // Cleanup
        return () => mediaQuery.removeEventListener('change', applyTheme);
    }, []);

    return { isDark };
}