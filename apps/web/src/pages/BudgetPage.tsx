import { useEffect, useState } from "react";
import { List, Section, Cell, Avatar, Input, Button } from "@telegram-apps/telegram-ui";
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

export function BudgetPage() {
    const { authenticated, loading: authLoading, token } = useAuth();
    const { budget, loading, error, fetchBudget, updateBudget, setToken, setOn401Handler } = useStore();

    // Set up authentication integration with store
    useEffect(() => {
        if (token) {
            setToken(token);
        }
    }, [token, setToken]);
    const [editing, setEditing] = useState(false);
    const [tempIncome, setTempIncome] = useState("");

    useEffect(() => {
        if (!authenticated || authLoading) return;

        fetchBudget();
    }, [authenticated, authLoading, fetchBudget]);

    useEffect(() => {
        if (budget) {
            setTempIncome(budget.estimatedIncome.toString());
        }
    }, [budget]);

    const handleSaveIncome = async () => {
        const newIncome = parseFloat(tempIncome.replace(/[^\d]/g, ''));
        if (!newIncome || !budget) return;

        // Calculate new budget allocation based on 50/30/20 rule
        const needsAmount = newIncome * 0.5;
        const wantsAmount = newIncome * 0.3;
        const savingsAmount = newIncome * 0.2;

        await updateBudget({
            estimatedIncome: newIncome,
            needsAmount,
            wantsAmount,
            savingsAmount,
        });

        setEditing(false);
    };

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
                    <Cell>Please authenticate to manage your budget</Cell>
                </Section>
            </Page>
        );
    }

    if (!budget) {
        return (
            <Page>
                <Section header="Budget Setup">
                    <Cell>No budget found. Please set up your monthly income.</Cell>
                </Section>
            </Page>
        );
    }

    return (
        <Page>
            <List>
                <Section header="Monthly Budget Settings">
                    <Cell
                        before={<Avatar>💰</Avatar>}
                        subtitle="Update your estimated monthly income"
                    >
                        {editing ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Input
                                    value={tempIncome}
                                    onChange={(e) => setTempIncome(e.target.value)}
                                    placeholder="Enter income"
                                    style={{ flex: 1 }}
                                />
                                <Button size="s" onClick={handleSaveIncome}>Save</Button>
                                <Button size="s" mode="bezeled" onClick={() => setEditing(false)}>Cancel</Button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Monthly Income</span>
                                <Button size="s" mode="bezeled" onClick={() => setEditing(true)}>Edit</Button>
                            </div>
                        )}
                    </Cell>

                    <Cell subtitle={`Current: ${formatRupiah(budget.estimatedIncome)}`}>
                        Monthly Income
                    </Cell>
                </Section>

                <Section header="50/30/20 Budget Allocation">
                    <Cell
                        before={<Avatar>🏠</Avatar>}
                        subtitle="Housing, utilities, groceries, transportation"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span>Needs (50%)</span>
                            <span>{formatRupiah(budget.needsAmount)}</span>
                        </div>
                    </Cell>

                    <Cell
                        before={<Avatar>🎮</Avatar>}
                        subtitle="Dining out, entertainment, hobbies"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span>Wants (30%)</span>
                            <span>{formatRupiah(budget.wantsAmount)}</span>
                        </div>
                    </Cell>

                    <Cell
                        before={<Avatar>💵</Avatar>}
                        subtitle="Emergency fund, investments, debt payoff"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span>Savings (20%)</span>
                            <span>{formatRupiah(budget.savingsAmount)}</span>
                        </div>
                    </Cell>
                </Section>

                <Section header="Budget Details">
                    <Cell subtitle={`Needs: ${budget.needsPercentage}%`}>
                        {budget.needsPercentage}% of income
                    </Cell>
                    <Cell subtitle={`Wants: ${budget.wantsPercentage}%`}>
                        {budget.wantsPercentage}% of income
                    </Cell>
                    <Cell subtitle={`Savings: ${budget.savingsPercentage}%`}>
                        {budget.savingsPercentage}% of income
                    </Cell>
                </Section>

                <Section header="Current Period">
                    <Cell subtitle={budget.period.name}>
                        Budget Period
                    </Cell>
                    <Cell subtitle={`${budget.period.startDate} - ${budget.period.endDate}`}>
                        Date Range
                    </Cell>
                </Section>
            </List>
        </Page>
    );
}