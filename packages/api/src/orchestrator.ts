import type { ParsedTransaction } from "@kodetama/shared";

// =============================================================================
// TYPES (copied from AI package to avoid direct dependency)
// =============================================================================

export interface AIConfig {
    apiKey: string;
    model?: string;
    baseURL?: string;
}

export interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    model: string;
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

// =============================================================================
// DEVELOPMENT ORCHESTRATOR (Mock responses)
// =============================================================================

/**
 * Development orchestrator that provides mock AI responses without calling external APIs
 * Automatically enabled when OPENROUTER_API_KEY is not properly configured
 */
export class DevelopmentOrchestrator {
    private isDevMode: boolean;

    constructor() {
        // Check if we're in development mode (API key not set or is placeholder)
        const apiKey = process.env.OPENROUTER_API_KEY ?? "";
        this.isDevMode = !apiKey ||
            apiKey === "your_openrouter_api_key_here" ||
            apiKey.startsWith("sk-") === false; // OpenRouter keys start with sk-
    }

    /**
     * Check if currently using development/mocked responses
     */
    isDevelopmentMode(): boolean {
        return this.isDevMode;
    }

    /**
     * Parse a casual Indonesian financial message into structured transaction data
     * Returns mock data for development
     */
    async parseTransaction(
        message: string
    ): Promise<{ result: ParsedTransaction; usage: UsageStats }> {
        if (!this.isDevMode) {
            throw new Error("Development orchestrator should only be used in development mode");
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));

        const mockResult: ParsedTransaction = {
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
        };

        return {
            result: mockResult,
            usage: {
                inputTokens: 50,
                outputTokens: 150,
                model: "dev-mock"
            }
        };
    }

    /**
     * Generate a smart budget split for ZBB onboarding
     * Returns mock budget allocation for development
     */
    async generateBudgetSplit(
        income: number,
        context?: string
    ): Promise<{ result: BudgetSplitResult; usage: UsageStats }> {
        if (!this.isDevMode) {
            throw new Error("Development orchestrator should only be used in development mode");
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 200));

        const mockResult: BudgetSplitResult = {
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
        };

        return {
            result: mockResult,
            usage: {
                inputTokens: 75,
                outputTokens: 200,
                model: "dev-mock"
            }
        };
    }

    /**
     * Generate a monthly financial summary (Pro tier)
     * Returns mock financial summary for development
     */
    async generateMonthlySummary(
        periodName: string,
        transactions: object[],
        budget: object
    ): Promise<{ result: MonthlySummaryResult; usage: UsageStats }> {
        if (!this.isDevMode) {
            throw new Error("Development orchestrator should only be used in development mode");
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 300));

        const mockResult: MonthlySummaryResult = {
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
        };

        return {
            result: mockResult,
            usage: {
                inputTokens: 200,
                outputTokens: 400,
                model: "dev-mock"
            }
        };
    }

    /**
     * Stream a conversational response (for chat interactions)
     * Returns mock streaming response for development
     */
    async *streamResponse(
        systemPrompt: string,
        userMessage: string
    ): AsyncGenerator<string, void, unknown> {
        if (!this.isDevMode) {
            throw new Error("Development orchestrator should only be used in development mode");
        }

        const mockResponse = `Terima kasih atas pertanyaan Anda tentang "${userMessage}". Ini adalah respons contoh dari sistem development yang mensimulasikan AI assistant untuk manajemen keuangan. Dalam mode production, sistem ini akan memberikan analisis yang lebih detail dan personal berdasarkan data keuangan Anda.`;

        const words = mockResponse.split(' ');
        for (const word of words) {
            yield word + ' ';
            // Simulate realistic typing delay
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}