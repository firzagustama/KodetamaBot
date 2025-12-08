import { useEffect } from "react";
import { List, Section, Cell, Avatar } from "@telegram-apps/telegram-ui";
import { Page } from "@/components/Page";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/useStore";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function getTransactionIcon(type: string, category: string): string {
    if (type === 'income') return '💰';
    if (type === 'expense') {
        // Common category mappings
        const categoryIcons: Record<string, string> = {
            'Food': '🍔',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Shopping': '🛍️',
            'Healthcare': '⚕️',
            'Education': '📚',
            'Utilities': '💡',
            'Rent': '🏠',
            'Salary': '💼',
            'Transfer': '↔️',
        };
        return categoryIcons[category] || '💳';
    }
    return '💳';
}

export function TransactionsPage() {
    const { authenticated, loading: authLoading, token } = useAuth();
    const { transactions, budget, loading, error, fetchBudget, fetchTransactions, setToken, setOn401Handler } = useStore();

    // Set up authentication integration with store
    useEffect(() => {
        if (token) {
            setToken(token);
        }
    }, [token, setToken]);

    useEffect(() => {
        if (!authenticated || authLoading) return;

        const loadData = async () => {
            await fetchBudget();
        };
        loadData();
    }, [authenticated, authLoading, fetchBudget]);

    useEffect(() => {
        if (authenticated && budget) {
            fetchTransactions();
        }
    }, [authenticated, budget, fetchTransactions]);

    if (authLoading || loading) {
        return (
            <Page>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <div>Loading...</div>
                </div>
            </Page>
        );
    }

    if (!authenticated) {
        return (
            <Page>
                <Section header="Authentication Required">
                    <Cell>Please authenticate to view your transactions</Cell>
                </Section>
            </Page>
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <Page>
                <Section header="Transactions">
                    <Cell>No transactions available yet</Cell>
                </Section>
            </Page>
        );
    }

    // Group transactions by date
    const groupedTransactions = transactions.reduce((groups, transaction) => {
        const date = formatDate(transaction.transactionDate);
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(transaction);
        return groups;
    }, {} as Record<string, typeof transactions>);

    return (
        <Page>
            <List>
                {Object.entries(groupedTransactions).map(([date, dateTransactions]) => (
                    <Section key={date} header={date}>
                        {dateTransactions.map((transaction, index) => (
                            <Cell
                                key={`${date}-${index}`}
                                before={<Avatar>{getTransactionIcon(transaction.type, transaction.category)}</Avatar>}
                                subtitle={`${transaction.category} • ${transaction.description}`}
                                after={
                                    <span style={{
                                        color: transaction.type === 'income' ? '#10b981' : '#ef4444',
                                        fontWeight: 'bold'
                                    }}>
                                        {transaction.type === 'income' ? '+' : '-'}{formatRupiah(transaction.amount)}
                                    </span>
                                }
                            >
                                {transaction.bucket.charAt(0).toUpperCase() + transaction.bucket.slice(1)}
                            </Cell>
                        ))}
                    </Section>
                ))}
            </List>
        </Page>
    );
}