<template>
    <div>
        <!-- Header - Fixed at top -->
        <header class="fixed pt-16 left-0 right-0 z-10 text-primary-content bg-base-200 p-4 shadow-lg">
            <div class="flex items-center gap-3">
                <div class="flex-1 text-center">
                    <h1 class="font-semibold">Periode</h1>
                    <p class="text-sm text-primary-content text-opacity-80">
                        {{ budget?.period.name ?? "Dashboard" }}
                    </p>
                </div>
                <!-- Logout button -->
                <button
                    v-if="!isMiniApp"
                    @click="$emit('logout')"
                    class="btn btn-ghost btn-sm text-primary-content text-opacity-80 hover:text-primary-content"
                >
                    Keluar
                </button>
            </div>
        </header>

        <!-- Content -->
        <main class="min-h-screen pt-36 pb-28 px-4 overflow-y-auto">
            <Dashboard v-if="activeTab === 'dashboard'" />
            <BudgetManager v-if="activeTab === 'budget'" />
            <TransactionList v-if="activeTab === 'transactions'" />
            <GoogleIntegration v-if="activeTab === 'google'" />
        </main>

        <!-- Bottom Navigation - Fixed at bottom -->
        <div class="fixed bottom-0 left-0 right-0 z-10 flex pt-4 pb-10 bg-base-200 border-t border-base-300">
            <NavButton
                icon="Dashboard"
                label="Dashboard"
                :active="activeTab === 'dashboard'"
                @click="setActiveTab('dashboard')"
            />
            <NavButton
                icon="Budget"
                label="Budget"
                :active="activeTab === 'budget'"
                @click="setActiveTab('budget')"
            />
            <NavButton
                icon="Transaksi"
                label="Transaksi"
                :active="activeTab === 'transactions'"
                @click="setActiveTab('transactions')"
            />
            <NavButton
                icon="Google"
                label="Google"
                :active="activeTab === 'google'"
                @click="setActiveTab('google')"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useStore } from '../stores/useStore';
import Dashboard from './Dashboard.vue';
import BudgetManager from './BudgetManager.vue';
import TransactionList from './TransactionList.vue';
import GoogleIntegration from './GoogleIntegration.vue';
import NavButton from './NavButton.vue';

interface Props {
    budget: any;
    isMiniApp?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    logout: []
}>();

const store = useStore();
const { budget } = storeToRefs(store);

const activeTab = ref<'dashboard' | 'budget' | 'transactions' | 'google'>('dashboard');

const setActiveTab = (tab: typeof activeTab.value) => {
    activeTab.value = tab;
};
</script>