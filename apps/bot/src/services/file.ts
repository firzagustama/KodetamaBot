import { db } from "@kodetama/db";
import { files } from "@kodetama/db/schema";

export interface SaveFileParams {
    userId: string;
    periodId?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    telegramFileId?: string;
}

/**
 * Save file metadata to the database
 */
export async function saveFileMetadata(params: SaveFileParams): Promise<string> {
    const [file] = await db.insert(files).values({
        userId: params.userId,
        periodId: params.periodId,
        fileName: params.fileName,
        fileType: params.fileType,
        fileSize: params.fileSize,
        telegramFileId: params.telegramFileId,
    }).returning({ id: files.id });

    return file.id;
}
