const { UTF8_BOM, generateCSV, formatDuration, escapeCSVField, generateFileName } = require('../src/shared/utils/csvUtils');
const { formatDate, formatTime } = require('../src/shared/utils/dateHelper');

describe('CSV Utilities', () => {
  test('formatDate formats ISO string correctly', () => {
    const isoString = '2024-03-15T14:30:00.000Z';
    expect(formatDate(isoString)).toBe('15/03/2024');
  });

  test('formatTime formats ISO string correctly', () => {
    const isoString = '2024-03-15T14:30:45.000Z';
    expect(formatTime(isoString)).toBe('14:30:45');
  });

  test('formatDuration formats seconds correctly', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(60)).toBe('0:01');
    expect(formatDuration(3600)).toBe('1:00');
    expect(formatDuration(3665)).toBe('1:01');
  });

  test('escapeCSVField handles special characters', () => {
    expect(escapeCSVField('simple')).toBe('simple');
    expect(escapeCSVField('text with, comma')).toBe('"text with, comma"');
    expect(escapeCSVField('text with "quotes"')).toBe('"text with ""quotes"""');
    expect(escapeCSVField('text\nwith\nnewlines')).toBe('"text\nwith\nnewlines"');
  });

  test('generateCSV creates proper CSV format', () => {
    const timers = [
      {
        project_name: 'Test Project',
        task_description: 'Task 1',
        start_time: '2024-03-15T14:30:00.000Z',
        end_time: '2024-03-15T15:30:00.000Z',
        duration: 3600,
        is_billable: true,
        hourly_rate: 50.00,
        amount_earned: 50.00
      },
      {
        project_name: 'Another Project',
        task_description: 'Task with, comma',
        start_time: '2024-03-15T16:00:00.000Z',
        end_time: '2024-03-15T16:30:00.000Z',
        duration: 1800,
        is_billable: false,
        hourly_rate: null,
        amount_earned: null
      }
    ];

    const csv = generateCSV(timers);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(UTF8_BOM + 'Project,Description,Start Date,Start Time,End Date,End Time,Duration,Hourly Rate,Amount Earned');
    expect(lines[1]).toBe('Test Project,Task 1,15/03/2024,14:30:00,15/03/2024,15:30:00,1:00,$50.00,$50.00');
    expect(lines[2]).toBe('Another Project,"Task with, comma",15/03/2024,16:00:00,15/03/2024,16:30:00,0:30,,');
  });

  test('generateFileName creates proper filename', () => {
    const filename = generateFileName('Test Project');
    expect(filename).toMatch(/^Test Project_timers_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);

    const filenameAll = generateFileName();
    expect(filenameAll).toMatch(/^all_projects_timers_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
  });

  test('generateCSV starts with a UTF-8 BOM so Excel reads the file as UTF-8', () => {
    expect(generateCSV([]).charCodeAt(0)).toBe(0xFEFF);
    expect(generateCSV([{ project_name: 'P' }]).charCodeAt(0)).toBe(0xFEFF);
  });

  test('generateCSV preserves accented and non-ASCII field values verbatim', () => {
    const timers = [
      {
        project_name: 'Próprio',
        task_description: 'Conciliação — Avançado',
        start_time: '2024-03-15T14:30:00.000Z',
        end_time: '2024-03-15T15:30:00.000Z',
        duration: 3600,
        is_billable: false,
        hourly_rate: null,
        amount_earned: null
      }
    ];

    const lines = generateCSV(timers).split('\n');

    expect(lines[1]).toBe('Próprio,Conciliação — Avançado,15/03/2024,14:30:00,15/03/2024,15:30:00,1:00,,');
  });

  test('escapeCSVField neutralizes spreadsheet formula injection', () => {
    // Excel evaluates a cell starting with = + - @ tab or CR as a formula.
    expect(escapeCSVField('=HYPERLINK("http://x","click")'))
      .toBe('"\'=HYPERLINK(""http://x"",""click"")"');
    expect(escapeCSVField('+1+1')).toBe("'+1+1");
    expect(escapeCSVField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCSVField('-Client A')).toBe("'-Client A");
    expect(escapeCSVField('\tTabbed')).toBe("'\tTabbed");
  });

  test('escapeCSVField leaves plain negative numbers as data', () => {
    expect(escapeCSVField('-50.00')).toBe('-50.00');
    expect(escapeCSVField('-7')).toBe('-7');
    expect(escapeCSVField(-50.5)).toBe('-50.5');
  });

  test('escapeCSVField does not disturb ordinary or accented values', () => {
    expect(escapeCSVField('Próprio')).toBe('Próprio');
    expect(escapeCSVField('$120.50')).toBe('$120.50');
    expect(escapeCSVField('15/03/2024')).toBe('15/03/2024');
  });
});
