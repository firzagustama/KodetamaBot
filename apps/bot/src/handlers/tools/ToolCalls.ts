import { Period } from "@kodetama/shared";
import { upsertTransaction, deleteTransaction, upsertBucket, deleteBucket } from "../../services/index.js";
import { BotContext } from "../../types.js";

export async function toolCalls(
    toolCalls: any[],
    target: any,
    period: Period,
    ctx: BotContext
) {
    const toolResults: any[] = [];

    for (const toolCall of toolCalls) {
        const { id, function: func } = toolCall;
        const args = JSON.parse(func.arguments);
        console.log(args)

        try {
            let result: any;

            switch (func.name) {
                case "upsertTransaction":
                    result = await upsertTransaction(target, period.id, args.input);
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

                case "upsertBucket":
                    result = await upsertBucket(period.id, args);
                    toolResults.push({
                        role: "tool",
                        tool_call_id: id,
                        content: JSON.stringify({
                            success: true,
                            message: "Bucket upserted successfully",
                        })
                    })
                    break;

                case "deleteBucket":
                    result = await deleteBucket(period, args);
                    toolResults.push({
                        role: "tool",
                        tool_call_id: id,
                        content: JSON.stringify({
                            success: true,
                            message: "Bucket deleted successfully",
                        })
                    })
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