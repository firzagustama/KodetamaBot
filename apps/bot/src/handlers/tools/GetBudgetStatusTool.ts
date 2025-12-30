import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService } from "@kodetama/shared";

export class GetBudgetStatusTool implements IToolHandler {
    readonly name = "getBudgetStatus";

    constructor(private budgetService: IBudgetService) { }

    async execute(args: any, { target, period }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const bs = await this.budgetService.getBudgetSummary(targetId, period.id);

        let buckets = bs?.budget.buckets ?? [];
        if (args.bucketName) {
            buckets = buckets.filter((b: any) =>
                b.name.toLowerCase() === args.bucketName.toLowerCase()
            );
        }

        // Compact: "name:alloc:spent:left"
        const bktList = buckets.map((b: any) =>
            `${b.name}:${b.amount}:${b.spent || 0}:${b.remaining || 0}`
        ).join("|");

        return compactResult({ inc: bs?.budget.estimatedIncome, bkt: bktList });
    }
}
