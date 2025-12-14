import { create } from "zustand";
import { authFetch } from "../utils/apiClient";

interface Budget {
    id: string;
    estimatedIncome: number;
    buckets: Array<{
        id: string;
        icon: string;
        name: string;
        amount: number;
        spent: number;
        remaining: number;
        category?: string;
        isSystem?: boolean;
    }>,
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
    byBucket: Array<{
        id: string;
        icon: string;
        name: string;
        allocated: number;
        spent: number;
        remaining: number;
    }>,
    topCategories: { name: string; amount: number; percentage: number }[];
    big3: {
        needs: { allocated: number; spent: number; remaining: number };
        wants: { allocated: number; spent: number; remaining: number };
        savings: { allocated: number; spent: number; remaining: number };
    };
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
    on401Handler: (() => Promise<string | null>) | null;
    on403Handler: (() => Promise<void>) | null;

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
    setOn401Handler: (handler: () => Promise<string | null>) => void;
    setOn403Handler: (handler: () => Promise<void>) => void;
    fetchBudget: () => Promise<void>;
    fetchTransactions: () => Promise<void>;
    fetchSummary: () => Promise<void>;
    fetchGoogleData: () => Promise<void>;
    updateBudget: (data: Partial<Budget>) => Promise<void>;
    reset: () => void;
    generateBucketDescription: (category: string, context?: string) => Promise<string | null>;
}

export const useStore = create<State>((set, get) => ({
    token: null,
    on401Handler: null,
    on403Handler: null,
    budget: null,
    transactions: [],
    summary: null,
    googleSheet: null,
    googleFolder: null,
    loading: false,
    error: null,

    setToken: (token) => set({ token }),

    setOn401Handler: (handler) => set({ on401Handler: handler }),

    setOn403Handler: (handler) => set({ on403Handler: handler }),

    fetchBudget: async () => {
        const { token, on401Handler, on403Handler } = get();
        set({ loading: true, error: null });

        try {
            const res = await authFetch(`/budgets/current`, token, {}, on401Handler || undefined, on403Handler || undefined);

            if (!res.ok) {
                if (res.status === 401) {
                    // Let apiClient handle 401 retry, if that fails throw error
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
        const { token, budget, on401Handler, on403Handler } = get();
        set({ loading: true, error: null });

        try {
            // Need periodId from budget to fetch transactions
            const periodId = budget?.period?.id;
            const url = periodId
                ? `/transactions?periodId=${periodId}`
                : `/transactions`;

            const res = await authFetch(url, token, {}, on401Handler || undefined, on403Handler || undefined);

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Unauthorized");
                }
                throw new Error("Failed to fetch transactions");
            }

            const data = await res.json();

            // New format: flatten transactions from days
            const allTransactions: Transaction[] = [];
            if (data.days) {
                for (const day of data.days) {
                    for (const tx of day.transactions) {
                        allTransactions.push({
                            ...tx,
                            amount: parseFloat(tx.amount),
                        });
                    }
                }
            }

            // Backward compatibility: also check for old items format
            if (data.items) {
                allTransactions.push(...data.items.map((t: Record<string, unknown>) => ({
                    ...t,
                    amount: parseFloat(t.amount as string),
                })));
            }

            set({
                transactions: allTransactions,
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
        const { token, budget, on401Handler } = get();

        try {
            const periodId = budget?.period?.id;
            const url = periodId
                ? `/transactions/summary?periodId=${periodId}`
                : `/transactions/summary?periodId=default`;

            const res = await authFetch(url, token, {}, on401Handler || undefined);

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
        const { token, on401Handler, on403Handler } = get();

        try {
            const [sheetRes, folderRes] = await Promise.all([
                authFetch(`/google/sheets/current`, token, {}, on401Handler || undefined, on403Handler || undefined),
                authFetch(`/google/drive/folder`, token, {}, on401Handler || undefined, on403Handler || undefined),
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
        const { budget, token, on401Handler, on403Handler } = get();
        if (!budget) return;

        try {
            const res = await authFetch(`/budgets/${budget.period.id}`, token, {
                method: "PUT",
                body: JSON.stringify(data),
            }, on401Handler || undefined, on403Handler || undefined);

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
            on401Handler: null,
            budget: null,
            transactions: [],
            summary: null,
            googleSheet: null,
            googleFolder: null,
            loading: false,
            error: null,
        });
    },

    generateBucketDescription: async (category: string, context?: string) => {
        const { token, on401Handler, on403Handler } = get();
        try {
            const res = await authFetch(`/budgets/generate-description`, token, {
                method: "POST",
                body: JSON.stringify({ category, context }),
            }, on401Handler || undefined, on403Handler || undefined);

            if (!res.ok) {
                throw new Error("Failed to generate description");
            }

            const data = await res.json();
            return data.description;
        } catch (err) {
            console.error(err);
            return null;
        }
    },
}));