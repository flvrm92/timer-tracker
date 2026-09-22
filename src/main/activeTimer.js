/**
 * The one running timer, owned by the main process.
 *
 * Navigation in this app is `win.loadFile(...)` - a full document reload that
 * destroys the renderer's JS heap. Anything the renderer holds in memory is
 * gone the moment the user opens Projects, Timers or Dashboard. Keeping the
 * running timer here instead means a page is only ever a view of this state:
 * it can be torn down and rebuilt without the timer noticing.
 *
 * Elapsed time is always derived from a wall-clock anchor (`startedAtMs`) and
 * never accumulated, so recomputing it after a page reload is exact rather
 * than approximately right.
 *
 * Deliberately in-memory only, and deliberately free of Electron imports: a
 * crash losing an unsaved session is accepted, and the module stays testable
 * without a mocked runtime.
 */

let active = null;

function isRunning() {
  return active !== null;
}

/**
 * @param {{projectId: *, taskDesc?: string, projectName?: string}} details
 * @returns {{ok: boolean, reason?: string, state?: object}}
 */
function start({ projectId, taskDesc = '', projectName = null } = {}) {
  if (active) return { ok: false, reason: 'already-running' };
  if (projectId === null || projectId === undefined || projectId === '') {
    return { ok: false, reason: 'no-project' };
  }

  // One reading of the clock for both, so the anchor and the stored ISO stamp
  // can never describe different instants.
  const startedAtMs = Date.now();

  active = {
    projectId,
    projectName,
    taskDesc,
    startedAtMs,
    startTimeIso: new Date(startedAtMs).toISOString()
  };

  return { ok: true, state: getState() };
}

/**
 * The payload every page renders from - `null` when nothing is running.
 */
function getState() {
  if (!active) return null;
  return {
    projectId: active.projectId,
    projectName: active.projectName,
    taskDesc: active.taskDesc,
    startTimeIso: active.startTimeIso,
    startedAtMs: active.startedAtMs,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000))
  };
}

/**
 * Ends the run and returns the record to persist, shaped for persistTimer().
 * Returns null when no timer was running, so callers can branch on it.
 */
function stop() {
  if (!active) return null;

  const endedAtMs = Date.now();

  const finished = {
    selectedProjectId: active.projectId,
    startTime: active.startTimeIso,
    endTime: new Date(endedAtMs).toISOString(),
    duration: Math.max(0, Math.floor((endedAtMs - active.startedAtMs) / 1000)),
    taskDesc: active.taskDesc
  };

  active = null;
  return finished;
}

/** Test seam - drops any running timer without persisting it. */
function reset() {
  active = null;
}

module.exports = { start, stop, getState, isRunning, reset };
