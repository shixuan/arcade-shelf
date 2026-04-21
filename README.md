# Your Arcade Shelf

[![npm](https://img.shields.io/npm/v/arcade-shelf.svg)](https://www.npmjs.com/package/arcade-shelf)
[![license](https://img.shields.io/npm/l/arcade-shelf.svg)](./LICENSE)

[Live demo](https://shixuan.github.io/arcade-shelf/)

Drop-in mini canvas games as a sidebar widget — a shelf for your mini games.

**Not a game engine**, not a canvas library. Just a small runtime that takes a
list of self-contained canvas games and renders them as a clickable widget.

## Install

```bash
npm install arcade-shelf
```

## Quick start (ES modules)

```ts
import { createShelf, pong, minesweeper, snake } from 'arcade-shelf';
import 'arcade-shelf/style.css';

const shelf = createShelf({
  container: '#games',
  title: "Let's play!",
});
shelf.register(pong);
shelf.register(minesweeper);
shelf.register(snake);
shelf.mount();
```

```html
<div id="games"></div>
```

> Only the games you import end up in your bundle — the built-in games are tree-shakeable. Drop any you don't need from the import list.

## Quick start (plain HTML, no build step)

```html
<link rel="stylesheet" href="https://unpkg.com/arcade-shelf/dist/style.css">
<div id="games"></div>
<script src="https://unpkg.com/arcade-shelf/dist/index.umd.cjs"></script>
<script>
  const shelf = ArcadeShelf.createShelf({
    container: '#games',
    title: "Let's play!",
  });
  shelf.register(ArcadeShelf.pong);
  shelf.register(ArcadeShelf.minesweeper);
  shelf.register(ArcadeShelf.snake);
  shelf.mount();
</script>
```

## Built-in games

Three reference implementations ship in the box. Pick whichever input
paradigm is closest to the game you want to build, then copy the shape —
each one handles `start()` / `stop()` listener lifecycle correctly.

| Game          | Input paradigm         | What to crib from it |
|---------------|------------------------|-----------------------|
| **Pong** 🎾    | Mouse / touch drag     | `mousemove` + `touchmove` to track paddle position; `getBoundingClientRect()` cached on `start()` + `resize` instead of per-event; deltaTime normalization so motion is frame-rate independent. |
| **Minesweeper** 💣 | Left / right click + long-press | `click` to reveal, `contextmenu` to flag, `touchstart` long-press as the touch equivalent of right-click (with swallow of the trailing `click`). |
| **Snake** 🐍   | Keyboard + swipe       | `keydown` on `window`, swipe on the canvas — two separate layers from the modal's `document`-level focus trap, so there's no ordering contention to reason about; `touchstart` → `touchend` diff for swipe direction; `touchmove` with `passive: false` to suppress page scroll while the finger is on the play area. |

All three are ~200–600 lines of pure canvas + DOM — no framework, no
dependencies. Read them as recipes, not as a library surface. They're the
shortest path from "I want to write a mini canvas game" to "it handles
input and teardown correctly on both desktop and mobile."

## Integration recipes

### React

```tsx
import { useEffect, useRef } from 'react';
import { createShelf, pong } from 'arcade-shelf';
import 'arcade-shelf/style.css';

export function GameShelf() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const shelf = createShelf({ container: ref.current }).register(pong).mount();
    return () => shelf.unmount();
  }, []);
  return <div ref={ref} />;
}
```

Key detail: `unmount()` in the cleanup — otherwise HMR / route changes leak
listeners and an open modal's RAF keeps running.

### Hexo / Jekyll (no build step)

Drop the UMD bundle into your theme's static assets and reference it from
the layout. Example for Hexo (similar for Jekyll `_includes` or 11ty
`includes`):

```ejs
<!-- themes/your-theme/layout/_widget/games.ejs -->
<link rel="stylesheet" href="https://unpkg.com/arcade-shelf/dist/style.css">
<div id="arcade-shelf-mount"></div>
<script src="https://unpkg.com/arcade-shelf/dist/index.umd.cjs"></script>
<script>
  ArcadeShelf.createShelf({ container: '#arcade-shelf-mount' })
    .register(ArcadeShelf.pong)
    .mount();
</script>
```

If you'd rather self-host (air-gapped builds, offline dev), copy
`node_modules/arcade-shelf/dist/` into your theme's assets folder and point
the tags at the local paths.

### Your own game

You do **not** need to fork arcade-shelf to add a game. `shelf.register()`
accepts any object matching the `Game` contract, no matter where it's
defined:

```ts
import { createShelf, type Game } from 'arcade-shelf';
import 'arcade-shelf/style.css';

const tetris: Game = {
  name: 'Tetris',
  icon: '🧱',
  canvasSize: { width: 320, height: 480 },
  init(canvas) {
    // ... your game logic
    return {
      start() { /* attach listeners, start RAF */ },
      stop()  { /* cancel RAF, remove listeners */ },
    };
  },
};

createShelf({ container: '#games' })
  .register(tetris)
  .mount();
```

See [src/games/pong.ts](src/games/pong.ts) for a worked example including
dt normalization and cleanup, or [src/games/snake.ts](src/games/snake.ts)
for keyboard input + fixed-step simulation.

## The game contract

Every game implements this interface:

```ts
interface Game {
  name: string;                                    // required, unique
  icon?: string;                                   // emoji or short string
  description?: string;
  order?: number;                                  // display order
  canvasSize?: { width: number; height: number };  // defaults to 380×280
  init(canvas: HTMLCanvasElement): GameHandle;
}

interface GameHandle {
  start(): void;
  stop(): void;   // cancel RAF, remove listeners, etc.
}
```

That's the whole API contract. Write your game inside `init`, return start/stop,
register it on a shelf, done.

## License

MIT
