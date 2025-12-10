/**
 * Currency-related utility functions for Indonesian locale
 */

/**
 * Parse Indonesian amount strings to numbers
 * Examples: 20rb → 20000, 1,5jt → 1500000, 500k → 500000
 */
export function parseIndonesianAmount(input: string): number | null {
    // Remove spaces and convert to lowercase
    let cleaned = input.toLowerCase().replace(/\s/g, "");

    // Replace Indonesian comma with dot for decimals
    cleaned = cleaned.replace(",", ".");

    // Match patterns
    const patterns = [
        // rb/ribu = thousands
        { regex: /^([\d.]+)\s*(rb|ribu)$/i, multiplier: 1000 },
        // jt/juta = millions
        { regex: /^([\d.]+)\s*(jt|juta)$/i, multiplier: 1000000 },
        // k = thousands (international)
        { regex: /^([\d.]+)\s*k$/i, multiplier: 1000 },
        // m = millions (international)
        { regex: /^([\d.]+)\s*m$/i, multiplier: 1000000 },
        // plain number
        { regex: /^([\d.]+)$/, multiplier: 1 },
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern.regex);
        if (match) {
            const value = parseFloat(match[1]);
            if (!isNaN(value)) {
                return Math.round(value * pattern.multiplier);
            }
        }
    }

    return null;
}

/**
 * Format number to Indonesian currency format
 */
export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format amount to short Indonesian format
 * Examples: 20000 → 20rb, 1500000 → 1,5jt
 */
export function formatShortAmount(amount: number): string {
    if (amount >= 1000000) {
        const millions = amount / 1000000;
        return millions % 1 === 0
            ? `${millions}jt`
            : `${millions.toFixed(1).replace(".", ",")}jt`;
    }
    if (amount >= 1000) {
        const thousands = amount / 1000;
        return thousands % 1 === 0
            ? `${thousands}rb`
            : `${thousands.toFixed(1).replace(".", ",")}rb`;
    }
    return amount.toString();
}

/**
 * Check if amount might need confirmation (under 1000)
 */
export function mightNeedAmountConfirmation(amount: number): boolean {
    return amount > 0 && amount < 1000;
}

/**
 * Round amount to nearest thousand (common in financial contexts)
 */
export function roundToThousands(amount: number): number {
    return Math.round(amount / 1000) * 1000;
}

/**
 * Calculate percentage from amount and total
 */
export function calculatePercentage(amount: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((amount / total) * 100 * 100) / 100; // Round to 2 decimal places
}

/**
 * Validate that a number is positive and reasonable
 */
export function isValidAmount(amount: number): boolean {
    return amount >= 0 && amount <= 1e12 && Number.isFinite(amount);
}