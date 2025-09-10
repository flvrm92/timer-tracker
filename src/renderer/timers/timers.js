const bodyEl = document.getElementById('timers-body');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageIndicator = document.getElementById('page-indicator');
const projectFilter = document.getElementById('project-filter');
const monthFilter = document.getElementById('month-filter');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const customDateSection = document.getElementById('custom-date-section') || document.querySelector('.custom-date-section');
const exportBtn = document.getElementById('export-btn');
const statusMessage = document.getElementById('status-message');

let currentPage = 1;
let totalPages = 1;
let selectedProjectId = '';
let selectedStartDate = '';
let selectedEndDate = '';
let selectedMonthFilter = 'all-time';

// Initialize theme and icon utilities
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeUtils) {
    const themeManager = window.ThemeUtils.getThemeManager();
    // Theme is automatically applied
  }
});

function formatDuration(sec) {
  const s = Number(sec) || 0;
  const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
  const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const secs = (s % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

function localInputToIso(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function getMonthDateRange(monthFilter) {
  const now = new Date();

  if (monthFilter === 'this-month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  if (monthFilter === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  return { start: '', end: '' };
}

function computeDuration(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.floor((e - s) / 1000);
}

function createActionButtons() {
  if (!window.IconUtils) {
    return `
      <button class="btn btn-sm btn-success save-btn" disabled title="Save Changes">Save</button>
      <button class="btn btn-sm btn-secondary cancel-btn" disabled title="Cancel Changes">Cancel</button>
      <button class="btn btn-sm btn-danger delete-btn" title="Delete Timer">Delete</button>
    `;
  }

  const saveIcon = window.IconUtils.createIcon('save', {
    size: 'sm',
    title: 'Save Changes',
    ariaLabel: 'Save Changes'
  });

  const cancelIcon = window.IconUtils.createIcon('cancel', {
    size: 'sm',
    title: 'Cancel Changes',
    ariaLabel: 'Cancel Changes'
  });

  const deleteIcon = window.IconUtils.createIcon('delete', {
    size: 'sm',
    title: 'Delete Timer',
    ariaLabel: 'Delete Timer'
  });

  return `
    <button class="btn btn-sm btn-success btn-icon save-btn tooltip" disabled title="Save Changes" aria-label="Save Changes">
      ${saveIcon}
      <span class="tooltip-text">Save Changes</span>
    </button>
    <button class="btn btn-sm btn-secondary btn-icon cancel-btn tooltip" disabled title="Cancel Changes" aria-label="Cancel Changes">
      ${cancelIcon}
      <span class="tooltip-text">Cancel Changes</span>
    </button>
    <button class="btn btn-sm btn-danger btn-icon delete-btn tooltip" title="Delete Timer" aria-label="Delete Timer">
      ${deleteIcon}
      <span class="tooltip-text">Delete Timer</span>
    </button>
  `;
}

function renderRows(rows) {
  bodyEl.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;

    const startLocal = isoToLocalInput(row.start_time);
    const endLocal = isoToLocalInput(row.end_time);

    // Format amount earned
    const amountEarned = row.amount_earned
      ? `R$ ${parseFloat(row.amount_earned).toFixed(2)}`
      : '';

    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.project_name || ''}</td>
      <td>${row.task_description || ''}</td>
      <td><input type="datetime-local" class="form-input start-input" value="${startLocal}"></td>
      <td><input type="datetime-local" class="form-input end-input" value="${endLocal}"></td>
      <td class="duration-cell">${formatDuration(row.duration)}</td>
      <td style="text-align: right;">${amountEarned}</td>
      <td style="text-align: right;">
        ${createActionButtons()}
        <div class="error" style="display:none"></div>
      </td>
    `;

    bodyEl.appendChild(tr);
  });
}

function markDirty(tr, dirty) {
  const saveBtn = tr.querySelector('.save-btn');
  const cancelBtn = tr.querySelector('.cancel-btn');
  if (dirty) {
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
  } else {
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
  }
}

function updateComputedDuration(tr) {
  const startVal = tr.querySelector('.start-input').value;
  const endVal = tr.querySelector('.end-input').value;
  const startIso = localInputToIso(startVal);
  const endIso = localInputToIso(endVal);
  const durSec = computeDuration(startIso, endIso);
  tr.querySelector('.duration-cell').textContent = formatDuration(durSec);
  return { startIso, endIso, durSec };
}

bodyEl.addEventListener('input', (e) => {
  if (e.target.classList.contains('start-input') || e.target.classList.contains('end-input')) {
    const tr = e.target.closest('tr');
    markDirty(tr, true);
    const { startIso, endIso } = updateComputedDuration(tr);
    validateRow(tr, startIso, endIso);
  }
});

function validateRow(tr, startIso, endIso) {
  const errEl = tr.querySelector('.error');
  tr.classList.remove('row-invalid');
  errEl.style.display = 'none';
  errEl.textContent = '';
  if (!startIso || !endIso) return false;
  if (new Date(endIso) < new Date(startIso)) {
    errEl.textContent = 'End before start';
    errEl.style.display = 'block';
    tr.classList.add('row-invalid');
    return false;
  }
  return true;
}

bodyEl.addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;

  if (e.target.classList.contains('cancel-btn')) {
    fetchPage(); // Reload with current filter
  }

  if (e.target.classList.contains('save-btn')) {
    const startVal = tr.querySelector('.start-input').value;
    const endVal = tr.querySelector('.end-input').value;
    const startIso = localInputToIso(startVal);
    const endIso = localInputToIso(endVal);
    if (!validateRow(tr, startIso, endIso)) return;
    window.ipcRenderer.send('update-timer', { id: Number(tr.dataset.id), start_time: startIso, end_time: endIso });
  }

  if (e.target.classList.contains('delete-btn')) {
    window.ipcRenderer.send('delete-timer', { id: Number(tr.dataset.id) });
  }
});

prevBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    fetchPage();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    fetchPage();
  }
});

// Project filter change handler
projectFilter.addEventListener('change', (e) => {
  selectedProjectId = e.target.value;
  currentPage = 1; // Reset to first page when filter changes
  fetchPage();
});

// Month filter change handler
monthFilter.addEventListener('change', (e) => {
  selectedMonthFilter = e.target.value;

  if (selectedMonthFilter === 'custom') {
    customDateSection.style.display = 'flex';
    // Don't fetch immediately for custom - wait for date inputs
  } else {
    customDateSection.style.display = 'none';

    if (selectedMonthFilter === 'all-time') {
      selectedStartDate = '';
      selectedEndDate = '';
    } else {
      const dateRange = getMonthDateRange(selectedMonthFilter);
      selectedStartDate = dateRange.start;
      selectedEndDate = dateRange.end;
    }

    currentPage = 1;
    fetchPage();
  }
});

// Date input change handlers
function handleDateChange() {
  if (selectedMonthFilter === 'custom') {
    selectedStartDate = startDateInput.value;
    selectedEndDate = endDateInput.value;

    // Validate date range
    if (selectedStartDate && selectedEndDate && selectedStartDate > selectedEndDate) {
      showStatusMessage('Start date must be before or equal to end date', 'error');
      return;
    }

    currentPage = 1;
    fetchPage();
  }
}

startDateInput.addEventListener('change', handleDateChange);
endDateInput.addEventListener('change', handleDateChange);

// Export button handler
exportBtn.addEventListener('click', () => {
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  window.ipcRenderer.send('export-csv', {
    projectId: selectedProjectId,
    startDate: selectedStartDate,
    endDate: selectedEndDate
  });
});

function fetchPage() {
  window.ipcRenderer.send('get-timers', {
    page: currentPage,
    projectId: selectedProjectId,
    startDate: selectedStartDate,
    endDate: selectedEndDate
  });
}

function showStatusMessage(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

function populateProjectFilter(projects) {
  // Clear existing options except "All Projects"
  projectFilter.innerHTML = '<option value="">All Projects</option>';

  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectFilter.appendChild(option);
  });
}

function loadProjects() {
  window.ipcRenderer.send('get-projects');
}

window.ipcRenderer.on('timers', (payload) => {
  const { rows, page, totalPages: tp } = payload;
  currentPage = page;
  totalPages = tp;
  renderRows(rows);
  pageIndicator.textContent = `Page ${page} / ${tp}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= tp;
});

window.ipcRenderer.on('projects', (projects) => {
  populateProjectFilter(projects);
});

window.ipcRenderer.on('csv-exported', ({ filePath, recordCount }) => {
  exportBtn.disabled = false;
  exportBtn.textContent = 'Export CSV';
  showStatusMessage(`Successfully exported ${recordCount} records to ${filePath}`, 'success');
});

window.ipcRenderer.on('csv-export-error', (message) => {
  exportBtn.disabled = false;
  exportBtn.textContent = 'Export CSV';
  showStatusMessage(`Export failed: ${message}`, 'error');
});

window.ipcRenderer.on('csv-export-cancelled', () => {
  exportBtn.disabled = false;
  exportBtn.textContent = 'Export CSV';
});

window.ipcRenderer.on('timers-error', (message) => {
  bodyEl.innerHTML = `<tr><td colspan="7">Error: ${message}</td></tr>`;
});

window.ipcRenderer.on('timer-update-error', ({ id, message }) => {
  const tr = bodyEl.querySelector(`tr[data-id='${id}']`);
  if (!tr) return;
  const errEl = tr.querySelector('.error');
  errEl.textContent = message;
  errEl.style.display = 'block';
  tr.classList.add('row-invalid');
});

window.ipcRenderer.on('timer-updated', (row) => {
  const tr = bodyEl.querySelector(`tr[data-id='${row.id}']`);
  if (!tr) return fetchPage();

  const startLocal = isoToLocalInput(row.start_time);
  const endLocal = isoToLocalInput(row.end_time);

  // Format amount earned
  const amountEarned = row.amount_earned
    ? `$${parseFloat(row.amount_earned).toFixed(2)}`
    : '';

  tr.innerHTML = `
    <td>${row.id}</td>
    <td>${row.project_name || ''}</td>
    <td>${row.task_description || ''}</td>
    <td><input type="datetime-local" class="form-input start-input" value="${startLocal}"></td>
    <td><input type="datetime-local" class="form-input end-input" value="${endLocal}"></td>
    <td class="duration-cell">${formatDuration(row.duration)}</td>
    <td style="text-align: right;">${amountEarned}</td>
    <td class="actions">
      ${createActionButtons()}
      <div class="error" style="display:none"></div>
    </td>
  `;
});

window.ipcRenderer.on('timer-deleted', ({ id }) => {
  const tr = bodyEl.querySelector(`tr[data-id='${id}']`);
  if (tr) {
    tr.remove();
    showStatusMessage('Timer deleted successfully', 'success');
  }
});

// Initialize
loadProjects();
fetchPage();
