const fs = require('fs');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, 'test-dashboard.db');

// Fresh DB per test run
if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);

const {
  insertTimer,
  insertProject,
  getProjectTotals,
  getMonthlyTotals,
  initializeDatabase
} = require('../src/infra/database');

function init() {
  return new Promise((resolve, reject) => {
    initializeDatabase((err) => (err ? reject(err) : resolve()));
  });
}

function addProject(name, isBillable, rate) {
  return new Promise((resolve, reject) => {
    insertProject(name, isBillable, rate, (err, project) => (err ? reject(err) : resolve(project)));
  });
}

function addTimer(projectId, start, durationSeconds, amountEarned) {
  const end = new Date(new Date(start).getTime() + durationSeconds * 1000).toISOString();
  return new Promise((resolve, reject) => {
    insertTimer(projectId, start, end, durationSeconds, 'task', amountEarned, (err) =>
      err ? reject(err) : resolve());
  });
}

function totals() {
  return new Promise((resolve, reject) => {
    getProjectTotals((err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function monthly(projectId, windowStart) {
  return new Promise((resolve, reject) => {
    getMonthlyTotals(projectId, windowStart, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

let billable;
let internal;
let untouched;

beforeAll(async () => {
  await init();

  billable = await addProject('Acme Redesign', true, 85);
  internal = await addProject('Internal Tooling', false, null);
  untouched = await addProject('Never Started', true, 50);

  // 8h + 13h in March, 11h in April 2026, all billable at 85/h.
  await addTimer(billable.id, '2026-03-02T09:00:00.000Z', 8 * 3600, 680);
  await addTimer(billable.id, '2026-03-20T09:00:00.000Z', 13 * 3600, 1105);
  await addTimer(billable.id, '2026-04-06T09:00:00.000Z', 11 * 3600, 935);

  // Non-billable work: duration but no amount_earned at all.
  await addTimer(internal.id, '2026-03-11T09:00:00.000Z', 2 * 3600, null);
  await addTimer(internal.id, '2026-04-11T09:00:00.000Z', 3.5 * 3600, null);
});

// No afterAll cleanup: sqlite3 still holds the file open when the suite ends,
// and unlinking it there fails with EBUSY on Windows. The delete at the top of
// this file is what guarantees a fresh database, same as database.test.js.

describe('getProjectTotals', () => {
  test('returns every project, including one with no timers', async () => {
    const rows = await totals();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name).sort()).toEqual(
      ['Acme Redesign', 'Internal Tooling', 'Never Started']
    );
  });

  test('a project with no timers reports zeros, not nulls', async () => {
    const row = (await totals()).find((r) => r.id === untouched.id);
    expect(row.total_seconds).toBe(0);
    expect(row.total_earned).toBe(0);
    expect(row.entry_count).toBe(0);
    expect(row.first_entry).toBeNull();
    expect(row.last_entry).toBeNull();
  });

  test('sums duration and earnings for a billable project', async () => {
    const row = (await totals()).find((r) => r.id === billable.id);
    expect(row.total_seconds).toBe(32 * 3600);
    expect(row.total_earned).toBeCloseTo(2720, 2);
    expect(row.entry_count).toBe(3);
  });

  test('NULL amount_earned sums as zero, and hours still count', async () => {
    const row = (await totals()).find((r) => r.id === internal.id);
    expect(row.total_earned).toBe(0);
    expect(row.total_seconds).toBe(5.5 * 3600);
    expect(row.entry_count).toBe(2);
  });

  test('carries the billable flag and rate through', async () => {
    const rows = await totals();
    const billableRow = rows.find((r) => r.id === billable.id);
    const internalRow = rows.find((r) => r.id === internal.id);
    expect(billableRow.is_billable).toBe(1);
    expect(billableRow.hourly_rate).toBe(85);
    expect(internalRow.is_billable).toBe(0);
    expect(internalRow.hourly_rate).toBeNull();
  });

  test('orders by earnings descending', async () => {
    const rows = await totals();
    expect(rows[0].id).toBe(billable.id);
  });

  test('tracks the first and last entry timestamps', async () => {
    const row = (await totals()).find((r) => r.id === billable.id);
    expect(row.first_entry).toBe('2026-03-02T09:00:00.000Z');
    expect(row.last_entry).toBe('2026-04-06T09:00:00.000Z');
  });
});

describe('getMonthlyTotals', () => {
  const WINDOW = '2025-10-01T00:00:00.000Z';

  test('buckets by month for one project', async () => {
    const rows = await monthly(billable.id, WINDOW);
    expect(rows).toEqual([
      { month: '2026-03', total_seconds: 21 * 3600, total_earned: 1785 },
      { month: '2026-04', total_seconds: 11 * 3600, total_earned: 935 }
    ]);
  });

  test('returns only months that have timers - padding is the caller job', async () => {
    const rows = await monthly(billable.id, WINDOW);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.month)).not.toContain('2026-01');
  });

  test('a null projectId totals every project together', async () => {
    const rows = await monthly(null, WINDOW);
    const march = rows.find((r) => r.month === '2026-03');
    expect(march.total_seconds).toBe(23 * 3600);
    expect(march.total_earned).toBe(1785);
  });

  test('excludes anything before the window start', async () => {
    const rows = await monthly(billable.id, '2026-04-01T00:00:00.000Z');
    expect(rows.map((r) => r.month)).toEqual(['2026-04']);
  });

  test('a project with no timers returns nothing at all', async () => {
    expect(await monthly(untouched.id, WINDOW)).toEqual([]);
  });

  test('a non-billable project reports hours with zero earnings', async () => {
    const rows = await monthly(internal.id, WINDOW);
    expect(rows.every((r) => r.total_earned === 0)).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.total_seconds, 0)).toBe(5.5 * 3600);
  });

  test('puts the first and last second of a month in the right bucket', async () => {
    const edge = await addProject('Edge Case', true, 10);
    await addTimer(edge.id, '2026-05-01T00:00:00.000Z', 3600, 10);
    await addTimer(edge.id, '2026-05-31T23:59:59.000Z', 3600, 10);
    await addTimer(edge.id, '2026-06-01T00:00:00.000Z', 3600, 10);

    const rows = await monthly(edge.id, WINDOW);
    const may = rows.find((r) => r.month === '2026-05');
    const june = rows.find((r) => r.month === '2026-06');
    expect(may.total_seconds).toBe(2 * 3600);
    expect(june.total_seconds).toBe(3600);
  });
});
