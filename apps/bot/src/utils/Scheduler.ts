import { ConversationAI } from "@kodetama/ai";
import { redisManager } from "@kodetama/shared";
import cron from "node-cron";

let ai: ConversationAI | undefined = undefined;

// Initialize shared instances
function getConversationAI(): ConversationAI {
    if (!ai) {
        ai = new ConversationAI({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL,
        });
    }
    return ai;
}

export class Scheduler {
    init() {
        // run every minutes
        cron.schedule("* * * * *", async () => {
            // Init AI
            const ai = getConversationAI();

            // Find all redis with key target:context:* that will be expired
            const client = await redisManager.getClient();
            const keys = await client.keys("target:context:*");
            for (const key of keys) {
                const ttl = await client.ttl(key);
                // Nearly expired
                if (ttl < 120) {
                    const targetId = key.split(":")[2];
                    await ai.createSummaryFromCache(targetId);
                }
            }
        });
    }
}