import { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../utils/logger.js";

export async function loggingMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const start = Date.now();
    const { method, url } = request;

    // Capture request body
    const reqBody = request.body ? JSON.stringify(request.body) : "-";

    // Store original send function
    const originalSend = reply.send.bind(reply);

    // Override send to capture response
    reply.send = function (payload: any) {
        const duration = Date.now() - start;
        const { statusCode } = reply;

        // Capture response body
        let resBody = "-";
        if (payload) {
            try {
                resBody = typeof payload === "string" 
                    ? payload 
                    : JSON.stringify(payload);
                // Truncate if too long
                if (resBody.length > 500) {
                    resBody = resBody.substring(0, 500) + "...";
                }
            } catch {
                resBody = "[ Unable to stringify ]";
            }
        }

        // Compact log format
        logger.info(
            `${method} ${url} ${statusCode} ${duration}ms | Req: ${reqBody} | Res: ${resBody}`
        );

        return originalSend(payload);
    };
}