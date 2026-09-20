const { roundTo2, formatMoney, formatHours, formatRate } = require('../src/shared/utils/numberHelper');

describe('roundTo2', () => {
  test('cleans up a drifted floating-point sum', () => {
    expect(roundTo2(129.89999999999)).toBe(129.9);
  });

  test('rounds an exact half cent up rather than down', () => {
    // The naive Math.round(v * 100) / 100 returns 1 here, because
    // 1.005 * 100 is 100.49999999999999 in binary floating point.
    expect(roundTo2(1.005)).toBe(1.01);
    expect(roundTo2(2.675)).toBe(2.68);
  });

  test('leaves values that are already 2dp alone', () => {
    expect(roundTo2(12133.75)).toBe(12133.75);
    expect(roundTo2(0)).toBe(0);
  });

  test('handles negatives symmetrically', () => {
    expect(roundTo2(-1.005)).toBe(-1.01);
    expect(roundTo2(-129.89999999999)).toBe(-129.9);
  });

  test('accepts numeric strings', () => {
    expect(roundTo2('85.499')).toBe(85.5);
  });

  test('falls back to 0 for anything non-finite', () => {
    expect(roundTo2(null)).toBe(0);
    expect(roundTo2(undefined)).toBe(0);
    expect(roundTo2('')).toBe(0);
    expect(roundTo2('abc')).toBe(0);
    expect(roundTo2(NaN)).toBe(0);
    expect(roundTo2(Infinity)).toBe(0);
  });
});

describe('formatMoney', () => {
  test('always emits two decimals', () => {
    expect(formatMoney(129.89999999999)).toBe('129.90');
    expect(formatMoney(129.9)).toBe('129.90');
    expect(formatMoney(130)).toBe('130.00');
    expect(formatMoney(0)).toBe('0.00');
  });

  test('separates thousands', () => {
    expect(formatMoney(1000)).toBe('1,000.00');
    expect(formatMoney(12133.75)).toBe('12,133.75');
    expect(formatMoney(1234567.5)).toBe('1,234,567.50');
  });

  test('does not put a separator inside the decimals', () => {
    expect(formatMoney(999.99)).toBe('999.99');
    expect(formatMoney(999999.99)).toBe('999,999.99');
  });

  test('keeps the sign outside the grouping', () => {
    expect(formatMoney(-12133.75)).toBe('-12,133.75');
  });

  test('renders a missing amount as zero, never blank', () => {
    expect(formatMoney(null)).toBe('0.00');
    expect(formatMoney(undefined)).toBe('0.00');
  });

  test('a sum of many small amounts stays exact to the cent', () => {
    let total = 0;
    for (let i = 0; i < 1000; i++) total += 0.01;
    expect(formatMoney(total)).toBe('10.00');
  });

  test('carries no currency symbol', () => {
    expect(formatMoney(85)).not.toMatch(/[^\d.,-]/);
  });
});

describe('formatHours', () => {
  test('converts seconds to decimal hours at two decimals', () => {
    expect(formatHours(513900)).toBe('142.75');
    expect(formatHours(3600)).toBe('1.00');
    expect(formatHours(0)).toBe('0.00');
  });

  test('rounds rather than truncating', () => {
    expect(formatHours(3629)).toBe('1.01');
    expect(formatHours(5)).toBe('0.00');
  });

  test('falls back to zero for missing input', () => {
    expect(formatHours(null)).toBe('0.00');
    expect(formatHours(undefined)).toBe('0.00');
  });
});

describe('formatRate', () => {
  test('formats a rate like money', () => {
    expect(formatRate(85)).toBe('85.00');
    expect(formatRate(120.5)).toBe('120.50');
  });

  test('distinguishes "no rate set" from a rate of zero', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(undefined)).toBe('—');
    expect(formatRate(0)).toBe('0.00');
  });
});
