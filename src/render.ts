import type { Game, ShelfOptions } from './types';
import { openGameModal } from './modal';

interface RenderDeps {
  getGames(): Game[];
  getGame(name: string): Game | undefined;
  options: ShelfOptions;
}

interface RenderedShelf {
  root: HTMLElement;
  destroy(): void;
}

function resolveContainer(target: HTMLElement | string): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector<HTMLElement>(target);
  }
  return target ?? null;
}

function sortGames(games: Game[], options: ShelfOptions): Game[] {
  const { whitelist, order } = options;

  let list = games;
  if (whitelist && whitelist.length > 0) {
    const allow = new Set(whitelist);
    list = list.filter((g) => allow.has(g.name));
  }

  const orderIndex = new Map<string, number>();
  if (order) {
    order.forEach((name, i) => orderIndex.set(name, i));
  }

  return list.slice().sort((a, b) => {
    const ai = orderIndex.get(a.name);
    const bi = orderIndex.get(b.name);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;

    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

export function renderShelf(deps: RenderDeps): RenderedShelf {
  const { getGames, getGame, options } = deps;
  const container = resolveContainer(options.container);
  if (!container) {
    throw new Error('[arcade-shelf] container not found');
  }

  const card = document.createElement('div');
  card.className = 'arcade-shelf-card';

  const header = document.createElement('div');
  header.className = 'arcade-shelf-card-header';

  const title = document.createElement('span');
  title.className = 'arcade-shelf-card-title';
  title.textContent = options.title ?? "Let's play!";

  header.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'arcade-shelf-list';
  list.setAttribute('role', 'list');

  const games = sortGames(getGames(), options);
  for (const game of games) {
    const item = document.createElement('li');
    item.className = 'arcade-shelf-list-item';

    const btn = document.createElement('button');
    btn.className = 'arcade-shelf-list-btn';
    btn.type = 'button';
    btn.dataset.gameName = game.name;
    if (game.description) {
      btn.title = game.description;
      btn.setAttribute('aria-label', `${game.name} — ${game.description}`);
    } else {
      btn.setAttribute('aria-label', game.name);
    }

    if (game.icon) {
      const ic = document.createElement('span');
      ic.className = 'arcade-shelf-list-icon';
      ic.textContent = game.icon;
      ic.setAttribute('aria-hidden', 'true');
      btn.appendChild(ic);
    }

    const label = document.createElement('span');
    label.className = 'arcade-shelf-list-label';
    label.textContent = game.name;
    btn.appendChild(label);

    item.appendChild(btn);
    list.appendChild(item);
  }

  card.appendChild(header);
  card.appendChild(list);
  container.appendChild(card);

  function onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('.arcade-shelf-list-btn');
    if (!btn) return;
    const name = btn.dataset.gameName;
    if (!name) return;
    const game = getGame(name);
    if (!game) return;
    openGameModal(game, btn);
  }

  list.addEventListener('click', onClick);

  function destroy(): void {
    list.removeEventListener('click', onClick);
    card.remove();
  }

  return { root: card, destroy };
}
