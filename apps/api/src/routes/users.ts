import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { users, telegramAccounts } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /users/:id
     */
    fastify.get<{
        Params: { id: string };
    }>("/:id", async (request, reply) => {
        const { id } = request.params;

        const user = await db.query.users.findFirst({
            where: eq(users.id, id),
            with: {
                telegramAccount: true,
            },
        });

        if (!user) {
            return reply.status(404).send({ error: "User not found" });
        }

        return {
            id: user.id,
            tier: user.tier,
            isActive: user.isActive,
            createdAt: user.createdAt.toISOString(),
            telegram: user.telegramAccount,
        };
    });

    /**
     * GET /users/telegram/:telegramId
     */
    fastify.get<{
        Params: { telegramId: string };
    }>("/telegram/:telegramId", async (request, reply) => {
        const telegramId = parseInt(request.params.telegramId);

        const telegramAccount = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramId),
            with: {
                // Note: need to add reverse relation
            },
        });

        if (!telegramAccount) {
            return reply.status(404).send({ error: "User not found" });
        }

        const user = await db.query.users.findFirst({
            where: eq(users.id, telegramAccount.userId),
        });

        return {
            id: user?.id,
            tier: user?.tier,
            isActive: user?.isActive,
            telegramId: telegramAccount.telegramId,
            username: telegramAccount.username,
        };
    });

    /**
     * PATCH /users/:id
     */
    fastify.patch<{
        Params: { id: string };
        Body: { tier?: "standard" | "pro" | "family" };
    }>("/:id", async (request, reply) => {
        const { id } = request.params;
        const { tier } = request.body;

        const updated = await db
            .update(users)
            .set({
                tier: tier,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning();

        if (updated.length === 0) {
            return reply.status(404).send({ error: "User not found" });
        }

        return { id, tier, updated: true };
    });
}
