import { describe, it, expect, beforeEach } from 'vitest';
import { createShelf } from './index';
import type { Game } from './types';

function makeGame(name: string): Game {
  return {
    name,
    init: () => ({ start() {}, stop() {} }),
  };
}

function countButtons(container: HTMLElement): number {
  return container.querySelectorAll('.arcade-shelf-list-btn').length;
}

describe('createShelf', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('re-renders when register() is called after mount', () => {
    const shelf = createShelf({ container });
    shelf.mount();
    expect(countButtons(container)).toBe(0);
    shelf.register(makeGame('A'));
    expect(countButtons(container)).toBe(1);
    shelf.register(makeGame('B'));
    expect(countButtons(container)).toBe(2);
  });

  it('does not render before mount()', () => {
    const shelf = createShelf({ container });
    shelf.register(makeGame('A'));
    expect(countButtons(container)).toBe(0);
    shelf.mount();
    expect(countButtons(container)).toBe(1);
  });

  it('unmount() removes rendered DOM and subsequent register() is a no-op on DOM', () => {
    const shelf = createShelf({ container });
    shelf.register(makeGame('A')).mount();
    expect(countButtons(container)).toBe(1);
    shelf.unmount();
    expect(countButtons(container)).toBe(0);
    shelf.register(makeGame('B'));
    expect(countButtons(container)).toBe(0);
  });

  it('register() rejecting a duplicate does not trigger a re-render', () => {
    const shelf = createShelf({ container });
    shelf.register(makeGame('A')).mount();
    const firstCard = container.querySelector('.arcade-shelf-card');
    shelf.register(makeGame('A'));
    const afterCard = container.querySelector('.arcade-shelf-card');
    expect(afterCard).toBe(firstCard);
    expect(countButtons(container)).toBe(1);
  });
});
