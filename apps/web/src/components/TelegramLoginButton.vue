<template>
    <div>
        <div ref="containerRef" class="flex justify-center" />
        <noscript>
            <div class="text-center text-sm text-base-content/70 mt-2">
                JavaScript harus diaktifkan untuk login dengan Telegram
            </div>
        </noscript>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

interface Props {
    botName: string;
    buttonSize?: "large" | "medium" | "small";
    cornerRadius?: number;
    requestAccess?: boolean;
    usePic?: boolean;
    lang?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    auth: [user: TelegramUser]
}>();

const containerRef = ref<HTMLDivElement>();
const scriptLoadedRef = ref(false);

// Set up GLOBAL callback function (required by Telegram)
const setupGlobalCallback = () => {
    if (typeof window !== 'undefined') {
        // @ts-ignore - Telegram widget requires global function
        window.onTelegramAuth = (user: TelegramUser) => {
            console.log("Telegram OAuth callback received:", user);
            emit('auth', user);
        };
    }
};

onMounted(() => {
    setupGlobalCallback();

    // Only load script once
    if (!scriptLoadedRef.value && containerRef.value) {
        scriptLoadedRef.value = true;

        // Clear any existing content
        containerRef.value.innerHTML = '';

        // Create script element
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.async = true;
        script.setAttribute("data-telegram-login", props.botName);
        script.setAttribute("data-size", props.buttonSize || "large");
        script.setAttribute("data-radius", (props.cornerRadius || 20).toString());
        script.setAttribute("data-request-access", props.requestAccess ? "write" : "read");
        script.setAttribute("data-userpic", (props.usePic !== false).toString());
        script.setAttribute("data-lang", props.lang || "en");

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
        containerRef.value.appendChild(script);
    }
});

onUnmounted(() => {
    // Don't delete the global function on unmount
    // as Telegram might call it after unmount
});
</script>