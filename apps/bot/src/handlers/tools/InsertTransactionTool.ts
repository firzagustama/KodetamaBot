import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IBudgetService, ITransactionService } from "@kodetama/shared";

export class InsertTransactionTool implements IToolHandler {
    readonly name = "insertTransaction";

    constructor(private transactionService: ITransactionService, private budgetService: IBudgetService) { }

    async execute(args: any, { target, period, ctx, orchestrator }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const transactions = Array.isArray(args.input) ? args.input : [args.input];
        const ids: string[] = [];
        const buckets: string[] = [];

        let error: any[] = [];
        for (const tx of transactions) {
            if (tx.amount < 0) {
                error.push(`${tx.name} amount must be greater than 0`);
            }
            if (tx.confidence < 0.8) {
                error.push(`${tx.name} not confidence enough, confirm "${tx.confirmationMessage}"`);
            }
        }
        if (error.length > 0) {
            return compactResult({ ok: false, error });
        }

        for (const tx of transactions) {
            buckets.push(tx.bucket);

            const { result: embedding } = await orchestrator.generateEmbedding(`Desc: ${tx.description}, Category: ${tx.category}, Bucket: ${tx.bucket}`);
            tx.embedding = embedding;

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
        return compactResult({ ok: true, ids, remainingBuckets });
    }
}
