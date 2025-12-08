<template>
    <div class="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-base-200">
        <div class="bg-base-100 rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div class="text-center mb-6">
                <div class="text-6xl mb-4">💰</div>
                <h1 class="text-2xl font-bold text-base-content">Kodetama Finance</h1>
                <p class="text-base-content text-opacity-70 text-sm mt-2">
                    Kelola keuangan Anda dengan mudah
                </p>
            </div>

            <div v-if="loginError" class="alert alert-error mb-4">
                <span>❌</span>
                <span>{{ loginError }}</span>
            </div>

            <div v-if="!isMiniApp && !loginError" class="alert alert-info mb-4">
                <span>ℹ️</span>
                <span>
                    Anda juga bisa membuka aplikasi ini dari bot Telegram untuk pengalaman yang lebih baik.
                </span>
            </div>

            <div class="space-y-4">
                <div class="text-center">
                    <div class="text-sm text-base-content text-opacity-80 mb-4">
                        Login dengan akun Telegram Anda:
                    </div>
                    <div v-if="isLoggingIn" class="flex flex-col items-center gap-2 py-4">
                        <span class="loading loading-spinner loading-md"></span>
                        <p class="text-sm text-base-content text-opacity-70">Memproses login...</p>
                    </div>
                    <TelegramLoginButton
                        v-else
                        :bot-name="BOT_USERNAME"
                        button-size="large"
                        corner-radius="10"
                        :request-access="true"
                        :use-pic="true"
                        lang="en"
                        @auth="handleAuth"
                    />
                </div>

                <div class="divider">atau</div>

                <div class="card card-compact bg-base-200">
                    <div class="card-body text-center">
                        <div class="text-sm text-base-content text-opacity-80 mb-2">
                            Gunakan di Telegram Mini App
                        </div>
                        <a
                            :href="`https://t.me/${BOT_USERNAME}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn btn-primary btn-sm"
                        >
                            <span>Buka Bot</span>
                            <span>→</span>
                        </a>
                    </div>
                </div>
            </div>

            <div class="mt-6 text-center">
                <p class="text-xs text-base-content text-opacity-50">
                    Dengan login, Anda menyetujui penggunaan data Telegram Anda
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TelegramLoginButton from './TelegramLoginButton.vue';

interface Props {
    botUsername: string;
    isMiniApp: boolean;
    loginError?: string | null;
    isLoggingIn?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    auth: [user: any]
}>();

const BOT_USERNAME = props.botUsername;

// Pass through auth event
const handleAuth = (user: any) => {
    emit('auth', user);
};
</script>