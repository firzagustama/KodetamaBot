import { create } from "zustand";

interface Budget {
    id: string;
    estimatedIncome: number;
    needsAmount: number;
    wantsAmount: number;
    savingsAmount: number;
    needsPercentage: number;
    wantsPercentage: number;
    savingsPercentage: number;
    period: {
        name: string;
        startDate: string;
        endDate: string;
    };
}

interface Transaction {
    id: string;
    type: "income" | "expense" | "transfer" | "adjustment";
    amount: number;
    category: string;
    bucket: string;
    description: string;
    transactionDate: string;
}

interface Summary {
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

interface GoogleSheet {
    spreadsheetUrl: string;
    lastSyncAt?: string;
}

interface GoogleFolder {
    folderUrl: string;
}

interface State {
    budget: Budget | null;
    transactions: Transaction[];
    summary: Summary | null;
    googleSheet: GoogleSheet | null;
    googleFolder: GoogleFolder | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchBudget: () => Promise<void>;
    fetchTransactions: () => Promise<void>;
    fetchSummary: () => Promise<void>;
    fetchGoogleData: () => Promise<void>;
    updateBudget: (data: Partial<Budget>) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const useStore = create<State>((set, get) => ({
    budget: null,
    transactions: [],
    summary: null,
    googleSheet: null,
    googleFolder: null,
    loading: false,
    error: null,

    fetchBudget: async () => {
        set({ loading: true });
        try {
            const res = await fetch(`${API_URL}/budgets/current`);
            const data = await res.json();
            set({
                budget: {
                    ...data,
                    estimatedIncome: parseFloat(data.estimatedIncome),
                    needsAmount: parseFloat(data.needsAmount),
                    wantsAmount: parseFloat(data.wantsAmount),
                    savingsAmount: parseFloat(data.savingsAmount),
                },
                loading: false,
            });
        } catch (err) {
            set({ error: "Failed to fetch budget", loading: false });
        }
    },

    fetchTransactions: async () => {
        set({ loading: true });
        try {
            const res = await fetch(`${API_URL}/transactions`);
            const data = await res.json();
            set({
                transactions: data.items.map((t: any) => ({
                    ...t,
                    amount: parseFloat(t.amount),
                })),
                loading: false,
            });
        } catch (err) {
            set({ error: "Failed to fetch transactions", loading: false });
        }
    },

    fetchSummary: async () => {
        try {
            const res = await fetch(`${API_URL}/transactions/summary`);
            const data = await res.json();
            set({ summary: data });
        } catch (err) {
            set({ error: "Failed to fetch summary" });
        }
    },

    fetchGoogleData: async () => {
        try {
            const [sheetRes, folderRes] = await Promise.all([
                fetch(`${API_URL}/google/sheets/current`),
                fetch(`${API_URL}/google/drive/folder`),
            ]);
            const sheetData = await sheetRes.json();
            const folderData = await folderRes.json();
            set({
                googleSheet: sheetData,
                googleFolder: folderData,
            });
        } catch (err) {
            // Google not connected yet, ignore
        }
    },

    updateBudget: async (data) => {
        const { budget } = get();
        if (!budget) return;

        try {
            await fetch(`${API_URL}/budgets/${budget.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            set({ budget: { ...budget, ...data } });
        } catch (err) {
            set({ error: "Failed to update budget" });
        }
    },
}));
