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
    api.send('ch', 42);
    expect(ipcRenderer.send).toHaveBeenCalledWith('ch', 42);
  });

  test('on wraps ipcRenderer.on and strips event arg from callback', () => {
    const api = getExposed('ipcRenderer');
    const cb = jest.fn();
    api.on('my-channel', cb);
    expect(ipcRenderer.on).toHaveBeenCalledWith('my-channel', expect.any(Function));
    const wrapped = ipcRenderer.on.mock.calls.find(c => c[0] === 'my-channel')[1];
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
