import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { ITransactionService } from "@kodetama/shared";

export class DeleteTransactionTool implements IToolHandler {
    readonly name = "deleteTransaction";

    constructor(private transactionService: ITransactionService) { }

    async execute(args: any, _context: ToolHandlerContext): Promise<string> {
        const ok = await this.transactionService.deleteTransaction(args.transactionId);
        return compactResult({ ok });
    }
}
