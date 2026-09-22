// Byte-level guard for the CSV export encoding.
//
// The string-level assertions in csvUtils.test.js cannot catch a wrong `fs`
// encoding argument, so this suite writes a real file the way the export
// handler does (src/main/ipcHandlers.js) and inspects the raw bytes.
const fs = require('fs');
const os = require('os');
const path = require('path');

const { generateCSV } = require('../src/shared/utils/csvUtils');

const timers = [
  {
    project_name: 'Próprio',
    task_description: 'Conciliação — Avançado',
    start_time: '2024-03-15T14:30:00.000Z',
    end_time: '2024-03-15T15:30:00.000Z',
    duration: 3600,
    is_billable: true,
    hourly_rate: 50,
    amount_earned: 50
  }
];

let tmpDir;
let filePath;
let bytes;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-encoding-'));
  filePath = path.join(tmpDir, 'export.csv');

  // Mirrors src/main/ipcHandlers.js exactly.
  fs.writeFileSync(filePath, generateCSV(timers), 'utf8');

  bytes = fs.readFileSync(filePath); // no encoding argument -> raw Buffer
});

afterAll(() => {
  // Guarded: if beforeAll threw, tmpDir is undefined and an unguarded
  // rmSync would mask the original failure.
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('CSV export file encoding', () => {
  test('file begins with the UTF-8 BOM', () => {
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xEF, 0xBB, 0xBF]);
  });

  test('accented text round-trips as UTF-8', () => {
    const text = bytes.toString('utf8');
    expect(text).toContain('Próprio');
    expect(text).toContain('Conciliação — Avançado');
  });

  test('decoding as CP1252/latin1 reproduces the reported mojibake', () => {
    // Documents *why* the BOM is required: without it Excel on Windows decodes
    // the file with the system ANSI codepage and the user sees exactly this.
    expect(bytes.toString('latin1')).toContain('ConciliaÃ§Ã£o');
  });
});
