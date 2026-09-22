/**
 * Timer page.
 *
 * The running timer lives in the main process (src/main/activeTimer.js), not
 * here. Navigating to Projects/Timers/Dashboard is a full document reload, so
 * anything this page held would be destroyed; instead the page is a view that
 * asks main what is running and renders it. The only local clock is a repaint
 * interval, and even that reads from the start timestamp main supplied rather
 * than accumulating, so leaving and returning shows the exact elapsed time.
 */

let repaintInterval = null;
let activeState = null;
let rendered = false;
let projectsLoaded = false;
let selectedProjectId = null;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const projectDropdown = document.getElementById('project-dropdown');
const taskDescInput = document.getElementById('task-desc');

// Initialize theme management
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeUtils) {
    const themeManager = window.ThemeUtils.getThemeManager();
    // Theme is automatically applied by the theme manager
  }
});

projectDropdown.addEventListener('change', () => {
  selectedProjectId = projectDropdown.value;
});

function formatTime(seconds) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function elapsedFrom(state) {
  return Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000));
}

/**
 * The single place that writes UI state, so a freshly loaded page and one that
 * just clicked Start go through identical code.
 */
function renderState(state) {
  const wasRunning = rendered && activeState !== null;
  activeState = state;

  if (repaintInterval) {
    clearInterval(repaintInterval);
    repaintInterval = null;
  }

  if (state) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.innerHTML = '<span class="spinner"></span> Running...';

    taskDescInput.value = state.taskDesc || '';
    taskDescInput.disabled = true;
    projectDropdown.disabled = true;

    timerDisplay.textContent = formatTime(elapsedFrom(state));
    repaintInterval = setInterval(() => {
      timerDisplay.textContent = formatTime(elapsedFrom(state));
    }, 1000);
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.innerHTML = '<span>Start Timer</span>';

    timerDisplay.textContent = '00:00:00';
    // Only clear after a stop. The first reply from main lands once the page is
    // already interactive, and must not wipe what the user has started typing.
    if (wasRunning) taskDescInput.value = '';
    taskDescInput.disabled = false;
    projectDropdown.disabled = false;
  }

  rendered = true;
  syncDropdownSelection();
}

/**
 * The project list and the running state arrive as two independent IPC
 * replies, and populateProjectDropdown() rewrites the options. Whichever lands
 * second has to apply the selection, or a restored timer shows a blank project.
 */
function syncDropdownSelection() {
  if (!projectsLoaded || !activeState) return;
  projectDropdown.value = String(activeState.projectId);
  selectedProjectId = projectDropdown.value;
}

async function startTimer() {
  if (!selectedProjectId) {
    await Dialog.alert('Please select a project before starting the timer.', {
      title: 'No project selected',
      severity: 'warning'
    });
    return;
  }

  // Guard against a double click while main is answering; the reply on
  // 'active-timer' is what actually paints the running state.
  startBtn.disabled = true;

  const selectedOption = projectDropdown.options[projectDropdown.selectedIndex];

  window.ipcRenderer.send('start-timer', {
    projectId: selectedProjectId,
    projectName: selectedOption ? selectedOption.textContent : null,
    taskDesc: taskDescInput.value.trim()
  });
}

function stopTimer() {
  stopBtn.disabled = true;
  // Duration and end time are main's to compute - it owns the start stamp.
  window.ipcRenderer.send('stop-timer');
}

function populateProjectDropdown(projects) {
  projectDropdown.innerHTML = '<option value="" disabled selected>Select a project</option>';
  projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectDropdown.appendChild(option);
  });
}

function loadProjects() {
  window.ipcRenderer.send('get-projects');
}

// Event listeners
window.ipcRenderer.on('projects', (projects) => {
  populateProjectDropdown(projects);
  projectsLoaded = true;
  syncDropdownSelection();
});

window.ipcRenderer.on('active-timer', (state) => {
  renderState(state);
});

window.ipcRenderer.on('timer-start-error', ({ message }) => {
  Dialog.alert(message, { title: 'Could not start the timer', severity: 'warning' });
  // Resync rather than guess - main is the authority on what is running.
  window.ipcRenderer.send('get-active-timer');
});

window.ipcRenderer.on('timer-saved', ({ duration }) => {
  Dialog.toast(`Timer saved! Duration: ${formatTime(duration)}`, 'success');
});

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);

// Initialize
loadProjects();
window.ipcRenderer.send('get-active-timer');
