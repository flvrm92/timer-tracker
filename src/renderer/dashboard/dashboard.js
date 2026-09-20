/**
 * Dashboard page.
 *
 * Reads two IPC channels and renders three things: the KPI row, the project
 * table, and a 12-month earnings chart for whichever project is selected.
 * Everything arriving over IPC is already rounded to 2 decimals, so this file
 * formats and never calculates.
 */

const headMeta = document.getElementById('head-meta');
const statusMessage = document.getElementById('status-message');
const kpiRow = document.getElementById('kpi-row');
const projectsBody = document.getElementById('projects-body');
const projectsFoot = document.getElementById('projects-foot');
const chartTitle = document.getElementById('chart-title');
const chartSelect = document.getElementById('chart-project');
const chartNote = document.getElementById('chart-note');
const chartInlineNote = document.getElementById('chart-inline-note');
const chartCanvas = document.getElementById('earnings-chart');

// formatMoney, formatHours, formatRate and formatDate are globals from the
// helper scripts loaded ahead of this one, the same way timers.js uses them.

let earningsChart = null;
let projects = [];
let selectedProjectId = null;
let lastMonths = [];

/* ------------------------------------------------------------------ theme */

/**
 * Chart.js paints into a canvas, and canvas pixels do not inherit CSS. The
 * palette therefore has to be read out of the custom properties at draw time,
 * and the whole chart repainted whenever the theme changes.
 */
function chartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => (styles.getPropertyValue(name) || '').trim() || fallback;

  return {
    series: read('--color-primary', '#2563eb'),
    grid: read('--color-border', '#e2e8f0'),
    label: read('--color-text-muted', '#94a3b8'),
    text: read('--color-text', '#1e293b'),
    surface: read('--color-background', '#ffffff')
  };
}

/* ------------------------------------------------------------- rendering */

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message error';
}

function clearError() {
  statusMessage.textContent = '';
  statusMessage.className = 'status-message';
}

function billableBadge(isBillable) {
  const span = document.createElement('span');
  span.className = 'badge ' + (isBillable ? 'badge-billable' : 'badge-internal');
  // A word, not just a colour - the status has to survive a greyscale print
  // and a colourblind reader.
  span.textContent = isBillable ? 'Billable' : 'Non-billable';
  return span;
}

function kpiTile(label, value, sub) {
  const tile = document.createElement('div');
  tile.className = 'kpi';

  const dt = document.createElement('dt');
  dt.textContent = label;

  const dd = document.createElement('dd');
  dd.appendChild(document.createTextNode(value));
  if (sub) {
    const small = document.createElement('span');
    small.className = 'kpi-sub';
    small.textContent = sub;
    dd.appendChild(small);
  }

  tile.appendChild(dt);
  tile.appendChild(dd);
  return tile;
}

function renderKpis(totals) {
  kpiRow.textContent = '';
  kpiRow.appendChild(kpiTile('Total earned', formatMoney(totals.totalEarned), 'all time'));
  kpiRow.appendChild(kpiTile(
    'Hours tracked',
    formatHours(totals.totalSeconds) + ' h',
    formatHours(totals.billableSeconds) + ' h billable'
  ));
  kpiRow.appendChild(kpiTile(
    'Projects',
    String(totals.projectCount),
    totals.billableCount + ' billable'
  ));
  kpiRow.appendChild(kpiTile(
    'Last entry',
    totals.lastEntry ? formatDate(totals.lastEntry) : '—',
    totals.lastEntryProject || 'no timers yet'
  ));

  headMeta.textContent = totals.projectCount + ' projects · ' +
    totals.entryCount + ' entries';
}

function cell(text, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function renderProjectTable(rows, totals) {
  projectsBody.textContent = '';
  projectsFoot.textContent = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'empty-state';
    td.textContent = 'No projects yet. Create one on the Projects page and start a timer.';
    tr.appendChild(td);
    projectsBody.appendChild(tr);
    return;
  }

  rows.forEach((project) => {
    const tr = document.createElement('tr');

    const nameCell = document.createElement('td');
    const strong = document.createElement('strong');
    // textContent, not innerHTML - project names are user input.
    strong.textContent = project.name;
    nameCell.appendChild(strong);
    tr.appendChild(nameCell);

    const typeCell = document.createElement('td');
    typeCell.appendChild(billableBadge(project.isBillable));
    tr.appendChild(typeCell);

    tr.appendChild(cell(formatRate(project.hourlyRate), 'num'));
    tr.appendChild(cell(formatHours(project.totalSeconds) + ' h', 'num'));
    tr.appendChild(cell(String(project.entryCount), 'num'));
    tr.appendChild(cell(formatMoney(project.totalEarned), 'num'));
    tr.appendChild(cell(project.lastEntry ? formatDate(project.lastEntry) : '—'));

    projectsBody.appendChild(tr);
  });

  const footRow = document.createElement('tr');
  footRow.appendChild(cell('Total'));
  footRow.appendChild(cell(''));
  footRow.appendChild(cell('', 'num'));
  footRow.appendChild(cell(formatHours(totals.totalSeconds) + ' h', 'num'));
  footRow.appendChild(cell(String(totals.entryCount), 'num'));
  footRow.appendChild(cell(formatMoney(totals.totalEarned), 'num'));
  footRow.appendChild(cell(''));
  projectsFoot.appendChild(footRow);
}

