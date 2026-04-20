import type { Game } from './types';

export class GameRegistry {
  private games = new Map<string, Game>();

  add(game: Game): boolean {
    if (!game || typeof game.name !== 'string' || !game.name) {
      console.warn('[arcade-shelf] game missing name:', game);
      return false;
    }
    if (typeof game.init !== 'function') {
      console.warn(`[arcade-shelf] game "${game.name}" missing init()`);
      return false;
    }
    if (this.games.has(game.name)) {
      console.warn(
        `[arcade-shelf] duplicate game name "${game.name}" — registration ignored`,
      );
      return false;
    }
    this.games.set(game.name, game);
    return true;
  }

  remove(name: string): boolean {
    return this.games.delete(name);
  }

  get(name: string): Game | undefined {
    return this.games.get(name);
  }

  list(): Game[] {
    return Array.from(this.games.values());
  }

  clear(): void {
    this.games.clear();
  }
}
