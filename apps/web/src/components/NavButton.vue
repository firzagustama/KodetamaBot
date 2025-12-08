<template>
    <button
        @click="handleClick"
        :class="[
            'flex flex-col items-center gap-1 flex-1',
            active ? 'text-primary' : 'text-base-content'
        ]"
    >
        <svg
            class="w-6 h-6"
            :class="active ? 'text-primary' : 'text-base-content'"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                v-if="currentIcon === 'Dashboard'"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v15a1 1 0 0 0 1 1h15M8 16l2.5-5.5 3 3L17.273 7 20 9.667"
            />
            <path
                v-else-if="currentIcon === 'Budget'"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 8H5m12 0a1 1 0 0 1 1 1v2.6M17 8l-4-4M5 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6M5 8l4-4 4 4m6 4h-4a2 2 0 1 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"
            />
            <path
                v-else-if="currentIcon === 'Transaksi'"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 19V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12M9 3v14m7 0v4"
            />
            <g v-else>
                <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
            </g>
        </svg>
        <span class="text-xs">{{ label }}</span>
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    icon: string;
    label: string;
    active: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    click: []
}>();

const handleClick = () => {
    emit('click');
};

const currentIcon = computed(() => {
    return props.icon;
});
</script>