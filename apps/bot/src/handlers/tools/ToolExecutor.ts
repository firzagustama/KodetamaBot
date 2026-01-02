import { Period, TargetContext } from "@kodetama/shared";
import { BotContext } from "../../types.js";
import { AIOrchestrator } from "@kodetama/ai";

export interface ToolHandlerContext {
    target: TargetContext;
    period: Period;
    ctx: BotContext;
    orchestrator: AIOrchestrator;
}

export interface IToolHandler {
    readonly name: string;
    execute(args: any, context: ToolHandlerContext): Promise<any>;
}

/**
 * Compact JSON helper - removes null/undefined and shortens keys
 */
export const compactResult = (obj: Record<string, any>): string => {
    const cleaned = Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v != null && v !== '')
    );
    return JSON.stringify(cleaned);
};

export class ToolExecutor {
    private handlers: Map<string, IToolHandler> = new Map();

    constructor(private orchestrator: AIOrchestrator) { }

    register(handler: IToolHandler): void {
        this.handlers.set(handler.name, handler);
    }

    async execute(
        toolCallsList: any[],
        target: TargetContext,
        period: Period,
        ctx: BotContext
    ): Promise<any[]> {
        const results: any[] = [];
        const context: ToolHandlerContext = { target, period, ctx, orchestrator: this.orchestrator };

        for (const toolCall of toolCallsList) {
            const { id, function: func } = toolCall;
            const args = JSON.parse(func.arguments);
            const handler = this.handlers.get(func.name);

            try {
                if (!handler) {
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compactResult({ err: `Unknown tool: ${func.name}` })
                    });
                    continue;
                }

                const result = await handler.execute(args, context);
                results.push({
                    role: "tool",
                    tool_call_id: id,
                    content: result
                });
            } catch (error: any) {
                console.error(`Error executing tool ${func.name}:`, error);
                results.push({
                    role: "tool",
                    tool_call_id: id,
                    content: compactResult({ err: error.message?.slice(0, 50) || "Failed" })
                });
            }
        }

        return results;
    }
}
