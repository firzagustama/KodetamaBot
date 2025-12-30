import { db } from "@kodetama/db";
import { pendingRegistrations } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import type { IPendingRegistrationRepository, PendingRegistration } from "@kodetama/shared";

export class PendingRegistrationRepository implements IPendingRegistrationRepository {
    async findByTelegramId(telegramId: number): Promise<PendingRegistration | null> {
        const result = await db.query.pendingRegistrations.findFirst({
            where: and(
                eq(pendingRegistrations.telegramId, telegramId),
                eq(pendingRegistrations.status, "pending")
            ),
        });
        return (result as PendingRegistration) || null;
    }

    async save(data: Omit<PendingRegistration, "id" | "createdAt" | "status">): Promise<string> {
        const [registration] = await db.insert(pendingRegistrations).values({
            ...data,
            status: "pending",
        }).returning({ id: pendingRegistrations.id });
        return registration.id;
    }

    async updateStatus(telegramId: number, status: "approved" | "rejected", adminTelegramId: number): Promise<void> {
        await db.update(pendingRegistrations)
            .set({
                status,
                processedBy: adminTelegramId,
                processedAt: new Date(),
            })
            .where(eq(pendingRegistrations.telegramId, telegramId));
    }
}
