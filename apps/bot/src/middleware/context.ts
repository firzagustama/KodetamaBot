import { NextFunction } from "grammy";
import { BotContext } from "../types.js";
import { getTargetContext } from "../core/targetContext.js";
import { IUserService, IPeriodService } from "@kodetama/shared";

/**
 * Middleware factory to populate context with user, target, and period information.
 * This runs for every update, so it must be efficient and non-blocking.
 */
export function createContextMiddleware(userService: IUserService, periodService: IPeriodService) {
    return async (ctx: BotContext, next: NextFunction) => {
        const user = ctx.from;
        if (!user) {
            return next();
        }

        try {
            // 1. Get User Context
            // We try to fetch the user. If not found, we just proceed (e.g. for new users)
            const userContext = await userService.getUserByTelegramId(user.id);

            if (userContext) {
                ctx.userContext = userContext;

                // 2. Get Target Context
                // We attempt to resolve the target context (private vs group).
                // getTargetContext might throw if the user is not in the group or other validation fails.
                // We catch these errors and ignore them here, allowing specific handlers to enforce requirements later.
                try {
                    // Note: We are calling getTargetContext which might be modified to check ctx.targetContext.
                    // Since ctx.targetContext is undefined here, it will run the resolution logic.
                    const target = await getTargetContext(ctx);
                    ctx.targetContext = target;

                    // 3. Get Period Context
                    // Only if we have a valid target, we try to fetch the current period.
                    if (target) {
                        const targetId = target.groupId || target.userId!;
                        const period = await periodService.getCurrentPeriod(targetId);
                        if (period) {
                            ctx.periodContext = period;
                        }
                    }
                } catch (error) {
                    // Ignore target resolution errors (e.g. "User not member", "Group not found")
                    // This is expected for some interactions (e.g. /start in a new group)
                }
            }
        } catch (error) {
            console.error("Error in context middleware:", error);
            // Ensure we don't block the bot even if middleware fails
        }

        await next();
    };
}
