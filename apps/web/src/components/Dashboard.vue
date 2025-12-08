<template>
    <div class="space-y-4">
        <!-- Income Stat -->
        <div class="card card-compact bg-base-200 bg-opacity-50">
            <div class="card-body">
                <div class="text-sm text-base-content text-opacity-70">Penghasilan Bulan Ini</div>
                <div class="text-2xl font-bold text-primary">
                    {{ formatRupiah(budget?.estimatedIncome || 0) }}
                </div>
            </div>
        </div>

        <!-- Budget Summary -->
        <div class="grid grid-cols-3 gap-3">
            <BudgetCard
                icon="🏠"
                label="Needs"
                :allocated="summary.byBucket.needs.allocated"
                :spent="summary.byBucket.needs.spent"
                color="success"
            />
            <BudgetCard
                icon="🎮"
                label="Wants"
                :allocated="summary.byBucket.wants.allocated"
                :spent="summary.byBucket.wants.spent"
                color="warning"
            />
            <BudgetCard
                icon="💵"
                label="Savings"
                :allocated="summary.byBucket.savings.allocated"
                :spent="summary.byBucket.savings.spent"
                color="info"
            />
        </div>

        <!-- Spending Progress -->
        <div class="card card-compact bg-base-200 bg-opacity-50">
            <div class="card-body">
                <h3 class="card-title text-base-content">Progress Pengeluaran</h3>
                <BucketProgress
                    label="Needs"
                    :spent="summary.byBucket.needs.spent"
                    :allocated="summary.byBucket.needs.allocated"
                    color="success"
                />
                <BucketProgress
                    label="Wants"
                    :spent="summary.byBucket.wants.spent"
                    :allocated="summary.byBucket.wants.allocated"
                    color="warning"
                />
                <BucketProgress
                    label="Savings"
                    :spent="summary.byBucket.savings.spent"
                    :allocated="summary.byBucket.savings.allocated"
                    color="info"
                />
            </div>
        </div>

        <!-- Top Categories -->
        <div v-if="summary.topCategories.length > 0" class="card card-compact bg-base-200 bg-opacity-50">
            <div class="card-body">
                <h3 class="card-title text-base-content">Kategori Teratas</h3>
                <div class="space-y-2">
                    <div v-for="cat in summary.topCategories" :key="cat.name" class="flex items-center justify-between">
                        <span class="text-base-content text-opacity-80">{{ cat.name }}</span>
                        <div class="text-right">
                            <span class="font-medium text-base-content">{{ formatRupiah(cat.amount) }}</span>
                            <span class="text-xs text-base-content text-opacity-50 ml-2 badge badge-ghost">
                                {{ cat.percentage.toFixed(1) }}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-2 gap-3">
            <div class="stat stat-compact bg-base-200 bg-opacity-50 rounded-xl p-4 text-center">
                <div class="stat-desc text-base-content text-opacity-70">Total Pengeluaran</div>
                <div class="stat-value text-lg text-error">
                    {{ formatRupiah(summary.totalExpenses) }}
                </div>
            </div>
            <div class="stat stat-compact bg-base-200 bg-opacity-50 rounded-xl p-4 text-center">
                <div class="stat-desc text-base-content text-opacity-70">Sisa Budget</div>
                <div class="stat-value text-lg text-success">
                    {{ formatRupiah((budget?.estimatedIncome || 0) - summary.totalExpenses) }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useStore } from '../stores/useStore';
import BudgetCard from './BudgetCard.vue';
import BucketProgress from './BucketProgress.vue';

const store = useStore();
const { budget, summary } = storeToRefs(store);

onMounted(() => {
    if (!budget.value) return;
    store.fetchSummary();
});

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}
</script>