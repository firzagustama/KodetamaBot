import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

class RedisManager {
    private client: any = null;
    private connectionPromise: Promise<any> | null = null;

    async getClient(): Promise<any> {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = (async () => {
            const client = createClient({ url: REDIS_URL });

            client.on("error", (err: any) => {
                console.error("Redis Client Error", err);
            });

            client.on("connect", () => {
                console.log("Redis Client Connected");
            });

            client.on("ready", () => {
                console.log("Redis Client Ready");
            });

            client.on("end", () => {
                console.log("Redis Client Disconnected");
                this.client = null;
                this.connectionPromise = null;
            });

            await client.connect();
            this.client = client;
            return client;
        })();

        return this.connectionPromise;
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

export function getTargetContextKey(targetId: string): string {
    return `target:context:${targetId}`;
}

export function getOnboardingTTL(): number {
    // 24 hours for incomplete onboarding
    return 24 * 60 * 60;
}

export function getCompletedOnboardingTTL(): number {
    // 6 hours for completed onboarding (just in case user wants to restart)
    return 6 * 60 * 60;
}