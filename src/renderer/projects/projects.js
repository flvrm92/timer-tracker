const projectForm = document.getElementById('project-form');
const projectNameInput = document.getElementById('project-name');
const projectsList = document.getElementById('projects-list');

// Initialize theme management
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeUtils) {
    const themeManager = window.ThemeUtils.getThemeManager();
    // Theme is automatically applied
  }
});

function loadProjects() {
  window.ipcRenderer.send('get-projects');
}

function createDeleteButton(projectId, projectName) {
  if (window.IconUtils) {
    const deleteIcon = window.IconUtils.createIcon('delete', {
      size: 'sm',
      title: `Delete ${projectName}`,
      ariaLabel: `Delete ${projectName}`
    });

    return `
      <button 
        class="btn btn-sm btn-danger btn-icon tooltip" 
        onclick="deleteProject(${projectId}, '${projectName.replace(/'/g, "\\'")}')"
        title="Delete ${projectName}"
        aria-label="Delete ${projectName}"
      >
        ${deleteIcon}
        <span class="tooltip-text">Delete Project</span>
      </button>
    `;
  }

  // Fallback if icons aren't loaded
  return `
    <button 
      class="btn btn-sm btn-danger" 
      onclick="deleteProject(${projectId}, '${projectName.replace(/'/g, "\\'")}')"
      title="Delete ${projectName}"
    >
      Delete
    </button>
  `;
}

function populateProjects(projects) {
  projectsList.innerHTML = '';

  if (projects.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="3" style="text-align: center; color: var(--color-text-muted); padding: var(--space-8);">
        No projects found. Create your first project above.
      </td>
    `;
    projectsList.appendChild(row);
    return;
  }

  projects.forEach((project) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${project.id}</td>
      <td><strong>${project.name}</strong></td>
      <td class="actions">
        ${createDeleteButton(project.id, project.name)}
      </td>
    `;
    projectsList.appendChild(row);
  });
}

projectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = projectNameInput.value.trim();

  if (!name) {
    showErrorMessage('Please enter a project name.');
    return;
  }

  if (name.length > 100) {
    showErrorMessage('Project name is too long (maximum 100 characters).');
    return;
  }

  // Disable form during submission
  const submitBtn = projectForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Adding...';

  window.ipcRenderer.send('add-project', name);

  // Re-enable form after a delay (will be properly reset when project is added)
  setTimeout(() => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }, 3000);
});

function deleteProject(id, name) {
  if (!id) {
    showErrorMessage('Invalid project ID.');
    return;
  }

  // Show confirmation dialog
  const confirmMessage = `Are you sure you want to delete the project "${name}"?\n\nThis action cannot be undone, but any existing timers for this project will be preserved.`;

  if (confirm(confirmMessage)) {
    window.ipcRenderer.send('delete-project', id);
    showSuccessMessage(`Project "${name}" has been deleted.`);
  }
}

function showSuccessMessage(message) {
  showMessage(message, 'success');
}

function showErrorMessage(message) {
  showMessage(message, 'error');
}

function showMessage(message, type) {
  // Remove any existing messages
  const existingMessage = document.querySelector('.temp-message');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = `alert alert-${type} temp-message`;
  messageEl.textContent = message;
  messageEl.style.position = 'fixed';
  messageEl.style.top = '20px';
  messageEl.style.right = '20px';
  messageEl.style.zIndex = '1000';
  messageEl.style.maxWidth = '400px';
  messageEl.style.boxShadow = 'var(--shadow-lg)';

  document.body.appendChild(messageEl);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateX(100%)';
      messageEl.style.transition = 'all var(--transition-base)';

      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 200);
    }
  }, 5000);
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
  const submitBtn = projectForm.querySelector('button[type="submit"]');
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<span>Add Project</span>';

  // Show success message
  showSuccessMessage(`Project "${project.name}" has been created successfully.`);

  // Reload projects
  loadProjects();
});

// Initialize
loadProjects();