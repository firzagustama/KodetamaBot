/**
 * Async utility functions for handling asynchronous operations
 */

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add timeout to a promise
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
        ),
    ]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error = new Error("Operation failed");

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                break;
            }

            // Exponential backoff: baseDelay * 2^attempt
            const delay = baseDelay * Math.pow(2, attempt);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Execute promises in batches to avoid overwhelming resources
 */
export async function batchExecute<T>(
    items: T[],
    batchSize: number,
    processor: (item: T) => Promise<void>
): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(processor));
    }
}

/**
 * Create a debounced promise-based function
 */
export function debounceAsync<T extends any[]>(
    fn: (...args: T) => Promise<void>,
    delay: number
): (...args: T) => Promise<void> {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolveCallbacks: Array<() => void> = [];

    return (...args: T): Promise<void> => {
        return new Promise((resolve) => {
            // Clear existing timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Clear pending resolve callbacks
            resolveCallbacks.forEach(resolve => resolve());
            resolveCallbacks = [resolve];

            // Set new timeout
            timeoutId = setTimeout(async () => {
                try {
                    await fn(...args);
                    resolveCallbacks.forEach(resolve => resolve());
                } catch (error) {
                    // On error, still resolve to prevent hanging promises
                    resolveCallbacks.forEach(resolve => resolve());
                }
                resolveCallbacks = [];
                timeoutId = null;
            }, delay);
        });
    };
}

/**
 * Execute promises one by one (sequentially)
 */
export async function sequential<T>(
    promises: (() => Promise<T>)[]
): Promise<T[]> {
    const results: T[] = [];

    for (const promise of promises) {
        const result = await promise();
        results.push(result);
    }

    return results;
}