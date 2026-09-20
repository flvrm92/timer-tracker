/**
 * Reusable pop-up component: modal dialogs (alert / confirm / prompt / custom
 * buttons) plus transient toasts.
 *
 * Everything is coloured through the design tokens in shared/styles/variables.css,
 * so light/dark switching is handled entirely by CSS -- this file never inspects
 * the current theme.
 *
 * Two constraints from the surrounding codebase shape the implementation:
 *   - The renderer CSP allows no inline scripts, so this builds DOM nodes and
 *     attaches listeners instead of emitting markup with onclick attributes.
 *   - Messages carry user-supplied data (project names), so all caller text is
 *     written with textContent and never through innerHTML.
 *
 * Unlike the other shared modules this one is wrapped in an IIFE: renderer
 * scripts share a single global scope per page, and top-level functions named
 * alert/confirm/prompt would overwrite the native window methods for every
 * other script on the page.
 */
(function () {
  'use strict';

  const SEVERITY_ICONS = {
    info: 'clock',
    success: 'check',
    warning: 'warning',
    danger: 'error'
  };

  const DEFAULT_TITLES = {
    info: 'Notice',
    success: 'Success',
    warning: 'Warning',
    danger: 'Confirm'
  };

  const TOAST_VARIANTS = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  };

  const TOAST_DURATION = 5000;
  const TOAST_EXIT_DURATION = 200;
  const INERT_FLAG = 'data-dialog-inert';

  let overlayEl = null;
  let dialogEl = null;
  let toastContainer = null;
  let activeDialog = null;

  /**
   * Builds the single overlay/panel pair the component reuses for every pop-up.
   * Pages are fully reloaded on navigation, so one instance per page is all
   * that is ever needed.
   */
  function ensureOverlay() {
    if (overlayEl && overlayEl.isConnected) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'dialog-overlay';
    overlayEl.setAttribute('aria-hidden', 'true');

    dialogEl = document.createElement('div');
    dialogEl.className = 'dialog';
    dialogEl.setAttribute('role', 'dialog');
    dialogEl.setAttribute('aria-modal', 'true');
    overlayEl.appendChild(dialogEl);

    // Only a click on the backdrop itself dismisses; clicks inside the panel
    // bubble up to the overlay and must be ignored.
    overlayEl.addEventListener('click', (event) => {
      if (event.target !== overlayEl || !activeDialog) return;
      settle(activeDialog.cancelId);
    });

    document.addEventListener('keydown', handleKeydown, true);
    document.body.appendChild(overlayEl);
  }

  function handleKeydown(event) {
    if (!activeDialog) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      settle(activeDialog.cancelId);
      return;
    }

    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }

    // Buttons already act on Enter themselves; intercepting it here would fire
    // the default action twice when focus sits on a button.
    if (event.key === 'Enter' && event.target && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      settle(activeDialog.defaultId);
    }
  }

  function trapFocus(event) {
    const focusable = dialogEl.querySelectorAll('button:not(:disabled), input:not(:disabled), select, textarea');
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    const outside = !dialogEl.contains(current);

    if (event.shiftKey && (outside || current === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || current === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Hides everything outside the pop-up from assistive technology while it is
   * open. Only elements this function hid are restored, so a pre-existing
   * aria-hidden on the page is left alone.
   */
  function setBackgroundInert(hidden) {
    Array.from(document.body.children).forEach((child) => {
      if (child === overlayEl || child === toastContainer) return;

      if (hidden) {
        if (child.hasAttribute('aria-hidden')) return;
        child.setAttribute('aria-hidden', 'true');
        child.setAttribute(INERT_FLAG, 'true');
      } else if (child.hasAttribute(INERT_FLAG)) {
        child.removeAttribute('aria-hidden');
        child.removeAttribute(INERT_FLAG);
      }
    });
  }

  /**
   * Resolves the open dialog exactly once, whatever dismissed it: a button, the
   * Escape key, a backdrop click or a programmatic close().
   */
  function settle(buttonId) {
    if (!activeDialog) return;

    const pending = activeDialog;
    activeDialog = null;

    const value = pending.input ? pending.input.value : undefined;

    overlayEl.classList.remove('is-open');
    overlayEl.setAttribute('aria-hidden', 'true');
    setBackgroundInert(false);

    if (pending.previousFocus && typeof pending.previousFocus.focus === 'function') {
      pending.previousFocus.focus();
    }

    pending.resolve({ id: buttonId === undefined ? null : buttonId, value });
  }

  function pickButtonId(buttons, flag, fallback) {
    const match = buttons.find((button) => button[flag]);
    return match ? match.id : fallback;
  }

  function buildHeader(title, severity) {
    const header = document.createElement('div');
    header.className = 'dialog-header';

    const iconName = SEVERITY_ICONS[severity];
    // Icons are optional: guard the same way the project rows do, so a page
    // that has not loaded icons.js still gets a working pop-up.
    if (iconName && typeof window !== 'undefined' && window.IconUtils) {
      const icon = document.createElement('span');
      icon.className = `dialog-icon is-${severity}`;
      icon.innerHTML = window.IconUtils.createIcon(iconName, { size: 'xl' });
      header.appendChild(icon);
    }

    const heading = document.createElement('h2');
    heading.className = 'dialog-title';
    heading.id = 'dialog-title';
    heading.textContent = title || DEFAULT_TITLES[severity] || DEFAULT_TITLES.info;
    header.appendChild(heading);

    return header;
  }

  function buildInput(input) {
    const field = document.createElement('div');
    field.className = 'dialog-field';

    if (input.label) {
      const label = document.createElement('label');
      label.className = 'form-label';
      label.setAttribute('for', 'dialog-input');
      label.textContent = input.label;
      field.appendChild(label);
    }

    const inputEl = document.createElement('input');
    inputEl.className = 'form-input';
    inputEl.id = 'dialog-input';
    inputEl.type = input.type || 'text';
    inputEl.value = input.value || '';
    if (input.placeholder) inputEl.placeholder = input.placeholder;
    field.appendChild(inputEl);

    return { field, inputEl };
  }

  /**
   * Low-level primitive that alert/confirm/prompt are built on.
   *
   * @param {object} options
   * @param {string} [options.title]     Heading; defaults to one per severity.
   * @param {string} [options.message]   Body text. Newlines are preserved.
   * @param {string} [options.severity]  info | success | warning | danger
   * @param {Array}  [options.buttons]   [{ id, label, variant, isDefault, isCancel }]
   * @param {object} [options.input]     { label, value, placeholder, type } adds a text field
   * @param {string} [options.defaultId] Button the Enter key activates
   * @param {string} [options.cancelId]  Button Escape and the backdrop activate
   * @returns {Promise<{id: string|null, value: string|undefined}>}
   */
  function show(options = {}) {
    const {
      title = '',
      message = '',
      severity = 'info',
      buttons = [{ id: 'ok', label: 'OK', variant: 'primary', isDefault: true, isCancel: true }],
      input = null,
      defaultId,
      cancelId
    } = options;

    // One pop-up at a time: an already-open dialog resolves as cancelled rather
    // than being buried under a second overlay.
    if (activeDialog) settle(activeDialog.cancelId);

    ensureOverlay();
    dialogEl.innerHTML = '';

    dialogEl.appendChild(buildHeader(title, severity));

    const body = document.createElement('div');
    body.className = 'dialog-body';

    const messageEl = document.createElement('p');
    messageEl.className = 'dialog-message';
    messageEl.id = 'dialog-message';
    messageEl.textContent = message;
    body.appendChild(messageEl);

    let inputEl = null;
    if (input) {
      const built = buildInput(input);
      inputEl = built.inputEl;
      body.appendChild(built.field);
    }
    dialogEl.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    const buttonEls = buttons.map((button) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `btn btn-${button.variant || 'secondary'}`;
      el.textContent = button.label || button.id;
      el.dataset.dialogId = button.id;
      el.addEventListener('click', () => settle(button.id));
      footer.appendChild(el);
      return el;
    });
    dialogEl.appendChild(footer);

    dialogEl.setAttribute('aria-labelledby', 'dialog-title');
    dialogEl.setAttribute('aria-describedby', 'dialog-message');

    overlayEl.classList.add('is-open');
    overlayEl.removeAttribute('aria-hidden');
    setBackgroundInert(true);

    const resolvedDefaultId = defaultId !== undefined
      ? defaultId
      : pickButtonId(buttons, 'isDefault', buttons.length ? buttons[buttons.length - 1].id : null);
    const resolvedCancelId = cancelId !== undefined
      ? cancelId
      : pickButtonId(buttons, 'isCancel', null);

    return new Promise((resolve) => {
      activeDialog = {
        resolve,
        defaultId: resolvedDefaultId,
        cancelId: resolvedCancelId,
        previousFocus: document.activeElement,
        input: inputEl
      };

      const defaultButton = buttonEls.find((el) => el.dataset.dialogId === String(resolvedDefaultId));
      const initial = inputEl || defaultButton || buttonEls[0];
      if (initial) initial.focus();
      if (inputEl) inputEl.select();
    });
  }

  /**
   * Replacement for window.alert: a single OK button.
   * @returns {Promise<void>} resolves once the user dismisses the pop-up.
   */
  function alert(message, options = {}) {
    const { title = '', severity = 'info', okLabel = 'OK' } = options;

    return show({
      title,
      message,
      severity,
      buttons: [{ id: 'ok', label: okLabel, variant: 'primary', isDefault: true, isCancel: true }]
    }).then(() => undefined);
  }

  /**
   * Replacement for window.confirm.
   * @returns {Promise<boolean>} true only when the confirm button was clicked.
   */
  function confirm(message, options = {}) {
    const {
      title = '',
      severity = 'warning',
      confirmLabel = 'Yes',
      cancelLabel = 'No'
    } = options;

    return show({
      title,
      message,
      severity,
      buttons: [
        { id: 'cancel', label: cancelLabel, variant: 'secondary', isCancel: true },
        {
          id: 'confirm',
          label: confirmLabel,
          variant: severity === 'danger' ? 'danger' : 'primary',
          isDefault: true
        }
      ]
    }).then((result) => result.id === 'confirm');
  }

  /**
   * Replacement for window.prompt.
   * @returns {Promise<string|null>} the entered text, or null if cancelled.
   */
  function prompt(message, options = {}) {
    const {
      title = '',
      severity = 'info',
      confirmLabel = 'OK',
      cancelLabel = 'Cancel',
      defaultValue = '',
      placeholder = '',
      label = '',
      type = 'text'
    } = options;

    return show({
      title,
      message,
      severity,
      input: { value: defaultValue, placeholder, label, type },
      buttons: [
        { id: 'cancel', label: cancelLabel, variant: 'secondary', isCancel: true },
        { id: 'confirm', label: confirmLabel, variant: 'primary', isDefault: true }
      ]
    }).then((result) => (result.id === 'confirm' ? result.value : null));
  }

  /** Dismisses the open pop-up as if the user had cancelled it. */
  function close() {
    if (!activeDialog) return;
    settle(activeDialog.cancelId);
  }

  function ensureToastContainer() {
    if (toastContainer && toastContainer.isConnected) return toastContainer;

    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);

    return toastContainer;
  }

  /**
   * Transient feedback that needs no interaction. Toasts stack in a shared
   * container rather than replacing one another.
   *
   * @param {string} message
   * @param {string} [type] success | error | warning | info
   * @param {{duration?: number}} [options] a duration of 0 keeps it until dismissed
   * @returns {{element: HTMLElement, dismiss: function}}
   */
  function toast(message, type = 'success', options = {}) {
    const { duration = TOAST_DURATION } = options;
    const container = ensureToastContainer();

    const el = document.createElement('div');
    el.className = `alert ${TOAST_VARIANTS[type] || TOAST_VARIANTS.info} toast`;
    el.textContent = message;
    container.appendChild(el);

    const dismiss = () => {
      if (!el.parentNode) return;
      el.classList.add('is-leaving');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, TOAST_EXIT_DURATION);
    };

    if (duration > 0) setTimeout(dismiss, duration);

    return { element: el, dismiss };
  }

  const api = { show, alert, confirm, prompt, toast, close };

  if (typeof window !== 'undefined') {
    window.Dialog = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
