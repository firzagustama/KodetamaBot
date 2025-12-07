import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
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
    },
    define: {
        "process.env.ADMIN_TELEGRAM_ID": JSON.stringify(process.env.ADMIN_TELEGRAM_ID),
    },
});
