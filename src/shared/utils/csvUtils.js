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

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

function escapeCSVField(field) {
  if (field === null || field === undefined) return '';
  const stringField = String(field);

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
    'Duration'
  ];

  let csv = headers.map(escapeCSVField).join(',') + '\n';

  timers.forEach(timer => {
    const row = [
      timer.project_name || '',
      timer.task_description || '',
      formatDate(timer.start_time),
      formatTime(timer.start_time),
      formatDate(timer.end_time),
      formatTime(timer.end_time),
      formatDuration(timer.duration)
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

module.exports = {
  formatDate,
  formatTime,
  formatDuration,
  escapeCSVField,
  generateCSV,
  generateFileName
};
