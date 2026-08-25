/**
 * @jest-environment jsdom
 *
 * The other suites run in the default node environment; only this one needs a
 * DOM, so the environment is set per file rather than globally.
 */

const Dialog = require('../src/shared/components/dialog');

/** Clicks the footer button carrying the given dialog id. */
function clickButton(id) {
  const button = document.querySelector(`.dialog-footer [data-dialog-id="${id}"]`);
  if (!button) throw new Error(`no dialog button with id "${id}"`);
  button.click();
}

function pressKey(key, options = {}) {
  const target = options.target || document.activeElement || document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
}

function overlay() {
  return document.querySelector('.dialog-overlay');
}

describe('Dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><button id="trigger">Open</button></div>';
  });

  afterEach(() => {
    Dialog.close();
    jest.useRealTimers();
  });

  describe('confirm', () => {
    it('resolves true when the confirm button is clicked', async () => {
      const pending = Dialog.confirm('Delete this?');
      clickButton('confirm');
      await expect(pending).resolves.toBe(true);
    });

    it('resolves false when the cancel button is clicked', async () => {
      const pending = Dialog.confirm('Delete this?');
      clickButton('cancel');
      await expect(pending).resolves.toBe(false);
    });

    it('resolves false when Escape is pressed', async () => {
      const pending = Dialog.confirm('Delete this?');
      pressKey('Escape');
      await expect(pending).resolves.toBe(false);
    });

    it('resolves false when the backdrop is clicked', async () => {
      const pending = Dialog.confirm('Delete this?');
      overlay().click();
      await expect(pending).resolves.toBe(false);
    });

    it('does not resolve when a click lands inside the panel', async () => {
      let settled = false;
      const pending = Dialog.confirm('Delete this?').then((value) => {
        settled = true;
        return value;
      });

      document.querySelector('.dialog-body').click();
      await Promise.resolve();
      expect(settled).toBe(false);

      clickButton('confirm');
      await expect(pending).resolves.toBe(true);
    });

    it('uses a danger confirm button for danger severity', async () => {
      const pending = Dialog.confirm('Delete this?', { severity: 'danger', confirmLabel: 'Delete' });

      const confirmButton = document.querySelector('[data-dialog-id="confirm"]');
      expect(confirmButton.className).toContain('btn-danger');
      expect(confirmButton.textContent).toBe('Delete');

      clickButton('cancel');
      await pending;
    });
  });

  describe('alert', () => {
    it('resolves when OK is clicked', async () => {
      const pending = Dialog.alert('Pick a project first.');
      expect(document.querySelector('.dialog-message').textContent).toBe('Pick a project first.');
      clickButton('ok');
      await expect(pending).resolves.toBeUndefined();
    });

    it('resolves on Escape, since OK is also the cancel action', async () => {
      const pending = Dialog.alert('Pick a project first.');
      pressKey('Escape');
      await expect(pending).resolves.toBeUndefined();
    });
  });

  describe('prompt', () => {
    it('resolves the entered value', async () => {
      const pending = Dialog.prompt('New name?', { defaultValue: 'old' });

      const input = document.querySelector('#dialog-input');
      expect(input.value).toBe('old');
      input.value = 'new';

      clickButton('confirm');
      await expect(pending).resolves.toBe('new');
    });

    it('resolves null when cancelled', async () => {
      const pending = Dialog.prompt('New name?', { defaultValue: 'old' });
      clickButton('cancel');
      await expect(pending).resolves.toBeNull();
    });

    it('submits on Enter from the input', async () => {
      const pending = Dialog.prompt('New name?');
      const input = document.querySelector('#dialog-input');
      input.value = 'typed';
      pressKey('Enter', { target: input });
      await expect(pending).resolves.toBe('typed');
    });
  });

  describe('show', () => {
    it('resolves the id of the clicked custom button', async () => {
      const pending = Dialog.show({
        title: 'Unsaved changes',
        message: 'What now?',
        buttons: [
          { id: 'discard', label: 'Discard', variant: 'secondary', isCancel: true },
          { id: 'save', label: 'Save', variant: 'primary', isDefault: true }
        ]
      });

      clickButton('discard');
      await expect(pending).resolves.toEqual({ id: 'discard', value: undefined });
    });

    it('keeps a single overlay and cancels the previous pop-up', async () => {
      const first = Dialog.confirm('First?');
      const second = Dialog.confirm('Second?');

      expect(document.querySelectorAll('.dialog-overlay')).toHaveLength(1);
      await expect(first).resolves.toBe(false);
      expect(document.querySelector('.dialog-message').textContent).toBe('Second?');

      clickButton('confirm');
      await expect(second).resolves.toBe(true);
    });

    it('marks the overlay open while shown and closed afterwards', async () => {
      const pending = Dialog.confirm('Delete this?');
      expect(overlay().classList.contains('is-open')).toBe(true);
      expect(overlay().hasAttribute('aria-hidden')).toBe(false);

      clickButton('cancel');
      await pending;

      expect(overlay().classList.contains('is-open')).toBe(false);
      expect(overlay().getAttribute('aria-hidden')).toBe('true');
    });

    it('hides the rest of the page from assistive technology while open', async () => {
      const app = document.getElementById('app');
      const pending = Dialog.confirm('Delete this?');
      expect(app.getAttribute('aria-hidden')).toBe('true');

      clickButton('cancel');
      await pending;
      expect(app.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  describe('escaping', () => {
    it('renders markup in the message as text', async () => {
      const payload = '<img src=x onerror="alert(1)">';
      const pending = Dialog.confirm(`Delete "${payload}"?`);

      const body = document.querySelector('.dialog-body');
      expect(body.querySelector('img')).toBeNull();
      expect(body.textContent).toContain(payload);

      clickButton('cancel');
      await pending;
    });

    it('renders markup in the title as text', async () => {
      const pending = Dialog.confirm('Sure?', { title: '<script>bad()</script>' });

      const title = document.querySelector('.dialog-title');
      expect(title.querySelector('script')).toBeNull();
      expect(title.textContent).toBe('<script>bad()</script>');

      clickButton('cancel');
      await pending;
    });

    it('preserves line breaks without introducing markup', async () => {
      const pending = Dialog.alert('First line.\n\nSecond line.');

      const message = document.querySelector('.dialog-message');
      expect(message.innerHTML).not.toContain('<br');
      expect(message.textContent).toBe('First line.\n\nSecond line.');

      clickButton('ok');
      await pending;
    });
  });

  describe('focus', () => {
    it('focuses the default button and restores focus on close', async () => {
      const trigger = document.getElementById('trigger');
      trigger.focus();

      const pending = Dialog.confirm('Delete this?');
      expect(document.activeElement.dataset.dialogId).toBe('confirm');

      clickButton('confirm');
      await pending;
      expect(document.activeElement).toBe(trigger);
    });

    it('focuses the input for a prompt', async () => {
      const pending = Dialog.prompt('New name?');
      expect(document.activeElement.id).toBe('dialog-input');

      clickButton('cancel');
      await pending;
    });

    it('labels the prompt input when a label is given', async () => {
      const pending = Dialog.prompt('New name?', { label: 'Project name' });

      const label = document.querySelector('.dialog-field .form-label');
      expect(label.textContent).toBe('Project name');
      expect(label.getAttribute('for')).toBe('dialog-input');

      clickButton('cancel');
      await pending;
    });

    it('wraps Tab from the last control back to the first', async () => {
      const pending = Dialog.confirm('Delete this?');

      const buttons = document.querySelectorAll('.dialog-footer button');
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      last.focus();
      pressKey('Tab', { target: last });
      expect(document.activeElement).toBe(first);

      pressKey('Tab', { target: first, shiftKey: true });
      expect(document.activeElement).toBe(last);

      clickButton('cancel');
      await pending;
    });
  });

  describe('toast', () => {
    it('appends a themed toast and removes it after the timeout', () => {
      jest.useFakeTimers();

      const { element } = Dialog.toast('Timer saved!', 'success');
      expect(element.className).toContain('alert-success');
      expect(element.textContent).toBe('Timer saved!');
      expect(document.querySelectorAll('.toast-container .toast')).toHaveLength(1);

      jest.advanceTimersByTime(5000);
      expect(element.classList.contains('is-leaving')).toBe(true);

      jest.advanceTimersByTime(200);
      expect(document.querySelectorAll('.toast-container .toast')).toHaveLength(0);
    });

    it('stacks multiple toasts in one container', () => {
      jest.useFakeTimers();

      Dialog.toast('One', 'success');
      Dialog.toast('Two', 'error');

      expect(document.querySelectorAll('.toast-container')).toHaveLength(1);
      expect(document.querySelectorAll('.toast')).toHaveLength(2);
      expect(document.querySelectorAll('.toast')[1].className).toContain('alert-error');
    });

    it('falls back to the info variant for an unknown type', () => {
      jest.useFakeTimers();

      const { element } = Dialog.toast('Something happened', 'nonsense');
      expect(element.className).toContain('alert-info');
    });

    it('keeps a toast until dismissed when the duration is 0', () => {
      jest.useFakeTimers();

      const { element, dismiss } = Dialog.toast('Sticky', 'info', { duration: 0 });
      jest.advanceTimersByTime(60000);
      expect(element.isConnected).toBe(true);

      dismiss();
      jest.advanceTimersByTime(200);
      expect(element.isConnected).toBe(false);
    });
  });

  describe('severity icon', () => {
    // The pages load icons.js ahead of dialog.js, so the header icon is the
    // path that actually runs in the app; without it the pop-up still works.
    afterEach(() => {
      delete window.IconUtils;
    });

    it('renders a severity icon when IconUtils is available', async () => {
      window.IconUtils = require('../src/shared/components/icons');

      const pending = Dialog.confirm('Delete this?', { severity: 'danger' });

      const icon = document.querySelector('.dialog-icon');
      expect(icon.className).toContain('is-danger');
      expect(icon.querySelector('svg')).not.toBeNull();

      clickButton('cancel');
      await pending;
    });

    it('omits the icon when IconUtils is not loaded', async () => {
      const pending = Dialog.confirm('Delete this?');

      expect(document.querySelector('.dialog-icon')).toBeNull();
      expect(document.querySelector('.dialog-title').textContent).toBe('Warning');

      clickButton('cancel');
      await pending;
    });
  });

  describe('close', () => {
    it('resolves the open pop-up as cancelled', async () => {
      const pending = Dialog.confirm('Delete this?');
      Dialog.close();
      await expect(pending).resolves.toBe(false);
    });

    it('is a no-op when nothing is open', () => {
      expect(() => Dialog.close()).not.toThrow();
    });
  });
});
