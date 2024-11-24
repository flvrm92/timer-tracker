let timerInterval;
let elapsedTime = 0;
let startTime;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

const projectDropdown = document.getElementById('project-dropdown');

const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeLink = document.getElementById('theme-link');

let selectedProjectId = null;

// Format time as HH:MM:SS
function formatTime(seconds) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function startTimer() {
  startBtn.disabled = true;
  stopBtn.disabled = false;

  startTime = new Date().toISOString();
  const startMilliseconds = Date.now() - elapsedTime * 1000;
  timerInterval = setInterval(() => {
    elapsedTime = Math.floor((Date.now() - startMilliseconds) / 1000);
    timerDisplay.textContent = formatTime(elapsedTime);
  }, 1000);
}

function stopTimer() {
  startBtn.disabled = false;
  stopBtn.disabled = true;

  clearInterval(timerInterval);

  const endTime = new Date().toISOString();
  const duration = elapsedTime; // in seconds

  window.ipcRenderer.send('save-timer', { selectedProjectId, startTime, endTime, duration });

  console.log(`Timer stopped. Duration: ${formatTime(duration)}`);
  elapsedTime = 0;
  timerDisplay.textContent = '00:00:00';
}

function toggleTheme() {
  const isDark = themeLink.getAttribute('href') === 'styles/dark-theme.css';
  const newTheme = isDark ? 'light' : 'dark';
  if (isDark) {
    themeLink.setAttribute('href', 'styles/styles.css');
    themeToggleBtn.textContent = 'Enable Dark Theme';
  } else {
    themeLink.setAttribute('href', 'styles/dark-theme.css');
    themeToggleBtn.textContent = 'Disable Dark Theme';
  }
  
  window.ipcRenderer.send('save-theme', newTheme);
}

function loadProjects() {
  window.ipcRenderer.send('get-projects');
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

projectDropdown.addEventListener('change', () => {
  selectedProjectId = projectDropdown.value;
  console.log(`Selected Project ID: ${selectedProjectId}`);
});

window.ipcRenderer.on('theme', (theme) => {
  if (theme === 'dark') {
    themeLink.setAttribute('href', 'styles/dark-theme.css');
    themeToggleBtn.textContent = 'Disable Dark Theme';
  }
});

window.ipcRenderer.on('projects', (projects) => {
  populateProjectDropdown(projects);
});

loadProjects();

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);
themeToggleBtn.addEventListener('click', toggleTheme);
