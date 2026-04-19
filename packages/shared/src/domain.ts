// =============================================================================
// EXTENDED DOMAIN ENTITIES (building on types.ts)
// =============================================================================

// Import existing entity types from types.ts to avoid conflicts
import type { User, TelegramAccount, DatePeriod, Budget, Transaction, PendingRegistration, PeriodBudget, Period, TargetContext, Tier } from "./types.js";

// =============================================================================
// GROUP DOMAIN ENTITIES
// =============================================================================

export interface Group {
    id: string;
    telegramGroupId: number; // Stored as bigint in DB but represented as number in JS
    name: string;
    ownerId: string;
    isActive: boolean;
    createdAt: Date;
}

export interface FamilyMember {
    id: string;
    groupId: string;
    userId: string;
    role: string;
    joinedAt: Date;
}

// Define Category type since it's not exported from types.ts
export interface Category {
    id: string;
    targetId: string;
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
    findById(id: string): Promise<Period | null>;
    findCurrentByTargetId(targetId: string): Promise<Period | null>;
    save(period: Omit<DatePeriod, "id" | "createdAt">): Promise<string>;
    setCurrent(targetId: string, periodId: string): Promise<void>;
    findByTargetDateRange(targetId: string, startDate: Date, endDate: Date): Promise<DatePeriod[]>;
    /** Find the most recent period before the given period ID */
    findPreviousByTargetId(targetId: string, beforePeriodId: string): Promise<Period | null>;
}

export interface IBudgetRepository {
    findByPeriodId(periodId: string): Promise<PeriodBudget | null>;
    save(budget: Omit<Budget, "id" | "createdAt" | "updatedAt"> & { buckets?: any[] }): Promise<string>;
    update(budgetId: string, updates: Partial<Budget>): Promise<void>;
    saveBucket(bucket: any): Promise<string>;
    updateBucket(bucketId: string, updates: any): Promise<void>;
    deleteBucket(bucketId: string): Promise<void>;
}

export interface ITransactionRepository {
    findById(id: string): Promise<TransactionWithCategory | null>;
    findByIds(ids: string[]): Promise<TransactionWithCategory[]>;
    findByTargetAndPeriod(targetId: string, periodId: string): Promise<TransactionWithCategory[]>;
    findByVector(targetId: string, periodId: string, searchQuery: number[], treshold: number): Promise<TransactionWithCategory[]>;
    save(transaction: Omit<Transaction, "id" | "createdAt">): Promise<string>;
    update(transaction: Transaction): Promise<string>;
    delete(id: string): Promise<boolean>;
    getPeriodTotals(targetId: string, periodId: string): Promise<PeriodTotals>;
    getTransactionsSummary(targetId: string, periodId: string): Promise<any[]>;
}

