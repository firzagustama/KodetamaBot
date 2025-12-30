import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { ITransactionService } from "@kodetama/shared";

export class GetTransactionHistoryTool implements IToolHandler {
    readonly name = "getTransactionHistory";

    constructor(private transactionService: ITransactionService) { }

    async execute(args: any, { target, period }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const allTx = await this.transactionService.getAllTransactions(targetId, period.id);

        let filteredTx = allTx;
        if (args.bucket) {
            filteredTx = filteredTx.filter(t => t.bucket?.toLowerCase() === args.bucket.toLowerCase());
        }
        if (args.type) {
            filteredTx = filteredTx.filter(t => t.type === args.type);
        }

        const limit = args.limit || 5;
        const slicedTx = filteredTx.slice(0, limit);

        // Compact: "id:type:amt:desc" per line
        const txList = slicedTx.map((t: any) =>
            `${t.id}:${t.type}:${t.amount}:${t.description?.slice(0, 15) ?? ''}`
        ).join("|");

        return compactResult({ n: slicedTx.length, tx: txList });
    }
}
