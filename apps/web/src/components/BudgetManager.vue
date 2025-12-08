<template>
    <div class="space-y-4">
        <!-- Loading skeleton -->
        <div v-if="!budget" class="animate-pulse h-40 bg-base-200 rounded-2xl" />

        <!-- Main content -->
        <div v-else>
            <!-- Period Header -->
            <div class="card card-compact bg-base-200 bg-opacity-50">
                <div class="card-body">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="text-sm text-base-content text-opacity-70">Periode</div>
                            <div class="font-semibold">{{ budget.period.name }}</div>
                        </div>
                        <button
                            @click="toggleEditing"
                            :class="`btn btn-sm ${editing ? 'btn-outline' : 'btn-primary'}`"
                        >
                            {{ editing ? "Batal" : "Edit" }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Income -->
            <div class="card card-compact bg-base-200 bg-opacity-50">
                <div class="card-body">
                    <div class="text-sm text-base-content text-opacity-70">Penghasilan Bulanan</div>
                    <input
                        v-if="editing"
                        v-model.number="localIncome"
                        type="number"
                        class="input input-bordered w-full"
                    />
                    <div v-else class="text-2xl font-bold text-primary">
                        {{ formatRupiah(localIncome) }}
                    </div>
                </div>
            </div>

            <!-- Budget Allocation -->
            <div class="card card-compact bg-base-200 bg-opacity-50">
                <div class="card-body space-y-4">
                    <h3 class="card-title text-base-content">Alokasi Budget (Total: 100%)</h3>

                    <AllocationSlider
                        icon="🏠"
                        label="Needs"
                        v-model="localNeeds"
                        :amount="localIncome * (localNeeds / 100)"
                        :disabled="!editing"
                        :max="100 - localWants"
                        color="success"
                    />

                    <AllocationSlider
                        icon="🎮"
                        label="Wants"
                        v-model="localWants"
                        :amount="localIncome * (localWants / 100)"
                        :disabled="!editing"
                        :max="100 - localNeeds"
                        color="warning"
                    />

                    <AllocationSlider
                        icon="💵"
                        label="Savings"
                        :model-value="localSavings"
                        :amount="localIncome * (localSavings / 100)"
                        :disabled="true"
                        :max="100"
                        color="info"
                    />

                    <button
                        v-if="editing"
                        @click="handleSave"
                        class="btn btn-primary w-full"
                        :disabled="isSaving"
                    >
                        <span v-if="isSaving" class="loading loading-spinner loading-sm"></span>
                        {{ isSaving ? "Menyimpan..." : "Simpan Perubahan" }}
                    </button>
                </div>
            </div>

            <!-- Tips -->
            <div class="alert alert-info">
                <span>💡</span>
                <div>
                    <div class="font-medium">Tips</div>
                    <div class="text-sm text-base-content text-opacity-80">
                        Setiap rupiah harus punya tujuan.
                        Alokasikan 50% untuk needs, 30% untuk wants, dan 20% untuk savings.
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useStore } from '../stores/useStore';
import AllocationSlider from './AllocationSlider.vue';

const store = useStore();
const { budget } = storeToRefs(store);

const editing = ref(false);
const localNeeds = ref(budget.value?.needsPercentage ?? 50);
const localWants = ref(budget.value?.wantsPercentage ?? 30);
const localIncome = ref(budget.value?.estimatedIncome ?? 0);
const isSaving = ref(false);

const localSavings = computed(() => 100 - localNeeds.value - localWants.value);

const toggleEditing = () => {
    editing.value = !editing.value;
    if (!editing.value) {
        // Reset to original values when canceling
        localNeeds.value = budget.value?.needsPercentage ?? 50;
        localWants.value = budget.value?.wantsPercentage ?? 30;
        localIncome.value = budget.value?.estimatedIncome ?? 0;
    }
};

const handleSave = async () => {
    isSaving.value = true;
    try {
        await store.updateBudget({
            estimatedIncome: localIncome.value,
            needsPercentage: localNeeds.value,
            wantsPercentage: localWants.value,
            savingsPercentage: localSavings.value,
            needsAmount: Math.round(localIncome.value * (localNeeds.value / 100)),
            wantsAmount: Math.round(localIncome.value * (localWants.value / 100)),
            savingsAmount: Math.round(localIncome.value * (localSavings.value / 100)),
        });
        editing.value = false;
    } catch (error) {
        console.error('Failed to save budget:', error);
    } finally {
        isSaving.value = false;
    }
};

// Watch for budget changes to update local values
watch(budget, (newBudget) => {
    if (newBudget) {
        localNeeds.value = newBudget.needsPercentage ?? 50;
        localWants.value = newBudget.wantsPercentage ?? 30;
        localIncome.value = newBudget.estimatedIncome ?? 0;
    }
}, { immediate: true });

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}
</script>