function renderProjectOptions(rows) {
  chartSelect.textContent = '';

  if (!rows.length) {
    const option = document.createElement('option');
    option.textContent = 'No projects';
    option.value = '';
    chartSelect.appendChild(option);
    chartSelect.disabled = true;
    return;
  }

  chartSelect.disabled = false;
  rows.forEach((project) => {
    const option = document.createElement('option');
    option.value = String(project.id);
    option.textContent = project.name;
    chartSelect.appendChild(option);
  });

  if (selectedProjectId === null || !rows.some((p) => p.id === selectedProjectId)) {
    selectedProjectId = rows[0].id;
  }
  chartSelect.value = String(selectedProjectId);
}

/* ----------------------------------------------------------------- chart */

function selectedProject() {
  return projects.find((p) => p.id === selectedProjectId) || null;
}

function renderChart(months) {
  lastMonths = months;

  const project = selectedProject();
  const colors = chartColors();
  const values = months.map((m) => m.totalEarned);
  const peak = Math.max.apply(null, values.concat([0]));

  chartTitle.textContent = 'Earnings per month' + (project ? ' · ' + project.name : '');

  if (months.length) {
    chartNote.textContent = months[0].label + ' – ' + months[months.length - 1].label +
      ' · total ' + formatMoney(values.reduce((sum, v) => sum + v, 0));
  } else {
    chartNote.textContent = '';
  }

  if (project && !project.isBillable) {
    chartInlineNote.hidden = false;
    chartInlineNote.textContent =
      'This project is not billable, so every month is 0.00. Its hours are in the table above.';
  } else {
    chartInlineNote.hidden = true;
    chartInlineNote.textContent = '';
  }

  if (earningsChart) {
    earningsChart.destroy();
    earningsChart = null;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  earningsChart = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: months.map((m) => m.label),
      datasets: [{
        label: project ? project.name : 'Earnings',
        data: values,
        backgroundColor: colors.series,
        hoverBackgroundColor: colors.series,
        borderRadius: 4,
        borderSkipped: 'bottom',
        // Keeps a 2px gap between neighbouring bars at any width.
        categoryPercentage: 0.7,
        barPercentage: 0.9,
        // A true zero still gets a sliver on the baseline, so a quiet month
        // reads as "nothing earned" rather than "no data".
        minBarLength: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduceMotion ? false : undefined,
      // One series named in the title - a legend box would add nothing.
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.surface,
          titleColor: colors.text,
          bodyColor: colors.text,
          borderColor: colors.grid,
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (context) => {
              const bucket = months[context.dataIndex];
              return formatMoney(bucket.totalEarned) + '  ·  ' +
                formatHours(bucket.totalSeconds) + ' h';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: colors.grid },
          ticks: { color: colors.label }
        },
        y: {
          // Always anchored at zero. A truncated axis exaggerates every
          // difference between months.
          beginAtZero: true,
          suggestedMax: peak > 0 ? undefined : 100,
          grid: { color: colors.grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: colors.label,
            callback: (value) => formatMoney(value)
          }
        }
      }
    }
  });

  chartCanvas.setAttribute(
    'aria-label',
    'Monthly earnings' + (project ? ' for ' + project.name : '') +
    (months.length
      ? ', ' + months[0].label + ' to ' + months[months.length - 1].label +
        '. Total ' + formatMoney(values.reduce((sum, v) => sum + v, 0)) + '.'
      : '.')
  );
}

function requestMonthly() {
  if (selectedProjectId === null) return;
  window.ipcRenderer.send('get-project-monthly', { projectId: selectedProjectId });
}

/* ------------------------------------------------------------------ wire */

chartSelect.addEventListener('change', () => {
  selectedProjectId = chartSelect.value === '' ? null : Number(chartSelect.value);
  requestMonthly();
});

window.ipcRenderer.on('dashboard-summary', (payload) => {
  clearError();
  projects = payload.projects || [];
  renderKpis(payload.totals);
  renderProjectTable(projects, payload.totals);
  renderProjectOptions(projects);
  requestMonthly();
});

window.ipcRenderer.on('dashboard-summary-error', (payload) => {
  showError('Could not load the dashboard: ' + (payload && payload.message ? payload.message : 'unknown error'));
});

window.ipcRenderer.on('project-monthly', (payload) => {
  renderChart(payload.months || []);
});

window.ipcRenderer.on('project-monthly-error', (payload) => {
  showError('Could not load the chart: ' + (payload && payload.message ? payload.message : 'unknown error'));
});

document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeUtils) {
    window.ThemeUtils.getThemeManager();
    // Canvas does not inherit CSS custom properties, so a theme switch needs
    // an explicit repaint with the new palette.
    window.ThemeUtils.addThemeListener(() => {
      if (earningsChart) renderChart(lastMonths);
    });
  }

  window.ipcRenderer.send('get-dashboard-summary');
});
