import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { budgetRoutes } from "./routes/budgets";
import { transactionRoutes } from "./routes/transactions";
import { googleRoutes } from "./routes/google";

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
    },
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
await fastify.register(authRoutes, { prefix: "/auth" });
await fastify.register(userRoutes, { prefix: "/users" });
await fastify.register(budgetRoutes, { prefix: "/budgets" });
await fastify.register(transactionRoutes, { prefix: "/transactions" });
await fastify.register(googleRoutes, { prefix: "/google" });

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
