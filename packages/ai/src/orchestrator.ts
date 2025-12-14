import OpenAI from "openai";
import type { ParsedTransaction } from "@kodetama/shared";
import {
    PARSE_TRANSACTION_SYSTEM_PROMPT,
    PARSE_TRANSACTION_USER_PROMPT,
    BUDGET_SPLIT_SYSTEM_PROMPT,
    BUDGET_SPLIT_USER_PROMPT,
    MONTHLY_SUMMARY_SYSTEM_PROMPT,
    MONTHLY_SUMMARY_USER_PROMPT,
    GENERATE_DESCRIPTION_SYSTEM_PROMPT,
    GENERATE_DESCRIPTION_USER_PROMPT,
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
// DEVELOPMENT MOCKS
// =============================================================================

/**
 * Get mock parsed transaction based on message
 */
function getMockParsedTransaction(message: string): { result: ParsedTransaction; usage: UsageStats } {
    return {
        result: {
            message,
            transactions: [
                {
                    type: "expense",
                    amount: 25000, // Rp 25,000
                    category: "Makanan",
                    bucket: "needs",
                    description: `Biaya ${message.toLowerCase()}`,
                    confidence: 0.95,
                    needsConfirmation: false
                }
            ]
        },
        usage: {
            inputTokens: 50,
            outputTokens: 150,
            model: "dev-mock"
        }
    };
}

/**
 * Get mock budget split based on income
 */
function getMockBudgetSplit(income: number): { result: BudgetSplitResult; usage: UsageStats } {
    return {
        result: {
            needsPercentage: 50,
            wantsPercentage: 30,
            savingsPercentage: 20,
            needsAmount: income * 0.5,
            wantsAmount: income * 0.3,
            savingsAmount: income * 0.2,
            suggestions: [
                "Prioritaskan kebutuhan pokok seperti makanan dan transportasi",
                "Alokasikan 30% untuk keinginan yang wajar",
                "Simpan minimal 20% untuk darurat dan investasi"
            ],
            reasoning: "Berdasarkan analisis umum untuk pendapatan Rp " + income.toLocaleString('id-ID') +
                ", proporsi 50:30:20 adalah rekomendasi standar untuk Zero-Based Budgeting yang balance."
        },
        usage: {
            inputTokens: 75,
            outputTokens: 200,
            model: "dev-mock"
        }
    };
}

/**
 * Get mock monthly summary
 */
function getMockMonthlySummary(periodName: string): { result: MonthlySummaryResult; usage: UsageStats } {
    return {
        result: {
            summary: {
                totalIncome: 5000000, // Rp 5,000,000
                totalExpenses: 3500000, // Rp 3,500,000
                totalSavings: 1500000, // Rp 1,500,000
                netCashflow: 1500000   // Rp 1,500,000
            },
            topCategories: [
                { name: "Makanan", amount: 800000, percentage: 22.9 },
                { name: "Transportasi", amount: 600000, percentage: 17.1 },
                { name: "Belanja", amount: 500000, percentage: 14.3 },
                { name: "Hiburan", amount: 400000, percentage: 11.4 },
                { name: "Lainnya", amount: 1200000, percentage: 34.3 }
            ],
            insights: [
                "Pengeluaran Anda bulan ini 70% dari total pendapatan",
                "Kategori Makanan merupakan pengeluaran terbesar",
                "Anda berhasil menabung sesuai target budget"
            ],
            achievements: [
                "Berhasil menabung 30% dari pendapatan",
                "Pengeluaran kebutuhan di bawah 50%",
                "Tidak ada pengeluaran impulsif besar"
            ],
            suggestions: [
                "Pertimbangkan mengurangi pengeluaran makanan di luar rumah",
                "Coba gunakan transportasi umum lebih sering untuk hemat biaya",
                "Lanjutkan pola menabung yang baik ini"
            ],
            overallScore: 85,
            narrative: `Ringkasan keuangan untuk ${periodName} menunjukkan kinerja yang baik dengan skor 85/100. Total pendapatan Rp 5.000.000 dengan pengeluaran Rp 3.500.000, menghasilkan tabungan Rp 1.500.000. Pola pengeluaran Anda cukup sehat dengan fokus pada kebutuhan primer.`
        },
        usage: {
            inputTokens: 200,
            outputTokens: 400,
            model: "dev-mock"
        }
    };
}

/**
 * Get mock streaming response
 */
async function* getMockStreamResponse(userMessage: string): AsyncGenerator<string, void, unknown> {
    const mockResponse = `Terima kasih atas pertanyaan Anda tentang "${userMessage}". Ini adalah respons contoh dari sistem development yang mensimulasikan AI assistant untuk manajemen keuangan. Dalam mode production, sistem ini akan memberikan analisis yang lebih detail dan personal berdasarkan data keuangan Anda.`;

    const words = mockResponse.split(' ');
    for (const word of words) {
        yield word + ' ';
        // Simulate realistic typing delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// =============================================================================
// AI ORCHESTRATOR
// =============================================================================

export class AIOrchestrator {
    private client: OpenAI | undefined;
    private model: string;
    private isDevMode: boolean;

    constructor(config: AIConfig) {
        // Check if we're in development mode (API key not set or is placeholder)
        const apiKey = config.apiKey;
        this.isDevMode = !apiKey ||
            apiKey === "your_openrouter_api_key_here" ||
            !apiKey.startsWith("sk-"); // OpenRouter keys start with sk-

        if (!this.isDevMode) {
            this.client = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseURL ?? "https://openrouter.ai/api/v1",
            });
        }
        this.model = config.model ?? "openai/gpt-4-turbo";
    }

    /**
     * Parse a casual Indonesian financial message into structured transaction data
     */
    /**
     * Parse a casual Indonesian financial message into structured transaction data
     */
    async parseTransaction(
        message: string,
        budgetContext?: { buckets: string[] }
    ): Promise<{ result: ParsedTransaction; usage: UsageStats }> {
        if (this.isDevMode) {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 100));
            return getMockParsedTransaction(message);
        }

        if (!this.client) {
            throw new Error("OpenAI client not initialized");
        }

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: PARSE_TRANSACTION_SYSTEM_PROMPT },
                { role: "user", content: PARSE_TRANSACTION_USER_PROMPT(message, budgetContext) },
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
        if (this.isDevMode) {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 200));
            return getMockBudgetSplit(income);
        }

        if (!this.client) {
            throw new Error("OpenAI client not initialized");
        }

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
        if (this.isDevMode) {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 300));
            return getMockMonthlySummary(periodName);
        }

        if (!this.client) {
            throw new Error("OpenAI client not initialized");
        }

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
     * Generate a short description for a budget bucket
     */
    async generateBucketDescription(
        category: string,
        context?: string
    ): Promise<{ result: string; usage: UsageStats }> {
        if (this.isDevMode) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
                result: `Budget untuk ${category}`,
                usage: { inputTokens: 10, outputTokens: 5, model: "dev-mock" }
            };
        }

        if (!this.client) {
            throw new Error("OpenAI client not initialized");
        }

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: GENERATE_DESCRIPTION_SYSTEM_PROMPT },
                { role: "user", content: GENERATE_DESCRIPTION_USER_PROMPT(category, context) },
            ],
            temperature: 0.7,
        });

        return {
            result: response.choices[0]?.message?.content ?? "",
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
        if (this.isDevMode) {
            yield* getMockStreamResponse(userMessage);
            return;
        }

        if (!this.client) {
            throw new Error("OpenAI client not initialized");
        }

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