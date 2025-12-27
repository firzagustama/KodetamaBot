import { Period, TargetContext } from "@kodetama/shared";
import {
    upsertTransaction,
    deleteTransaction,
    getPeriodTotals,
    getTransactionHistory,
    searchTransactionsByKeyword,
} from "../../services/transaction.js";
import {
    upsertBucket,
    deleteBucket,
    getBudgetSummary,
} from "../../services/budget.js";
import { upsertPeriodWithBudget } from "../../services/period.js";
import { BotContext } from "../../types.js";
import { InlineKeyboard } from "grammy";

// Compact JSON helper - removes null/undefined and shortens keys
const compact = (obj: Record<string, any>): string => {
    const cleaned = Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v != null && v !== '')
    );
    return JSON.stringify(cleaned);
};

/**
 * Execute tool calls from AI and return results (token-optimized)
 */
export async function toolCalls(
    toolCallsList: any[],
    target: TargetContext,
    period: Period,
    ctx: BotContext
) {
    const results: any[] = [];

    for (const toolCall of toolCallsList) {
        const { id, function: func } = toolCall;
        const args = JSON.parse(func.arguments);

        try {
            let r: any;

            switch (func.name) {
                // CONFIRM TOOLS
                case "confirmTelegram":
                    let keyboard: InlineKeyboard | undefined = undefined;
                    for (const button of args.buttons) {
                        if (!keyboard) keyboard = new InlineKeyboard();
                        keyboard.text(button.text, `ai_${button.callback_data}`)
                    }
                    await ctx.reply(args.confirmationMessage, { reply_markup: keyboard })
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ ok: true })
                    })
                    break;
                // WRITE TOOLS
                case "upsertTransaction":
                    r = await upsertTransaction(target, period.id, args.input);
                    ctx.session.lastTransactionIds = [...ctx.session.lastTransactionIds.slice(-4), ...r.ids];
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ ok: true, ids: r.ids, remainingBucket: r.remainingBucket })
                    });
                    break;

                case "deleteTransaction":
                    r = await deleteTransaction(args.transactionId);
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ ok: r })
                    });
                    break;

                case "upsertBucket":
                    await upsertBucket(period, args);
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ ok: true, name: args.name })
                    });
                    break;

                case "deleteBucket":
                    await deleteBucket(period, args);
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ ok: true })
                    });
                    break;

                case "upsertPeriod":
                    console.log(args);
                    r = await upsertPeriodWithBudget(target, {
                        name: args.name,
                        copyFromPrevious: args.copyFromPrevious,
                    });
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ ok: true, pid: r.periodId, copied: r.budgetCopied })
                    });
                    break;

                // READ TOOLS
                case "getTransactionHistory":
                    r = await getTransactionHistory(target, period.id, {
                        limit: args.limit,
                        bucket: args.bucket,
                        type: args.type,
                        daysBack: args.daysBack,
                    });
                    // Compact: "id:type:amt:desc" per line
                    const txList = r.map((t: any) =>
                        `${t.id}:${t.type}:${t.amount}:${t.description?.slice(0, 15) ?? ''}`
                    ).join("|");
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ n: r.length, tx: txList })
                    });
                    break;

                case "getBudgetStatus":
                    const bs = await getBudgetSummary(target.targetId, period.id, !!target.groupId);
                    let buckets = bs?.budget.buckets ?? [];
                    if (args.bucketName) {
                        buckets = buckets.filter((b: any) =>
                            b.bucket.toLowerCase() === args.bucketName.toLowerCase()
                        );
                    }
                    // Compact: "name:alloc:spent:left"
                    const bktList = buckets.map((b: any) =>
                        `${b.bucket}:${b.amount}:${b.spent}:${b.remaining}`
                    ).join("|");
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ inc: bs?.budget.estimatedIncome, bkt: bktList })
                    });
                    break;

                case "searchTransactions":
                    r = await searchTransactionsByKeyword(target, period.id, args.query, args.limit ?? 10);
                    const searchList = r.map((t: any) =>
                        `${t.id}:${t.amount}:${t.description?.slice(0, 15) ?? ''}`
                    ).join("|");
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ q: args.query, n: r.length, tx: searchList })
                    });
                    break;

                case "getFinancialSummary":
                    const totals = await getPeriodTotals(target.userId!, period.id);
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({
                            in: totals.income,
                            out: totals.expense,
                            bal: totals.balance
                        })
                    });
                    break;

                default:
                    results.push({
                        role: "tool",
                        tool_call_id: id,
                        content: compact({ err: `Unknown: ${func.name}` })
                    });
            }

        } catch (error: any) {
            results.push({
                role: "tool",
                tool_call_id: id,
                content: compact({ err: error.message?.slice(0, 50) || "Failed" })
            });
        }
    }

    return results;
}