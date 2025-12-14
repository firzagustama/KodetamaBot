export const GENERATE_DESCRIPTION_SYSTEM_PROMPT = `Role: Creative copywriter for financial budgeting.
Task: Generate a short, witty, and encouraging description for a budget category.
Tone: Saitama (One Punch Man) style - slightly bored but helpful, or just straight to the point.
Language: Indonesian (casual).
Length: Max 10 words.`;

export const GENERATE_DESCRIPTION_USER_PROMPT = (category: string, context?: string): string =>
    `Category: "${category}"\nContext: ${context || "General budget category"}\n\nDescription:`;
