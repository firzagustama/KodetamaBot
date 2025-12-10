// =============================================================================
// EXTENDED DOMAIN ENTITIES (building on types.ts)
// =============================================================================

// Import existing entity types from types.ts to avoid conflicts
import type { User, TelegramAccount, DatePeriod, Budget, Transaction, PendingRegistration } from "./types.js";

// Define Category type since it's not exported from types.ts
export interface Category {
    id: string;
    userId?: string | null;
    groupId?: string | null;
    name: string;
    icon?: string | null;
    bucket?: string | null;
    isDefault: boolean;
    createdAt: Date;
}

export interface UserWithTelegram extends User {
    telegramAccount: TelegramAccount;
}

export interface TransactionWithCategory extends Transaction {
    category?: {
        id: string;
        name: string;
        bucket?: string | null;
        icon?: string | null;
    } | null;
}

export interface CategoryEntity {
    id: string;
    userId?: string | null;
    groupId?: string | null;
    name: string;
    icon?: string | null;
    bucket?: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt?: Date;
}

export interface AIUsageEntity {
    id: string;
    userId: string;
    model: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    cost?: string | null;
    createdAt: Date;
}

// =============================================================================
// VALUE OBJECTS
// =============================================================================

export interface BudgetAllocation {
    needs: number;
    wants: number;
    savings: number;
}

export interface BudgetPercentages {
    needs: number;
    wants: number;
    savings: number;
}

export interface PeriodTotals {
    income: number;
    expense: number;
    transfer: number;
    balance: number;
}

export interface AITokens {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface AIUsage {
    id: string;
    userId: string;
    model: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    cost?: string | null;
    createdAt: Date;
}

// =============================================================================
// DOMAIN RESULT TYPES
// =============================================================================

export interface DomainResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// =============================================================================
// REPOSITORY INTERFACES (DOMAIN LAYER)
// =============================================================================

export interface IUserRepository {
    findByTelegramId(telegramId: number): Promise<UserWithTelegram | null>;
    findById(id: string): Promise<User | null>;
    isRegistered(telegramId: number): Promise<boolean>;
    save(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<string>;
    saveTelegramAccount(account: Omit<TelegramAccount, "id" | "createdAt" | "username" | "firstName" | "lastName"> & { username?: string, firstName?: string, lastName?: string }): Promise<string>;
    updateUserIncomeSettings(userId: string, incomeDate: number, isIncomeUncertain: boolean): Promise<void>;
    update(userId: string, updates: Partial<Pick<User, "tier" | "isActive"> & { incomeDate?: number; isIncomeUncertain?: boolean }>): Promise<void>;
}

export interface IDatePeriodRepository {
    findById(id: string): Promise<DatePeriod | null>;
    findCurrentByUserId(userId: string): Promise<DatePeriod | null>;
    save(period: Omit<DatePeriod, "id" | "createdAt">): Promise<string>;
    setCurrent(userId: string, periodId: string): Promise<void>;
    findByUserDateRange(userId: string, startDate: Date, endDate: Date): Promise<DatePeriod[]>;
}

export interface IBudgetRepository {
    findByPeriodId(periodId: string): Promise<Budget | null>;
    save(budget: Omit<Budget, "id" | "createdAt" | "updatedAt">): Promise<string>;
    update(budgetId: string, updates: Partial<Pick<Budget, "estimatedIncome" | "needsAmount" | "wantsAmount" | "savingsAmount" | "needsPercentage" | "wantsPercentage" | "savingsPercentage">>): Promise<void>;
}

export interface ITransactionRepository {
    findById(id: string): Promise<TransactionWithCategory | null>;
    findByIds(ids: string[]): Promise<TransactionWithCategory[]>;
    findByUserAndPeriod(userId: string, periodId: string): Promise<TransactionWithCategory[]>;
    save(transaction: Omit<Transaction, "id" | "createdAt">): Promise<string>;
    delete(id: string): Promise<boolean>;
    getPeriodTotals(userId: string, periodId: string): Promise<PeriodTotals>;
    getTransactionsSummary(userId: string, periodId: string): Promise<any[]>;
}

export interface ICategoryRepository {
    findById(id: string): Promise<Category | null>;
    findByUserId(userId: string): Promise<Category[]>;
    findOrCreate(userId: string | null, groupId: string | null, categoryName: string, bucket?: string): Promise<string>;
    save(category: Omit<Category, "id" | "createdAt">): Promise<string>;
}

export interface IPendingRegistrationRepository {
    findByTelegramId(telegramId: number): Promise<PendingRegistration | null>;
    save(registration: Omit<PendingRegistration, "id" | "createdAt">): Promise<string>;
    updateStatus(telegramId: number, status: PendingRegistration["status"], adminTelegramId: number): Promise<void>;
}

export interface IAIUsageRepository {
    save(usage: Omit<AIUsage, "id">): Promise<string>;
    findByUser(userId: string, limit?: number): Promise<AIUsage[]>;
}

// =============================================================================
// USE CASE INTERFACES
// =============================================================================

export interface ITransactionUseCase {
    parseTransaction(message: string): Promise<DomainResult<{ parsed: any; usage: any }>>;
    saveTransactionWithConfirmation(ctx: any, transaction: any, usage: any, userId: string, rawMessage: string): Promise<DomainResult>;
    saveMultipleTransactionsWithConfirmation(ctx: any, transactions: any[], usage: any, userId: string, rawMessage: string, aiMessage: string): Promise<DomainResult>;
    confirmSinglePendingTransaction(ctx: any): Promise<DomainResult>;
    confirmPendingTransactions(ctx: any): Promise<DomainResult>;
    rejectPendingTransactions(ctx: any): Promise<DomainResult>;
}

export interface IUserService {
    getUserForRegistration(telegramId: number): Promise<DomainResult<UserWithTelegram>>;
    registerNewUser(telegramData: {
        telegramId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        tier: User["tier"];
    }): Promise<DomainResult<string>>;
    updateUserIncomeSettings(userId: string, incomeDate: number, isIncomeUncertain: boolean): Promise<DomainResult>;
}

export interface IBudgetCalculationService {
    calculateBudgetAllocation(income: number, needsPct: number, wantsPct: number, savingsPct: number): BudgetAllocation;
    validateBudgetPercentages(percentages: BudgetPercentages): boolean;
}