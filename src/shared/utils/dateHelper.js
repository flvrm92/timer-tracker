function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

function formatDuration(sec) {
  const s = Number(sec) || 0;
  const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
  const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const secs = (s % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

/**
 * "2026-09" -> "09/2026". The month equivalent of formatDate's dd/MM/yyyy.
 */
function formatMonthLabel(yearMonth) {
  if (typeof yearMonth !== 'string') return '';
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return '';
  return `${match[2]}/${match[1]}`;
}

/**
 * The 12 month keys ending in the given month, oldest first: the current month
 * plus the 11 before it. From 2026-09 that is 2025-10 through 2026-09.
 *
 * Built in UTC to match strftime('%Y-%m', start_time) on the stored ISO
 * timestamps, and formatDate, which also reads its dates in UTC.
 *
 * @param {Date} [from] defaults to now
 * @returns {string[]} twelve 'YYYY-MM' keys
 */
function lastTwelveMonths(from) {
  const ref = from instanceof Date && !isNaN(from.getTime()) ? from : new Date();
  const months = [];
  for (let back = 11; back >= 0; back--) {
    // Day 1 keeps the arithmetic away from end-of-month clamping: stepping
    // back a month from the 31st would otherwise skip February entirely.
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - back, 1));
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    months.push(`${d.getUTCFullYear()}-${month}`);
  }
  return months;
}

/**
 * ISO timestamp of the first instant of the oldest month in that window -
 * the lower bound the monthly query filters on.
 */
function monthWindowStart(from) {
  const oldest = lastTwelveMonths(from)[0].split('-');
  return new Date(Date.UTC(Number(oldest[0]), Number(oldest[1]) - 1, 1)).toISOString();
}

function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

function localInputToIso(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Loaded both as a <script src> in the renderer - where `module` does not exist -
// and via require() in tests, so the export has to be guarded.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDate,
    formatTime,
    formatDuration,
    formatMonthLabel,
    lastTwelveMonths,
    monthWindowStart,
    isoToLocalInput,
    localInputToIso
  };
}
