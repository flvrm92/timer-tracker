jest.mock('electron', () => {
  const ipcMain = {
    handlers: {},
    handleHandlers: {},
    on(channel, listener) { this.handlers[channel] = listener; },
    handle(channel, listener) { this.handleHandlers[channel] = listener; },
  };
  return {
    ipcMain,
    nativeTheme: { shouldUseDarkColors: false, themeSource: 'system' },
    dialog: { showSaveDialog: jest.fn() }
  };
});

jest.mock('fs', () => ({ writeFileSync: jest.fn() }));

jest.mock('../src/shared/utils/csvUtils', () => ({
  generateCSV: jest.fn(() => 'csv-content'),
  generateFileName: jest.fn(() => 'timers.csv')
}));

jest.mock('../src/infra/database', () => ({
  insertTimer: jest.fn(),
  insertProject: jest.fn(),
  getProjects: jest.fn(),
  getProjectById: jest.fn(),
  deleteProject: jest.fn(),
  getTimers: jest.fn(),
  countTimers: jest.fn(),
  updateTimer: jest.fn(),
  deleteTimer: jest.fn(),
  getTimersForExport: jest.fn(),
  getProjectTotals: jest.fn(),
  getMonthlyTotals: jest.fn(),
  initializeDatabase: jest.fn((callback) => callback(null))
}));

const { ipcMain } = require('electron');
const db = require('../src/infra/database');
const setupIpcHandlers = require('../src/main/ipcHandlers');
const { lastTwelveMonths } = require('../src/shared/utils/dateHelper');

function createMockEvent() {
  return {
    sender: {
      sent: [],
      send(channel, payload) { this.sent.push({ channel, payload }); }
    }
  };
}

setupIpcHandlers();

const summaryHandler = () => ipcMain.handlers['get-dashboard-summary'];
const monthlyHandler = () => ipcMain.handlers['get-project-monthly'];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('get-dashboard-summary', () => {
  const ROWS = [
    {
      id: 1, name: 'Acme Redesign', is_billable: 1, hourly_rate: 85,
      total_seconds: 32 * 3600, total_earned: 2719.9999999999,
      entry_count: 3, first_entry: '2026-03-02T09:00:00.000Z', last_entry: '2026-04-06T09:00:00.000Z'
    },
    {
      id: 2, name: 'Internal Tooling', is_billable: 0, hourly_rate: null,
      total_seconds: 5.5 * 3600, total_earned: 0,
      entry_count: 2, first_entry: '2026-03-11T09:00:00.000Z', last_entry: '2026-04-11T09:00:00.000Z'
    },
    {
      id: 3, name: 'Never Started', is_billable: 1, hourly_rate: 50,
      total_seconds: 0, total_earned: 0,
      entry_count: 0, first_entry: null, last_entry: null
    }
  ];

  function run(rows) {
    db.getProjectTotals.mockImplementation((cb) => cb(null, rows));
    const event = createMockEvent();
    summaryHandler()(event);
    return event.sender.sent[0];
  }

  test('is registered', () => {
    expect(typeof summaryHandler()).toBe('function');
  });

  test('replies on dashboard-summary with one entry per project', () => {
    const message = run(ROWS);
    expect(message.channel).toBe('dashboard-summary');
    expect(message.payload.projects).toHaveLength(3);
  });

  test('rounds a drifted sum to 2 decimals before it leaves the main process', () => {
    const project = run(ROWS).payload.projects[0];
    expect(project.totalEarned).toBe(2720);
  });

  test('converts seconds to decimal hours', () => {
    const project = run(ROWS).payload.projects[0];
    expect(project.totalSeconds).toBe(32 * 3600);
    expect(project.totalHours).toBe(32);
  });

  test('normalises the billable flag to a boolean', () => {
    const projects = run(ROWS).payload.projects;
    expect(projects[0].isBillable).toBe(true);
    expect(projects[1].isBillable).toBe(false);
  });

  test('keeps a missing rate as null rather than zero', () => {
    const projects = run(ROWS).payload.projects;
    expect(projects[1].hourlyRate).toBeNull();
    expect(projects[0].hourlyRate).toBe(85);
  });

  test('computes the headline totals', () => {
    const totals = run(ROWS).payload.totals;
    expect(totals.totalHours).toBe(37.5);
    expect(totals.billableHours).toBe(32);
    expect(totals.totalEarned).toBe(2720);
    expect(totals.projectCount).toBe(3);
    expect(totals.billableCount).toBe(2);
    expect(totals.entryCount).toBe(5);
  });

  test('reports the most recent entry and which project it belongs to', () => {
    const totals = run(ROWS).payload.totals;
    expect(totals.lastEntry).toBe('2026-04-11T09:00:00.000Z');
    expect(totals.lastEntryProject).toBe('Internal Tooling');
  });

  test('handles an empty database without throwing', () => {
    const message = run([]);
    expect(message.payload.projects).toEqual([]);
    expect(message.payload.totals.totalEarned).toBe(0);
    expect(message.payload.totals.projectCount).toBe(0);
    expect(message.payload.totals.lastEntry).toBeNull();
  });

  test('replies on the error channel when the query fails', () => {
    db.getProjectTotals.mockImplementation((cb) => cb(new Error('disk is gone')));
    const event = createMockEvent();
    summaryHandler()(event);
    expect(event.sender.sent[0].channel).toBe('dashboard-summary-error');
    expect(event.sender.sent[0].payload.message).toBe('disk is gone');
  });
});

