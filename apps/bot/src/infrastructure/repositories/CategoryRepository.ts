import { db } from "@kodetama/db";
import { categories } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";
import type { ICategoryRepository, Category } from "@kodetama/shared";

export class CategoryRepository implements ICategoryRepository {
    async findById(id: string): Promise<Category | null> {
        const result = await db.query.categories.findFirst({
            where: eq(categories.id, id)
        });
        return result || null;
    }

    async findByTargetId(targetId: string): Promise<Category[]> {
        return await db.query.categories.findMany({
            where: eq(categories.targetId, targetId)
        });
    }

    async findOrCreate(targetId: string, categoryName: string, bucket?: string): Promise<string> {
        const existing = await db.query.categories.findFirst({
            where: and(
                eq(categories.targetId, targetId),
                eq(categories.name, categoryName)
            )
        });

        if (existing) {
            return existing.id;
        }

        const [newCategory] = await db.insert(categories).values({
            targetId,
            name: categoryName,
            bucket: bucket || null,
            isDefault: false
        }).returning({ id: categories.id });

        return newCategory.id;
    }

    async save(category: Omit<Category, "id" | "createdAt">): Promise<string> {
        const [result] = await db.insert(categories).values(category).returning({ id: categories.id });
        return result.id;
    }
}
