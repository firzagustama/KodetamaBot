import { db } from "@kodetama/db";
import { transactions, buckets } from "@kodetama/db/schema";
import { AIOrchestrator } from "@kodetama/ai";
import { eq, sql } from "drizzle-orm";

async function main() {
    console.log("Starting backfill...");

    const ai = new AIOrchestrator({
        apiKey: process.env.OPENROUTER_API_KEY ?? "",
        model: process.env.OPENROUTER_MODEL,
    });

    // 1. Backfill Transactions
    console.log("Backfilling transactions...");
    const txs = await db.select().from(transactions).where(sql`embedding IS NULL`);
    console.log(`Found ${txs.length} transactions without embeddings.`);

    for (const tx of txs) {
        if (!tx.description) continue;
        try {
            const { result } = await ai.generateEmbedding(tx.description);
            await db.update(transactions)
                .set({ embedding: result })
                .where(eq(transactions.id, tx.id));
            console.log(`Updated transaction ${tx.id}`);
        } catch (e) {
            console.error(`Failed to update transaction ${tx.id}:`, e);
        }
    }

    // 2. Backfill Buckets
    console.log("Backfilling buckets...");
    const bkts = await db.select().from(buckets).where(sql`embedding IS NULL`);
    console.log(`Found ${bkts.length} buckets without embeddings.`);

    for (const b of bkts) {
        try {
            const { result } = await ai.generateEmbedding(`${b.name}: ${b.description}`);
            await db.update(buckets)
                .set({ embedding: result })
                .where(eq(buckets.id, b.id));
            console.log(`Updated bucket ${b.id}`);
        } catch (e) {
            console.error(`Failed to update bucket ${b.id}:`, e);
        }
    }

    console.log("Backfill complete.");
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
