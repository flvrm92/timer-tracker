const { formatDate, formatTime } = require('./dateHelper');

// Excel on Windows opens a BOM-less CSV using the system ANSI codepage (CP1252),
// so UTF-8 accented text arrives as mojibake ("Próprio" -> "PrÃ³prio"). The BOM
// forces Excel to read the file as UTF-8.
const UTF8_BOM = '\uFEFF';

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

// Spreadsheet apps evaluate a cell whose text begins with one of these as a
// formula, so a project named =HYPERLINK(...) would execute on open instead of
// being displayed. A leading apostrophe forces Excel to treat it as literal text.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function isFormulaLike(value) {
  // A negative number ("-50.00") is data, not a formula.
  return FORMULA_TRIGGER.test(value) && !PLAIN_NUMBER.test(value);
}

function escapeCSVField(field) {
  if (field === null || field === undefined) return '';
  let stringField = String(field);

  if (isFormulaLike(stringField)) {
    stringField = "'" + stringField;
  }

  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
    return '"' + stringField.replace(/"/g, '""') + '"';
  }
  return stringField;
}

function generateCSV(timers) {
  const headers = [
    'Project',
    'Description',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
    'Duration',
    'Hourly Rate',
    'Amount Earned'
  ];

  let csv = UTF8_BOM + headers.map(escapeCSVField).join(',') + '\n';

  timers.forEach(timer => {
    // Format hourly rate (only show for billable projects)
    const hourlyRate = timer.is_billable && timer.hourly_rate
      ? `$${parseFloat(timer.hourly_rate).toFixed(2)}`
      : '';

    // Format amount earned
    const amountEarned = timer.amount_earned
      ? `$${parseFloat(timer.amount_earned).toFixed(2)}`
      : '';

    const row = [
      timer.project_name || '',
      timer.task_description || '',
      formatDate(timer.start_time),
      formatTime(timer.start_time),
      formatDate(timer.end_time),
      formatTime(timer.end_time),
      formatDuration(timer.duration),
      hourlyRate,
      amountEarned
    ];

    csv += row.map(escapeCSVField).join(',') + '\n';
  });

  return csv;
}

function generateFileName(projectName = null) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

  const prefix = projectName ? `${projectName}_` : 'all_projects_';
  return `${prefix}timers_${dateStr}_${timeStr}.csv`;
}

// Guarded so this file is safe to load as a <script src> as well as via require().
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UTF8_BOM,
    formatDuration,
    escapeCSVField,
    generateCSV,
    generateFileName
  };
}
