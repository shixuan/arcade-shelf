import type { Game, GameHandle } from '../types';

/*
 * Snake — classic grid snake.
 *
 * Controls: arrow keys / WASD to turn, R to restart after game over.
 *
 * This was added in v0.2 primarily as a keyboard-input integration test for
 * the modal: modal listens on `document` (Esc, Tab focus trap) while the game
 * listens on `window`. Bubble phase fires document handler before window, so
 * Esc / Tab are intercepted by the modal and arrow keys fall through to the
 * game — no Game-contract extension needed.
 *
 * Fixed-step simulation with a dt accumulator (not "one tick per RAF") so the
 * apparent speed is framerate-independent.
 */

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const CELL = 20;
const STEP_MS = 120;

export const snake: Game = {
  name: 'Snake',
  icon: '🐍',
  description: 'Arrow keys / WASD or swipe to move. R / tap to restart.',
  order: 3,
  canvasSize: { width: 380, height: 380 },

  init(canvas: HTMLCanvasElement): GameHandle {
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) throw new Error('[arcade-shelf/snake] 2D context unavailable');
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    const W = canvas.width;
    const H = canvas.height;
    const COLS = Math.floor(W / CELL);
    const ROWS = Math.floor(H / CELL);
    const OFFSET_X = Math.floor((W - COLS * CELL) / 2);
    const OFFSET_Y = Math.floor((H - ROWS * CELL) / 2);

    let body: Point[] = [];
    let dir: Dir = 'right';
    // Buffered turn: we validate against `pendingDir`, not `dir`, so that two
    // fast presses (right -> up -> left) are rejected as a reversal chain.
    let pendingDir: Dir = 'right';
    let apple: Point = { x: 0, y: 0 };
    let score = 0;
    let over = false;
    let acc = 0;
    let lastTs = 0;
    let raf: number | null = null;

    function placeApple(): void {
      // Random rejection sampling. Grid is small and rarely > 50% full,
      // so the expected retry count is tiny.
      for (;;) {
        const x = Math.floor(Math.random() * COLS);
        const y = Math.floor(Math.random() * ROWS);
        if (!body.some((p) => p.x === x && p.y === y)) {
          apple = { x, y };
          return;
        }
      }
    }

    function reset(): void {
      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      body = [
        { x: cx - 2, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy },
      ];
      dir = 'right';
      pendingDir = 'right';
      score = 0;
      over = false;
      acc = 0;
      lastTs = 0;
      placeApple();
    }

    function setDir(next: Dir): void {
      // Compare against the most recent intent, not the currently-executing
      // direction, so rapid keypresses can't sneak in a reversal.
      if (next === 'up' && pendingDir === 'down') return;
      if (next === 'down' && pendingDir === 'up') return;
      if (next === 'left' && pendingDir === 'right') return;
      if (next === 'right' && pendingDir === 'left') return;
      pendingDir = next;
    }

    function step(): void {
      if (over) return;
      dir = pendingDir;
      const head = body[body.length - 1]!;
      let nx = head.x;
      let ny = head.y;
      if (dir === 'up') ny--;
      else if (dir === 'down') ny++;
      else if (dir === 'left') nx--;
      else nx++;

      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
        over = true;
        return;
      }
      if (body.some((p) => p.x === nx && p.y === ny)) {
        over = true;
        return;
      }
      body.push({ x: nx, y: ny });
      if (nx === apple.x && ny === apple.y) {
        score++;
        placeApple();
      } else {
        body.shift();
      }
    }

    function draw(): void {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(OFFSET_X + i * CELL + 0.5, OFFSET_Y);
        ctx.lineTo(OFFSET_X + i * CELL + 0.5, OFFSET_Y + ROWS * CELL);
        ctx.stroke();
      }
      for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(OFFSET_X, OFFSET_Y + i * CELL + 0.5);
        ctx.lineTo(OFFSET_X + COLS * CELL, OFFSET_Y + i * CELL + 0.5);
        ctx.stroke();
      }

      // Apple
      ctx.fillStyle = '#e8635a';
      ctx.beginPath();
      ctx.arc(
        OFFSET_X + apple.x * CELL + CELL / 2,
        OFFSET_Y + apple.y * CELL + CELL / 2,
        CELL / 2 - 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Snake — head a bit brighter than tail
      for (let i = 0; i < body.length; i++) {
        const p = body[i]!;
        ctx.fillStyle = i === body.length - 1 ? '#b7e88a' : '#7fd07f';
        ctx.fillRect(
          OFFSET_X + p.x * CELL + 1,
          OFFSET_Y + p.y * CELL + 1,
          CELL - 2,
          CELL - 2,
        );
      }

      // Score overlay
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Score: ${score}`, 8, 6);

      if (over) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
        ctx.fillText('Game Over', W / 2, H / 2 - 10);
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Score: ${score} · R or tap to restart`, W / 2, H / 2 + 18);
      }
    }

    function tick(ts: number): void {
      if (lastTs === 0) lastTs = ts;
      // Clamp so a backgrounded tab doesn't fast-forward 100 steps on return.
      const dt = Math.min(1000, ts - lastTs);
      lastTs = ts;
      acc += dt;
      while (acc >= STEP_MS) {
        step();
        acc -= STEP_MS;
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function onKeyDown(e: KeyboardEvent): void {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          setDir('up');
          return;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          setDir('down');
          return;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          setDir('left');
          return;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          setDir('right');
          return;
        case 'r':
        case 'R':
          if (over) reset();
          return;
      }
    }

    // Touch: swipe on canvas sets direction; tap-on-gameover restarts.
    // Threshold is in CSS pixels so it scales with device zoom.
    const SWIPE_MIN = 18;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartId: number | null = null;

    function onTouchStart(e: TouchEvent): void {
      if (touchStartId !== null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      touchStartId = t.identifier;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }

    function onTouchMove(e: TouchEvent): void {
      // Suppress page scroll while the finger is on the canvas.
      if (touchStartId !== null) e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent): void {
      if (touchStartId === null) return;
      let end: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]!;
        if (t.identifier === touchStartId) {
          end = t;
          break;
        }
      }
      touchStartId = null;
      if (!end) return;

      const dx = end.clientX - touchStartX;
      const dy = end.clientY - touchStartY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (adx < SWIPE_MIN && ady < SWIPE_MIN) {
        // Treat as a tap — only meaningful when game is over (restart).
        if (over) reset();
        return;
      }

      if (adx > ady) setDir(dx > 0 ? 'right' : 'left');
      else setDir(dy > 0 ? 'down' : 'up');
    }

    reset();
    draw();

    return {
      start(): void {
        window.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
        canvas.addEventListener('touchcancel', onTouchEnd);
        raf = requestAnimationFrame(tick);
      },
      stop(): void {
        window.removeEventListener('keydown', onKeyDown);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchEnd);
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
        lastTs = 0;
      },
    };
  },
};
