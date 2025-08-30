jest.mock('electron', () => ({
  ipcMain: {
    handlers: {},
    on(channel, listener) { this.handlers[channel] = listener; },
    handle() { },
  },
  nativeTheme: { shouldUseDarkColors: false, themeSource: 'system' }
}));

const { ipcMain } = require('electron');

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

const db = require('../src/infra/database');
const setupIpcHandlers = require('../src/main/ipcHandlers');

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
  });

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

  test('update-timer success', () => {
    db.updateTimer.mockImplementation((id, s, e, cb) => cb(null, { id, start_time: s, end_time: e, duration: 10 }));
    const event = createMockEvent();
    ipcMain.handlers['update-timer'](event, { id: 5, start_time: '2024-01-01T00:00:00.000Z', end_time: '2024-01-01T00:00:10.000Z' });
    const updated = event.sender.sent.find(m => m.channel === 'timer-updated');
    expect(updated).toBeTruthy();
    expect(updated.payload.duration).toBe(10);
  });

  test('update-timer error', () => {
    db.updateTimer.mockImplementation((id, s, e, cb) => cb(new Error('bad')));
    const event = createMockEvent();
    ipcMain.handlers['update-timer'](event, { id: 5, start_time: '2024-01-01T00:00:00.000Z', end_time: '2024-01-01T00:00:10.000Z' });
    const err = event.sender.sent.find(m => m.channel === 'timer-update-error');
    expect(err).toBeTruthy();
    expect(err.payload.message).toBe('bad');
  });
});
