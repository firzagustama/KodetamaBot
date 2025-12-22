import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const TIERS = ["standard", "pro", "family", "family_member"] as const;
export type Tier = (typeof TIERS)[number];

export const TX_TYPES = ["income", "expense", "transfer", "adjustment"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const REGISTRATION_STATUS = ["pending", "approved", "rejected"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number];

// Default bucket suggestions (but user can use any text)
export const DEFAULT_BUCKETS = ["needs", "wants", "savings"] as const;
export type DefaultBucket = (typeof DEFAULT_BUCKETS)[number];

// =============================================================================
// USER SCHEMAS
// =============================================================================

export const UserSchema = z.object({
    id: z.string().uuid(),
    tier: z.enum(TIERS),
    isActive: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

export const TelegramAccountSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    telegramId: z.number(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
});
export type TelegramAccount = z.infer<typeof TelegramAccountSchema>;

export const TargetContextSchema = z.object({
    isGroup: z.boolean(),
    targetId: z.string(), // userId for private, groupId for group
    userId: z.string().optional(), // always the individual user
    groupId: z.string().optional(), // present only in group context
});
export type TargetContext = z.infer<typeof TargetContextSchema>;

// =============================================================================
// TRANSACTION SCHEMAS
// =============================================================================

export const TransactionInputSchema = z.object({
    type: z.enum(TX_TYPES),
    amount: z.number().positive(),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    bucket: z.string().optional(), // free text bucket
    transactionDate: z.date().optional(),
});
export type TransactionInput = z.infer<typeof TransactionInputSchema>;

export const TransactionSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    periodId: z.string().uuid(),
    categoryId: z.string().uuid().nullable(),
    type: z.enum(TX_TYPES),
    amount: z.string(), // decimal string from DB
    description: z.string().nullable(),
    bucket: z.string().nullable(),
    rawMessage: z.string().nullable(),
    aiConfidence: z.string().nullable(), // decimal string from DB
    transactionDate: z.date(),
    createdAt: z.date(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// =============================================================================
// AI PARSING SCHEMAS
// =============================================================================
const Transaction = z.object({
    type: z.enum(TX_TYPES),
    amount: z.number().positive(),
    category: z.string(),
    bucket: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    needsConfirmation: z.boolean().optional(), // for amounts under 1000
    suggestedAmount: z.number().optional(), // suggested if needs confirmation
});

export const ParsedTransactionSchema = z.object({
    message: z.string(),
    transactions: z.array(Transaction),
});
export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>;

export const AmountConfirmationSchema = z.object({
    originalAmount: z.number(),
    suggestedAmount: z.number(),
    message: z.string(),
});
export type AmountConfirmation = z.infer<typeof AmountConfirmationSchema>;

// =============================================================================
// BUDGET SCHEMAS
// =============================================================================

export const BudgetInputSchema = z.object({
    estimatedIncome: z.number().positive(),
    needsPercentage: z.number().min(0).max(100),
    wantsPercentage: z.number().min(0).max(100),
    savingsPercentage: z.number().min(0).max(100),
}).refine(
    (data) => data.needsPercentage + data.wantsPercentage + data.savingsPercentage === 100,
    { message: "Percentages must add up to 100" }
);
export type BudgetInput = z.infer<typeof BudgetInputSchema>;

export const BudgetSchema = z.object({
    id: z.string().uuid(),
    periodId: z.string().uuid(),
    estimatedIncome: z.string(),
    needsAmount: z.string(),
    wantsAmount: z.string(),
    savingsAmount: z.string(),
    needsPercentage: z.number(),
    wantsPercentage: z.number(),
    savingsPercentage: z.number(),
});
export type Budget = z.infer<typeof BudgetSchema>;

// =============================================================================
// DATE PERIOD SCHEMAS
// =============================================================================

export const DatePeriodInputSchema = z.object({
    name: z.string(), // e.g., "Januari 2025"
    startDate: z.date(),
    endDate: z.date(),
});
export type DatePeriodInput = z.infer<typeof DatePeriodInputSchema>;

export const DatePeriodSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    groupId: z.string().uuid().nullable(),
    name: z.string(),
    startDate: z.date(),
    endDate: z.date(),
    isCurrent: z.boolean(),
});
export type DatePeriod = z.infer<typeof DatePeriodSchema>;

export const BucketSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    budgetId: z.string().uuid(),
    description: z.string().nullable(),
    amount: z.string(),
    icon: z.string().nullable(),
    category: z.string().nullable(),
    isSystem: z.boolean(),
});
export type Bucket = z.infer<typeof BucketSchema>;

export const PeriodBudgetSchema = z.object({
    id: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
    periodId: z.string().uuid(),
    estimatedIncome: z.string(),
    buckets: z.array(BucketSchema),
});
export type PeriodBudget = z.infer<typeof PeriodBudgetSchema>;

export const PeriodSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    createdAt: z.date(),
    userId: z.string().nullable(),
    groupId: z.string().nullable(),
    startDate: z.date(),
    endDate: z.date(),
    isCurrent: z.boolean(),
    budget: PeriodBudgetSchema.nullable(),
});
export type Period = z.infer<typeof PeriodSchema>;

// =============================================================================
// REGISTRATION SCHEMAS
// =============================================================================

export const PendingRegistrationSchema = z.object({
    id: z.string().uuid(),
    telegramId: z.number(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    requestedTier: z.enum(TIERS),
    status: z.enum(REGISTRATION_STATUS),
    createdAt: z.date(),
});
export type PendingRegistration = z.infer<typeof PendingRegistrationSchema>;

// =============================================================================
// API RESPONSE SCHEMAS
// =============================================================================

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
    z.object({
        success: z.boolean(),
        data: dataSchema.optional(),
        error: z.string().optional(),
    });

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
    z.object({
        items: z.array(itemSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        hasMore: z.boolean(),
    });