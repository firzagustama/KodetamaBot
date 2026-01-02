import { UpdateBucketInput } from "@kodetama/ai";
import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService } from "@kodetama/shared";

export class UpdateBucketTool implements IToolHandler {
    readonly name = "updateBucket";

    constructor(private budgetService: IBudgetService) { }

    async execute(args: UpdateBucketInput, { period, orchestrator }: ToolHandlerContext): Promise<string> {
        const { result: embedding } = await orchestrator.generateEmbedding(`Name: ${args.name}, Desc: ${args.description}`);
        args.embedding = embedding;

        await this.budgetService.updateBucket(period.id, args);
        return compactResult({ ok: true, name: args.name });
    }
}
