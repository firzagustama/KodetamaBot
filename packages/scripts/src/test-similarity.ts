import { db } from "@kodetama/db";
import { transactions } from "@kodetama/db/schema";
import { AIOrchestrator } from "@kodetama/ai";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Testing similarity search...");

    const ai = new AIOrchestrator({
        apiKey: process.env.OPENROUTER_API_KEY ?? "",
        model: process.env.OPENROUTER_MODEL,
    });

    const query = "makan siang di warteg";
    console.log(`Query: "${query}"`);

    const { result: queryEmbedding } = await ai.generateEmbedding(query);

    // Use cosine similarity (<=> operator in pgvector)
    // The <=> operator returns the cosine distance, so smaller is more similar.
    // We order by distance and limit to top 5.
    const similarityResults = await db.select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        distance: sql<number>`${transactions.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`
    })
        .from(transactions)
        .where(sql`${transactions.embedding} IS NOT NULL`)
        .orderBy(sql`${transactions.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
        .limit(5);

    console.log("Top 5 similar transactions:");
    similarityResults.forEach((r, i) => {
        console.log(`${i + 1}. [${r.distance.toFixed(4)}] ${r.description} - Rp ${r.amount}`);
    });

    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
