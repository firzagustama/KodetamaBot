const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface ApiClientOptions {
    url: string;
    token: string | null;
    options?: RequestInit;
    on401?: () => Promise<string | null>; // Callback to handle 401 and return new token
    on403?: () => Promise<void>; // Callback to handle 403
}

/**
 * Enhanced API client with:
 * - Automatic 401 handling and re-authentication
 * - Compact request/response logging
 * - Retry logic after successful re-auth
 */
export async function apiFetch({
    url,
    token,
    options = {},
    on401,
    on403
}: ApiClientOptions): Promise<Response> {
    const startTime = Date.now();
    const method = options.method || 'GET';
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

    // Log request
    console.log(`[API] → ${method} ${url}`);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const requestOptions: RequestInit = {
        ...options,
        headers,
    };

    let response = await fetch(fullUrl, requestOptions);
    const duration = Date.now() - startTime;

    // Log response
    console.log(`[API] ← ${response.status} ${response.statusText} (${duration}ms)`);

    // Handle 401 - attempt re-auth if callback provided
    if (response.status === 401 && on401) {
        console.log('[API] 401 detected - attempting re-authentication...');

        try {
            const newToken = await on401();

            if (newToken) {
                console.log('[API] Re-auth successful - retrying request with new token');

                // Retry with new token
                headers["Authorization"] = `Bearer ${newToken}`;
                const retryResponse = await fetch(fullUrl, {
                    ...requestOptions,
                    headers,
                });

                console.log(`[API] ← ${retryResponse.status} ${retryResponse.statusText} (${Date.now() - duration}ms) [retry]`);
                return retryResponse;
            } else {
                console.log('[API] Re-auth failed - proceeding with 401 response');
            }
        } catch (error) {
            console.error('[API] Re-auth error:', error);
        }
    }

    if (response.status === 403 && on403) {
        await on403();
    }

    return response;
}

/**
 * Convenience function for authenticated API calls with default on401 behavior
 * This is a drop-in replacement for the old authFetch function
 */
export async function authFetch(
    url: string,
    token: string | null,
    options: RequestInit = {},
    on401?: () => Promise<string | null>,
    on403?: () => Promise<void>
): Promise<Response> {
    return apiFetch({ url, token, options, on401, on403 });
}