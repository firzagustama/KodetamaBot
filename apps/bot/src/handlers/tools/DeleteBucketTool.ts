import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService } from "@kodetama/shared";

export class DeleteBucketTool implements IToolHandler {
    readonly name = "deleteBucket";

    constructor(private budgetService: IBudgetService) { }

    async execute(args: any, { period }: ToolHandlerContext): Promise<string> {
        await this.budgetService.deleteBucket(period.id, args);
        return compactResult({ ok: true });
    }
}
