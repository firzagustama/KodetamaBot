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
 * Get Indonesian month name
 */
export function getIndonesianMonth(month: number): string {
    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[month] ?? "";
}

/**
 * Format date period name
 */
export function formatPeriodName(date: Date): string {
    return `${getIndonesianMonth(date.getMonth())} ${date.getFullYear()}`;
}

/**
 * Get start and end dates for a monthly period
 */
export function getMonthlyPeriodDates(year: number, month: number): { start: Date; end: Date } {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Get start and end dates for a custom period (e.g. starting on 25th)
 */
export function getCustomPeriodDates(year: number, month: number, incomeDate: number): { start: Date; end: Date } {
    // If income date is 1, it's a standard month
    if (incomeDate === 1) {
        return getMonthlyPeriodDates(year, month);
    }

    // Start date is in the specified month
    const start = new Date(year, month, incomeDate);

    // End date is the day before income date in the NEXT month
    // e.g. Start Jan 25 -> End Feb 24
    const end = new Date(year, month + 1, incomeDate - 1, 23, 59, 59, 999);

    return { start, end };
}

/**
 * Calculate budget allocation amounts from percentages
 */
export function calculateBudgetAllocation(
    income: number,
    needsPercent: number,
    wantsPercent: number,
    savingsPercent: number
): { needs: number; wants: number; savings: number } {
    return {
        needs: Math.round(income * (needsPercent / 100)),
        wants: Math.round(income * (wantsPercent / 100)),
        savings: Math.round(income * (savingsPercent / 100)),
    };
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
