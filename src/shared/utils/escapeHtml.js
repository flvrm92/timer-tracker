/**
 * Escapes a value for safe interpolation into an HTML string.
 *
 * Project names and task descriptions are user-supplied, stored in SQLite and
 * rendered back through `innerHTML`. Without escaping, a project named
 * `<img src=x onerror=...>` becomes script running in the renderer with access
 * to the preload IPC bridge. Every user-controlled value interpolated into an
 * `innerHTML` template must go through this.
 *
 * Prefer `textContent` where a plain string will do - this exists for the
 * table-row templates where building nodes by hand would be far more code.
 *
 * @param {*} value anything; null and undefined become an empty string
 * @returns {string} the value with HTML-significant characters replaced
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Loaded both as a <script src> in the renderer and via require() in tests.
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml };
}
