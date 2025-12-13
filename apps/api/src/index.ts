import "dotenv/config";
import path from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { logger } from "./utils/logger.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { budgetRoutes } from "./routes/budgets.js";
import { transactionRoutes } from "./routes/transactions.js";
import { googleRoutes } from "./routes/google.js";
import { loggingMiddleware } from "./middleware/loggingMiddleware.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.API_PORT ?? "3000");
const HOST = process.env.API_HOST ?? "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key";

// =============================================================================
// SERVER SETUP
// =============================================================================

const fastify = Fastify({
    logger: {
        level: process.env.LOG_LEVEL ?? "info",
        file: path.join(process.env.LOG_DIR ?? "./logs", "api-fastify.log"),
    },
});

// Add custom logger to fastify instance
fastify.decorate('customLogger', logger);

// Fallback error
fastify.setErrorHandler((error, _request_, reply) => {
    console.log(error);
    reply.status(500).send({ error: "Internal Server Error" });
});

// Plugins
await fastify.register(cors, {
    origin: true, // Allow all origins for Mini App
    credentials: true,
});

await fastify.register(jwt, {
    secret: JWT_SECRET,
});

await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
});

// Routes
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(userRoutes, { prefix: "/api/users" });
await fastify.register(budgetRoutes, { prefix: "/api/budgets" });
await fastify.register(transactionRoutes, { prefix: "/api/transactions" });
await fastify.register(googleRoutes, { prefix: "/api/google" });

// Health check
fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
});

// =============================================================================
// START SERVER
// =============================================================================

try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 API server running at http://${HOST}:${PORT}`);
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}