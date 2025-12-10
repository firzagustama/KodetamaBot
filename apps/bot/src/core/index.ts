// Core application components - following SOLID principles
export { CommandHandler, type CommandExecutionResult } from "./CommandHandler.js";
export { CommandRegistry } from "./CommandRegistry.js";
export { BotConfiguration } from "./BotConfiguration.js";
export { BotRunner } from "./BotRunner.js";
export { MessageProcessor } from "./MessageProcessor.js";
export { getTargetContext, type TargetContext } from "./targetContext.js";