import { describe, it, expect } from 'vitest';
import { getCustomPeriodDates } from './date.js';

describe('getCustomPeriodDates', () => {
    it('should handle income date on the 1st (standard month)', () => {
        // Jan 1 2024 -> Jan 1 to Jan 31
        const { start, end } = getCustomPeriodDates(2024, 0, 1);
        expect(start).toEqual(new Date(2024, 0, 1, 0, 0, 0, 0));
        expect(end).toEqual(new Date(2024, 0, 31, 23, 59, 59, 999));
    });

    it('should handle income date on the 25th', () => {
        // Jan 2024 period with income date 25
        // Should be Jan 25 to Feb 24
        const { start, end } = getCustomPeriodDates(2024, 0, 25);
        expect(start).toEqual(new Date(2024, 0, 25, 0, 0, 0, 0));
        expect(end).toEqual(new Date(2024, 1, 24, 23, 59, 59, 999));
    });

    it('should handle income date wrapping to next year', () => {
        // Dec 2024 period with income date 25
        // Should be Dec 25 2024 to Jan 24 2025
        const { start, end } = getCustomPeriodDates(2024, 11, 25);
        expect(start).toEqual(new Date(2024, 11, 25, 0, 0, 0, 0));
        expect(end).toEqual(new Date(2025, 0, 24, 23, 59, 59, 999));
    });

    it('should handle short months (Feb)', () => {
        // Jan 2024 period with income date 30
        // Should be Jan 30 to Feb 28 (or 29 for leap year)
        // 2024 is a leap year
        const { start, end } = getCustomPeriodDates(2024, 0, 30);
        expect(start).toEqual(new Date(2024, 0, 30, 0, 0, 0, 0));
        // End date should be day before next start date (Feb 30 -> Mar 1/2?)
        // Wait, logic for "day before next start date" needs to be robust.
        // If income date is 30, next start is Feb 30 -> which is actually Mar 1 (or Feb 29?)
        // Let's verify the implementation behavior.
        // Standard expectation: End date is the day before the next period starts.
        // Next period starts on Feb 30? No, Feb only has 29 days.
        // Usually systems clamp to the last day of the month.

        // Let's see what the implementation does.
        // If implementation uses setDate(30), JS auto-corrects.
        // new Date(2024, 1, 30) -> Mar 1, 2024.
        // So next period starts Mar 1.
        // Current period ends day before -> Feb 29.

        expect(end).toEqual(new Date(2024, 1, 29, 23, 59, 59, 999));
    });
});