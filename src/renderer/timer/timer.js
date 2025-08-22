let timerInterval;
let elapsedTime = 0;
let startTime;
let selectedProjectId = null;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

const projectDropdown = document.getElementById('project-dropdown');

document.getElementById('toggle-dark-mode').addEventListener('click', async () => {
  const isDarkMode = await window.darkMode.toggle()
  document.getElementById('theme-source').innerHTML = isDarkMode ? 'Dark' : 'Light'
});

document.getElementById('reset-to-system').addEventListener('click', async () => {
  await window.darkMode.system()
  document.getElementById('theme-source').innerHTML = 'System'
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
  startBtn.disabled = true;
  stopBtn.disabled = false;

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
  startBtn.disabled = false;
  stopBtn.disabled = true;

  clearInterval(timerInterval);

  const endTime = new Date().toISOString();
  const duration = elapsedTime; // in seconds

  const taskDesc = document.getElementById('task-desc').value;

  window.ipcRenderer.send('save-timer', { selectedProjectId, startTime, endTime, duration, taskDesc });

  console.log(`Timer stopped. Duration: ${formatTime(duration)}`);
  elapsedTime = 0;
  timerDisplay.textContent = '00:00:00';
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

window.ipcRenderer.on('projects', (projects) => {
  populateProjectDropdown(projects);
});

loadProjects();

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);