export interface ICategoryRepository {
    findById(id: string): Promise<Category | null>;
    findByTargetId(targetId: string): Promise<Category[]>;
    findOrCreate(targetId: string, categoryName: string, bucket?: string): Promise<string>;
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

export interface IGroupRepository {
    findByTelegramId(telegramGroupId: number): Promise<Group | null>;
    findMembers(groupId: string): Promise<FamilyMember[]>;
    isUserMember(userId: string, groupId: string): Promise<boolean>;
    save(group: Omit<Group, "id" | "createdAt">): Promise<string>;
    addMember(familyMember: Omit<FamilyMember, "id" | "joinedAt">): Promise<string>;
    removeMember(groupId: string, userId: string): Promise<boolean>;
    updateMemberRole(groupId: string, userId: string, role: string): Promise<void>;
    findWithOwner(groupId: string): Promise<(Group & { owner: { telegramAccount: { telegramId: number; username?: string; firstName?: string } } }) | null>;
    findByOwner(ownerId: string): Promise<Group[]>;
}

// =============================================================================
// SERVICE INTERFACES
// =============================================================================

export interface IPeriodService {
    ensurePeriodExists(targetId: string, now: Date, incomeDate: number): Promise<string>;
    resolvePeriodId(targetId: string): Promise<string | null>;
    getCurrentPeriod(targetId: string): Promise<DatePeriod | null>;
    upsertPeriodWithBudget(targetId: string, periodData: any): Promise<string>;
}

export interface IBudgetService {
    getBudget(periodId: string): Promise<PeriodBudget | null>;
    getBudgetSummary(targetId: string, periodId: string): Promise<{ budget: PeriodBudget; spending: any[] } | null>;
    upsertBudget(params: any): Promise<string>;
    updateBucket(periodId: string, args: any): Promise<void>;
    insertBucket(periodId: string, args: any): Promise<void>;
    deleteBucket(periodId: string, args: any): Promise<void>;
}

export interface IFileService {
    saveFileMetadata(params: {
        userId: string;
        periodId?: string;
        fileName: string;
        fileType: string;
        fileSize: number;
        telegramFileId?: string;
    }): Promise<string>;
}

export interface IConversationAI {
    buildPrompt(target: TargetContext, period: Period): Promise<any[]>;
    generateResponse(messages: any[]): Promise<any>;
    setTargetContext(target: TargetContext, messages: any[]): Promise<void>;
    clearContext(target: TargetContext): Promise<void>;
}

export interface ITransactionService {
    saveTransaction(params: any): Promise<string>;
    getAllTransactions(targetId: string, periodId: string): Promise<TransactionWithCategory[]>;
    getTransactionsSummary(targetId: string, periodId: string): Promise<any[]>;
    getPeriodTotals(targetId: string, periodId: string): Promise<PeriodTotals>;
    getTransactionCount(targetId: string, periodId: string): Promise<number>;
    recommendSetupBuckets(targetId: string, periodId: string): Promise<boolean>;
    upsertTransaction(params: any): Promise<string>;
    updateTransaction(params: any): Promise<string>;
    getTransactionHistory(targetId: string, periodId: string, limit?: number): Promise<string>;
    searchTransactionsByKeyword(targetId: string, periodId: string, keyword: string): Promise<TransactionWithCategory[]>;
    deleteTransaction(id: string): Promise<boolean>;
    trackAiUsage(params: any): Promise<void>;
    searchTransactionsByVector(targetId: string, periodId: string, searchQuery: number[], treshold: number): Promise<TransactionWithCategory[]>;
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
    getUserByTelegramId(telegramId: number): Promise<User | null>;
    getUserForRegistration(telegramId: number): Promise<DomainResult<UserWithTelegram>>;
    registerNewUser(telegramData: {
        telegramId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        tier: User["tier"];
    }): Promise<DomainResult<string>>;
    updateUserIncomeSettings(userId: string, incomeDate: number, isIncomeUncertain: boolean): Promise<DomainResult>;
    approveRegistration(telegramId: number, adminTelegramId: number): Promise<DomainResult<string>>;
    updateRegistrationStatus(telegramId: number, status: string, adminTelegramId: number): Promise<DomainResult>;
    rejectRegistration(telegramId: number, adminTelegramId: number): Promise<DomainResult>;
    savePendingRegistration(data: {
        telegramId: number;
        username?: string;
        firstName?: string;
        requestedTier: Tier;
        adminMessageId?: number;
    }): Promise<DomainResult<string>>;
    getPendingRegistration(telegramId: number): Promise<DomainResult<PendingRegistration>>;
}

export interface IBudgetCalculationService {
    calculateBudgetAllocation(income: number, needsPct: number, wantsPct: number, savingsPct: number): BudgetAllocation;
    validateBudgetPercentages(percentages: BudgetPercentages): boolean;
}

export interface IGroupService {
    findGroupByTelegramId(telegramGroupId: number): Promise<Group | null>;
    groupExists(telegramGroupId: number): Promise<boolean>;
    createGroup(ownerData: {
        telegramGroupId: number;
        name: string;
        ownerId: string;
    }): Promise<DomainResult<string>>;
    inviteMember(
        telegramId: number,
        groupId: string,
        role: "member" | "admin",
        inviterId: string
    ): Promise<DomainResult>;
    removeMemberFromGroup(
        memberUserId: string,
        groupId: string,
        requesterId: string
    ): Promise<DomainResult>;
    getGroupWithMembers(groupId: string): Promise<DomainResult<Group & { members: FamilyMember[] }>>;
    getUserGroups(userId: string): Promise<DomainResult<Group[]>>;
}