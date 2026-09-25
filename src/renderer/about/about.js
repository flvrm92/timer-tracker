/**
 * The About popup's behaviour.
 *
 * Every dynamic string is written with textContent - the page never touches
 * innerHTML, matching the discipline the rest of the renderer follows and the
 * page's own Content-Security-Policy, which forbids inline script.
 */

// The same theme manager every other page uses, so light/dark/system is
// whatever the user already chose. The page never inspects the theme itself.
if (window.ThemeUtils) {
  window.ThemeUtils.getThemeManager();
}

/** How long the Copy confirmation stays on screen. */
const STATUS_TIMEOUT_MS = 2500;

document.addEventListener('DOMContentLoaded', () => {
  const info = window.aboutInfo || {};
  const nameEl = document.getElementById('about-name');
  const versionEl = document.getElementById('about-version');
  const runtimeEl = document.getElementById('about-runtime');
  const statusEl = document.getElementById('about-status');
  const copyBtn = document.getElementById('about-copy');
  const closeBtn = document.getElementById('about-close');

  if (info.appName) {
    nameEl.textContent = info.appName;
    document.title = `About ${info.appName}`;
  }
  versionEl.textContent = info.version ? `Version ${info.version}` : 'Version unknown';
  runtimeEl.textContent =
    `Electron ${info.electron || 'unknown'} · ` +
    `Node ${info.node || 'unknown'} · ` +
    `Chromium ${info.chrome || 'unknown'}`;

  let statusTimer = null;
  const say = (message) => {
    statusEl.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.textContent = ''; }, STATUS_TIMEOUT_MS);
  };

  // The clipboard write stays in the renderer; it does not round-trip to the
  // main process, so it adds no IPC surface.
  copyBtn.addEventListener('click', async () => {
    const summary = info.summary || runtimeEl.textContent;
    try {
      await navigator.clipboard.writeText(summary);
      say('Copied to clipboard');
    } catch (err) {
      console.error('Could not copy the version summary:', err);
      say('Could not copy - select the text above instead');
    }
  });

  closeBtn.addEventListener('click', () => window.close());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.close();
  });

  // Close is the safe default and the one a keyboard user most likely wants.
  // Tab then cycles between Copy and Close: they are the document's only
  // focusable controls, and a child window has nowhere else for focus to go.
  closeBtn.focus();
});