describe('get-project-monthly', () => {
  function run(rows, payload) {
    db.getMonthlyTotals.mockImplementation((projectId, windowStart, cb) => cb(null, rows));
    const event = createMockEvent();
    monthlyHandler()(event, payload);
    return event.sender.sent[0];
  }

  test('is registered', () => {
    expect(typeof monthlyHandler()).toBe('function');
  });

  test('always returns exactly 12 months, oldest first', () => {
    const message = run([], { projectId: 1 });
    expect(message.channel).toBe('project-monthly');
    expect(message.payload.months).toHaveLength(12);
    expect(message.payload.months.map((m) => m.month)).toEqual(lastTwelveMonths());
  });

  test('pads months that have no timers with zeros, not gaps', () => {
    const months = run([], { projectId: 1 }).payload.months;
    expect(months.every((m) => m.totalEarned === 0 && m.totalHours === 0)).toBe(true);
  });

  test('labels each bucket MM/yyyy', () => {
    const months = run([], { projectId: 1 }).payload.months;
    months.forEach((m) => expect(m.label).toMatch(/^\d{2}\/\d{4}$/));
  });

  test('fills in the months the query returned', () => {
    const target = lastTwelveMonths()[6];
    const months = run(
      [{ month: target, total_seconds: 21 * 3600, total_earned: 1784.9999999999 }],
      { projectId: 1 }
    ).payload.months;

    const filled = months.find((m) => m.month === target);
    expect(filled.totalEarned).toBe(1785);
    expect(filled.totalHours).toBe(21);
    expect(filled.totalSeconds).toBe(21 * 3600);
  });

  test('ignores months outside the window that the query somehow returned', () => {
    const months = run(
      [{ month: '1999-01', total_seconds: 3600, total_earned: 10 }],
      { projectId: 1 }
    ).payload.months;
    expect(months.map((m) => m.month)).not.toContain('1999-01');
    expect(months.every((m) => m.totalEarned === 0)).toBe(true);
  });

  test('passes the project id and window start down to the query', () => {
    run([], { projectId: 7 });
    const [projectId, windowStart] = db.getMonthlyTotals.mock.calls[0];
    expect(projectId).toBe(7);
    expect(windowStart).toBe(lastTwelveMonths()[0] + '-01T00:00:00.000Z');
  });

  test('treats a missing, empty or null projectId as "all projects"', () => {
    [undefined, {}, { projectId: null }, { projectId: '' }].forEach((payload, i) => {
      db.getMonthlyTotals.mockImplementation((projectId, windowStart, cb) => cb(null, []));
      const event = createMockEvent();
      monthlyHandler()(event, payload);
      expect(db.getMonthlyTotals.mock.calls[0][0]).toBeNull();
      expect(event.sender.sent[0].payload.projectId).toBeNull();
      db.getMonthlyTotals.mockClear();
    });
  });

  test('replies on the error channel when the query fails', () => {
    db.getMonthlyTotals.mockImplementation((projectId, windowStart, cb) => cb(new Error('locked')));
    const event = createMockEvent();
    monthlyHandler()(event, { projectId: 1 });
    expect(event.sender.sent[0].channel).toBe('project-monthly-error');
    expect(event.sender.sent[0].payload.message).toBe('locked');
  });
});
