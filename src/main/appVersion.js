/**
 * The single answer to "what version is this?".
 *
 * Everything user-facing about the build - the Help menu label and the About
 * popup - reads from here, so the two can never disagree. The underlying
 * source is Electron's own app metadata, which resolves to package.json's
 * `version` in development and in a packaged MSIX alike. That is the same
 * field forge.config.js widens into the four-part manifest version, so bumping
 * package.json remains the one act that moves the version everywhere.
 *
 * Every entry point takes its metadata provider as an argument so the module
 * is pure under test: no live Electron `app`, no process globals.
 */

/** The friendly product name. Deliberately not app.getName(), which is the
 *  packaging name `time-tracker` and is load-bearing for the userData path. */
const APP_NAME = 'Timer Tracker';

/** Rendered wherever a real version could not be read. Clearly not a semver. */
const UNKNOWN = 'unknown';

/**
 * The real metadata provider, resolved lazily so that importing this module
 * never drags in Electron - tests inject their own and stay pure.
 *
 * @returns {{getVersion: function(): string, versions: object}}
 */
function electronProvider() {
  const { app } = require('electron');
  return { getVersion: () => app.getVersion(), versions: process.versions };
}

/** Trims a candidate to a non-empty string, or null if it is not one. */
function clean(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * The application version, e.g. `1.0.5`.
 *
 * Never throws: a provider that is missing, malformed or blows up yields the
 * placeholder instead. Version display must not be able to stop the app from
 * starting or leave the menu half-built.
 *
 * @param {object} [provider] metadata provider; defaults to Electron's.
 * @returns {string} the version, or `unknown`.
 */
function getVersion(provider = electronProvider()) {
  try {
    return clean(provider.getVersion()) || UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/**
 * The Electron, Node and Chromium versions the About popup shows. Read from
 * the same provider as the app version so the popup has one dependency.
 *
 * @param {object} [provider] metadata provider; defaults to Electron's.
 * @returns {{electron: string, node: string, chrome: string}}
 */
function getRuntimeVersions(provider = electronProvider()) {
  let versions;
  try {
    versions = provider.versions || {};
  } catch {
    versions = {};
  }
  return {
    electron: clean(versions.electron) || UNKNOWN,
    node: clean(versions.node) || UNKNOWN,
    chrome: clean(versions.chrome) || UNKNOWN,
  };
}

/**
 * The Help menu item's label, with the version in it so the current build is
 * readable without opening anything.
 *
 * @param {object} [provider] metadata provider; defaults to Electron's.
 * @returns {string} e.g. `About Timer Tracker (v1.0.5)`.
 */
function getMenuLabel(provider = electronProvider()) {
  const version = getVersion(provider);
  const suffix = version === UNKNOWN ? `version ${UNKNOWN}` : `v${version}`;
  return `About ${APP_NAME} (${suffix})`;
}

/**
 * The one-line summary the popup's Copy button puts on the clipboard. Built
 * here rather than in the page so that what a user pastes into a bug report is
 * covered by the same tests as the rest of the version surface.
 *
 * @param {{version: string, electron: string, node: string, chrome: string}} info
 * @returns {string}
 */
function formatSummary({ version, electron, node, chrome }) {
  return `${APP_NAME} v${version} (Electron ${electron}, Node ${node}, Chromium ${chrome})`;
}

/**
 * Everything the About popup renders, in one frozen payload. This is what the
 * About preload hands to the page, which is why it carries the finished
 * summary string too - the page writes text, it does not compose it.
 *
 * @param {object} [provider] metadata provider; defaults to Electron's.
 * @returns {{appName: string, version: string, electron: string, node: string,
 *            chrome: string, summary: string}}
 */
function buildAboutInfo(provider = electronProvider()) {
  const info = {
    appName: APP_NAME,
    version: getVersion(provider),
    ...getRuntimeVersions(provider),
  };
  return { ...info, summary: formatSummary(info) };
}

module.exports = {
  APP_NAME,
  UNKNOWN,
  getVersion,
  getRuntimeVersions,
  getMenuLabel,
  formatSummary,
  buildAboutInfo,
};
