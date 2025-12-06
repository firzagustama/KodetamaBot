import { createClient, RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

class RedisManager {
    private client: RedisClientType | null = null;

    async getClient(): Promise<RedisClientType> {
        if (!this.client) {
            this.client = createClient({ url: REDIS_URL });

            this.client.on("error", (err: any) => {
                console.error("Redis Client Error", err);
            });

            this.client.on("connect", () => {
                console.log("Redis Client Connected");
            });

            this.client.on("ready", () => {
                console.log("Redis Client Ready");
            });

            this.client.on("end", () => {
                console.log("Redis Client Disconnected");
            });

            await this.client.connect();
        }

        return this.client;
    }

    async get(key: string): Promise<string | null> {
        try {
            const client = await this.getClient();
            return await client.get(key);
        } catch (error) {
            console.error("Redis GET error:", error);
            return null;
        }
    }

    async set(key: string, value: string, expireSeconds?: number): Promise<void> {
        try {
            const client = await this.getClient();
            if (expireSeconds) {
                await client.setEx(key, expireSeconds, value);
            } else {
                await client.set(key, value);
            }
        } catch (error) {
            console.error("Redis SET error:", error);
        }
    }

    async del(key: string): Promise<void> {
        try {
            const client = await this.getClient();
            await client.del(key);
        } catch (error) {
            console.error("Redis DEL error:", error);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const client = await this.getClient();
            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            console.error("Redis EXISTS error:", error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.disconnect();
        }
    }
}

export const redisManager = new RedisManager();

// Key generation helpers
export function getOnboardingStateKey(userId: number): string {
    return `onboarding:user:${userId}`;
}

export function getOnboardingTTL(): number {
    // 24 hours for incomplete onboarding
    return 24 * 60 * 60;
}

export function getCompletedOnboardingTTL(): number {
    // 6 hours for completed onboarding (just in case user wants to restart)
    return 6 * 60 * 60;
}