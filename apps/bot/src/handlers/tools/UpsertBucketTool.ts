import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService } from "@kodetama/shared";

export class UpsertBucketTool implements IToolHandler {
    readonly name = "upsertBucket";

    constructor(private budgetService: IBudgetService) { }

    async execute(args: any, { period }: ToolHandlerContext): Promise<string> {
        await this.budgetService.upsertBucket(period.id, args);
        return compactResult({ ok: true, name: args.name });
    }
}
