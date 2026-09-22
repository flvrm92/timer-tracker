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

jest.mock('fs', () => ({
  writeFileSync: jest.fn()
}));

jest.mock('../src/shared/utils/csvUtils', () => ({
  generateCSV: jest.fn(() => 'csv-content'),
  generateFileName: jest.fn(() => 'timers.csv')
}));

// Mock database functions
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
  initializeDatabase: jest.fn((callback) => callback(null))
}));

const { ipcMain, nativeTheme, dialog } = require('electron');
const fs = require('fs');

const db = require('../src/infra/database');
const setupIpcHandlers = require('../src/main/ipcHandlers');
const activeTimer = require('../src/main/activeTimer');

function createMockEvent() {
  return {
    sender: {
      sent: [],
      send(channel, payload) { this.sent.push({ channel, payload }); }
    }
  };
}

setupIpcHandlers();

describe('IPC Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeTimer.reset();
    nativeTheme.shouldUseDarkColors = false;
    nativeTheme.themeSource = 'system';
  });

  // --- get-timers ---
  test('get-timers sends timers payload', () => {
    db.countTimers.mockImplementation((projectId, startDate, endDate, cb) => cb(null, 1));
    db.getTimers.mockImplementation((page, size, projectId, startDate, endDate, cb) => cb(null, [{ id: 1, project_name: 'P', duration: 5 }]));
    const event = createMockEvent();
    ipcMain.handlers['get-timers'](event, { page: 1 });
    const sent = event.sender.sent.find(m => m.channel === 'timers');
    expect(sent).toBeTruthy();
    expect(sent.payload.rows[0].id).toBe(1);
  });

  test('get-timers error path', () => {
    db.countTimers.mockImplementation((projectId, startDate, endDate, cb) => cb(new Error('fail')));
    const event = createMockEvent();
    ipcMain.handlers['get-timers'](event, { page: 1 });
    const errMsg = event.sender.sent.find(m => m.channel === 'timers-error');
    expect(errMsg).toBeTruthy();
  });

  test('get-timers inner getTimers error sends timers-error', () => {
    db.countTimers.mockImplementation((projectId, startDate, endDate, cb) => cb(null, 0));
    db.getTimers.mockImplementation((page, size, projectId, startDate, endDate, cb) => cb(new Error('inner-fail')));
    const event = createMockEvent();
    ipcMain.handlers['get-timers'](event, { page: 1 });
    const err = event.sender.sent.find(m => m.channel === 'timers-error');
    expect(err).toBeTruthy();
    expect(err.payload).toBe('inner-fail');
  });

  test('get-timers invalid date range sends timers-error', () => {
    const event = createMockEvent();
    ipcMain.handlers['get-timers'](event, { page: 1, startDate: '2024-05-10', endDate: '2024-05-01' });
    const err = event.sender.sent.find(m => m.channel === 'timers-error');
    expect(err).toBeTruthy();
    expect(db.countTimers).not.toHaveBeenCalled();
  });

  // --- update-timer ---
  test('update-timer success', () => {
    db.updateTimer.mockImplementation((id, s, e, a, cb) => cb(null, { id, start_time: s, end_time: e, duration: 10, amount_earned: a }));
    const event = createMockEvent();
    ipcMain.handlers['update-timer'](event, { id: 5, start_time: '2024-01-01T00:00:00.000Z', end_time: '2024-01-01T00:00:10.000Z', amount_earned: 5 });
    const updated = event.sender.sent.find(m => m.channel === 'timer-updated');
    expect(updated).toBeTruthy();
    expect(updated.payload.duration).toBe(10);
  });

  test('update-timer error', () => {
    db.updateTimer.mockImplementation((id, s, e, a, cb) => cb(new Error('bad')));
    const event = createMockEvent();
    ipcMain.handlers['update-timer'](event, { id: 5, start_time: '2024-01-01T00:00:00.000Z', end_time: '2024-01-01T00:00:10.000Z', amount_earned: 5 });
    const err = event.sender.sent.find(m => m.channel === 'timer-update-error');
    expect(err).toBeTruthy();
    expect(err.payload.message).toBe('bad');
  });

  // --- add-project ---
  test('add-project legacy string payload sends project-added', () => {
    db.insertProject.mockImplementation((name, cb) => cb(null, { id: 1, name }));
    const event = createMockEvent();
    ipcMain.handlers['add-project'](event, 'My Project');
    const sent = event.sender.sent.find(m => m.channel === 'project-added');
    expect(sent).toBeTruthy();
    expect(sent.payload.name).toBe('My Project');
  });

  test('add-project object payload sends project-added', () => {
    db.insertProject.mockImplementation((name, isBillable, hourlyRate, cb) =>
      cb(null, { id: 2, name, is_billable: isBillable, hourly_rate: hourlyRate }));
    const event = createMockEvent();
    ipcMain.handlers['add-project'](event, { name: 'Billable', isBillable: true, hourlyRate: 50 });
    const sent = event.sender.sent.find(m => m.channel === 'project-added');
    expect(sent).toBeTruthy();
    expect(sent.payload.name).toBe('Billable');
  });

  test('add-project legacy error does not send', () => {
    db.insertProject.mockImplementation((name, cb) => cb(new Error('dup')));
    const event = createMockEvent();
    ipcMain.handlers['add-project'](event, 'Dup');
    expect(event.sender.sent.length).toBe(0);
  });

  test('add-project object error does not send', () => {
    db.insertProject.mockImplementation((name, isBillable, hourlyRate, cb) => cb(new Error('dup')));
    const event = createMockEvent();
    ipcMain.handlers['add-project'](event, { name: 'Dup', isBillable: false, hourlyRate: null });
    expect(event.sender.sent.length).toBe(0);
  });

  // --- delete-project ---
  test('delete-project success sends project-deleted', () => {
    db.deleteProject.mockImplementation((id, cb) => cb(null));
    const event = createMockEvent();
    ipcMain.handlers['delete-project'](event, 3);
    const sent = event.sender.sent.find(m => m.channel === 'project-deleted');
    expect(sent).toBeTruthy();
  });

  test('delete-project error reports back instead of going quiet', () => {
    db.deleteProject.mockImplementation((id, cb) => cb(new Error('gone')));
    const event = createMockEvent();
    ipcMain.handlers['delete-project'](event, 99);

    expect(event.sender.sent).toEqual([
      { channel: 'project-delete-error', payload: { message: 'gone' } }
    ]);
  });

  test('delete-project is refused while that project has a timer running', () => {
    activeTimer.start({ projectId: '3' });
    const event = createMockEvent();
    ipcMain.handlers['delete-project'](event, 3);

    // String from the dropdown vs number from the projects list - still the
    // same project.
    expect(db.deleteProject).not.toHaveBeenCalled();
    expect(event.sender.sent[0].channel).toBe('project-delete-error');
    expect(event.sender.sent[0].payload.reason).toBe('timer-running');
    expect(activeTimer.isRunning()).toBe(true);
  });

  test('delete-project still works on other projects while a timer runs', () => {
    activeTimer.start({ projectId: '3' });
    db.deleteProject.mockImplementation((id, cb) => cb(null));
    const event = createMockEvent();
    ipcMain.handlers['delete-project'](event, 4);

    expect(db.deleteProject).toHaveBeenCalledWith(4, expect.any(Function));
    expect(event.sender.sent.find(m => m.channel === 'project-deleted')).toBeTruthy();
  });

  // --- get-projects ---
  test('get-projects sends projects list', () => {
    db.getProjects.mockImplementation((cb) => cb(null, [{ id: 1, name: 'Alpha' }]));
    const event = createMockEvent();
    ipcMain.handlers['get-projects'](event);
    const sent = event.sender.sent.find(m => m.channel === 'projects');
    expect(sent).toBeTruthy();
    expect(sent.payload[0].name).toBe('Alpha');
  });

  test('get-projects error does not send', () => {
    db.getProjects.mockImplementation((cb) => cb(new Error('fail')));
    const event = createMockEvent();
    ipcMain.handlers['get-projects'](event);
    expect(event.sender.sent.length).toBe(0);
  });

  // --- running timer ---
  test('get-active-timer replies with null when nothing is running', () => {
    const event = createMockEvent();
    ipcMain.handlers['get-active-timer'](event);
    expect(event.sender.sent).toEqual([{ channel: 'active-timer', payload: null }]);
  });

  test('start-timer replies with the running state', () => {
    const event = createMockEvent();
    ipcMain.handlers['start-timer'](event, { projectId: 5, taskDesc: 'Work', projectName: 'Acme' });

    expect(event.sender.sent[0].channel).toBe('active-timer');
    expect(event.sender.sent[0].payload).toMatchObject({
      projectId: 5, taskDesc: 'Work', projectName: 'Acme'
    });
    expect(activeTimer.isRunning()).toBe(true);
  });

  test('start-timer without a project is refused', () => {
    const event = createMockEvent();
    ipcMain.handlers['start-timer'](event, { projectId: '' });

    expect(event.sender.sent[0].channel).toBe('timer-start-error');
    expect(event.sender.sent[0].payload.reason).toBe('no-project');
    expect(activeTimer.isRunning()).toBe(false);
  });

  test('start-timer while one is running is refused and does not restart it', () => {
    activeTimer.start({ projectId: 1, taskDesc: 'First' });
    const event = createMockEvent();
    ipcMain.handlers['start-timer'](event, { projectId: 2, taskDesc: 'Second' });

    expect(event.sender.sent[0].channel).toBe('timer-start-error');
    expect(event.sender.sent[0].payload.reason).toBe('already-running');
    expect(activeTimer.getState()).toMatchObject({ projectId: 1, taskDesc: 'First' });
  });

  // The timer page is destroyed by navigation, so a page that comes back and
  // asks must be told what is still running.
  test('get-active-timer replies with the live state after a navigation', () => {
    activeTimer.start({ projectId: 9, taskDesc: 'Long task', projectName: 'Acme' });
    const event = createMockEvent();
    ipcMain.handlers['get-active-timer'](event);

    expect(event.sender.sent[0].payload).toMatchObject({ projectId: 9, taskDesc: 'Long task' });
    expect(typeof event.sender.sent[0].payload.startedAtMs).toBe('number');
  });

  test('stop-timer clears the state and persists a billable entry', () => {
    db.getProjectById.mockImplementation((id, cb) => cb(null, { id, is_billable: 1, hourly_rate: 60 }));
    db.insertTimer.mockImplementation((...args) => args[args.length - 1](null, { id: 11 }));

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    activeTimer.start({ projectId: 1, taskDesc: 'Work' });
    nowSpy.mockReturnValue(1_000_000 + 7_200_000);

    const event = createMockEvent();
    ipcMain.handlers['stop-timer'](event);
    nowSpy.mockRestore();

    // 7200s / 3600 * 60 = 120.00
    expect(db.insertTimer).toHaveBeenCalledWith(
      1, expect.any(String), expect.any(String), 7200, 'Work', 120, expect.any(Function));
    expect(activeTimer.isRunning()).toBe(false);
    expect(event.sender.sent).toEqual([
      { channel: 'active-timer', payload: null },
      { channel: 'timer-saved', payload: { duration: 7200 } }
    ]);
  });

  test('stop-timer inserts a null amount for a non-billable project', () => {
    db.getProjectById.mockImplementation((id, cb) => cb(null, { id, is_billable: 0, hourly_rate: null }));
    db.insertTimer.mockImplementation((...args) => args[args.length - 1](null, { id: 12 }));

    activeTimer.start({ projectId: 2, taskDesc: '' });
    ipcMain.handlers['stop-timer'](createMockEvent());

    expect(db.insertTimer).toHaveBeenCalledWith(
      2, expect.any(String), expect.any(String), expect.any(Number), '', null, expect.any(Function));
  });

  test('stop-timer still saves when the project lookup fails', () => {
    db.getProjectById.mockImplementation((id, cb) => cb(new Error('db-err')));
    db.insertTimer.mockImplementation((...args) => args[args.length - 1](null, { id: 13 }));

    activeTimer.start({ projectId: 3, taskDesc: 'T' });
    ipcMain.handlers['stop-timer'](createMockEvent());

    expect(db.insertTimer).toHaveBeenCalledWith(
      3, expect.any(String), expect.any(String), expect.any(Number), 'T', null, expect.any(Function));
  });

  test('stop-timer reports a failed insert rather than claiming success', () => {
    activeTimer.start({ projectId: 2, taskDesc: 'Doomed' });
    db.getProjectById.mockImplementation((id, cb) => cb(null, { is_billable: 0 }));
    db.insertTimer.mockImplementation((...args) => {
      args[args.length - 1](new Error('database is locked'));
    });

    const event = createMockEvent();
    ipcMain.handlers['stop-timer'](event);

    // The page is already idle and the slot is already empty, so the error is
    // the only remaining trace of the session - it must not be swallowed.
    expect(event.sender.sent.map(m => m.channel)).toEqual(['active-timer', 'timer-save-error']);
    expect(event.sender.sent[1].payload.message).toBe('database is locked');
    expect(event.sender.sent.find(m => m.channel === 'timer-saved')).toBeUndefined();
  });

  test('a failed insert still returns the duration the user lost', () => {
    const startedAt = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(startedAt);
    activeTimer.start({ projectId: 2 });
    Date.now.mockReturnValue(startedAt + 90_000);

    db.getProjectById.mockImplementation((id, cb) => cb(null, { is_billable: 0 }));
    db.insertTimer.mockImplementation((...args) => args[args.length - 1](new Error('nope')));

    const event = createMockEvent();
    ipcMain.handlers['stop-timer'](event);
    Date.now.mockRestore();

    expect(event.sender.sent[1].payload.duration).toBe(90);
  });

  test('stop-timer while idle saves nothing', () => {
    const event = createMockEvent();
    ipcMain.handlers['stop-timer'](event);

    expect(db.insertTimer).not.toHaveBeenCalled();
    expect(event.sender.sent).toEqual([{ channel: 'active-timer', payload: null }]);
  });

  // --- delete-timer ---
  test('delete-timer success sends timer-deleted', () => {
    db.deleteTimer.mockImplementation((id, cb) => cb(null));
    const event = createMockEvent();
    ipcMain.handlers['delete-timer'](event, { id: 7 });
    const sent = event.sender.sent.find(m => m.channel === 'timer-deleted');
    expect(sent).toBeTruthy();
    expect(sent.payload.id).toBe(7);
  });

  test('delete-timer error sends timer-delete-error', () => {
    db.deleteTimer.mockImplementation((id, cb) => cb(new Error('gone')));
    const event = createMockEvent();
    ipcMain.handlers['delete-timer'](event, { id: 8 });
    const err = event.sender.sent.find(m => m.channel === 'timer-delete-error');
    expect(err).toBeTruthy();
    expect(err.payload.id).toBe(8);
    expect(err.payload.message).toBe('gone');
  });

  // --- export-csv ---
  test('export-csv invalid date range sends csv-export-error', async () => {
    const event = createMockEvent();
    await ipcMain.handlers['export-csv'](event, { startDate: '2024-05-10', endDate: '2024-05-01' });
    const err = event.sender.sent.find(m => m.channel === 'csv-export-error');
    expect(err).toBeTruthy();
    expect(db.getTimersForExport).not.toHaveBeenCalled();
  });

  test('export-csv success writes file and sends csv-exported', async () => {
    db.getTimersForExport.mockImplementation((pid, sd, ed, cb) =>
      cb(null, [{ id: 1, project_name: 'P' }]));
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.csv' });
    const event = createMockEvent();
    await ipcMain.handlers['export-csv'](event, {});
    const sent = event.sender.sent.find(m => m.channel === 'csv-exported');
    expect(sent).toBeTruthy();
    expect(sent.payload.filePath).toBe('/tmp/out.csv');
    expect(sent.payload.recordCount).toBe(1);
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/out.csv', 'csv-content', 'utf8');
  });

  test('export-csv dialog cancel sends csv-export-cancelled', async () => {
    db.getTimersForExport.mockImplementation((pid, sd, ed, cb) => cb(null, []));
    dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    const event = createMockEvent();
    await ipcMain.handlers['export-csv'](event, {});
    const sent = event.sender.sent.find(m => m.channel === 'csv-export-cancelled');
    expect(sent).toBeTruthy();
  });

  test('export-csv getTimersForExport error sends csv-export-error', async () => {
    db.getTimersForExport.mockImplementation((pid, sd, ed, cb) => cb(new Error('export-fail')));
    const event = createMockEvent();
    await ipcMain.handlers['export-csv'](event, {});
    const err = event.sender.sent.find(m => m.channel === 'csv-export-error');
    expect(err).toBeTruthy();
    expect(err.payload).toBe('export-fail');
  });

  test('export-csv with projectId resolves project name before export', async () => {
    db.getProjects.mockImplementation((cb) =>
      cb(null, [{ id: 5, name: 'My Proj' }]));
    db.getTimersForExport.mockImplementation((pid, sd, ed, cb) => cb(null, []));
    dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    const event = createMockEvent();
    await ipcMain.handlers['export-csv'](event, { projectId: '5' });
    expect(db.getProjects).toHaveBeenCalled();
    const sent = event.sender.sent.find(m => m.channel === 'csv-export-cancelled');
    expect(sent).toBeTruthy();
  });

  // --- dark-mode:toggle ---
  test('dark-mode:toggle from light sets themeSource to dark', () => {
    nativeTheme.shouldUseDarkColors = false;
    ipcMain.handleHandlers['dark-mode:toggle']();
    expect(nativeTheme.themeSource).toBe('dark');
  });

  test('dark-mode:toggle from dark sets themeSource to light', () => {
    nativeTheme.shouldUseDarkColors = true;
    ipcMain.handleHandlers['dark-mode:toggle']();
    expect(nativeTheme.themeSource).toBe('light');
  });

  // --- dark-mode:system ---
  test('dark-mode:system sets themeSource to system and returns it', () => {
    nativeTheme.themeSource = 'dark';
    const result = ipcMain.handleHandlers['dark-mode:system']();
    expect(nativeTheme.themeSource).toBe('system');
    expect(result).toBe('system');
  });

  // --- dark-mode:set ---
  test('dark-mode:set valid theme updates themeSource and returns state', () => {
    const result = ipcMain.handleHandlers['dark-mode:set'](null, 'dark');
    expect(nativeTheme.themeSource).toBe('dark');
    expect(result.themeSource).toBe('dark');
    expect(typeof result.shouldUseDarkColors).toBe('boolean');
  });

  test('dark-mode:set invalid theme throws', () => {
    expect(() => ipcMain.handleHandlers['dark-mode:set'](null, 'invalid'))
      .toThrow('Invalid theme: invalid');
  });

  // --- dark-mode:get ---
  test('dark-mode:get returns current theme state', () => {
    nativeTheme.themeSource = 'light';
    nativeTheme.shouldUseDarkColors = false;
    const result = ipcMain.handleHandlers['dark-mode:get']();
    expect(result.themeSource).toBe('light');
    expect(result.shouldUseDarkColors).toBe(false);
  });
});
