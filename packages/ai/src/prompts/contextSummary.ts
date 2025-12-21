export const CONTEXT_SUMMARY_USER_PROMPT = (oldSummary: string, recentConversation: string): string =>
    `Rewrite the following user context summary.
Rules:
- Max 5 sentences
- No numbers or totals
- Describe user intent and habits
- Use tentative language
- Do not include raw transactions

Current summary:
${oldSummary}

Recent conversation:
${recentConversation}
`;