/**
 * Running-timer indicator for the pages that are not the Timer page.
 *
 * Because navigation destroys the renderer, a timer started on the Timer page
 * is invisible everywhere else - the user has no way to tell it is still
 * going. This badge asks the main process what is running and keeps counting
 * from the start timestamp it gets back.
 *
 * Repainting is local: elapsed is derived from `startedAtMs` each second
 * rather than accumulated or pushed over IPC, so every page shows the same
 * number without a tick per second crossing the bridge.
 *
 * Display only - stopping stays on the Timer page.
 */
(function () {
  'use strict';

  const INDICATOR_ID = 'running-timer-indicator';

  let elements = null;
  let state = null;
  let repaintInterval = null;

  function formatTime(seconds) {
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  }

  function build() {
    if (elements) return elements;

    const root = document.createElement('div');
    root.id = INDICATOR_ID;
    root.className = 'running-timer';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.hidden = true;

    const dot = document.createElement('span');
    dot.className = 'running-timer-dot';
    dot.setAttribute('aria-hidden', 'true');

    const elapsed = document.createElement('span');
    elapsed.className = 'running-timer-elapsed';
    elapsed.textContent = '00:00:00';

    const project = document.createElement('span');
    project.className = 'running-timer-project';

    root.appendChild(dot);
    root.appendChild(elapsed);
    root.appendChild(project);
    document.body.appendChild(root);

    elements = { root, elapsed, project };
    return elements;
  }

  function paint() {
    if (!state || !elements) return;
    const seconds = Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000));
    elements.elapsed.textContent = formatTime(seconds);
  }

  function render(next) {
    state = next;
    const ui = build();

    if (repaintInterval) {
      clearInterval(repaintInterval);
      repaintInterval = null;
    }

    if (!state) {
      ui.root.hidden = true;
      return;
    }

    // textContent, never innerHTML - the project name is user input.
    ui.project.textContent = state.projectName || 'Timer running';
    ui.root.hidden = false;
    paint();
    repaintInterval = setInterval(paint, 1000);
  }

  function refresh() {
    if (window.ipcRenderer) window.ipcRenderer.send('get-active-timer');
  }

  function init() {
    if (!window.ipcRenderer) return;

    window.ipcRenderer.on('active-timer', render);
    // The badge is built lazily by render(); a page that regains focus after a
    // timer was stopped elsewhere resyncs rather than counting into the void.
    window.addEventListener('focus', refresh);
    refresh();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  const api = { init, render, refresh, formatTime };

  if (typeof window !== 'undefined') window.RunningTimer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
