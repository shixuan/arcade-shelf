import type { Game, Shelf, ShelfOptions } from './types';
import { GameRegistry } from './registry';
import { renderShelf } from './render';
import './style.css';

export type {
  CanvasSize,
  Game,
  GameHandle,
  Shelf,
  ShelfOptions,
} from './types';

export { openGameModal } from './modal';
export { pong } from './games/pong';
export { minesweeper } from './games/minesweeper';

export function createShelf(options: ShelfOptions): Shelf {
  const registry = new GameRegistry();
  let rendered: { destroy(): void } | null = null;

  function render(): void {
    if (rendered) rendered.destroy();
    rendered = renderShelf({
      getGames: () => registry.list(),
      getGame: (name) => registry.get(name),
      options,
    });
  }

  const shelf: Shelf = {
    register(game: Game) {
      const ok = registry.add(game);
      // If already mounted, re-render so the new game shows up immediately.
      // Cheap: the list is usually single-digit entries.
      if (ok && rendered) render();
      return shelf;
    },
    mount() {
      render();
      return shelf;
    },
    unmount() {
      if (rendered) {
        rendered.destroy();
        rendered = null;
      }
    },
  };

  return shelf;
}
