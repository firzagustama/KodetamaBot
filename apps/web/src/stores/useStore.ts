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
        id: string;
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
    // Auth
    token: string | null;

    // Data
    budget: Budget | null;
    transactions: Transaction[];
    summary: Summary | null;
    googleSheet: GoogleSheet | null;
    googleFolder: GoogleFolder | null;
    loading: boolean;
    error: string | null;

    // Actions
    setToken: (token: string | null) => void;
    fetchBudget: () => Promise<void>;
    fetchTransactions: () => Promise<void>;
    fetchSummary: () => Promise<void>;
    fetchGoogleData: () => Promise<void>;
    updateBudget: (data: Partial<Budget>) => Promise<void>;
    reset: () => void;
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

export const useStore = create<State>((set, get) => ({
    token: null,
    budget: null,
    transactions: [],
    summary: null,
    googleSheet: null,
    googleFolder: null,
    loading: false,
    error: null,

    setToken: (token) => set({ token }),

    fetchBudget: async () => {
        const { token } = get();
        set({ loading: true, error: null });

        try {
            const res = await authFetch(`${API_URL}/budgets/current`, token);

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Unauthorized");
                }
                if (res.status === 404) {
                    // No budget yet - this is okay
                    set({ budget: null, loading: false });
                    return;
                }
                throw new Error("Failed to fetch budget");
            }

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
            set({
                error: err instanceof Error ? err.message : "Failed to fetch budget",
                loading: false,
            });
        }
    },

    fetchTransactions: async () => {
        const { token, budget } = get();
        set({ loading: true, error: null });

        try {
            // Need periodId from budget to fetch transactions
            const periodId = budget?.period?.id;
            const url = periodId
                ? `${API_URL}/transactions?periodId=${periodId}`
                : `${API_URL}/transactions`;

            const res = await authFetch(url, token);

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Unauthorized");
                }
                throw new Error("Failed to fetch transactions");
            }

            const data = await res.json();
            set({
                transactions: (data.items ?? []).map((t: Record<string, unknown>) => ({
                    ...t,
                    amount: parseFloat(t.amount as string),
                })),
                loading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to fetch transactions",
                loading: false,
            });
        }
    },

    fetchSummary: async () => {
        const { token, budget } = get();

        try {
            const periodId = budget?.period?.id;
            const url = periodId
                ? `${API_URL}/transactions/summary?periodId=${periodId}`
                : `${API_URL}/transactions/summary?periodId=default`;

            const res = await authFetch(url, token);

            if (!res.ok) {
                throw new Error("Failed to fetch summary");
            }

            const data = await res.json();
            set({ summary: data });
        } catch (err) {
            set({ error: err instanceof Error ? err.message : "Failed to fetch summary" });
        }
    },

    fetchGoogleData: async () => {
        const { token } = get();

        try {
            const [sheetRes, folderRes] = await Promise.all([
                authFetch(`${API_URL}/google/sheets/current`, token),
                authFetch(`${API_URL}/google/drive/folder`, token),
            ]);

            if (sheetRes.ok) {
                const sheetData = await sheetRes.json();
                set({ googleSheet: sheetData });
            }

            if (folderRes.ok) {
                const folderData = await folderRes.json();
                set({ googleFolder: folderData });
            }
        } catch {
            // Google not connected yet, ignore
        }
    },

    updateBudget: async (data) => {
        const { budget, token } = get();
        if (!budget) return;

        try {
            const res = await authFetch(`${API_URL}/budgets/${budget.period.id}`, token, {
                method: "PUT",
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                throw new Error("Failed to update budget");
            }

            set({ budget: { ...budget, ...data } });
        } catch (err) {
            set({ error: err instanceof Error ? err.message : "Failed to update budget" });
        }
    },

    reset: () => {
        set({
            token: null,
            budget: null,
            transactions: [],
            summary: null,
            googleSheet: null,
            googleFolder: null,
            loading: false,
            error: null,
        });
    },
}));

