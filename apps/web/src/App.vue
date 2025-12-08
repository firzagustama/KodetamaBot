<template>
    <div class="min-h-screen bg-base-100 text-base-content transition-colors duration-300">
        <!-- Loading / skeleton UI -->
        <LoadingSkeleton v-if="!uiReady || authLoading" />

        <!-- Login Page -->
        <LoginPage
            v-else-if="!authenticated"
            :bot-username="BOT_USERNAME"
            :is-mini-app="isMiniApp"
            :login-error="loginError"
            :is-logging-in="isLoggingIn"
            @auth="handleTelegramAuth"
        />

        <!-- Main UI (Authenticated) -->
        <AuthenticatedLayout
            v-else
            :budget="budget"
            :is-mini-app="isMiniApp"
            @logout="handleLogout"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onBeforeMount, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from './stores/useStore'
import { useAuth } from './composables/useAuth'
import { useTelegram } from './composables/useTelegram'
import LoadingSkeleton from './components/LoadingSkeleton.vue'
import LoginPage from './components/LoginPage.vue'
import AuthenticatedLayout from './components/AuthenticatedLayout.vue'
import { setupSwipeBehavior } from './utils/telegramBridge'

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME;

const { ready, expand, webApp, requestFullscreen } = useTelegram();
const { token: authToken, authenticated, loading: authLoading } = useAuth();
const store = useStore();
const { budget } = storeToRefs(store);

const uiReady = ref(false);
const isMiniApp = ref(false);
const isLoggingIn = ref(false);
const loginError = ref<string | null>(null);
const hasExpanded = ref(false);
const hasFetched = ref(false);
const hasRequestedFullscreen = ref(false);

// Check if running inside Telegram Mini App
onBeforeMount(() => {
    isMiniApp.value = !!webApp.value;
    console.log("Running in Telegram Mini App:", isMiniApp.value);
    console.log("WebApp object:", webApp.value);
    console.log("Telegram WebApp:", window.Telegram?.WebApp);
});

// Initialize Mini App (only once)
watch([isMiniApp, ready], async () => {
    console.log("Watch triggered - isMiniApp:", isMiniApp.value, "ready:", ready.value);

    if (isMiniApp.value && ready.value && !hasExpanded.value) {
        hasExpanded.value = true;
        console.log("🚀 Initializing Telegram Mini App");

        await new Promise(resolve => setTimeout(resolve, 150));

        // Expand viewport
        expand?.();

        // Disable vertical swipe to prevent app closing on scroll
        setupSwipeBehavior(false);
        console.log("✅ Disabled vertical swipe behavior");

        // Request fullscreen ONCE (optional - remove if you don't want auto-fullscreen)
        if (!hasRequestedFullscreen.value) {
            hasRequestedFullscreen.value = true;
            // Uncomment if you want auto-fullscreen:
            requestFullscreen();
        }

        uiReady.value = true;
        console.log("✅ Mini App ready, setting uiReady to true");
    } else if (!isMiniApp.value) {
        console.log("🌐 Not in Mini App, setting uiReady to true");
        uiReady.value = true;
    }
});

// Fallback: If Mini App initialization takes too long, show UI anyway
watch([authenticated, authLoading], () => {
    console.log("Auth state changed - authenticated:", authenticated.value, "loading:", authLoading.value);
});

onMounted(() => {
    // Safety timeout: If uiReady is still false after 5 seconds, set it to true
    setTimeout(() => {
        if (!uiReady.value) {
            console.log("🚨 Safety timeout: Forcing uiReady to true");
            uiReady.value = true;
        }
    }, 5000);
});

// Set token in store when authenticated
watch(authToken, () => {
    if (authToken.value) {
        store.setToken(authToken.value);
    }
});

// Fetch budget/transactions in background
watch([authenticated, budget], () => {
    if (authenticated.value && !hasFetched.value) {
        hasFetched.value = true;
        store.fetchBudget()
            .then(() => store.fetchTransactions())
            .catch((error) => {
                console.error("Error fetching data:", error);
                hasFetched.value = false;
            });
    }
});

// Handle Telegram Widget Login
const handleTelegramAuth = async (telegramUser: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}) => {
    isLoggingIn.value = true;
    loginError.value = null;

    try {
        console.log("Telegram Widget user data:", telegramUser);

        const response = await fetch("/api/auth/telegram-widget", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(telegramUser),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Authentication failed");
        }

        console.log("Widget auth successful:", data);

        if (data.token) {
            store.setToken(data.token);
            localStorage.setItem("auth_token", data.token);
        }
    } catch (error) {
        console.error("Error during Telegram widget login:", error);
        const errorMessage = error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.";
        loginError.value = errorMessage;
    } finally {
        isLoggingIn.value = false;
    }
};

const handleLogout = () => {
    store.setToken("");
    localStorage.removeItem("auth_token");
    window.location.reload();
};
</script>

<script lang="ts">
import NavButton from './components/NavButton.vue'

export default {
    components: { NavButton }
}
</script>