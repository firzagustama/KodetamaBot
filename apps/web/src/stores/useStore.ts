import { defineStore } from "pinia";
import { ref } from "vue";

export interface Budget {
    id: string;
    estimatedIncome: number;
    needsAmount: number;
    wantsAmount: number;
    savingsAmount: number;
    needsPercentage: number;
    wantsPercentage: number;
    savingsPercentage: number;
    period: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
    };
}

export interface Transaction {
    id: string;
    type: "income" | "expense" | "transfer" | "adjustment";
    amount: number;
    category: string;
    bucket: string;
    description: string;
    transactionDate: string;
}

export interface Summary {
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    byBucket: {
        needs: { allocated: number; spent: number; remaining: number };
        wants: { allocated: number; spent: number; remaining: number };
        savings: { allocated: number; spent: number; remaining: number };
    };
    topCategories: { name: string; amount: number; percentage: number }[];
}

export interface GoogleSheet {
    spreadsheetUrl: string;
    lastSyncAt?: string;
}

export interface GoogleFolder {
    folderUrl: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Helper to make authenticated API requests
 */
async function authFetch(
    url: string,
    token: string | null,
    options: RequestInit = {}
): Promise<Response> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
        ...options,
        headers,
    });
}

export const useStore = defineStore("main", () => {
    // State
    const token = ref<string | null>(null);
    const budget = ref<Budget | null>(null);
    const transactions = ref<Transaction[]>([]);
    const summary = ref<Summary | null>(null);
    const googleSheet = ref<GoogleSheet | null>(null);
    const googleFolder = ref<GoogleFolder | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Actions
    const setToken = (newToken: string | null) => {
        if (!newToken) {
            // If empty token, treat as logout
            token.value = null;
            localStorage.removeItem("auth_token");
            reset();
            return;
        }

        token.value = newToken;
        localStorage.setItem("auth_token", newToken);
        error.value = null;
    };

    const fetchBudget = async () => {
        loading.value = true;
        error.value = null;

        try {
            const res = await authFetch(`${API_URL}/budgets/current`, token.value);

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Unauthorized");
                }
                if (res.status === 404) {
                    // No budget yet - this is okay
                    budget.value = null;
                    loading.value = false;
                    return;
                }
                throw new Error("Failed to fetch budget");
            }

            const data = await res.json();
            budget.value = {
                ...data,
                estimatedIncome: parseFloat(data.estimatedIncome),
                needsAmount: parseFloat(data.needsAmount),
                wantsAmount: parseFloat(data.wantsAmount),
                savingsAmount: parseFloat(data.savingsAmount),
            };
            loading.value = false;
        } catch (err) {
            error.value = err instanceof Error ? err.message : "Failed to fetch budget";
            loading.value = false;
        }
    };

    const fetchTransactions = async () => {
        loading.value = true;
        error.value = null;

        try {
            // Need periodId from budget to fetch transactions
            const periodId = budget.value?.period?.id;
            const url = periodId
                ? `${API_URL}/transactions?periodId=${periodId}`
                : `${API_URL}/transactions`;

            const res = await authFetch(url, token.value);

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Unauthorized");
                }
                throw new Error("Failed to fetch transactions");
            }

            const data = await res.json();
            transactions.value = (data.items ?? []).map((t: Record<string, unknown>) => ({
                ...t,
                amount: parseFloat(t.amount as string),
            }));
            loading.value = false;
        } catch (err) {
            error.value = err instanceof Error ? err.message : "Failed to fetch transactions";
            loading.value = false;
        }
    };

    const fetchSummary = async () => {
        try {
            const periodId = budget.value?.period?.id;
            const url = periodId
                ? `${API_URL}/transactions/summary?periodId=${periodId}`
                : `${API_URL}/transactions/summary?periodId=default`;

            const res = await authFetch(url, token.value);

            if (!res.ok) {
                throw new Error("Failed to fetch summary");
            }

            const data = await res.json();
            summary.value = data;
        } catch (err) {
            error.value = err instanceof Error ? err.message : "Failed to fetch summary";
        }
    };

    const fetchGoogleData = async () => {
        try {
            const [sheetRes, folderRes] = await Promise.all([
                authFetch(`${API_URL}/google/sheets/current`, token.value),
                authFetch(`${API_URL}/google/drive/folder`, token.value),
            ]);

            if (sheetRes.ok) {
                const sheetData = await sheetRes.json();
                googleSheet.value = sheetData;
            }

            if (folderRes.ok) {
                const folderData = await folderRes.json();
                googleFolder.value = folderData;
            }
        } catch {
            // Google not connected yet, ignore
        }
    };

    const updateBudget = async (data: Partial<Budget>) => {
        if (!budget.value) return;

        try {
            const res = await authFetch(`${API_URL}/budgets/${budget.value.period.id}`, token.value, {
                method: "PUT",
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                throw new Error("Failed to update budget");
            }

            budget.value = { ...budget.value, ...data };
        } catch (err) {
            error.value = err instanceof Error ? err.message : "Failed to update budget";
        }
    };

    const reset = () => {
        token.value = null;
        budget.value = null;
        transactions.value = [];
        summary.value = null;
        googleSheet.value = null;
        googleFolder.value = null;
        loading.value = false;
        error.value = null;
    };

    return {
        // State
        token,
        budget,
        transactions,
        summary,
        googleSheet,
        googleFolder,
        loading,
        error,

        // Actions
        setToken,
        fetchBudget,
        fetchTransactions,
        fetchSummary,
        fetchGoogleData,
        updateBudget,
        reset,
    };
});