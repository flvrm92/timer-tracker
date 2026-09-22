/**
 * @jest-environment jsdom
 *
 * The Timer page.
 *
 * Since the clock moved into the main process this page is a pure view: it
 * asks what is running and paints the reply. The parts worth testing are the
 * ones with no obvious failure signal - the two IPC replies ('projects' and
 * 'active-timer') racing each other over the same dropdown, and the guard that
 * keeps the first reply from wiping a half-typed task description.
 */

const PAGE = `
  <div class="timer-display" id="timer-display">00:00:00</div>
  <button id="start-btn"><span>Start Timer</span></button>
  <button id="stop-btn" disabled><span>Stop Timer</span></button>
  <select id="project-dropdown">
    <option value="" disabled selected>Select a project</option>
  </select>
  <input type="text" id="task-desc" />
`;

const PROJECTS = [
  { id: 1, name: 'Acme' },
  { id: 2, name: 'Beta Corp' }
];

let bridge;

function installBridge() {
  bridge = {
    sent: [],
    listeners: {},
    send(channel, payload) { this.sent.push({ channel, payload }); },
    on(channel, callback) { this.listeners[channel] = callback; },
    emit(channel, payload) { if (this.listeners[channel]) this.listeners[channel](payload); }
  };
  window.ipcRenderer = bridge;
}

/** Loads the page script against a fresh DOM, as a document load would. */
function loadPage() {
  document.body.innerHTML = PAGE;
  installBridge();
  global.Dialog = { alert: jest.fn(() => Promise.resolve(true)), toast: jest.fn() };
  jest.resetModules();
  require('../src/renderer/timer/timer');
}

const el = id => document.getElementById(id);
const sentOn = channel => bridge.sent.filter(m => m.channel === channel);
const running = (over = {}) => ({
  projectId: '2',
  projectName: 'Beta Corp',
  taskDesc: 'Migrating the importer',
  startTimeIso: new Date(Date.now()).toISOString(),
  startedAtMs: Date.now(),
  ...over
});

/** Picks a project the way a user would, so the change listener fires. */
function choose(value) {
  el('project-dropdown').value = value;
  el('project-dropdown').dispatchEvent(new Event('change'));
}

beforeEach(() => {
  jest.useFakeTimers();
  loadPage();
});

afterEach(() => {
  jest.useRealTimers();
  delete window.ipcRenderer;
  delete global.Dialog;
});

describe('timer page: startup', () => {
  test('asks for both the project list and the running timer', () => {
    expect(bridge.sent.map(m => m.channel)).toEqual(['get-projects', 'get-active-timer']);
  });

  test('an idle reply leaves the page ready to start', () => {
    bridge.emit('active-timer', null);

    expect(el('start-btn').disabled).toBe(false);
    expect(el('stop-btn').disabled).toBe(true);
    expect(el('timer-display').textContent).toBe('00:00:00');
    expect(el('task-desc').disabled).toBe(false);
  });

  test('an idle reply does not wipe a description typed while it was in flight', () => {
    el('task-desc').value = 'Already typing';
    bridge.emit('active-timer', null);

    expect(el('task-desc').value).toBe('Already typing');
  });
});

describe('timer page: restoring a run after navigation', () => {
  test('paints the elapsed time the timer actually has, not zero', () => {
    bridge.emit('active-timer', running({ startedAtMs: Date.now() - 3_725_000 }));

    expect(el('timer-display').textContent).toBe('01:02:05');
    expect(el('start-btn').disabled).toBe(true);
    expect(el('stop-btn').disabled).toBe(false);
    expect(el('task-desc').value).toBe('Migrating the importer');
    expect(el('task-desc').disabled).toBe(true);
    expect(el('project-dropdown').disabled).toBe(true);
  });

  test('keeps counting from the anchor rather than a local tally', () => {
    bridge.emit('active-timer', running());

    jest.advanceTimersByTime(5_000);
    expect(el('timer-display').textContent).toBe('00:00:05');

    jest.advanceTimersByTime(7_200_000);
    expect(el('timer-display').textContent).toBe('02:00:05');
  });

  test('selects the running project when the list arrives last', () => {
    bridge.emit('active-timer', running());
    expect(el('project-dropdown').value).toBe('');

    bridge.emit('projects', PROJECTS);
    expect(el('project-dropdown').value).toBe('2');
  });

  test('selects the running project when the list arrives first', () => {
    bridge.emit('projects', PROJECTS);
    bridge.emit('active-timer', running());

    expect(el('project-dropdown').value).toBe('2');
  });
});

