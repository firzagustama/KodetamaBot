import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService, ITransactionService } from "@kodetama/shared";

export class UpsertTransactionTool implements IToolHandler {
    readonly name = "upsertTransaction";

    constructor(private transactionService: ITransactionService, private budgetService: IBudgetService) { }

    async execute(args: any, { target, period, ctx }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const transactions = Array.isArray(args.input) ? args.input : [args.input];
        const ids: string[] = [];
        const buckets: string[] = [];

        for (const tx of transactions) {
            buckets.push(tx.bucket);
            const res = await this.transactionService.saveTransaction({
                targetId,
                userId: target.userId!,
                periodId: period.id,
                transaction: tx,
                rawMessage: ctx.message?.text || ""
            });
            ids.push(res);
        }

        // Distinct usedBuckets
        const usedBuckets = [...new Set(buckets)];

        // Get remaining buckets
        const summary = await this.budgetService.getBudgetSummary(targetId, period.id);
        const remainingBuckets = summary?.spending.filter(sp => usedBuckets.includes(sp.bucket));

        console.log(usedBuckets)
        console.log(remainingBuckets);
        return compactResult({ ok: true, ids, remainingBuckets });
    }
}
