<template>
    <div
        class="rounded-xl p-3 border"
        :class="colorClasses"
    >
        <span class="text-lg">{{ icon }}</span>
        <p class="text-xs text-base-content text-opacity-70 mt-1">{{ label }}</p>
        <p class="text-sm font-semibold text-base-content">
            {{ remaining >= 0 ? formatRupiah(remaining) : `-${formatRupiah(-remaining)}` }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    icon: string;
    label: string;
    allocated: number;
    spent: number;
    color: "success" | "warning" | "info";
}

const props = defineProps<Props>();

const remaining = computed(() => props.allocated - props.spent);

const colorClasses = computed(() => {
    const colors = {
        success: "border-success border-opacity-20 bg-success bg-opacity-80",
        warning: "border-warning border-opacity-20 bg-warning bg-opacity-80",
        info: "border-info border-opacity-20 bg-info bg-opacity-80",
    };
    return colors[props.color];
});

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}
</script>