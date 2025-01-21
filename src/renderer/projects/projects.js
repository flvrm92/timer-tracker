const projectForm = document.getElementById('project-form');
const projectNameInput = document.getElementById('project-name');
const projectsList = document.getElementById('projects-list');

function loadProjects() {
  window.ipcRenderer.send('get-projects');
}

function populateProjects(projects) {
  projectsList.innerHTML = '';
  projects.forEach((project) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${project.id}</td>
      <td>${project.name}</td>
      <td><a href="javascript: deleteProject(${project.id})">delete</a></td>
    `;
    projectsList.appendChild(row);
  });
}

projectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = projectNameInput.value.trim();
  if (name) {
    window.ipcRenderer.send('add-project', name);
    projectNameInput.value = '';
  }
});

function deleteProject(id) {
  if (id) {
    window.ipcRenderer.send('delete-project', id);
  }
}

window.ipcRenderer.on('project-deleted', () => {
  loadProjects();
});

window.ipcRenderer.on('projects', (projects) => {
  populateProjects(projects);
});

window.ipcRenderer.on('project-added', (project) => {
  loadProjects();
});

loadProjects();