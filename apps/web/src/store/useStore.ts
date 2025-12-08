import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface Budget {
    id: number;
    userId: number;
    period: {
        id: number;
        name: string;
        startDate: string;
        endDate: string;
    };
    estimatedIncome: number;
    buckets: {
        id: number;
        name: string;
        percentage: number;
        amount: number;
        category: 'needs' | 'wants' | 'savings';
    }[];
    transactions: any[]; // We'll type this properly later
}

interface Transaction {
    id: number;
    amount: number;
    category: string;
    description: string;
    date: string;
    type: string;
}

interface Summary {
    totalExpenses: number;
    byBucket: {
        needs: { allocated: number; spent: number; remaining: number };
        wants: { allocated: number; spent: number; remaining: number };
        savings: { allocated: number; spent: number; remaining: number };
    };
    topCategories: { name: string; amount: number; percentage: number }[];
}

interface User {
    id: number;
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
}



interface StoreState {
    // Auth state
    token: string | null;
    setToken: (token: string) => void;
    on401Handler: ((reason?: string) => Promise<string | null>) | null;
    setOn401Handler: (handler: (reason?: string) => Promise<string | null>) => void;

    // User and budget
    user: User | null;
    budget: Budget | null;
    transactions: Transaction[];
    summary: Summary | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchBudget: () => Promise<void>;
    fetchTransactions: () => Promise<void>;
    fetchSummary: () => Promise<void>;
    fetchUser: () => Promise<void>;

    // Auth actions for re-auth on 401
    setUser: (user: User) => void;
    clearState: () => void;

    // Transaction actions
    addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
    deleteTransaction: (id: number) => Promise<void>;
    updateTransaction: (id: number, transaction: Partial<Transaction>) => Promise<void>;

    // Google integration
    googleTokens: { access_token: string; refresh_token: string } | null;
    setGoogleTokens: (tokens: { access_token: string; refresh_token: string } | null) => void;
    googleSyncStatus: 'idle' | 'syncing' | 'done' | 'error';
    setGoogleSyncStatus: (status: 'idle' | 'syncing' | 'done' | 'error') => void;
    googleSheet: { spreadsheetUrl: string; lastSyncAt: string } | null;
    googleFolder: { folderUrl: string } | null;
    fetchGoogleData: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const state = useStore.getState();
    const headers = new Headers(options.headers);

    // Add authorization header if we have a token
    if (state.token) {
        headers.set('Authorization', `Bearer ${state.token}`);
    }

    // Add Content-Type if not specified and body is present
    if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...options,
        headers,
    });
}

