import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    plugins: [vue()],
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