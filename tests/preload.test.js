jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
  },
}));

const { contextBridge, ipcRenderer } = require('electron');

beforeAll(() => {
  require('../src/settings/preload');
});

function getExposed(name) {
  const call = contextBridge.exposeInMainWorld.mock.calls.find(c => c[0] === name);
  expect(call).toBeDefined();
  return call[1];
}

describe('preload: ipcRenderer API shape', () => {
  test('exposes ipcRenderer namespace', () => {
    getExposed('ipcRenderer');
  });

  test('exposes send function', () => {
    const api = getExposed('ipcRenderer');
    expect(typeof api.send).toBe('function');
  });

  test('exposes on function', () => {
    const api = getExposed('ipcRenderer');
    expect(typeof api.on).toBe('function');
  });

  test('send delegates to ipcRenderer.send', () => {
    const api = getExposed('ipcRenderer');
    api.send('get-timers', 42);
    expect(ipcRenderer.send).toHaveBeenCalledWith('get-timers', 42);
  });

  test('on wraps ipcRenderer.on and strips event arg from callback', () => {
    const api = getExposed('ipcRenderer');
    const cb = jest.fn();
    api.on('timers', cb);
    expect(ipcRenderer.on).toHaveBeenCalledWith('timers', expect.any(Function));
    const wrapped = ipcRenderer.on.mock.calls.find(c => c[0] === 'timers')[1];
    wrapped({} /* event */, 'payload');
    expect(cb).toHaveBeenCalledWith('payload');
  });
});

describe('preload: darkMode API shape', () => {
  test('exposes darkMode namespace', () => {
    getExposed('darkMode');
  });

  test('exposes toggle, system, setTheme, getTheme functions', () => {
    const api = getExposed('darkMode');
    expect(typeof api.toggle).toBe('function');
    expect(typeof api.system).toBe('function');
    expect(typeof api.setTheme).toBe('function');
    expect(typeof api.getTheme).toBe('function');
  });

  test('toggle invokes dark-mode:toggle', () => {
    const api = getExposed('darkMode');
    api.toggle();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dark-mode:toggle');
  });

  test('system invokes dark-mode:system', () => {
    const api = getExposed('darkMode');
    api.system();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dark-mode:system');
  });

  test('setTheme invokes dark-mode:set with theme arg', () => {
    const api = getExposed('darkMode');
    api.setTheme('dark');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dark-mode:set', 'dark');
  });

  test('getTheme invokes dark-mode:get', () => {
    const api = getExposed('darkMode');
    api.getTheme();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dark-mode:get');
  });
});

describe('preload: IPC channel allowlist', () => {
  const SEND_CHANNELS = [
    'add-project', 'delete-project', 'get-projects', 'save-timer',
    'get-timers', 'update-timer', 'delete-timer', 'export-csv',
  ];
  const RECEIVE_CHANNELS = [
    'projects', 'project-added', 'project-deleted', 'timers', 'timers-error',
    'timer-updated', 'timer-update-error', 'timer-deleted', 'timer-delete-error',
    'csv-exported', 'csv-export-error', 'csv-export-cancelled',
  ];

  test.each(SEND_CHANNELS)('send allows %s', (channel) => {
    const api = getExposed('ipcRenderer');
    expect(() => api.send(channel, null)).not.toThrow();
    expect(ipcRenderer.send).toHaveBeenCalledWith(channel, null);
  });

  test.each(RECEIVE_CHANNELS)('on allows %s', (channel) => {
    const api = getExposed('ipcRenderer');
    expect(() => api.on(channel, jest.fn())).not.toThrow();
  });

  test('send rejects an unregistered channel', () => {
    const api = getExposed('ipcRenderer');
    ipcRenderer.send.mockClear();
    expect(() => api.send('rm-rf', 'payload')).toThrow(/unregistered channel "rm-rf"/);
    expect(ipcRenderer.send).not.toHaveBeenCalled();
  });

  test('on rejects an unregistered channel', () => {
    const api = getExposed('ipcRenderer');
    ipcRenderer.on.mockClear();
    expect(() => api.on('rm-rf', jest.fn())).toThrow(/unregistered channel "rm-rf"/);
    expect(ipcRenderer.on).not.toHaveBeenCalled();
  });

  test('send and receive lists are separate', () => {
    const api = getExposed('ipcRenderer');
    expect(() => api.send('timers', null)).toThrow(/unregistered channel/);
    expect(() => api.on('delete-project', jest.fn())).toThrow(/unregistered channel/);
  });

  test('dark-mode channels are not reachable through the generic bridge', () => {
    const api = getExposed('ipcRenderer');
    expect(() => api.send('dark-mode:set', 'dark')).toThrow(/unregistered channel/);
  });
});
