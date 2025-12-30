import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { ITransactionService } from "@kodetama/shared";

export class UpsertTransactionTool implements IToolHandler {
    readonly name = "upsertTransaction";

    constructor(private transactionService: ITransactionService) { }

    async execute(args: any, { target, period, ctx }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const transactions = Array.isArray(args.input) ? args.input : [args.input];
        const ids: string[] = [];

        for (const tx of transactions) {
            const res = await this.transactionService.saveTransaction({
                targetId,
                userId: target.userId!,
                periodId: period.id,
                transaction: tx,
                rawMessage: ctx.message?.text || ""
            });
            ids.push(res);
        }

        ctx.session.lastTransactionIds = [...ctx.session.lastTransactionIds.slice(-4), ...ids];

        return compactResult({ ok: true, ids });
    }
}
