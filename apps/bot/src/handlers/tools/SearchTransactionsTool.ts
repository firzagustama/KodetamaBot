import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { ITransactionService } from "@kodetama/shared";

export class SearchTransactionsTool implements IToolHandler {
    readonly name = "searchTransactions";

    constructor(private transactionService: ITransactionService) { }

    async execute(args: any, { target, period }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const r = await this.transactionService.searchTransactionsByKeyword(targetId, period.id, args.query);

        const searchList = r.slice(0, args.limit ?? 10).map((t: any) =>
            `${t.id}:${t.amount}:${t.description?.slice(0, 15) ?? ''}`
        ).join("|");

        return compactResult({ q: args.query, n: r.length, tx: searchList });
    }
}
