const { contextBridge, ipcRenderer } = require('electron');

/**
 * Channels the renderer may send on, and the channels it may listen to.
 *
 * The bridge used to forward any channel the caller named. That made every
 * ipcMain handler - including delete-project, delete-timer and export-csv,
 * which writes a file through a save dialog - reachable from anything running
 * in the renderer. Allowlisting bounds the damage if a rendering bug ever
 * reintroduces script injection, and it keeps the IPC surface documented in
 * one place.
 *
 * Keep these in sync with src/main/ipcHandlers.js.
 */
const SEND_CHANNELS = Object.freeze([
  'add-project',
  'delete-project',
  'get-projects',
  'save-timer',
  'get-timers',
  'update-timer',
  'delete-timer',
  'export-csv',
]);

const RECEIVE_CHANNELS = Object.freeze([
  'projects',
  'project-added',
  'project-deleted',
  'timers',
  'timers-error',
  'timer-updated',
  'timer-update-error',
  'timer-deleted',
  'timer-delete-error',
  'csv-exported',
  'csv-export-error',
  'csv-export-cancelled',
]);

function assertAllowed(allowed, channel, verb) {
  if (!allowed.includes(channel)) {
    throw new Error(`Blocked IPC ${verb} on unregistered channel "${channel}"`);
  }
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => {
    assertAllowed(SEND_CHANNELS, channel, 'send');
    ipcRenderer.send(channel, data);
  },
  on: (channel, callback) => {
    assertAllowed(RECEIVE_CHANNELS, channel, 'subscribe');
    ipcRenderer.on(channel, (event, args) => callback(args));
  }
});

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system'),
  setTheme: (theme) => ipcRenderer.invoke('dark-mode:set', theme),
  getTheme: () => ipcRenderer.invoke('dark-mode:get')
})
