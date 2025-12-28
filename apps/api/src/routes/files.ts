import type { FastifyInstance } from "fastify";
import { db } from "@kodetama/db";
import { files } from "@kodetama/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { authenticate } from "../middleware/auth.js";

export async function filesRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/files/:id
     * Redirect to Telegram file URL
     */
    fastify.get<{
        Params: { id: string };
    }>("/:id", async (request, reply) => {
        const { id } = request.params;

        try {
            // 1. Get telegramFileId from DB
            const file = await db.query.files.findFirst({
                where: eq(files.id, id),
            });

            if (!file || !file.telegramFileId) {
                return reply.status(404).send({ error: "File not found" });
            }

            // 2. Get fresh file path from Telegram
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${file.telegramFileId}`;

            const response = await fetch(getFileUrl);
            const data = (await response.json()) as any;

            if (!data.ok || !data.result?.file_path) {
                logger.error("Failed to get file path from Telegram", { data });
                return reply.status(500).send({ error: "Failed to retrieve file from Telegram" });
            }

            // 3. Proxy the image from Telegram
            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;

            const imageResponse = await fetch(fileUrl);
            if (!imageResponse.ok) {
                return reply.status(500).send({ error: "Failed to fetch image from Telegram" });
            }

            let contentType = imageResponse.headers.get("content-type") || "image/jpeg";

            // If Telegram returns generic stream, try to guess from filename
            if (contentType === "application/octet-stream" && file.fileName) {
                const ext = file.fileName.split(".").pop()?.toLowerCase();
                if (ext === "png") contentType = "image/png";
                else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
                else if (ext === "webp") contentType = "image/webp";
                else if (ext === "pdf") contentType = "application/pdf";
            }

            const buffer = await imageResponse.arrayBuffer();

            return reply
                .type(contentType)
                .header("Content-Disposition", "inline; filename=" + file.fileName)
                .header("X-Content-Type-Options", "nosniff")
                .send(Buffer.from(buffer));
        } catch (error) {
            logger.error("Error in file redirection", { id, error });
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
}
