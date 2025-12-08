<template>
    <div>
        <div class="flex justify-between text-sm mb-1 text-base-content">
            <span>{{ label }}</span>
            <span :class="isOverBudget ? 'text-error' : ''">
                {{ formatRupiah(spent) }} / {{ formatRupiah(allocated) }}
            </span>
        </div>
        <progress
            class="progress w-full h-3"
            :class="`progress-${isOverBudget ? 'error' : color}`"
            :value="percentage"
            max="100"
        ></progress>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    label: string;
    spent: number;
    allocated: number;
    color: "success" | "warning" | "info";
}

const props = defineProps<Props>();

const percentage = computed(() => Math.min((props.spent / props.allocated) * 100, 100));
const isOverBudget = computed(() => props.spent > props.allocated);

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}
</script>