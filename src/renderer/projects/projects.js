const projectForm = document.getElementById('project-form');
const projectNameInput = document.getElementById('project-name');
const isBillableInput = document.getElementById('is-billable');
const hourlyRateInput = document.getElementById('hourly-rate');
const projectsList = document.getElementById('projects-list');

// Initialize theme management
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeUtils) {
    const themeManager = window.ThemeUtils.getThemeManager();
    // Theme is automatically applied
  }

  // Add event listener for billable checkbox
  isBillableInput.addEventListener('change', () => {
    if (isBillableInput.checked) {
      hourlyRateInput.disabled = false;
      hourlyRateInput.focus();
    } else {
      hourlyRateInput.disabled = true;
      hourlyRateInput.value = '';
    }
  });
});

function loadProjects() {
  window.ipcRenderer.send('get-projects');
}

/**
 * Builds the delete button for a project row as a DOM element.
 *
 * This deliberately returns an element rather than an HTML string: the previous
 * version emitted an inline `onclick="deleteProject(1, 'name')"` attribute with
 * only single quotes escaped, so a project name containing a double quote or an
 * angle bracket broke out of the attribute. Attaching the handler here also
 * lets the CSP drop `script-src 'unsafe-inline'` entirely.
 *
 * @param {{id: number, name: string}} project
 * @returns {HTMLButtonElement}
 */
function createDeleteButton(project) {
  const label = `Delete ${project.name}`;
  const onClick = () => deleteProject(project.id, project.name);

  if (window.IconUtils) {
    const button = window.IconUtils.createIconButton('delete', {
      variant: 'danger',
      size: 'sm',
      title: label,
      ariaLabel: label,
      onClick
    });
    window.IconUtils.addTooltip(button, 'Delete Project');
    return button;
  }

  // Fallback if icons aren't loaded.
  const button = document.createElement('button');
  button.className = 'btn btn-sm btn-danger';
  button.textContent = 'Delete';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

function populateProjects(projects) {
  projectsList.innerHTML = '';

  if (projects.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: var(--space-8);">
        No projects found. Create your first project above.
      </td>
    `;
    projectsList.appendChild(row);
    return;
  }

  projects.forEach((project) => {
    const row = document.createElement('tr');

    // Format billable status
    const billableStatus = project.is_billable ? '✓' : '';

    // Format hourly rate
    const hourlyRate = project.is_billable && project.hourly_rate
      ? `R$ ${parseFloat(project.hourly_rate).toFixed(2)}`
      : '';

    // project.name is user-supplied and goes through innerHTML, so it has to be
    // escaped. The delete button is appended as a node so it carries no inline
    // onclick attribute.
    row.innerHTML = `
      <td>${project.id}</td>
      <td><strong>${escapeHtml(project.name)}</strong></td>
      <td style="text-align: center;">${billableStatus}</td>
      <td style="text-align: right;">${hourlyRate}</td>
      <td class="actions"></td>
    `;
    row.querySelector('.actions').appendChild(createDeleteButton(project));
    projectsList.appendChild(row);
  });
}

projectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = projectNameInput.value.trim();
  const isBillable = isBillableInput.checked;
  const hourlyRate = hourlyRateInput.value.trim();

  if (!name) {
    Dialog.toast('Please enter a project name.', 'error');
    return;
  }

  if (name.length > 100) {
    Dialog.toast('Project name is too long (maximum 100 characters).', 'error');
    return;
  }

  // Validate hourly rate if billable is selected
  if (isBillable) {
    if (!hourlyRate) {
      Dialog.toast('Please enter an hourly rate for billable projects.', 'error');
      return;
    }

    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      Dialog.toast('Please enter a valid positive hourly rate.', 'error');
      return;
    }
  }

  // Disable form during submission
  const submitBtn = projectForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Adding...';

  // Send project data with billable information
  const projectData = {
    name,
    isBillable,
    hourlyRate: isBillable ? parseFloat(hourlyRate) : null
  };

  window.ipcRenderer.send('add-project', projectData);

  // Re-enable form after a delay (will be properly reset when project is added)
  setTimeout(() => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }, 3000);
});

/**
 * Confirms and deletes a project.
 *
 * Awaiting the pop-up is safe here: the only caller is the delete button's
 * click closure in createDeleteButton, which ignores the return value. The
 * message embeds the user-supplied project name, which Dialog renders with
 * textContent rather than markup.
 */
async function deleteProject(id, name) {
  if (!id) {
    Dialog.toast('Invalid project ID.', 'error');
    return;
  }

  const confirmMessage = `Are you sure you want to delete the project "${name}"?\n\nThis action cannot be undone, but any existing timers for this project will be preserved.`;

  const confirmed = await Dialog.confirm(confirmMessage, {
    title: 'Delete project',
    severity: 'danger',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel'
  });

  if (confirmed) {
    window.ipcRenderer.send('delete-project', id);
    Dialog.toast(`Project "${name}" has been deleted.`, 'success');
  }
}

// Event listeners
window.ipcRenderer.on('project-deleted', () => {
  loadProjects();
});

window.ipcRenderer.on('projects', (projects) => {
  populateProjects(projects);
});

window.ipcRenderer.on('project-added', (project) => {
  // Reset form
  projectNameInput.value = '';
  isBillableInput.checked = false;
  hourlyRateInput.value = '';
  hourlyRateInput.disabled = true;

  const submitBtn = projectForm.querySelector('button[type="submit"]');
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<span>Add Project</span>';

  // Show success message
  const billableText = project.is_billable ? ` (Billable at $${parseFloat(project.hourly_rate || 0).toFixed(2)}/hr)` : '';
  Dialog.toast(`Project "${project.name}"${billableText} has been created successfully.`, 'success');

  // Reload projects
  loadProjects();
});

// Initialize
loadProjects();