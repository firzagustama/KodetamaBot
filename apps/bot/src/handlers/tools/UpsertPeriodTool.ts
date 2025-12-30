import { IToolHandler, ToolHandlerContext, compactResult } from "./ToolExecutor.js";
import { IPeriodService } from "@kodetama/shared";

export class UpsertPeriodTool implements IToolHandler {
    readonly name = "upsertPeriod";

    constructor(private periodService: IPeriodService) { }

    async execute(args: any, { target }: ToolHandlerContext): Promise<string> {
        const targetId = target.groupId || target.userId!;
        const pid = await this.periodService.upsertPeriodWithBudget(targetId, {
            name: args.name,
            copyFromPrevious: args.copyFromPrevious,
        });
        return compactResult({ ok: true, pid });
    }
}
