const { generateCSV, formatDate, formatTime, formatDuration, escapeCSVField, generateFileName } = require('../src/shared/utils/csvUtils');

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

    expect(lines[0]).toBe('Project,Description,Start Date,Start Time,End Date,End Time,Duration,Hourly Rate,Amount Earned');
    expect(lines[1]).toBe('Test Project,Task 1,15/03/2024,14:30:00,15/03/2024,15:30:00,1:00,$50.00,$50.00');
    expect(lines[2]).toBe('Another Project,"Task with, comma",15/03/2024,16:00:00,15/03/2024,16:30:00,0:30,,');
  });

  test('generateFileName creates proper filename', () => {
    const filename = generateFileName('Test Project');
    expect(filename).toMatch(/^Test Project_timers_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);

    const filenameAll = generateFileName();
    expect(filenameAll).toMatch(/^all_projects_timers_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
  });
});
