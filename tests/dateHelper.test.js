const {
  formatDate,
  formatMonthLabel,
  lastTwelveMonths,
  monthWindowStart
} = require('../src/shared/utils/dateHelper');

describe('formatDate', () => {
  test('renders dd/MM/yyyy', () => {
    expect(formatDate('2026-09-20T14:05:00.000Z')).toBe('20/09/2026');
    expect(formatDate('2026-01-02T00:00:00.000Z')).toBe('02/01/2026');
  });

  test('returns empty for missing or unparseable input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatMonthLabel', () => {
  test('turns a month key into MM/yyyy', () => {
    expect(formatMonthLabel('2026-09')).toBe('09/2026');
    expect(formatMonthLabel('2025-10')).toBe('10/2025');
  });

  test('rejects anything that is not a month key', () => {
    expect(formatMonthLabel('2026-9')).toBe('');
    expect(formatMonthLabel('2026-09-20')).toBe('');
    expect(formatMonthLabel(null)).toBe('');
    expect(formatMonthLabel(undefined)).toBe('');
  });
});

describe('lastTwelveMonths', () => {
  test('returns twelve keys, oldest first, ending in the given month', () => {
    const months = lastTwelveMonths(new Date('2026-09-20T12:00:00.000Z'));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-10');
    expect(months[11]).toBe('2026-09');
  });

  test('crosses the year boundary', () => {
    const months = lastTwelveMonths(new Date('2026-01-15T00:00:00.000Z'));
    expect(months[0]).toBe('2025-02');
    expect(months[11]).toBe('2026-01');
  });

  test('does not skip February when asked from a 31-day month', () => {
    // Naive month arithmetic from the 31st clamps and drops a month.
    const months = lastTwelveMonths(new Date('2026-03-31T00:00:00.000Z'));
    expect(months).toContain('2026-02');
    expect(months[11]).toBe('2026-03');
    expect(new Set(months).size).toBe(12);
  });

  test('handles a leap year', () => {
    const months = lastTwelveMonths(new Date('2028-02-29T00:00:00.000Z'));
    expect(months[11]).toBe('2028-02');
    expect(months[0]).toBe('2027-03');
  });

  test('returns strictly ascending, contiguous months', () => {
    const months = lastTwelveMonths(new Date('2026-09-20T12:00:00.000Z'));
    for (let i = 1; i < months.length; i++) {
      expect(months[i] > months[i - 1]).toBe(true);
    }
  });

  test('falls back to now when given nothing usable', () => {
    expect(lastTwelveMonths()).toHaveLength(12);
    expect(lastTwelveMonths(new Date('nonsense'))).toHaveLength(12);
  });
});

describe('monthWindowStart', () => {
  test('is the first instant of the oldest month in the window', () => {
    expect(monthWindowStart(new Date('2026-09-20T23:59:59.000Z')))
      .toBe('2025-10-01T00:00:00.000Z');
  });

  test('agrees with lastTwelveMonths', () => {
    const ref = new Date('2026-01-15T00:00:00.000Z');
    expect(monthWindowStart(ref).startsWith(lastTwelveMonths(ref)[0])).toBe(true);
  });
});
