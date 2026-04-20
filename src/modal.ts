import type { Game, GameHandle } from './types';

const DEFAULT_SIZE = { width: 380, height: 280 };

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), iframe, ' +
  '[tabindex]:not([tabindex="-1"])';

interface OpenedModal {
  close(): void;
}

function isFocusable(el: Element | null): el is HTMLElement {
  return !!el && el instanceof HTMLElement && typeof el.focus === 'function' && el.tabIndex !== -1;
}

/**
 * Open a modal containing a canvas, call game.init(canvas), and start it.
 * Returns a handle with close() that stops the game and removes the modal.
 */
export function openGameModal(game: Game, triggerElement?: HTMLElement | null): OpenedModal {
  const size = game.canvasSize ?? DEFAULT_SIZE;
  // document.activeElement defaults to <body> when nothing is focused; body.focus()
  // is a no-op unless tabindex is set, so only keep activeElement if it's actually focusable.
  const activeEl = document.activeElement;
  const fallbackFocus = isFocusable(activeEl) && activeEl !== document.body ? activeEl : null;
  const lastFocus = triggerElement ?? fallbackFocus;

  const overlay = document.createElement('div');
  overlay.className = 'arcade-shelf-modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'arcade-shelf-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', `Playing: ${game.name}`);

  const header = document.createElement('div');
  header.className = 'arcade-shelf-modal-header';

  const title = document.createElement('span');
  title.className = 'arcade-shelf-modal-title';
  title.textContent = game.name;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'arcade-shelf-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  header.appendChild(closeBtn);

  const canvas = document.createElement('canvas');
  canvas.className = 'arcade-shelf-canvas';
  canvas.width = size.width;
  canvas.height = size.height;

  dialog.appendChild(header);
  dialog.appendChild(canvas);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Lock background scroll while the modal is open. Record the prior value so
  // we restore it (some hosts set their own overflow, e.g. during nav transitions).
  const prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let handle: GameHandle | null = null;
  try {
    handle = game.init(canvas);
    handle.start();
  } catch (e) {
    console.error(`[arcade-shelf] game "${game.name}" init/start failed:`, e);
  }

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;

    if (handle) {
      try {
        handle.stop();
      } catch (e) {
        console.warn(`[arcade-shelf] game "${game.name}" stop() threw:`, e);
      }
    }

    overlay.removeEventListener('click', onOverlayClick);
    closeBtn.removeEventListener('click', close);
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();

    document.body.style.overflow = prevBodyOverflow;

    if (isFocusable(lastFocus)) {
      lastFocus.focus();
    }
  }

  function onOverlayClick(e: MouseEvent): void {
    if (e.target === overlay) close();
  }

  // Focus trap: keep Tab / Shift+Tab cycling inside the dialog. Without this,
  // keyboard users can tab back into the underlying page while a modal is open.
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    if (focusables.length === 0) {
      // Nothing focusable inside — just trap on the dialog itself.
      e.preventDefault();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  overlay.addEventListener('click', onOverlayClick);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);

  // Autofocus close button so Esc/Enter work immediately.
  closeBtn.focus();

  return { close };
}
