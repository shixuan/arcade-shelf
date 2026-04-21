import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderShelf } from './render';
import type { Game } from './types';

function makeGame(name: string, order?: number): Game {
  return {
    name,
    order,
    init: () => ({ start() {}, stop() {} }),
  };
}

function renderNames(games: Game[], options: { whitelist?: string[]; order?: string[] } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const rendered = renderShelf({
    getGames: () => games,
    getGame: (n) => games.find((g) => g.name === n),
    options: { container, ...options },
  });
  const labels = Array.from(
    container.querySelectorAll<HTMLElement>('.arcade-shelf-list-label'),
  ).map((el) => el.textContent);
  rendered.destroy();
  return labels;
}

describe('renderShelf sort + filter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sorts by Game.order ascending, then by name', () => {
    const games = [makeGame('Zed', 2), makeGame('Apple', 2), makeGame('Bee', 1)];
    expect(renderNames(games)).toEqual(['Bee', 'Apple', 'Zed']);
  });

  it('falls back to name sort when no order set', () => {
    const games = [makeGame('Cat'), makeGame('Ant'), makeGame('Bee')];
    expect(renderNames(games)).toEqual(['Ant', 'Bee', 'Cat']);
  });

  it('whitelist filters out unlisted games', () => {
    const games = [makeGame('A'), makeGame('B'), makeGame('C')];
    expect(renderNames(games, { whitelist: ['C', 'A'] })).toEqual(['A', 'C']);
  });

  it('explicit order overrides Game.order', () => {
    const games = [makeGame('A', 1), makeGame('B', 2), makeGame('C', 3)];
    expect(renderNames(games, { order: ['C', 'A', 'B'] })).toEqual(['C', 'A', 'B']);
  });

  it('games missing from explicit order fall back after listed ones', () => {
    const games = [makeGame('A', 1), makeGame('B', 2), makeGame('C', 3)];
    expect(renderNames(games, { order: ['C'] })).toEqual(['C', 'A', 'B']);
  });

  it('throws when container selector resolves to nothing', () => {
    expect(() =>
      renderShelf({
        getGames: () => [],
        getGame: () => undefined,
        options: { container: '#does-not-exist' },
      }),
    ).toThrow(/container not found/);
  });
});
