export const CONTEXT_SUMMARY_USER_PROMPT = (oldSummary: string, recentConversation: string): string =>
    `Update the user context summary by extracting long-term preferences, recurring habits, and personal interests from the recent conversation.

Rules:
- Max 5 sentences.
- Focus exclusively on saving user preferences and behavioral patterns.
- Do not include raw transactions, specific numbers, or temporary status updates.
- Use tentative language (e.g., "appears to prefer," "tends to").
- Merge new observations with the existing summary, prioritizing the most consistent traits.

Current summary:
${oldSummary}

Recent conversation:
${recentConversation}
`;