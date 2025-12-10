/**
 * String manipulation utility functions
 */

/**
 * Clean and normalize text input
 */
export function normalizeText(input: string): string {
    if (!input) return "";

    return input
        .trim()
        .replace(/\s+/g, " ") // Normalize whitespace
        .toLowerCase();
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
    return str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

/**
 * Create a URL-safe slug from string
 */
export function slugify(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove special characters
        .replace(/[\s_-]+/g, "-") // Replace spaces, underscores with hyphens
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + "...";
}

/**
 * Extract words from string that might contain numbers
 */
export function extractWords(input: string): string[] {
    return input
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
}

/**
 * Remove diacritics and special characters from Indonesian text
 */
export function normalizeIndonesianText(input: string): string {
    return input
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .replace(/[^a-zA-Z0-9\s]/g, " ") // Keep only alphanumeric and spaces
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
}

/**
 * Check if string contains Indonesian currency keywords
 */
export function containsCurrencyKeywords(str: string): boolean {
    const keywords = ["rb", "ribu", "jt", "juta", "k", "m"];
    const normalized = str.toLowerCase();
    return keywords.some(keyword => normalized.includes(keyword));
}

/**
 * Parse numbers from mixed string content
 */
export function extractNumbers(str: string): number[] {
    const matches = str.match(/\d+(\.\d+)?/g);
    if (!matches) return [];

    return matches.map(match => parseFloat(match)).filter(n => !isNaN(n));
}