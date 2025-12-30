import { db } from "@kodetama/db";
import { files } from "@kodetama/db/schema";
import { IFileService } from "@kodetama/shared";

export class FileService implements IFileService {
    /**
     * Save file metadata to the database
     */
    async saveFileMetadata(params: {
        userId: string;
        periodId?: string;
        fileName: string;
        fileType: string;
        fileSize: number;
        telegramFileId?: string;
    }): Promise<string> {
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
}

// LEGACY: Keep for backward compatibility
export async function saveFileMetadata(params: any): Promise<string> {
    const service = new FileService();
    return await service.saveFileMetadata(params);
}
