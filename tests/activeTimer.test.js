const activeTimer = require('../src/main/activeTimer');

describe('activeTimer', () => {
  let now;

  beforeEach(() => {
    activeTimer.reset();
    now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    activeTimer.reset();
  });

  test('starts idle', () => {
    expect(activeTimer.isRunning()).toBe(false);
    expect(activeTimer.getState()).toBeNull();
  });

  test('start records the project and an ISO start stamp', () => {
    const result = activeTimer.start({ projectId: 7, taskDesc: 'Refactor', projectName: 'Acme' });

    expect(result.ok).toBe(true);
    expect(activeTimer.isRunning()).toBe(true);
    expect(result.state).toMatchObject({
      projectId: 7,
      projectName: 'Acme',
      taskDesc: 'Refactor',
      startedAtMs: now
    });
    expect(result.state.startTimeIso).toBe(new Date(now).toISOString());
  });

  test('start without a project is rejected', () => {
    expect(activeTimer.start({ projectId: '' })).toEqual({ ok: false, reason: 'no-project' });
    expect(activeTimer.isRunning()).toBe(false);
  });

  test('a second start is rejected and leaves the first running', () => {
    activeTimer.start({ projectId: 1, taskDesc: 'First' });
    const second = activeTimer.start({ projectId: 2, taskDesc: 'Second' });

    expect(second).toEqual({ ok: false, reason: 'already-running' });
    expect(activeTimer.getState()).toMatchObject({ projectId: 1, taskDesc: 'First' });
  });

  test('the start anchor survives reads and is what elapsed is measured from', () => {
    activeTimer.start({ projectId: 1 });
    const anchor = now;

    now += 65_500; // no ticks ran - this is what a page reload looks like
    expect(activeTimer.getState().startedAtMs).toBe(anchor);

    now += 3_600_000;
    expect(activeTimer.getState().startedAtMs).toBe(anchor);
    expect(activeTimer.stop().duration).toBe(3665);
  });

  test('getState carries no precomputed elapsed for callers to go stale on', () => {
    activeTimer.start({ projectId: 1 });

    expect(activeTimer.getState()).not.toHaveProperty('elapsedSeconds');
  });

  test('a backwards clock adjustment clamps duration to zero rather than going negative', () => {
    activeTimer.start({ projectId: 1 });
    now -= 5_000;

    expect(activeTimer.stop().duration).toBe(0);
  });

  test('stop returns the record to persist and clears the slot', () => {
    activeTimer.start({ projectId: 4, taskDesc: 'Build' });
    const startIso = new Date(now).toISOString();

    now += 7_200_000;
    const finished = activeTimer.stop();

    expect(finished).toEqual({
      selectedProjectId: 4,
      startTime: startIso,
      endTime: new Date(now).toISOString(),
      duration: 7200,
      taskDesc: 'Build'
    });
    expect(activeTimer.isRunning()).toBe(false);
    expect(activeTimer.getState()).toBeNull();
  });

  test('stop while idle returns null', () => {
    expect(activeTimer.stop()).toBeNull();
  });
});
