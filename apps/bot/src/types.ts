import type { Context, SessionFlavor } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { Tier } from "@kodetama/shared";

// =============================================================================
// SESSION DATA
// =============================================================================

export interface RegistrationData {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    selectedTier: Tier;
    registrationId?: string;
}

export interface OnboardingData {
    estimatedIncome?: number;
    needsPercentage?: number;
    wantsPercentage?: number;
    savingsPercentage?: number;
    periodMonth?: number;
    periodYear?: number;
    incomeDate?: number;
    isIncomeUncertain?: boolean;
    useAiRecommendation?: boolean;
}

export interface PendingTransactionData {
    parsed: any; // Parsed AI result
    usage: any; // AI usage data
    userId: string; // User ID
    rawMessage: string; // Original message
}

export interface SessionData {
    step: string;
    registrationData: RegistrationData | null;
    onboardingData: OnboardingData | null;
    lastTransactionId: string | null;
    pendingTransaction: PendingTransactionData | null;
}

// =============================================================================
// CONTEXT TYPE
// =============================================================================

export type BotContext = Context &
    SessionFlavor<SessionData> &
    ConversationFlavor &
    HydrateFlavor<Context>;

// =============================================================================
// CONVERSATION CONTEXT
// =============================================================================

export type ConversationContext = BotContext;