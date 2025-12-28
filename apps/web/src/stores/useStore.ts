import { create } from "zustand";
import { authFetch } from "../utils/apiClient";

interface Bucket {
    id: string;
    budgetId: string;
    name: string;
    description: string | undefined;
    icon: string;
    amount: number;
    category: string;
    isSystem: boolean;
}

interface Budget {
    id: string;
    estimatedIncome: number;
    buckets: {
        system: Bucket,
        needs: Bucket[],
        wants: Bucket[],
        savings: Bucket[],
    },
    period: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
    };
}

interface UpdateBudget {
    estimatedIncome?: string;
    buckets?: Array<{
        id: string;
        amount: number;
        name?: string;
        description?: string;
        icon?: string;
        category?: string;
    }>;
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

interface State {
    // Auth
    token: string | null;
    on401Handler: (() => Promise<string | null>) | null;
    on403Handler: (() => Promise<void>) | null;

    // Data
    budget: Budget | null;
    transactions: Transaction[];
    hasMore: boolean;
    currentPage: number;
    totalTransactions: number;
    summary: Summary | null;
    loading: boolean;
    fetchingMore: boolean;
    error: string | null;

    // Actions
    setToken: (token: string | null) => void;
    setOn401Handler: (handler: () => Promise<string | null>) => void;
    setOn403Handler: (handler: () => Promise<void>) => void;
    fetchBudget: () => Promise<void>;
    fetchTransactions: () => Promise<void>;
    fetchMoreTransactions: () => Promise<void>;
    fetchSummary: () => Promise<void>;
    updateBudget: (data: Partial<UpdateBudget>) => Promise<void>;
    reset: () => void;
    generateBucketDescription: (category: string, context?: string) => Promise<string | null>;
}

export const useStore = create<State>((set, get) => ({
    token: null,
    on401Handler: null,
    on403Handler: null,
    budget: null,
    transactions: [],
    hasMore: false,
    currentPage: 1,
    totalTransactions: 0,
    summary: null,
    loading: false,
    fetchingMore: false,
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
        set({ loading: true, error: null, currentPage: 1 });

        try {
            const periodId = budget?.period?.id;
            const url = periodId
                ? `/transactions?periodId=${periodId}&page=1&pageSize=20`
                : `/transactions?page=1&pageSize=20`;

            const res = await authFetch(url, token, {}, on401Handler || undefined, on403Handler || undefined);

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Unauthorized");
                }
                throw new Error("Failed to fetch transactions");
            }

            const data = await res.json();

            // The API now returns { transactions, total, page, pageSize, hasMore }
            const mappedTransactions: Transaction[] = (data.transactions || []).map((tx: any) => ({
                ...tx,
                amount: parseFloat(tx.amount),
            }));

            set({
                transactions: mappedTransactions,
                totalTransactions: data.total || 0,
                hasMore: data.hasMore || false,
                currentPage: 1,
                loading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to fetch transactions",
                loading: false,
            });
        }
    },

    fetchMoreTransactions: async () => {
        const { token, budget, on401Handler, on403Handler, currentPage, hasMore, transactions, fetchingMore } = get();
        if (!hasMore || fetchingMore) return;

        set({ fetchingMore: true });

        try {
            const nextPage = currentPage + 1;
            const periodId = budget?.period?.id;
            const url = periodId
                ? `/transactions?periodId=${periodId}&page=${nextPage}&pageSize=20`
                : `/transactions?page=${nextPage}&pageSize=20`;

            const res = await authFetch(url, token, {}, on401Handler || undefined, on403Handler || undefined);

            if (!res.ok) {
                throw new Error("Failed to fetch more transactions");
            }

            const data = await res.json();

            const newTransactions: Transaction[] = (data.transactions || []).map((tx: any) => ({
                ...tx,
                amount: parseFloat(tx.amount),
            }));

            set({
                transactions: [...transactions, ...newTransactions],
                currentPage: nextPage,
                hasMore: data.hasMore || false,
                fetchingMore: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to fetch more transactions",
                fetchingMore: false,
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

    updateBudget: async (data) => {
        const { budget, token, on401Handler, on403Handler, fetchBudget } = get();
        if (!budget) return;

        try {
            const res = await authFetch(`/budgets/${budget.period.id}`, token, {
                method: "PUT",
                body: JSON.stringify(data),
            }, on401Handler || undefined, on403Handler || undefined);

            if (!res.ok) {
                throw new Error("Failed to update budget");
            }

            await fetchBudget();
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
            hasMore: false,
            currentPage: 1,
            totalTransactions: 0,
            summary: null,
            loading: false,
            fetchingMore: false,
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