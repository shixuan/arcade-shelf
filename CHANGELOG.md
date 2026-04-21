# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-21

### Added
- Built-in Snake game (`export { snake }`). Arrow keys / WASD or swipe to
  move, R or tap to restart on game over. Fixed-step simulation with a
  dt accumulator so speed is framerate-independent; direction changes
  are buffered against the last *intent* (not the currently-executing
  direction) to prevent reversal via rapid keypresses. Touch input
  handled on the canvas element so page scroll is preserved outside the
  play area.
- `sideEffects: ["**/*.css"]` in `package.json` — ESM consumers that only
  import `{ createShelf }` now tree-shake all built-in games. Bare
  `createShelf` measures at ~1.7 kB brotlied vs. ~5.6 kB for the full
  bundle.
- Vitest suite (jsdom) covering registry dedup / validation, `renderShelf`
  sort + whitelist behavior, `createShelf` mount / register / unmount
  lifecycle, and `openGameModal` invariants (stop-on-close, idempotent
  close, focus return, ARIA attributes, Esc / backdrop, footer
  sanitization, init() failure isolation).
- `size-limit` config with three budgets (full ESM ≤ 8 kB, bare
  `createShelf` ≤ 3 kB, UMD ≤ 8 kB, all brotli). Wired into
  `prepublishOnly` so a regression blocks publish.

### Changed
- `prepublishOnly` now runs `typecheck → test → build → size` instead of
  just typecheck + build.

## [0.1.1] - 2026-04-20

### Added
- `Game.footer` field — a trivial content slot rendered below the canvas in
  the modal. Accepts a plain string (rendered as text) or an `HTMLElement`
  (appended as-is, so games can embed links / rich markup). Useful for
  attribution, credits, or controls hints.
- Minesweeper now carries a footer link crediting the original Java
  implementation.
- npm version + license badges in the README.

## [0.1.0] - 2026-04-20

### Added
- `createShelf(options)` factory, returning a `Shelf` with
  `register(game).mount()` / `unmount()`.
- Modal runtime: opens a canvas, calls `game.init(canvas)`, wires Esc /
  backdrop click / close button, restores focus on close.
- Modal a11y: focus trap on Tab / Shift+Tab, body scroll lock, ARIA
  `role="dialog"` + `aria-modal="true"`.
- Built-in Pong reference game with deltaTime-normalized motion.
- Built-in Minesweeper with three difficulty presets, first-click safety,
  BFS flood fill, Win95-style chrome, and long-press flagging on touch.
- Public `Game` / `GameHandle` / `ShelfOptions` / `Shelf` type exports.
- CSS theming via custom properties
  (`--arcade-shelf-card-bg`, `--arcade-shelf-modal-bg`,
  `--arcade-shelf-modal-z`, etc.) with `prefers-color-scheme: dark`
  defaults.
- Dual ESM (`dist/index.js`) + UMD (`dist/index.umd.cjs`) build with
  rolled-up `.d.ts`.
- Vanilla HTML example under `examples/`.
