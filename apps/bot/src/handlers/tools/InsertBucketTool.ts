import { InsertBucketInput } from "@kodetama/ai";
import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService } from "@kodetama/shared";

export class InsertBucketTool implements IToolHandler {
    readonly name = "insertBucket";

    constructor(private budgetService: IBudgetService) { }

    async execute(args: InsertBucketInput, { period, orchestrator }: ToolHandlerContext): Promise<string> {
        const { result: embedding } = await orchestrator.generateEmbedding(`Name: ${args.name}, Desc: ${args.description}`);
        args.embedding = embedding;

        await this.budgetService.insertBucket(period.id, args);
        return compactResult({ ok: true, name: args.name });
    }
}
