/**
 * Validation utilities and schemas for shared use
 */

import { z } from "zod";

// =============================================================================
// COMMON VALIDATION SCHEMAS
// =============================================================================

/**
 * Email validation schema
 */
export const EmailSchema = z
    .string()
    .email("Format email tidak valid")
    .min(1, "Email wajib diisi");

/**
 * Phone number validation schema (Indonesian format)
 */
export const PhoneSchema = z
    .string()
    .regex(/^(\+62|62|0)[8-9][0-9]{7,11}$/, "Format nomor telepon tidak valid");

/**
 * Indonesian amount string validation
 */
export const AmountStringSchema = z
    .string()
    .min(1, "Jumlah tidak boleh kosong")
    .refine(
        (val) => {
            const patterns = [
                /^[\d.,\s]*(rb|ribu|jt|juta|k|m)$/i,
                /^[\d.,\s]+$/,
            ];
            return patterns.some(pattern => pattern.test(val));
        },
        { message: "Format jumlah tidak valid (contoh: 20rb, 1.5jt, 500k)" }
    );

// =============================================================================
// DOMAIN VALIDATORS
// =============================================================================

/**
 * Validate Indonesian currency amount
 */
export function validateAmount(amount: string): { valid: boolean; value?: number; error?: string } {
    try {
        const { parseIndonesianAmount } = require("@kodetama/shared");
        const numericValue = parseIndonesianAmount(amount.trim());

        if (numericValue === null) {
            return { valid: false, error: "Format jumlah tidak valid" };
        }

        if (numericValue <= 0) {
            return { valid: false, error: "Jumlah harus lebih besar dari 0" };
        }

        if (numericValue > 10000000000) { // 10 billion IDR limit
            return { valid: false, error: "Jumlah terlalu besar" };
        }

        return { valid: true, value: numericValue };
    } catch {
        return { valid: false, error: "Format jumlah tidak valid" };
    }
}

/**
 * Validate budget percentages
 */
export function validateBudgetPercentages(
    needs: number,
    wants: number,
    savings: number
): { valid: boolean; error?: string } {
    const total = needs + wants + savings;

    if (needs < 0 || wants < 0 || savings < 0) {
        return { valid: false, error: "Persentase tidak boleh negatif" };
    }

    if (Math.abs(total - 100) > 0.01) {
        return { valid: false, error: "Total persentase harus 100%" };
    }

    return { valid: true };
}

/**
 * Validate transaction description
 */
export function validateDescription(description: string): { valid: boolean; value: string; error?: string } {
    const trimmed = description.trim();

    if (trimmed.length > 500) {
        return { valid: false, value: description, error: "Deskripsi tidak boleh lebih dari 500 karakter" };
    }

    // Allow basic alphanumeric, spaces, and common symbols
    if (!/^[a-zA-Z0-9\s.,!?()-]+$/.test(trimmed)) {
        return { valid: false, value: description, error: "Deskripsi mengandung karakter tidak valid" };
    }

    return { valid: true, value: trimmed };
}

/**
 * Validate category name
 */
export function validateCategoryName(name: string): { valid: boolean; value: string; error?: string } {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { valid: false, value: name, error: "Nama kategori minimal 2 karakter" };
    }

    if (trimmed.length > 50) {
        return { valid: false, value: name, error: "Nama kategori maksimal 50 karakter" };
    }

    // Allow letters, numbers, spaces, and basic punctuation
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
        return { valid: false, value: name, error: "Nama kategori hanya boleh huruf, angka, spasi, -, dan _" };
    }

    return { valid: true, value: trimmed };
}

// =============================================================================
// INPUT SANITIZATION UTILS
// =============================================================================

/**
 * Sanitize user input for database storage
 */
export function sanitizeInput(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, "") // Remove potential HTML
        .replace(/\s+/g, " ") // Normalize whitespace
        .substring(0, 1000); // Limit length
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumericInput(input: string): string {
    return input.replace(/[^0-9.,]/g, "");
}

// =============================================================================
// VALIDATION HELPER FUNCTIONS
// =============================================================================

/**
 * Check if string is empty or whitespace
 */
export function isEmpty(value: string): boolean {
    return !value || value.trim().length === 0;
}

/**
 * Check if value is within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

/**
 * Check if string length is within bounds
 */
export function isLengthValid(str: string, min: number, max: number): boolean {
    return str.length >= min && str.length <= max;
}

// =============================================================================
// BUSINESS RULE VALIDATIONS
// =============================================================================

/**
 * Validate that transaction amount is reasonable for user tier
 */
export function validateAmountForTier(
    amount: number,
    tier: "standard" | "pro" | "family"
): { valid: boolean; error?: string } {
    const limits = {
        standard: 50000000, // 50M IDR
        pro: 200000000,      // 200M IDR
        family: 500000000,   // 500M IDR
    };

    if (amount > limits[tier]) {
        return {
            valid: false,
            error: `Jumlah terlalu besar untuk tier ${tier}. Maksimal: ${formatCurrency(limits[tier])}`
        };
    }

    return { valid: true };
}

/**
 * Helper to format currency for error messages
 */
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}