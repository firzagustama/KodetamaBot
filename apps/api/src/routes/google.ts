import type { FastifyInstance } from "fastify";
import { google } from "googleapis";
import { db } from "@kodetama/db";
import { googleTokens, googleSheets, googleDriveFolders, datePeriods } from "@kodetama/db/schema";
import { eq, and } from "drizzle-orm";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

function createOAuth2Client() {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );
}

export async function googleRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /google/auth
     * Get Google OAuth URL
     */
    fastify.get<{
        Querystring: { userId?: string };
    }>("/auth", async (request) => {
        const { userId } = request.query;
        const oauth2Client = createOAuth2Client();

        const scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file",
        ];

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent",
            state: userId ?? "",
        });

        return { authUrl };
    });

    /**
     * GET /google/callback
     * Handle Google OAuth callback
     */
    fastify.get<{
        Querystring: { code?: string; error?: string; state?: string };
    }>("/callback", async (request, reply) => {
        const { code, error, state: userId } = request.query;

        if (error) {
            return reply.status(400).send({ error });
        }

        if (!code) {
            return reply.status(400).send({ error: "No code provided" });
        }

        if (!userId) {
            return reply.status(400).send({ error: "No user ID in state" });
        }

        try {
            const oauth2Client = createOAuth2Client();
            const { tokens } = await oauth2Client.getToken(code);

            await db
                .insert(googleTokens)
                .values({
                    userId,
                    accessToken: tokens.access_token ?? "",
                    refreshToken: tokens.refresh_token ?? null,
                    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                    scope: tokens.scope ?? null,
                })
                .onConflictDoUpdate({
                    target: googleTokens.userId,
                    set: {
                        accessToken: tokens.access_token ?? "",
                        refreshToken: tokens.refresh_token ?? null,
                        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                        scope: tokens.scope ?? null,
                    },
                });

            return { success: true, message: "Google account connected" };
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: "Failed to exchange code" });
        }
    });

    /**
     * POST /google/sheets/export
     */
    fastify.post<{
        Body: { userId: string; periodId: string };
    }>("/sheets/export", async (request, reply) => {
        const { userId, periodId } = request.body;

        const tokens = await db.query.googleTokens.findFirst({
            where: eq(googleTokens.userId, userId),
        });

        if (!tokens) {
            return reply.status(400).send({ error: "Google not connected" });
        }

        return {
            success: true,
            periodId,
            spreadsheetId: "sample-spreadsheet-id",
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sample",
        };
    });

    /**
     * GET /google/sheets/current
     */
    fastify.get<{
        Querystring: { userId?: string };
    }>("/sheets/current", async (request) => {
        const { userId } = request.query;

        if (!userId) {
            return { spreadsheetId: null, spreadsheetUrl: null, lastSyncAt: null };
        }

        const period = await db.query.datePeriods.findFirst({
            where: and(eq(datePeriods.userId, userId), eq(datePeriods.isCurrent, true)),
        });

        if (!period) {
            return { spreadsheetId: null, spreadsheetUrl: null, lastSyncAt: null };
        }

        const sheet = await db.query.googleSheets.findFirst({
            where: eq(googleSheets.periodId, period.id),
        });

        if (!sheet) {
            return { spreadsheetId: null, spreadsheetUrl: null, lastSyncAt: null };
        }

        return {
            spreadsheetId: sheet.spreadsheetId,
            spreadsheetUrl: sheet.spreadsheetUrl,
            lastSyncAt: sheet.lastSyncAt?.toISOString() ?? null,
        };
    });

    /**
     * GET /google/drive/folder
     */
    fastify.get<{
        Querystring: { userId?: string };
    }>("/drive/folder", async (request) => {
        const { userId } = request.query;

        if (!userId) {
            return { folderId: null, folderUrl: null };
        }

        const period = await db.query.datePeriods.findFirst({
            where: and(eq(datePeriods.userId, userId), eq(datePeriods.isCurrent, true)),
        });

        if (!period) {
            return { folderId: null, folderUrl: null };
        }

        const folder = await db.query.googleDriveFolders.findFirst({
            where: eq(googleDriveFolders.periodId, period.id),
        });

        if (!folder) {
            return { folderId: null, folderUrl: null };
        }

        return {
            folderId: folder.folderId,
            folderUrl: folder.folderUrl,
        };
    });

    /**
     * POST /google/drive/upload
     */
    fastify.post<{
        Body: { userId: string; periodId: string; fileBase64: string; fileName: string; mimeType: string };
    }>("/drive/upload", async (request, reply) => {
        const { userId, periodId } = request.body;

        const tokens = await db.query.googleTokens.findFirst({
            where: eq(googleTokens.userId, userId),
        });

        if (!tokens) {
            return reply.status(400).send({ error: "Google not connected" });
        }

        return {
            success: true,
            periodId,
            fileId: "sample-file-id",
            webViewLink: "https://drive.google.com/file/d/sample",
        };
    });
}
