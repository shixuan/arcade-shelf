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
import { createShelf, pong, minesweeper } from 'arcade-shelf';
import 'arcade-shelf/style.css';

const shelf = createShelf({
  container: '#games',
  title: "Let's play!",
});
shelf.register(pong);
shelf.register(minesweeper);
shelf.mount();
```

```html
<div id="games"></div>
```

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
  shelf.mount();
</script>
```

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

```ts
import type { Game } from 'arcade-shelf';

export const snake: Game = {
  name: 'Snake',
  icon: '🐍',
  canvasSize: { width: 320, height: 320 },
  init(canvas) {
    // ... your game logic
    return {
      start() { /* attach listeners, start RAF */ },
      stop()  { /* cancel RAF, remove listeners */ },
    };
  },
};
```

Then `shelf.register(snake)`. See [src/games/pong.ts](src/games/pong.ts) for
a worked example including dt normalization and cleanup.

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
