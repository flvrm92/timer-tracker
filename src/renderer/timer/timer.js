let timerInterval;
let elapsedTime = 0;
let startTime;
let selectedProjectId = null;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const projectDropdown = document.getElementById('project-dropdown');

// Initialize theme management
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeUtils) {
    const themeManager = window.ThemeUtils.getThemeManager();
    // Theme is automatically applied by the theme manager
  }
});

projectDropdown.addEventListener('change', () => {
  selectedProjectId = projectDropdown.value;
  console.log(`Selected Project ID: ${selectedProjectId}`);
});

function formatTime(seconds) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function startTimer() {
  if (!selectedProjectId) {
    alert('Please select a project before starting the timer.');
    return;
  }

  startBtn.disabled = true;
  stopBtn.disabled = false;

  startBtn.innerHTML = '<span class="spinner"></span> Running...';

  startTime = new Date().toISOString();
  const startMilliseconds = Date.now() - elapsedTime * 1000;
  timerInterval = setInterval(() => {
    elapsedTime = Math.floor((Date.now() - startMilliseconds) / 1000);
    timerDisplay.textContent = formatTime(elapsedTime);
  }, 1000);

  makeReadonly();
}

function makeReadonly() {
  document.getElementById('task-desc').disabled = true;
  document.getElementById('project-dropdown').disabled = true;
}

function stopTimer() {
  const taskDesc = document.getElementById('task-desc').value.trim();
  startBtn.disabled = false;
  stopBtn.disabled = true;

  startBtn.innerHTML = '<span>Start Timer</span>';

  clearInterval(timerInterval);

  const endTime = new Date().toISOString();
  const duration = elapsedTime; // in seconds

  window.ipcRenderer.send('save-timer', { selectedProjectId, startTime, endTime, duration, taskDesc });

  console.log(`Timer stopped. Duration: ${formatTime(duration)}`);

  // Reset form
  elapsedTime = 0;
  timerDisplay.textContent = '00:00:00';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-desc').disabled = false;
  document.getElementById('project-dropdown').disabled = false;

  // Show success feedback
  showSuccessMessage(`Timer saved! Duration: ${formatTime(duration)}`);
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

function showSuccessMessage(message) {
  // Create a temporary success message
  const messageEl = document.createElement('div');
  messageEl.className = 'alert alert-success';
  messageEl.textContent = message;
  messageEl.style.position = 'fixed';
  messageEl.style.top = '20px';
  messageEl.style.right = '20px';
  messageEl.style.zIndex = '1000';
  messageEl.style.maxWidth = '300px';

  document.body.appendChild(messageEl);

  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
  }, 5000);
}

// Event listeners
window.ipcRenderer.on('projects', (projects) => {
  populateProjectDropdown(projects);
});

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);

// Initialize
loadProjects();