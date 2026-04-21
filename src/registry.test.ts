import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameRegistry } from './registry';
import type { Game } from './types';

function makeGame(name: string, extra: Partial<Game> = {}): Game {
  return {
    name,
    init: () => ({ start() {}, stop() {} }),
    ...extra,
  };
}

describe('GameRegistry', () => {
  let warn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    warn = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(warn);
  });

  it('adds and lists games in insertion order', () => {
    const r = new GameRegistry();
    r.add(makeGame('A'));
    r.add(makeGame('B'));
    expect(r.list().map((g) => g.name)).toEqual(['A', 'B']);
  });

  it('rejects duplicate names and keeps the first registration', () => {
    const r = new GameRegistry();
    const first = makeGame('A', { icon: '1' });
    const second = makeGame('A', { icon: '2' });
    expect(r.add(first)).toBe(true);
    expect(r.add(second)).toBe(false);
    expect(r.get('A')?.icon).toBe('1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate game name "A"'));
  });

  it('rejects games missing name or init', () => {
    const r = new GameRegistry();
    expect(r.add({ name: '', init: () => ({ start() {}, stop() {} }) } as Game)).toBe(false);
    expect(r.add({ name: 'X' } as unknown as Game)).toBe(false);
    expect(r.list()).toEqual([]);
  });

  it('remove() returns true only when the name existed', () => {
    const r = new GameRegistry();
    r.add(makeGame('A'));
    expect(r.remove('A')).toBe(true);
    expect(r.remove('A')).toBe(false);
    expect(r.get('A')).toBeUndefined();
  });

  it('clear() empties the registry', () => {
    const r = new GameRegistry();
    r.add(makeGame('A'));
    r.add(makeGame('B'));
    r.clear();
    expect(r.list()).toEqual([]);
  });
});
