import { AIOrchestrator } from "@kodetama/ai";
import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { ITransactionService } from "@kodetama/shared";

export class SearchTransactionsTool implements IToolHandler {
    readonly name = "searchTransactions";

    constructor(private transactionService: ITransactionService) { }

    async execute(args: any, { target, period }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;

        const ai = new AIOrchestrator({
            apiKey: process.env.OPENROUTER_API_KEY ?? "",
            model: process.env.OPENROUTER_MODEL,
        });
        const { result: queryEmbedding } = await ai.generateEmbedding(args.query);

        const treshold = 0.25;
        const r = await this.transactionService.searchTransactionsByVector(targetId, period.id, queryEmbedding, treshold);

        const searchList = r.slice(0, args.limit ?? 10).map((t: any) =>
            `${t.id}:${t.amount}:${t.description?.slice(0, 15) ?? ''}`
        ).join("|");

        return compactResult({ q: args.query, n: r.length, tx: searchList });
    }
}
