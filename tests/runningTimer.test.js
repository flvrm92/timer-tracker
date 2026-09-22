/**
 * @jest-environment jsdom
 *
 * The running-timer badge shown on every page that is not the Timer page.
 *
 * What is worth pinning down here is not the markup but the lifecycle: the
 * badge is built lazily, repaints from a timestamp rather than a counter, and
 * has to stop counting the moment main says nothing is running. A leaked
 * interval would keep incrementing a hidden element forever.
 */

/** A stand-in for the preload bridge, with the listeners it registered. */
function installBridge() {
  const bridge = {
    sent: [],
    listeners: {},
    send(channel, payload) { this.sent.push({ channel, payload }); },
    on(channel, callback) { (this.listeners[channel] ||= []).push(callback); },
    emit(channel, payload) { (this.listeners[channel] || []).forEach(cb => cb(payload)); }
  };
  window.ipcRenderer = bridge;
  return bridge;
}

function loadBadge() {
  jest.resetModules();
  return require('../src/shared/components/runningTimer');
}

function badge() {
  return document.getElementById('running-timer-indicator');
}

describe('runningTimer badge', () => {
  let bridge;
  let RunningTimer;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    bridge = installBridge();
    RunningTimer = loadBadge();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.ipcRenderer;
  });

  test('asks main what is running as soon as it loads', () => {
    expect(bridge.sent).toEqual([{ channel: 'get-active-timer', payload: undefined }]);
  });

  test('stays out of the DOM until there is something to show', () => {
    expect(badge()).toBeNull();
  });

  test('renders the project name and elapsed time once a timer is running', () => {
    bridge.emit('active-timer', {
      projectId: 1,
      projectName: 'Acme',
      startedAtMs: Date.now() - 65_000
    });

    expect(badge().hidden).toBe(false);
    expect(badge().querySelector('.running-timer-project').textContent).toBe('Acme');
    expect(badge().querySelector('.running-timer-elapsed').textContent).toBe('00:01:05');
  });

  test('counts up from the anchor without main pushing a tick', () => {
    bridge.emit('active-timer', { projectId: 1, projectName: 'Acme', startedAtMs: Date.now() });

    jest.advanceTimersByTime(3_000);
    expect(badge().querySelector('.running-timer-elapsed').textContent).toBe('00:00:03');

    jest.advanceTimersByTime(3_600_000);
    expect(badge().querySelector('.running-timer-elapsed').textContent).toBe('01:00:03');
    expect(bridge.sent.filter(m => m.channel === 'get-active-timer').length).toBe(1);
  });

  test('a project name is written as text, never as markup', () => {
    bridge.emit('active-timer', {
      projectId: 1,
      projectName: '<img src=x onerror=alert(1)>',
      startedAtMs: Date.now()
    });

    const project = badge().querySelector('.running-timer-project');
    expect(project.querySelector('img')).toBeNull();
    expect(project.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  test('falls back to a generic label when the project name is missing', () => {
    bridge.emit('active-timer', { projectId: 1, projectName: null, startedAtMs: Date.now() });

    expect(badge().querySelector('.running-timer-project').textContent).toBe('Timer running');
  });

  test('hides and stops repainting when the timer is stopped', () => {
    bridge.emit('active-timer', { projectId: 1, projectName: 'Acme', startedAtMs: Date.now() });
    jest.advanceTimersByTime(2_000);

    bridge.emit('active-timer', null);
    expect(badge().hidden).toBe(true);

    const frozen = badge().querySelector('.running-timer-elapsed').textContent;
    jest.advanceTimersByTime(10_000);
    expect(badge().querySelector('.running-timer-elapsed').textContent).toBe(frozen);
  });

  test('a second running state does not leave the first interval repainting', () => {
    const startedAtMs = Date.now();
    bridge.emit('active-timer', { projectId: 1, projectName: 'Acme', startedAtMs });
    bridge.emit('active-timer', { projectId: 2, projectName: 'Beta', startedAtMs });

    expect(jest.getTimerCount()).toBe(1);
    expect(badge().querySelector('.running-timer-project').textContent).toBe('Beta');
  });

  /**
   * Invoking the captured handler rather than dispatching a real focus event:
   * every test in this file loads the module again against the same jsdom
   * window, so the listeners pile up and a dispatched event would fan out to
   * all of them. A real page loads the script once per document.
   */
  test('regaining focus resyncs rather than trusting what is on screen', () => {
    const added = jest.spyOn(window, 'addEventListener');
    document.body.innerHTML = '';
    bridge = installBridge();
    loadBadge();

    const onFocus = added.mock.calls.find(([type]) => type === 'focus')[1];
    bridge.sent.length = 0;
    onFocus();

    expect(bridge.sent).toEqual([{ channel: 'get-active-timer', payload: undefined }]);
    added.mockRestore();
  });

  test('formatTime pads every field and carries hours past a day', () => {
    expect(RunningTimer.formatTime(0)).toBe('00:00:00');
    expect(RunningTimer.formatTime(59)).toBe('00:00:59');
    expect(RunningTimer.formatTime(3_600)).toBe('01:00:00');
    expect(RunningTimer.formatTime(90_061)).toBe('25:01:01');
  });

  test('does nothing at all without the preload bridge', () => {
    delete window.ipcRenderer;
    document.body.innerHTML = '';

    expect(() => loadBadge()).not.toThrow();
    expect(badge()).toBeNull();
  });
});
