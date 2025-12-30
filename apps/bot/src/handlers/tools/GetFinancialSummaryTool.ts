import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { ITransactionService } from "@kodetama/shared";

export class GetFinancialSummaryTool implements IToolHandler {
    readonly name = "getFinancialSummary";

    constructor(private transactionService: ITransactionService) { }

    async execute(_args: any, { target, period }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const totals = await this.transactionService.getPeriodTotals(targetId, period.id);

        return compactResult({
            in: totals.income,
            out: totals.expense,
            bal: totals.balance
        });
    }
}
