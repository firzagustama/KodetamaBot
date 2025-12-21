import { upsertTransaction, deleteTransaction } from "../../services";
import { BotContext } from "../../types";

export async function toolCalls(
    toolCalls: any[],
    target: any,
    periodId: string,
    ctx: BotContext
) {
    const toolResults: any[] = [];

    for (const toolCall of toolCalls) {
        const { id, function: func } = toolCall;
        const args = JSON.parse(func.arguments);

        try {
            let result: any;

            switch (func.name) {
                case "upsertTransaction":
                    result = await upsertTransaction(target, periodId, args);
                    ctx.session.lastTransactionIds.slice(-5).push(result);
                    toolResults.push({
                        role: "tool",
                        tool_call_id: id,
                        content: JSON.stringify({
                            success: true,
                            message: "Transaction upserted successfully",
                            data: {
                                transactionId: result
                            },
                            // Proactive hint for AI
                            suggest: "Ask if user wants to undo or add more transactions"
                        })
                    });
                    break;

                case "deleteTransaction":
                    result = await deleteTransaction(args.transactionId);
                    toolResults.push({
                        role: "tool",
                        tool_call_id: id,
                        content: JSON.stringify({
                            success: true,
                            message: "Transaction deleted successfully",
                        })
                    });
                    break;

                case "getBudgetSummary":
                    // TODO: Implement getBudgetSummary
                    break;

                case "getTransactionHistory":
                    // TODO: Implement getTransactionHistory
                    break;

                case "checkBudgetStatus":
                    // TODO: Implement checkBudgetStatus
                    break;

                default:
                    toolResults.push({
                        role: "tool",
                        tool_call_id: id,
                        content: JSON.stringify({
                            success: false,
                            error: `Unknown tool: ${func.name}`
                        })
                    });
            }

        } catch (error: any) {
            toolResults.push({
                role: "tool",
                tool_call_id: id,
                content: JSON.stringify({
                    needsConfirmation: true,
                    error: error.message || "Tool execution failed"
                })
            });
        }
    }

    return toolResults;
}