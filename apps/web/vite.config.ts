import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import terminal from "vite-plugin-terminal";

export default defineConfig({
    plugins: [
        react(),
        ...(process.env.NODE_ENV === 'development' ? [terminal({ console: "terminal" })] : [])
    ],
    server: {
        allowedHosts: true,

        port: 5173,
        strictPort: true,

        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
                secure: false
            },
        },
    },
    build: {
        outDir: "dist",
        sourcemap: true,
        rollupOptions: {
            external: ["/@id/__x00__virtual:terminal/console"],
        },
    },
    define: {
        "process.env.ADMIN_TELEGRAM_ID": JSON.stringify(process.env.ADMIN_TELEGRAM_ID),
    },
});