async function handleApiCall<T>(
    url: string,
    options: RequestInit = {},
    errorMessage: string
): Promise<T> {
    try {
        const response = await authenticatedFetch(url, options);

        if (response.status === 401 && useStore.getState().on401Handler) {
            // Attempt to re-authenticate
            const newToken = await useStore.getState().on401Handler!();
            if (newToken) {
                // Retry the request with the new token
                const retryResponse = await authenticatedFetch(url, options);
                if (retryResponse.ok) {
                    return await retryResponse.json();
                }
            }
            throw new Error('Authentication failed - please log in again');
        }

        if (!response.ok) {
            throw new Error(errorMessage || `Request failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

export const useStore = create<StoreState>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                token: null,
                setToken: (token: string) => {
                    set({ token });
                    if (!token) {
                        // Clear state on logout
                        get().clearState();
                    }
                },
                on401Handler: null,
                setOn401Handler: (handler) => set({ on401Handler: handler }),

                user: null,
                budget: null,
                transactions: [],
                summary: null,
                loading: false,
                error: null,

                googleTokens: null,
                setGoogleTokens: (tokens) => set({ googleTokens: tokens }),
                googleSyncStatus: 'idle',
                setGoogleSyncStatus: (status) => set({ googleSyncStatus: status }),
                googleSheet: null,
                googleFolder: null,

                // Actions
                fetchBudget: async () => {
                    set({ loading: true, error: null });
                    try {
                        const data = await handleApiCall<Budget>(`${API_BASE_URL}/budget`, {}, 'Failed to fetch budget');
                        set({ budget: data, loading: false });
                    } catch (error) {
                        console.error('Failed to fetch budget:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to fetch budget',
                            loading: false
                        });
                        throw error;
                    }
                },

                fetchTransactions: async () => {
                    set({ loading: true, error: null });
                    try {
                        const data = await handleApiCall<Transaction[]>(
                            `${API_BASE_URL}/transactions`,
                            {},
                            'Failed to fetch transactions'
                        );
                        set({ transactions: data, loading: false });
                    } catch (error) {
                        console.error('Failed to fetch transactions:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to fetch transactions',
                            loading: false
                        });
                        throw error;
                    }
                },

                fetchSummary: async () => {
                    const state = get();
                    if (!state.budget) return;

                    set({ loading: true, error: null });
                    try {
                        const data = await handleApiCall<Summary>(
                            `${API_BASE_URL}/budget/summary?periodId=${state.budget.period.id}`,
                            {},
                            'Failed to fetch summary'
                        );
                        set({ summary: data, loading: false });
                    } catch (error) {
                        console.error('Failed to fetch summary:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to fetch summary',
                            loading: false
                        });
                        throw error;
                    }
                },

                fetchUser: async () => {
                    set({ loading: true, error: null });
                    try {
                        const data = await handleApiCall<User>(`${API_BASE_URL}/users/me`, {}, 'Failed to fetch user');
                        set({ user: data, loading: false });
                    } catch (error) {
                        console.error('Failed to fetch user:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to fetch user',
                            loading: false
                        });
                        throw error;
                    }
                },

                setUser: (user) => set({ user }),
                clearState: () =>
                    set({
                        user: null,
                        budget: null,
                        transactions: [],
                        summary: null,
                        googleTokens: null,
                        googleSyncStatus: 'idle',
                    }),

                addTransaction: async (transaction) => {
                    set({ loading: true, error: null });
                    try {
                        const newTransaction = await handleApiCall<Transaction>(
                            `${API_BASE_URL}/transactions`,
                            {
                                method: 'POST',
                                body: JSON.stringify(transaction),
                            },
                            'Failed to add transaction'
                        );
                        set((state) => ({
                            transactions: [...state.transactions, newTransaction],
                            loading: false,
                        }));
                    } catch (error) {
                        console.error('Failed to add transaction:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to add transaction',
                            loading: false
                        });
                        throw error;
                    }
                },

                deleteTransaction: async (id) => {
                    set({ loading: true, error: null });
                    try {
                        await handleApiCall(
                            `${API_BASE_URL}/transactions/${id}`,
                            { method: 'DELETE' },
                            'Failed to delete transaction'
                        );
                        set((state) => ({
                            transactions: state.transactions.filter((t) => t.id !== id),
                            loading: false,
                        }));
                    } catch (error) {
                        console.error('Failed to delete transaction:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to delete transaction',
                            loading: false
                        });
                        throw error;
                    }
                },

                updateTransaction: async (id, updates) => {
                    set({ loading: true, error: null });
                    try {
                        const updatedTransaction = await handleApiCall<Transaction>(
                            `${API_BASE_URL}/transactions/${id}`,
                            {
                                method: 'PUT',
                                body: JSON.stringify(updates),
                            },
                            'Failed to update transaction'
                        );
                        set((state) => ({
                            transactions: state.transactions.map((t) =>
                                t.id === id ? updatedTransaction : t
                            ),
                            loading: false,
                        }));
                    } catch (error) {
                        console.error('Failed to update transaction:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to update transaction',
                            loading: false
                        });
                        throw error;
                    }
                },

                fetchGoogleData: async () => {
                    set({ loading: true, error: null });
                    try {
                        // Fetch Google Sheet data
                        const sheetResponse = await authenticatedFetch(`${API_BASE_URL}/google/sheet`);
                        if (sheetResponse.ok) {
                            const sheetData = await sheetResponse.json();
                            set({ googleSheet: sheetData });
                        }

                        // Fetch Google Folder data
                        const folderResponse = await authenticatedFetch(`${API_BASE_URL}/google/folder`);
                        if (folderResponse.ok) {
                            const folderData = await folderResponse.json();
                            set({ googleFolder: folderData });
                        }

                        set({ loading: false });
                    } catch (error) {
                        console.error('Failed to fetch Google data:', error);
                        set({
                            error: error instanceof Error ? error.message : 'Failed to fetch Google data',
                            loading: false
                        });
                    }
                },
            }),
            {
                name: 'kodetama-store', // name in localStorage
                // Only persist certain parts - not the token/volatile data
                partialize: (state) => ({
                    user: state.user,
                    googleTokens: state.googleTokens,
                }),
            }
        ),
        {
            name: 'kodetama-devtools',
        }
    )
);