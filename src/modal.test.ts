import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openGameModal } from './modal';
import type { Game, GameHandle } from './types';

function makeGame(overrides: Partial<Game> = {}): {
  game: Game;
  handle: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
} {
  const handle = { start: vi.fn(), stop: vi.fn() };
  const game: Game = {
    name: 'Test',
    init: (): GameHandle => handle,
    ...overrides,
  };
  return { game, handle };
}

describe('openGameModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });
  afterEach(() => {
    document.querySelectorAll('.arcade-shelf-modal-overlay').forEach((el) => el.remove());
  });

  it('calls init() then start() and locks body scroll', () => {
    const { game, handle } = makeGame();
    const initSpy = vi.spyOn(game, 'init');
    openGameModal(game);
    expect(initSpy).toHaveBeenCalledOnce();
    expect(handle.start).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('stops the game, removes overlay, and restores body scroll on close', () => {
    document.body.style.overflow = 'auto';
    const { game, handle } = makeGame();
    const modal = openGameModal(game);
    expect(document.querySelector('.arcade-shelf-modal-overlay')).not.toBeNull();
    modal.close();
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(document.querySelector('.arcade-shelf-modal-overlay')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('close() is idempotent — stop() fires at most once', () => {
    const { game, handle } = makeGame();
    const modal = openGameModal(game);
    modal.close();
    modal.close();
    expect(handle.stop).toHaveBeenCalledOnce();
  });

  it('Escape key closes the modal', () => {
    const { game, handle } = makeGame();
    openGameModal(game);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(document.querySelector('.arcade-shelf-modal-overlay')).toBeNull();
  });

  it('clicking the overlay backdrop closes; clicking inside dialog does not', () => {
    const { game, handle } = makeGame();
    openGameModal(game);
    const overlay = document.querySelector<HTMLElement>('.arcade-shelf-modal-overlay')!;
    const dialog = document.querySelector<HTMLElement>('.arcade-shelf-modal')!;
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handle.stop).not.toHaveBeenCalled();
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handle.stop).toHaveBeenCalledOnce();
  });

  it('returns focus to the trigger element on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { game } = makeGame();
    const modal = openGameModal(game, trigger);
    expect(document.activeElement).not.toBe(trigger);
    modal.close();
    expect(document.activeElement).toBe(trigger);
  });

  it('sets ARIA dialog attributes and aria-label from game name', () => {
    const { game } = makeGame({ name: 'My Game' });
    openGameModal(game);
    const dialog = document.querySelector<HTMLElement>('.arcade-shelf-modal')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toContain('My Game');
  });

  it('renders a string footer as text, guarding against HTML injection', () => {
    const { game } = makeGame({ footer: '<script>x</script>' });
    openGameModal(game);
    const footer = document.querySelector<HTMLElement>('.arcade-shelf-modal-footer')!;
    expect(footer).not.toBeNull();
    expect(footer.textContent).toBe('<script>x</script>');
    expect(footer.querySelector('script')).toBeNull();
  });

  it('renders an HTMLElement footer as-is (caller owns the markup)', () => {
    const link = document.createElement('a');
    link.href = 'https://example.com';
    link.textContent = 'credit';
    const { game } = makeGame({ footer: link });
    openGameModal(game);
    const footer = document.querySelector<HTMLElement>('.arcade-shelf-modal-footer')!;
    expect(footer.querySelector('a')).toBe(link);
  });

  it('uses provided canvasSize for the canvas element', () => {
    const { game } = makeGame({ canvasSize: { width: 400, height: 200 } });
    openGameModal(game);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.arcade-shelf-canvas')!;
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
  });

  it('logs but does not throw when init() throws', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const game: Game = {
      name: 'broken',
      init: () => {
        throw new Error('boom');
      },
    };
    expect(() => openGameModal(game)).not.toThrow();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
