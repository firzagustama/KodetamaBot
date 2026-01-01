import { UpsertTransactionInput } from "@kodetama/ai";
import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService, ITransactionService } from "@kodetama/shared";

export class UpdateTransactionTool implements IToolHandler {
    readonly name = "updateTransaction";

    constructor(private transactionService: ITransactionService, private budgetService: IBudgetService) { }

    async execute(args: UpsertTransactionInput, { target, period }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const transactions = Array.isArray(args.input) ? args.input : [args.input];
        const ids: string[] = [];
        const buckets: string[] = [];

        for (const tx of transactions) {
            if (tx.confidence < 0.8) {
                return compactResult({ needConfirmation: true, candidate: tx })
            }
            buckets.push(tx.bucket);
            const res = await this.transactionService.updateTransaction({
                transaction: tx,
                targetId,
                periodId: period.id,
            });
            ids.push(res);
        }

        // Distinct usedBuckets
        const usedBuckets = [...new Set(buckets)];

        // Get remaining buckets
        const summary = await this.budgetService.getBudgetSummary(targetId, period.id);
        const remainingBuckets = summary?.spending.filter(sp => usedBuckets.includes(sp.bucket));
        return compactResult({ ok: true, ids, remainingBuckets });
    }
}