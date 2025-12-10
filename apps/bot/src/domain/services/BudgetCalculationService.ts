import type {
    IBudgetCalculationService,
    BudgetAllocation,
    BudgetPercentages
} from "@kodetama/shared";
import { roundToThousands } from "@kodetama/shared";

/**
 * Domain service for budget calculations
 * Contains business logic that doesn't belong to specific entities
 */
export class BudgetCalculationService implements IBudgetCalculationService {

    /**
     * Calculate budget allocation from income and percentages
     *
     * @param income - Monthly income amount
     * @param needsPct - Needs percentage (50 = 50%)
     * @param wantsPct - Wants percentage (30 = 30%)
     * @param savingsPct - Savings percentage (20 = 20%)
     * @returns Allocated amounts for each bucket
     */
    calculateBudgetAllocation(
        income: number,
        needsPct: number,
        wantsPct: number,
        savingsPct: number
    ): BudgetAllocation {
        const needs = roundToThousands(income * (needsPct / 100));
        const wants = roundToThousands(income * (wantsPct / 100));
        const savings = roundToThousands(income * (savingsPct / 100));

        return { needs, wants, savings };
    }

    /**
     * Validate that budget percentages add up to 100%
     *
     * @param percentages - Budget percentages to validate
     * @returns true if percentages are valid
     */
    validateBudgetPercentages(percentages: BudgetPercentages): boolean {
        const total = percentages.needs + percentages.wants + percentages.savings;
        return Math.abs(total - 100) < 0.01; // Allow small floating point errors
    }

    /**
     * Suggest budget percentages based on income amount
     *
     * @param income - Monthly income
     * @returns Suggested budget percentages
     */
    suggestBudgetPercentages(income: number): BudgetPercentages {
        // Simple rule-based suggestions
        if (income < 5000000) { // < 5M IDR - basic living
            return { needs: 60, wants: 30, savings: 10 };
        } else if (income < 15000000) { // 5M-15M IDR - comfortable
            return { needs: 50, wants: 30, savings: 20 };
        } else if (income < 50000000) { // 15M-50M IDR - upper middle class
            return { needs: 40, wants: 40, savings: 20 };
        } else { // > 50M IDR - wealthy
            return { needs: 30, wants: 50, savings: 20 };
        }
    }

    /**
     * Calculate required income for desired expenses
     *
     * @param needs - Required needs expenses
     * @param wants - Desired wants expenses
     * @param savings - Desired savings amount
     * @returns Required income amount
     */
    calculateRequiredIncome(needs: number, wants: number, savings: number): number {
        return roundToThousands(needs + wants + savings);
    }

    /**
     * Calculate budget shortfall or surplus
     *
     * @param allocated - Allocated amounts
     * @param actual - Actual spent amounts
     * @returns Surplus (positive) or shortfall (negative)
     */
    calculateBudgetVariance(
        allocated: BudgetAllocation,
        actual: { needs: number; wants: number; savings: number }
    ): { needs: number; wants: number; savings: number } {
        return {
            needs: allocated.needs - actual.needs,
            wants: allocated.wants - actual.wants,
            savings: allocated.savings - actual.savings,
        };
    }
}