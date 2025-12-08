<template>
    <div class="space-y-2">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span>{{ icon }}</span>
                <span class="font-medium">{{ label }}</span>
            </div>
            <div class="text-right">
                <span class="font-semibold">{{ displayValue }}%</span>
                <span class="text-base-content text-opacity-50 text-sm ml-2">
                    {{ formatRupiah(amount) }}
                </span>
            </div>
        </div>
        <input
            type="range"
            min="0"
            :max="max"
            :value="displayValue"
            @input="handleInput"
            :disabled="disabled"
            :class="`range range-${color} w-full ${disabled ? 'opacity-50' : ''}`"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    icon: string;
    label: string;
    disabled?: boolean;
    max: number;
    color: "success" | "warning" | "info";
    amount: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'update:modelValue': [value: number]
}>();

// Use modelValue for Vue 3 compatibility
const displayValue = computed(() => {
    // Try to get modelValue first (Vue 3), fallback to props
    const propsWithModel = props as any;
    return typeof propsWithModel.modelValue !== 'undefined'
        ? propsWithModel.modelValue
        : propsWithModel.value || 0;
});

const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value);
    emit('update:modelValue', value);
};

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}
</script>