describe('timer page: starting', () => {
  test('sends the project, its name and the trimmed description', () => {
    bridge.emit('projects', PROJECTS);
    bridge.emit('active-timer', null);
    choose('1');
    el('task-desc').value = '  Writing the review  ';

    el('start-btn').click();

    expect(sentOn('start-timer')[0].payload).toEqual({
      projectId: '1',
      projectName: 'Acme',
      taskDesc: 'Writing the review'
    });
  });

  test('refuses without a project and never reaches main', () => {
    bridge.emit('projects', PROJECTS);
    bridge.emit('active-timer', null);

    el('start-btn').click();

    expect(sentOn('start-timer')).toHaveLength(0);
    expect(global.Dialog.alert).toHaveBeenCalled();
  });

  test('a double click cannot send two starts', () => {
    bridge.emit('projects', PROJECTS);
    bridge.emit('active-timer', null);
    choose('1');

    el('start-btn').click();
    el('start-btn').click();

    expect(sentOn('start-timer')).toHaveLength(1);
  });

  test('a refusal from main is shown and the page resyncs instead of guessing', () => {
    bridge.emit('projects', PROJECTS);
    bridge.emit('active-timer', null);
    choose('1');
    el('start-btn').click();
    bridge.sent.length = 0;

    bridge.emit('timer-start-error', { reason: 'already-running', message: 'A timer is already running.' });

    expect(global.Dialog.alert).toHaveBeenCalledWith('A timer is already running.', expect.any(Object));
    expect(sentOn('get-active-timer')).toHaveLength(1);
  });
});

describe('timer page: stopping', () => {
  beforeEach(() => {
    bridge.emit('projects', PROJECTS);
    bridge.emit('active-timer', running());
  });

  test('asks main to stop without computing a duration of its own', () => {
    el('stop-btn').click();

    expect(sentOn('stop-timer')).toEqual([{ channel: 'stop-timer', payload: undefined }]);
  });

  test('a double click cannot send two stops', () => {
    el('stop-btn').click();
    el('stop-btn').click();

    expect(sentOn('stop-timer')).toHaveLength(1);
  });

  test('the idle reply clears the form and frees the inputs', () => {
    el('stop-btn').click();
    bridge.emit('active-timer', null);

    expect(el('timer-display').textContent).toBe('00:00:00');
    expect(el('task-desc').value).toBe('');
    expect(el('task-desc').disabled).toBe(false);
    expect(el('project-dropdown').disabled).toBe(false);
    expect(el('start-btn').disabled).toBe(false);
  });

  test('stops repainting once the timer is gone', () => {
    bridge.emit('active-timer', null);

    jest.advanceTimersByTime(60_000);
    expect(el('timer-display').textContent).toBe('00:00:00');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('confirms the save with the duration main reports', () => {
    bridge.emit('active-timer', null);
    bridge.emit('timer-saved', { duration: 3_725 });

    expect(global.Dialog.toast).toHaveBeenCalledWith('Timer saved! Duration: 01:02:05', 'success');
  });

  /**
   * The page is already idle and main has dropped the timer by this point, so
   * the dialog is the only surviving record of the elapsed time.
   */
  test('a failed save is raised as a dialog carrying the lost duration', () => {
    bridge.emit('active-timer', null);
    bridge.emit('timer-save-error', { duration: 3_725, message: 'database is locked' });

    expect(global.Dialog.toast).not.toHaveBeenCalled();
    const [message, options] = global.Dialog.alert.mock.calls[0];
    expect(message).toContain('01:02:05');
    expect(options.severity).toBe('danger');
  });
});
