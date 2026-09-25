const { contextBridge } = require('electron');

/**
 * The About popup's entire bridge: one frozen, read-only object.
 *
 * It deliberately does not reuse src/settings/preload.js. That preload
 * allowlists twelve send channels, including delete-project, delete-timer and
 * export-csv, which writes a file through a save dialog. The About page needs
 * none of them, and giving it none is cheaper than trusting it with all of
 * them. Nothing here can send, invoke or subscribe.
 *
 * The payload arrives through the window's additionalArguments rather than
 * over IPC, so adding this page did not widen the main preload's allowlists or
 * add an ipcMain handler.
 */
const PREFIX = '--about-info=';

/** Everything the page renders, or nulls if the argument never arrived. */
const EMPTY = Object.freeze({
  appName: null,
  version: null,
  electron: null,
  node: null,
  chrome: null,
  summary: null,
});

/**
 * Reads the payload the main process attached to this window.
 *
 * Never throws: a missing or unparseable argument leaves the page rendering
 * its static fallbacks rather than a blank window with a console error.
 *
 * @param {string[]} argv the renderer's process.argv.
 * @returns {object} a frozen payload.
 */
function readAboutInfo(argv) {
  try {
    const arg = argv.find((value) => value.startsWith(PREFIX));
    if (!arg) return EMPTY;
    return Object.freeze({ ...EMPTY, ...JSON.parse(decodeURIComponent(arg.slice(PREFIX.length))) });
  } catch (err) {
    console.error('Could not read the About payload:', err.message);
    return EMPTY;
  }
}

contextBridge.exposeInMainWorld('aboutInfo', readAboutInfo(process.argv));
