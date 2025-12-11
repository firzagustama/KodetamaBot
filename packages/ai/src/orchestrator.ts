import OpenAI from "openai";
import type { ParsedTransaction } from "@kodetama/shared";
import {
    PARSE_TRANSACTION_SYSTEM_PROMPT,
    PARSE_TRANSACTION_USER_PROMPT,
    BUDGET_SPLIT_SYSTEM_PROMPT,
    BUDGET_SPLIT_USER_PROMPT,
    MONTHLY_SUMMARY_SYSTEM_PROMPT,
    MONTHLY_SUMMARY_USER_PROMPT,
} from "./prompts/index.js";

// =============================================================================
// TYPES
// =============================================================================

export interface AIConfig {
    apiKey: string;
    model?: string;
    baseURL?: string;
}

export interface BudgetSplitResult {
    needsPercentage: number;
    wantsPercentage: number;
    savingsPercentage: number;
    needsAmount: number;
    wantsAmount: number;
    savingsAmount: number;
    suggestions: string[];
    reasoning: string;
}

export interface MonthlySummaryResult {
    summary: {
        totalIncome: number;
        totalExpenses: number;
        totalSavings: number;
        netCashflow: number;
    };
    topCategories: { name: string; amount: number; percentage: number }[];
    insights: string[];
    achievements: string[];
    suggestions: string[];
    overallScore: number;
    narrative: string;
}

export interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    model: string;
}

// =============================================================================
// AI ORCHESTRATOR
// =============================================================================

export class AIOrchestrator {
    private client: OpenAI;
    private model: string;

    constructor(config: AIConfig) {
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL ?? "https://openrouter.ai/api/v1",
        });
        this.model = config.model ?? "openai/gpt-4-turbo";
    }

    /**
     * Parse a casual Indonesian financial message into structured transaction data
     */
    async parseTransaction(
        message: string
    ): Promise<{ result: ParsedTransaction; usage: UsageStats }> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: PARSE_TRANSACTION_SYSTEM_PROMPT },
                { role: "user", content: PARSE_TRANSACTION_USER_PROMPT(message) },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3, // Lower temperature for more consistent parsing
        });

        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content) as ParsedTransaction;

        return {
            result: parsed,
            usage: {
                inputTokens: response.usage?.prompt_tokens ?? 0,
                outputTokens: response.usage?.completion_tokens ?? 0,
                model: this.model,
            },
        };
    }

    /**
     * Generate a smart budget split for ZBB onboarding
     */
    async generateBudgetSplit(
        income: number,
        context?: string
    ): Promise<{ result: BudgetSplitResult; usage: UsageStats }> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: BUDGET_SPLIT_SYSTEM_PROMPT },
                { role: "user", content: BUDGET_SPLIT_USER_PROMPT(income, context) },
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
        });

        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content) as BudgetSplitResult;

        return {
            result: parsed,
            usage: {
                inputTokens: response.usage?.prompt_tokens ?? 0,
                outputTokens: response.usage?.completion_tokens ?? 0,
                model: this.model,
            },
        };
    }

    /**
     * Generate a monthly financial summary (Pro tier)
     */
    async generateMonthlySummary(
        periodName: string,
        transactions: object[],
        budget: object
    ): Promise<{ result: MonthlySummaryResult; usage: UsageStats }> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: MONTHLY_SUMMARY_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: MONTHLY_SUMMARY_USER_PROMPT(
                        periodName,
                        JSON.stringify(transactions, null, 2),
                        JSON.stringify(budget, null, 2)
                    ),
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
        });

        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content) as MonthlySummaryResult;

        return {
            result: parsed,
            usage: {
                inputTokens: response.usage?.prompt_tokens ?? 0,
                outputTokens: response.usage?.completion_tokens ?? 0,
                model: this.model,
            },
        };
    }

    /**
     * Stream a conversational response (for chat interactions)
     */
    async *streamResponse(
        systemPrompt: string,
        userMessage: string
    ): AsyncGenerator<string, void, unknown> {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }
}
