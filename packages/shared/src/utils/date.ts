/**
 * Date-related utility functions for Indonesian locale
 */

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
 * Check if a date falls within a given period
 */
export function isDateInPeriod(date: Date, periodStart: Date, periodEnd: Date): boolean {
    return date >= periodStart && date <= periodEnd;
}

/**
 * Get the first day of the month
 */
export function getFirstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the last day of the month
 */
export function getLastDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Format date to Indonesian locale
 */
export function formatIndonesianDate(date: Date): string {
    return date.toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Get relative date description (e.g., "hari ini", "kemarin", "2 hari yang lalu")
 */
export function getRelativeDateDescription(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) {
        return "di masa depan";
    } else if (diffInDays === 0) {
        return "hari ini";
    } else if (diffInDays === 1) {
        return "kemarin";
    } else if (diffInDays <= 7) {
        return `${diffInDays} hari yang lalu`;
    } else if (diffInDays <= 30) {
        const weeks = Math.floor(diffInDays / 7);
        return weeks === 1 ? "minggu lalu" : `${weeks} minggu yang lalu`;
    } else {
        return formatIndonesianDate(date);
    }
}