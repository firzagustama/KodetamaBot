<template>
    <div class="space-y-3">
        <div class="flex items-center justify-between mb-2">
            <h2 class="font-semibold">Transaksi Terkini</h2>
            <span class="text-sm text-base-content text-opacity-70">
                {{ transactions.length }} item
            </span>
        </div>

        <!-- Empty state -->
        <div v-if="transactions.length === 0" class="card card-compact bg-base-200 bg-opacity-50">
            <div class="card-body text-center">
                <span class="text-4xl">📝</span>
                <div class="card-title text-base-content text-opacity-70">Belum ada transaksi</div>
                <p class="text-sm text-base-content text-opacity-60">
                    Kirim pesan ke bot untuk mencatat transaksi
                </p>
            </div>
        </div>

        <!-- Transaction list -->
        <div v-else class="space-y-3">
            <div
                v-for="tx in transactions"
                :key="tx.id"
                class="card card-compact bg-base-200 bg-opacity-50"
            >
                <div class="card-body">
                    <div class="flex items-center gap-3">
                        <div class="avatar placeholder">
                            <div class="w-10 h-10 bg-base-content bg-opacity-10 rounded-full flex items-center justify-center text-xl">
                                {{ typeConfig[tx.type].icon }}
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium truncate">{{ tx.description }}</div>
                            <div class="text-xs text-base-content text-opacity-70 flex items-center gap-2">
                                <span class="badge badge-ghost badge-xs">{{ tx.category }}</span>
                                <span>•</span>
                                <span>{{ tx.bucket }}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div :class="`font-semibold ${typeConfig[tx.type].color}`">
                                {{ tx.type === "income" ? "+" : "-" }}
                                {{ formatRupiah(tx.amount) }}
                            </div>
                            <div class="text-xs text-base-content text-opacity-60">
                                {{ formatDate(tx.transactionDate) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useStore } from '../stores/useStore';

const store = useStore();
const { transactions } = storeToRefs(store);

const typeConfig = {
    income: { icon: "📈", color: "text-success", label: "Pemasukan" },
    expense: { icon: "📉", color: "text-error", label: "Pengeluaran" },
    transfer: { icon: "↔️", color: "text-primary", label: "Transfer" },
    adjustment: { icon: "⚙️", color: "text-base-content text-opacity-70", label: "Penyesuaian" },
};

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
    });
}
</script>