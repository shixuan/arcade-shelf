# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/).

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
