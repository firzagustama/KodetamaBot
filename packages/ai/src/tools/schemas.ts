/**
 * Zod schemas for AI tool validation
 * Imports shared types from @kodetama/shared
 */

import { z } from "zod";
import { TX_TYPES } from "@kodetama/shared";

// =============================================================================
// WRITE TOOL SCHEMAS
// =============================================================================

/**
 * Schema for upserting transactions via AI
 */
export const UpsertTransactionItemSchema = z.object({
    transactionId: z.string().uuid().optional().describe("Transaction ID for update, omit for new"),
    type: z.enum(TX_TYPES).describe("income: gaji, transfer in | expense: beli, makan | transfer: kirim uang | adjustment: koreksi"),
    amount: z.number().positive().describe("Amount in IDR. Parse: rb/ribu/k=×1000, jt/juta=×1000000. Comma=decimal"),
    category: z.string().min(1).describe("Indonesian category name, title case (e.g., Makanan, Transport)"),
    bucket: z.string().min(1).describe("Target bucket from user's available buckets"),
    description: z.string().min(1).describe("Brief transaction description"),
    confidence: z.number().min(0).max(1).describe("0.0-1.0. Must be >0.8 to auto-execute"),
    confirmationMessage: z.string().optional().describe("Required if confidence <0.8. Ask user to clarify"),
});

export const UpsertTransactionSchema = z.object({
    input: z.array(UpsertTransactionItemSchema).min(1).describe("Array of transactions to upsert"),
});

export type UpsertTransactionInput = z.infer<typeof UpsertTransactionSchema>;

/**
 * Schema for deleting a transaction
 */
export const DeleteTransactionSchema = z.object({
    transactionId: z.string().uuid().describe("Transaction ID from context or history. Never ask user for ID"),
});

export type DeleteTransactionInput = z.infer<typeof DeleteTransactionSchema>;

/**
 * Schema for upserting a bucket
 */
export const UpsertBucketSchema = z.object({
    bucketId: z.string().uuid().optional().describe("Bucket ID for update, omit for new"),
    name: z.string().min(1).describe("Bucket name (e.g., Makan, Transport, Tabungan)"),
    description: z.string().min(1).describe("Brief description of what this bucket is for"),
    amount: z.number().positive().describe("Budget allocation in IDR"),
    category: z.enum(["needs", "wants", "savings"]).describe("needs: essential | wants: non-essential | savings: savings"),
});

export type UpsertBucketInput = z.infer<typeof UpsertBucketSchema>;

/**
 * Schema for deleting a bucket
 */
export const DeleteBucketSchema = z.object({
    bucketId: z.string().uuid().optional().describe("Bucket ID if known"),
    name: z.string().min(1).describe("Bucket name to delete"),
    moveBucket: z.string().min(1).describe("Move existing transactions to this bucket"),
    confidence: z.number().min(0).max(1).describe("Must be >0.8 to auto-execute"),
    confirmationMessage: z.string().describe("Confirmation message to show user"),
});

export type DeleteBucketInput = z.infer<typeof DeleteBucketSchema>;

/**
 * Schema for upserting a period
 */
export const UpsertPeriodSchema = z.object({
    name: z.string().optional().describe("Period name (e.g., Januari 2025). Auto-generated if omitted"),
    incomeDate: z.number().min(1).max(28).default(1).describe("Day of month when income arrives (1-28)"),
    makeCurrent: z.boolean().default(true).describe("Set as current active period"),
});

export type UpsertPeriodInput = z.infer<typeof UpsertPeriodSchema>;

// =============================================================================
// READ TOOL SCHEMAS
// =============================================================================

/**
 * Schema for getting transaction history
 */
export const GetTransactionHistorySchema = z.object({
    limit: z.number().min(1).max(20).default(5).describe("Number of transactions to return (1-20)"),
    bucket: z.string().optional().describe("Filter by bucket name"),
    type: z.enum(TX_TYPES).optional().describe("Filter by transaction type"),
    daysBack: z.number().min(1).max(90).default(7).describe("Look back N days from today"),
});

export type GetTransactionHistoryInput = z.infer<typeof GetTransactionHistorySchema>;

/**
 * Schema for getting budget status
 */
export const GetBudgetStatusSchema = z.object({
    bucketName: z.string().optional().describe("Specific bucket to check, or omit for all buckets"),
});

export type GetBudgetStatusInput = z.infer<typeof GetBudgetStatusSchema>;

/**
 * Schema for searching transactions
 */
export const SearchTransactionsSchema = z.object({
    query: z.string().min(1).describe("Search term to match against description or category"),
    limit: z.number().min(1).max(20).default(10).describe("Max results to return"),
});

export type SearchTransactionsInput = z.infer<typeof SearchTransactionsSchema>;

/**
 * Schema for getting financial summary
 */
export const GetFinancialSummarySchema = z.object({
    periodType: z.enum(["current", "previous"]).default("current").describe("Which period to summarize"),
});

export type GetFinancialSummaryInput = z.infer<typeof GetFinancialSummarySchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Parse and validate tool arguments with Zod schema
 * @throws ZodError if validation fails
 */
export function parseToolArgs<T>(schema: z.ZodSchema<T>, args: unknown): T {
    return schema.parse(args);
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParseToolArgs<T>(schema: z.ZodSchema<T>, args: unknown): z.SafeParseReturnType<unknown, T> {
    return schema.safeParse(args);
}
