import type { Game, GameHandle } from '../types';

/*
 * Minesweeper — left-click to reveal, right-click (or long-press on touch) to flag.
 *
 * Ported from a Java/Swing implementation (https://github.com/shixuan/minesweeper). 
 * Preserved from the original: cell state model, three difficulty presets, mine
 * placement via random-retry, right-click flag with minesLeft counter, win = all
 * non-mine cells revealed.
 *
 * Notable additions over the original:
 *   - First-click safety: mines are placed AFTER the first reveal, excluding
 *     the clicked cell and its 8 neighbours. Original could lose on move 1.
 *   - Flood fill uses a BFS queue instead of recursion. Java's recursive
 *     MSGui.showBlank could stack-overflow on large blank regions.
 *   - Canvas 2D rendering with classic Win95 raised/sunken borders, LED
 *     counter, smiley face, difficulty bar.
 *   - Touch support: 450ms long-press triggers flag (original was mouse-only).
 */

interface Cell {
  isMine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

interface Difficulty {
  label: string;
  cols: number;
  rows: number;
  mines: number;
}

type GameState = 'idle' | 'playing' | 'won' | 'lost';

export const minesweeper: Game = {
  name: 'Minesweeper',
  icon: '💣',
  description:
    'Left-click to reveal, right-click to flag. First click is always safe.',
  order: 2,
  canvasSize: { width: 380, height: 420 },

  init(canvas: HTMLCanvasElement): GameHandle {
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) throw new Error('[arcade-shelf/minesweeper] 2D context unavailable');
    // Rebind non-null so closures below don't need `!` assertions.
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    const W = canvas.width;
    const H = canvas.height;

    const TOOLBAR_H = 50;
    const DIFF_H = 32;
    const MARGIN = 10;
    const GRID_W = W - MARGIN * 2;
    const GRID_H = H - TOOLBAR_H - DIFF_H;

    const DIFFS: Difficulty[] = [
      { label: 'Easy', cols: 9, rows: 9, mines: 10 },
      { label: 'Normal', cols: 12, rows: 12, mines: 20 },
      { label: 'Hard', cols: 16, rows: 16, mines: 30 },
    ];

    // Classic minesweeper number colours (index 0 unused, matches "adjacent" count).
    const NUM_COLORS: readonly string[] = [
      '',
      '#1565C0',
      '#2E7D32',
      '#C62828',
      '#4527A0',
      '#6D4C41',
      '#00838F',
      '#000000',
      '#546E7A',
    ];

    let diffIdx = 0;
    let grid: Cell[][] = [];
    let cellSize = 0;
    let offX = 0;
    let offY = 0;
    let minesLeft = 0;
    let gameState: GameState = 'idle';
    let timer = 0;
    let timerInterval: number | null = null;
    let firstClick = true;
    let longPressTimer: number | null = null;
    let longPressTriggered = false;

    // diffIdx is maintained in [0, DIFFS.length) by all setters, so this is always defined.
    function currentDiff(): Difficulty {
      return DIFFS[diffIdx] as Difficulty;
    }

    // ── Game logic ────────────────────────────────────────────

    function initGame(): void {
      const { cols, rows, mines } = currentDiff();
      if (timerInterval !== null) clearInterval(timerInterval);
      timerInterval = null;
      timer = 0;
      minesLeft = mines;
      firstClick = true;
      gameState = 'idle';

      grid = Array.from({ length: rows }, () =>
        Array.from(
          { length: cols },
          (): Cell => ({ isMine: false, revealed: false, flagged: false, adjacent: 0 }),
        ),
      );

      cellSize = Math.floor(Math.min(GRID_W / cols, GRID_H / rows));
      offX = MARGIN + Math.floor((GRID_W - cellSize * cols) / 2);
      offY = TOOLBAR_H + DIFF_H + Math.floor((GRID_H - cellSize * rows) / 2);

      draw();
    }

    function cellAtRC(r: number, c: number): Cell {
      // Callers already bounds-check r/c against the current difficulty's rows/cols.
      return grid[r]![c]!;
    }

    function placeMines(safeR: number, safeC: number): void {
      const { cols, rows, mines } = currentDiff();
      let placed = 0;
      while (placed < mines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        const cell = cellAtRC(r, c);
        // Exclude the first-click cell AND its 8 neighbours so move 1 is always safe
        // and usually opens a reasonable flood.
        if (
          !cell.isMine &&
          !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)
        ) {
          cell.isMine = true;
          placed++;
        }
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cellAtRC(r, c);
          if (cell.isMine) continue;
          let n = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (
                nr >= 0 &&
                nr < rows &&
                nc >= 0 &&
                nc < cols &&
                cellAtRC(nr, nc).isMine
              ) {
                n++;
              }
            }
          }
          cell.adjacent = n;
        }
      }
    }

    function revealBFS(startR: number, startC: number): void {
      const { cols, rows } = currentDiff();
      const queue: Array<[number, number]> = [[startR, startC]];
      while (queue.length) {
        const next = queue.shift()!;
        const [r, c] = next;
        const cell = cellAtRC(r, c);
        if (cell.revealed || cell.flagged) continue;
        cell.revealed = true;
        if (cell.adjacent === 0) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (
                nr >= 0 &&
                nr < rows &&
                nc >= 0 &&
                nc < cols &&
                !cellAtRC(nr, nc).revealed
              ) {
                queue.push([nr, nc]);
              }
            }
          }
        }
      }
    }

    function checkWin(): boolean {
      const { cols, rows } = currentDiff();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cellAtRC(r, c);
          if (!cell.isMine && !cell.revealed) return false;
        }
      }
      return true;
    }

    function revealMines(): void {
      const { cols, rows } = currentDiff();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cellAtRC(r, c);
          if (cell.isMine) cell.revealed = true;
        }
      }
    }

    // ── Drawing ───────────────────────────────────────────────

    function draw(): void {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(0, 0, W, H);
      drawToolbar();
      drawDiffBar();
      drawGrid();
    }

    function drawToolbar(): void {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(0, 0, W, TOOLBAR_H);
      raised3D(0, 0, W, TOOLBAR_H, 3, false);

      // Mines counter (floor at -99 so the 3-digit LED never overflows).
      drawLED(MARGIN + 4, 10, Math.max(-99, minesLeft));
      // Elapsed seconds (cap at 999 to fit 3 digits).
      drawLED(W - MARGIN - 4 - 40, 10, Math.min(999, timer));

      const sx = W / 2;
      const sy = TOOLBAR_H / 2;
      const sr = 13;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#222';

      if (gameState === 'won') {
        // Shades + big smile.
        ctx.fillRect(sx - 9, sy - 5, 7, 5);
        ctx.fillRect(sx + 2, sy - 5, 7, 5);
        ctx.fillRect(sx - 9, sy - 5, 18, 2);
        ctx.beginPath();
        ctx.arc(sx, sy + 2, 6, 0.1, Math.PI - 0.1);
        ctx.stroke();
      } else if (gameState === 'lost') {
        // X eyes + frown.
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', sx - 4, sy - 3);
        ctx.fillText('×', sx + 4, sy - 3);
        ctx.textBaseline = 'alphabetic';
        ctx.beginPath();
        ctx.arc(sx, sy + 8, 4, Math.PI, Math.PI * 2);
        ctx.stroke();
      } else {
        // Dot eyes + smile.
        ctx.beginPath();
        ctx.arc(sx - 4, sy - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + 4, sy - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy + 2, 5, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
    }

    function drawLED(x: number, y: number, value: number): void {
      const text = String(Math.abs(value)).padStart(3, '0');
      const prefix = value < 0 ? '-' : '';
      ctx.fillStyle = '#200';
      ctx.fillRect(x, y, 40, 22);
      raised3D(x, y, 40, 22, 1, true); // sunken
      ctx.fillStyle = '#f00';
      ctx.font = "bold 17px 'Courier New', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(prefix + text, x + 3, y + 3);
      ctx.textBaseline = 'alphabetic';
    }

    function drawDiffBar(): void {
      const btnW = Math.floor(GRID_W / DIFFS.length);
      DIFFS.forEach((d, i) => {
        const x = MARGIN + i * btnW;
        const y = TOOLBAR_H + 4;
        const bw = i === DIFFS.length - 1 ? GRID_W - i * btnW : btnW;
        const bh = DIFF_H - 8;
        const active = i === diffIdx;

        ctx.fillStyle = active ? '#1976D2' : '#e0e0e0';
        ctx.fillRect(x + 2, y, bw - 4, bh);
        raised3D(x + 2, y, bw - 4, bh, 2, active);

        ctx.fillStyle = active ? '#fff' : '#333';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.label, x + bw / 2, y + bh / 2);
        ctx.textBaseline = 'alphabetic';
      });
    }

    function drawGrid(): void {
      if (grid.length === 0) return;
      const { cols, rows } = currentDiff();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          drawCell(r, c);
        }
      }
    }

    function drawCell(r: number, c: number): void {
      const x = offX + c * cellSize;
      const y = offY + r * cellSize;
      const s = cellSize;
      const cell = cellAtRC(r, c);

      if (cell.revealed) {
        ctx.fillStyle = cell.isMine ? '#ff5252' : '#bdbdbd';
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

        if (cell.isMine) {
          drawMineIcon(x + s / 2, y + s / 2, s * 0.3);
        } else if (cell.adjacent > 0) {
          ctx.fillStyle = NUM_COLORS[cell.adjacent] ?? '#000';
          ctx.font = `bold ${Math.max(8, Math.floor(s * 0.55))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cell.adjacent), x + s / 2, y + s / 2 + 1);
          ctx.textBaseline = 'alphabetic';
        }
      } else {
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(x, y, s, s);
        raised3D(x, y, s, s, Math.max(1, Math.floor(s * 0.1)), false);
        if (cell.flagged) drawFlagIcon(x + s / 2, y + s / 2, s * 0.3);
      }
    }

    function raised3D(
      x: number,
      y: number,
      w: number,
      h: number,
      t: number,
      sunken: boolean,
    ): void {
      const light = sunken ? '#808080' : '#ffffff';
      const dark = sunken ? '#ffffff' : '#808080';
      ctx.fillStyle = light;
      ctx.fillRect(x, y, w, t);
      ctx.fillRect(x, y, t, h);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y + h - t, w, t);
      ctx.fillRect(x + w - t, y, t, h);
    }

    function drawMineIcon(cx: number, cy: number, r: number): void {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = Math.max(1, r * 0.3);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
        ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawFlagIcon(cx: number, cy: number, r: number): void {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = Math.max(1, r * 0.25);
      ctx.beginPath();
      ctx.moveTo(cx, cy + r);
      ctx.lineTo(cx, cy - r);
      ctx.stroke();
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 1.1, cy - r * 0.35);
      ctx.lineTo(cx, cy + r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(
        cx - r * 0.7,
        cy + r - Math.max(1, r * 0.25),
        r * 1.4,
        Math.max(1, r * 0.25),
      );
    }

    // ── Hit testing ───────────────────────────────────────────

    function canvasXY(clientX: number, clientY: number): { x: number; y: number } {
      // Always re-query: modal CSS transitions can shift the canvas after
      // start() runs, so a cached rect would be stale.
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (W / rect.width),
        y: (clientY - rect.top) * (H / rect.height),
      };
    }

    function cellAt(x: number, y: number): { r: number; c: number } | null {
      const { cols, rows } = currentDiff();
      const c = Math.floor((x - offX) / cellSize);
      const r = Math.floor((y - offY) / cellSize);
      if (r >= 0 && r < rows && c >= 0 && c < cols) return { r, c };
      return null;
    }

    function onSmiley(x: number, y: number): boolean {
      const dx = x - W / 2;
      const dy = y - TOOLBAR_H / 2;
      return Math.sqrt(dx * dx + dy * dy) <= 16;
    }

    function diffBarIdx(x: number, y: number): number {
      if (y < TOOLBAR_H + 4 || y > TOOLBAR_H + DIFF_H - 4) return -1;
      const btnW = Math.floor(GRID_W / DIFFS.length);
      const i = Math.floor((x - MARGIN) / btnW);
      return i >= 0 && i < DIFFS.length ? i : -1;
    }

    // ── Actions ───────────────────────────────────────────────

    function reveal(r: number, c: number): void {
      if (gameState === 'won' || gameState === 'lost') return;
      const cell = cellAtRC(r, c);
      if (cell.revealed || cell.flagged) return;

      if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        gameState = 'playing';
        timerInterval = window.setInterval(() => {
          timer++;
          draw();
        }, 1000);
      }

      if (cell.isMine) {
        cell.revealed = true;
        gameState = 'lost';
        if (timerInterval !== null) clearInterval(timerInterval);
        timerInterval = null;
        revealMines();
      } else {
        revealBFS(r, c);
        if (checkWin()) {
          gameState = 'won';
          if (timerInterval !== null) clearInterval(timerInterval);
          timerInterval = null;
          minesLeft = 0;
        }
      }
      draw();
    }

    function flag(r: number, c: number): void {
      if (gameState === 'won' || gameState === 'lost') return;
      const cell = cellAtRC(r, c);
      if (cell.revealed) return;
      cell.flagged = !cell.flagged;
      minesLeft += cell.flagged ? -1 : 1;
      draw();
    }

    // ── Listeners ─────────────────────────────────────────────

    function onClick(e: MouseEvent): void {
      // Long-press fires a flag on touchstart; the subsequent click should be swallowed
      // so it doesn't also reveal the cell the player just flagged.
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      const { x, y } = canvasXY(e.clientX, e.clientY);

      if (onSmiley(x, y)) {
        initGame();
        return;
      }

      const di = diffBarIdx(x, y);
      if (di >= 0) {
        diffIdx = di;
        initGame();
        return;
      }

      const pos = cellAt(x, y);
      if (pos) reveal(pos.r, pos.c);
    }

    function onContextMenu(e: MouseEvent): void {
      e.preventDefault();
      const { x, y } = canvasXY(e.clientX, e.clientY);
      const pos = cellAt(x, y);
      if (pos) flag(pos.r, pos.c);
    }

    function onTouchStart(e: TouchEvent): void {
      const touch = e.touches[0];
      if (!touch) return;
      const { clientX, clientY } = touch;
      longPressTimer = window.setTimeout(() => {
        longPressTriggered = true;
        const { x, y } = canvasXY(clientX, clientY);
        const pos = cellAt(x, y);
        if (pos) flag(pos.r, pos.c);
      }, 450);
    }

    function cancelLongPress(): void {
      if (longPressTimer !== null) clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Suppress the mobile long-press callout / text selection so our own
    // long-press flag handler is the one that fires.
    const TOUCH_CSS: Record<string, string> = {
      userSelect: 'none',
      webkitUserSelect: 'none',
      webkitTouchCallout: 'none',
      touchAction: 'none',
    };
    const savedCss: Record<string, string> = {};

    return {
      start(): void {
        initGame();
        for (const k of Object.keys(TOUCH_CSS)) {
          savedCss[k] = (canvas.style as unknown as Record<string, string>)[k] ?? '';
          (canvas.style as unknown as Record<string, string>)[k] = TOUCH_CSS[k]!;
        }
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('contextmenu', onContextMenu);
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchend', cancelLongPress);
        canvas.addEventListener('touchmove', cancelLongPress, { passive: true });
      },
      stop(): void {
        if (timerInterval !== null) clearInterval(timerInterval);
        timerInterval = null;
        cancelLongPress();
        for (const k of Object.keys(TOUCH_CSS)) {
          (canvas.style as unknown as Record<string, string>)[k] = savedCss[k] ?? '';
        }
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('contextmenu', onContextMenu);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchend', cancelLongPress);
        canvas.removeEventListener('touchmove', cancelLongPress);
      },
    };
  },
};
