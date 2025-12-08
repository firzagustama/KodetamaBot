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

export function DashboardPage() {
    const { authenticated, loading: authLoading, token } = useAuth();
    const { budget, summary, loading, error, fetchBudget, fetchSummary, setToken, setOn401Handler } = useStore();

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
        if (!budget) return;
        fetchSummary();
    }, [budget, fetchSummary]);

    if (authLoading || loading) {
        return (
            <Page back={false}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <div>Loading...</div>
                </div>
            </Page>
        );
    }

    if (!authenticated) {
        return (
            <Page back={false}>
                <Section header="Authentication Required">
                    <Cell>Please authenticate to view your dashboard</Cell>
                </Section>
            </Page>
        );
    }

    if (!budget || !summary) {
        return (
            <Page back={false}>
                <Section header="Dashboard">
                    <Cell>No budget data available yet</Cell>
                </Section>
            </Page>
        );
    }

    const { byBucket } = summary;

    return (
        <Page back={false}>
            <List>
                {/* Income Stat */}
                <Section header="Monthly Income">
                    <Cell
                        before={<Avatar>{"💰"}</Avatar>}
                        subtitle="Estimated monthly income"
                    >
                        {formatRupiah(budget.estimatedIncome)}
                    </Cell>
                </Section>

                {/* Budget Summary */}
                <Section header="Budget Overview (50/30/20)">
                    <Cell
                        before={<Avatar>{"🏠"}</Avatar>}
                        subtitle={`Needs - Allocated: ${formatRupiah(byBucket.needs.allocated)}`}
                    >
                        {formatRupiah(byBucket.needs.remaining)}
                    </Cell>
                    <Cell
                        before={<Avatar>{"🎮"}</Avatar>}
                        subtitle={`Wants - Allocated: ${formatRupiah(byBucket.wants.allocated)}`}
                    >
                        {formatRupiah(byBucket.wants.remaining)}
                    </Cell>
                    <Cell
                        before={<Avatar>{"💵"}</Avatar>}
                        subtitle={`Savings - Allocated: ${formatRupiah(byBucket.savings.allocated)}`}
                    >
                        {formatRupiah(byBucket.savings.remaining)}
                    </Cell>
                </Section>

                {/* Spending Progress */}
                <Section header="Spending Progress">
                    <Cell subtitle={`Needs: ${formatRupiah(byBucket.needs.spent)} / ${formatRupiah(byBucket.needs.allocated)}`}>
                        <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px', height: '8px' }}>
                            <div style={{
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: byBucket.needs.spent > byBucket.needs.allocated ? '#ef4444' : '#10b981',
                                width: `${Math.min((byBucket.needs.spent / byBucket.needs.allocated) * 100, 100)}%`
                            }} />
                        </div>
                    </Cell>
                    <Cell subtitle={`Wants: ${formatRupiah(byBucket.wants.spent)} / ${formatRupiah(byBucket.wants.allocated)}`}>
                        <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px', height: '8px' }}>
                            <div style={{
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: byBucket.wants.spent > byBucket.wants.allocated ? '#ef4444' : '#f59e0b',
                                width: `${Math.min((byBucket.wants.spent / byBucket.wants.allocated) * 100, 100)}%`
                            }} />
                        </div>
                    </Cell>
                    <Cell subtitle={`Savings: ${formatRupiah(byBucket.savings.spent)} / ${formatRupiah(byBucket.savings.allocated)}`}>
                        <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px', height: '8px' }}>
                            <div style={{
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: byBucket.savings.spent > byBucket.savings.allocated ? '#ef4444' : '#8b5cf6',
                                width: `${Math.min((byBucket.savings.spent / byBucket.savings.allocated) * 100, 100)}%`
                            }} />
                        </div>
                    </Cell>
                </Section>

                {/* Top Categories */}
                {summary.topCategories.length > 0 && (
                    <Section header="Top Spending Categories">
                        {summary.topCategories.map((cat, i) => (
                            <Cell
                                key={i}
                                subtitle={`${formatRupiah(cat.amount)} (${cat.percentage.toFixed(1)}%)`}
                            >
                                {cat.name}
                            </Cell>
                        ))}
                    </Section>
                )}

                {/* Quick Stats */}
                <Section header="Quick Stats">
                    <Cell subtitle="Total spent this month">
                        {formatRupiah(summary.totalExpenses)}
                    </Cell>
                    <Cell subtitle="Remaining budget">
                        {formatRupiah(budget.estimatedIncome - summary.totalExpenses)}
                    </Cell>
                </Section>
            </List>
        </Page>
    );
}