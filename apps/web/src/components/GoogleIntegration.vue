<template>
    <div class="space-y-4">
        <!-- Google Sheets Card -->
        <div class="glass-card rounded-2xl p-4">
            <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                    <span class="text-2xl">📊</span>
                </div>
                <div class="flex-1">
                    <h3 class="font-semibold">Google Sheets</h3>
                    <p class="text-sm text-base-content/70">
                        Export transaksi ke spreadsheet
                    </p>
                </div>
            </div>

            <div v-if="googleSheet?.spreadsheetUrl" class="mt-4 space-y-2">
                <a
                    :href="googleSheet.spreadsheetUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block w-full py-2.5 text-center bg-success text-success-content font-medium rounded-xl hover:bg-success-focus transition-colors"
                >
                    Buka Spreadsheet
                </a>
                <p v-if="googleSheet.lastSyncAt" class="text-xs text-center text-base-content/60">
                    Terakhir sync: {{ formatDate(googleSheet.lastSyncAt) }}
                </p>
            </div>
            <button
                v-else
                class="mt-4 w-full py-2.5 text-center bg-base-200 text-base-content font-medium rounded-xl hover:bg-base-300 transition-colors"
                @click="connectGoogle"
            >
                Hubungkan Google
            </button>
        </div>

        <!-- Google Drive Card -->
        <div class="glass-card rounded-2xl p-4">
            <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                    <span class="text-2xl">📁</span>
                </div>
                <div class="flex-1">
                    <h3 class="font-semibold">Google Drive</h3>
                    <p class="text-sm text-base-content/70">
                        Folder invoice untuk periode ini
                    </p>
                </div>
            </div>

            <a
                v-if="googleFolder?.folderUrl"
                :href="googleFolder.folderUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-4 block w-full py-2.5 text-center bg-warning text-warning-content font-medium rounded-xl hover:bg-warning-focus transition-colors"
            >
                Buka Folder Invoice
            </a>
            <div v-else class="mt-4 p-3 bg-base-200 rounded-xl text-center">
                <p class="text-sm text-base-content/70">
                    Upload invoice via bot untuk membuat folder
                </p>
            </div>
        </div>

        <!-- Sync Status -->
        <div class="bg-info/10 rounded-2xl p-4 border border-info/20">
            <h4 class="font-medium text-info flex items-center gap-2">
                🔄 Status Sinkronisasi
            </h4>
            <div class="mt-3 space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-base-content">Google Sheets</span>
                    <span :class="googleSheet ? 'text-success' : 'text-base-content/60'">
                        {{ googleSheet ? "✓ Terhubung" : "Belum terhubung" }}
                    </span>
                </div>
                <div class="flex justify-between">
                    <span class="text-base-content">Google Drive</span>
                    <span :class="googleFolder ? 'text-success' : 'text-base-content/60'">
                        {{ googleFolder ? "✓ Terhubung" : "Belum terhubung" }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Pro Tier Feature Note -->
        <div class="bg-secondary/10 rounded-2xl p-4 border border-secondary/20">
            <h4 class="font-medium text-secondary-focus">⭐ Fitur Pro</h4>
            <p class="text-sm text-base-content/80 mt-2">
                Upload invoice dan voice note tersedia untuk tier Pro.
                Upgrade untuk akses fitur lengkap!
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useStore } from '../stores/useStore';

const store = useStore();
const { googleSheet, googleFolder } = storeToRefs(store);

onMounted(() => {
    store.fetchGoogleData();
});

const connectGoogle = () => {
    // TODO: Implement Google OAuth flow
    alert("Fitur Google Sheets akan segera hadir!");
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("id-ID");
};
</script>