/**
 * Money and hour formatting for the dashboard.
 *
 * Amounts reach this module as floating-point sums out of SQLite, so they
 * arrive with the usual binary drift: a column that should total 129.90 comes
 * back as 129.89999999999. Every number shown to the user goes through
 * roundTo2 first, and the display helpers always emit exactly two decimals so
 * a column of figures lines up.
 *
 * No currency symbol anywhere - the schema has no notion of currency, and
 * guessing one from the OS locale would also change the separators.
 */

/**
 * Round to 2 decimals.
 *
 * Math.round(value * 100) / 100 is not enough on its own, for two reasons.
 * 1.005 * 100 is 100.49999999999999 in binary floating point, so the naive
 * version rounds it down to 1.00; nudging by one ULP of the value's own
 * magnitude pushes those exact-half cases back over the line without
 * disturbing anything else. And Math.round breaks ties toward +Infinity, so
 * -1.005 would land on -1.00 while 1.005 lands on 1.01. Rounding the
 * magnitude and reapplying the sign gives the half-away-from-zero behaviour
 * money is expected to have, in both directions.
 *
 * @param {number|string|null|undefined} value
 * @returns {number} the rounded value, or 0 for anything non-finite
 */
function roundTo2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const magnitude = Math.abs(n);
  const rounded = Math.round((magnitude + Number.EPSILON * magnitude) * 100) / 100;
  return n < 0 ? -rounded : rounded;
}

/**
 * Display form for an amount of money: always two decimals, thousands
 * separated with commas, no currency symbol. 129.9 becomes "129.90".
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
function formatMoney(value) {
  const fixed = roundTo2(value).toFixed(2);
  const negative = fixed.startsWith('-');
  const parts = (negative ? fixed.slice(1) : fixed).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+$)/g, ',');
  return (negative ? '-' : '') + parts.join('.');
}

/**
 * Seconds to decimal hours, two decimals. 513900 becomes "142.75".
 *
 * Decimal hours rather than HH:MM:SS because the dashboard's hours sit next to
 * money in the same table, and hours x rate has to read as arithmetic that
 * checks out. formatDuration in dateHelper still owns the clock format.
 *
 * @param {number|string|null|undefined} seconds
 * @returns {string}
 */
function formatHours(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return '0.00';
  return roundTo2(n / 3600).toFixed(2);
}

/**
 * An hourly rate, or an em dash when none is set.
 *
 * A NULL rate and a rate of 0.00 are different states - one means "nobody has
 * decided yet", the other means "this work is free" - so they must not render
 * the same way.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
function formatRate(value) {
  if (value === null || value === undefined || value === '') return '—';
  return formatMoney(value);
}

// Loaded both as a <script src> in the renderer - where `module` does not exist -
// and via require() in tests, so the export has to be guarded.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    roundTo2,
    formatMoney,
    formatHours,
    formatRate
  };
}
