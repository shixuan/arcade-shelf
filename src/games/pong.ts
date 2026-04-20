import type { Game, GameHandle } from '../types';

/*
 * Pong — classic two-paddle, ball bounces off paddles and walls.
 *
 * Velocity units: "pixels per 60fps frame". The step() function multiplies
 * motion by a deltaTime (dt) ratio so a 144Hz display doesn't run 2.4× faster
 * than a 60Hz one. Authors tune numbers against the 60fps baseline and dt
 * handles the rest.
 */
export const pong: Game = {
  name: 'Pong',
  icon: '🎾',
  description: 'Classic two-paddle — track the ball, beat the AI.',
  order: 1,
  canvasSize: { width: 380, height: 280 },

  init(canvas: HTMLCanvasElement): GameHandle {
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) throw new Error('[arcade-shelf/pong] 2D context unavailable');
    // Rebind with a non-nullable type so nested closures below don't need `!` assertions.
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    // Board geometry — W/H are the canvas's internal pixel size, NOT its CSS
    // size. setPlayerY() below scales mouse coords from CSS space into this.
    const W = canvas.width;
    const H = canvas.height;
    const PADDLE_W = 8;
    const PADDLE_H = 50;
    const BALL = 7;
    const PLAYER_X = 12;
    const AI_X = W - 12 - PADDLE_W;
    // 60fps baseline: one "frame" at 60Hz is ~16.67ms. dt = elapsed / FRAME_MS.
    const FRAME_MS = 1000 / 60;

    // Mutable game state. Kept in closure so start/stop share it without a class.
    let playerY = (H - PADDLE_H) / 2;
    let aiY = (H - PADDLE_H) / 2;
    let ballX = W / 2;
    let ballY = H / 2;
    let vx = 0;
    let vy = 0;
    let scoreP = 0;
    let scoreA = 0;
    let started = false; // has the player ever clicked to serve?
    let running = false; // is the RAF loop live right now?
    let raf: number | null = null;
    let lastTs = 0; // timestamp of previous step(), for dt calc
    let rect: DOMRect | null = null; // cached canvas bounds, for mouse→game coords

    // getBoundingClientRect() is expensive on every mousemove, so cache it.
    // Refreshed on start() and on resize (layout can shift the canvas).
    function refreshRect(): void {
      rect = canvas.getBoundingClientRect();
    }

    // Serve the ball toward `dir` (+1 = right / toward AI, -1 = left / toward player).
    // Small random vertical component so consecutive serves aren't identical.
    function resetBall(dir: number): void {
      ballX = W / 2;
      ballY = H / 2;
      const angle = Math.random() * 0.6 - 0.3; // radians, ~±17°
      const speed = 3.2;
      vx = Math.cos(angle) * speed * dir;
      vy = Math.sin(angle) * speed;
    }

    function draw(): void {
      // Full repaint every frame — cheaper than partial invalidation for a board this size.
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Dashed center line.
      ctx.strokeStyle = '#333';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]); // reset so other strokes don't inherit it

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(scoreP), W / 2 - 28, 28);
      ctx.fillText(String(scoreA), W / 2 + 28, 28);

      ctx.fillRect(PLAYER_X, playerY, PADDLE_W, PADDLE_H);
      ctx.fillRect(AI_X, aiY, PADDLE_W, PADDLE_H);
      // Ball is drawn from its top-left, but ballX/ballY track its center.
      ctx.fillRect(ballX - BALL / 2, ballY - BALL / 2, BALL, BALL);

      if (!started) {
        ctx.font = '12px sans-serif';
        ctx.fillText('Click / tap to start', W / 2, H - 14);
      }
    }

    function step(ts: number): void {
      if (!running) return;

      // dt is "how many 60fps frames' worth of time has passed since last step".
      // First frame: lastTs=0, use dt=1 (one baseline frame) to avoid a huge jump.
      // Clamp to 32ms (~2 frames) so a backgrounded tab returning after 5s
      // doesn't teleport the ball through a paddle.
      const dt = lastTs === 0 ? 1 : Math.min(32, ts - lastTs) / FRAME_MS;
      lastTs = ts;

      ballX += vx * dt;
      ballY += vy * dt;

      // Top/bottom wall bounce. Snap position back inside the wall before
      // flipping vy — otherwise a fast ball could "stick" outside the bound.
      if (ballY < BALL / 2) {
        ballY = BALL / 2;
        vy = -vy;
      }
      if (ballY > H - BALL / 2) {
        ballY = H - BALL / 2;
        vy = -vy;
      }

      // Player paddle collision. The `vx < 0` guard is critical: without it,
      // once the ball overlaps the paddle, every subsequent frame re-flips vx
      // and traps the ball inside (tunneling artifact).
      if (
        ballX - BALL / 2 < PLAYER_X + PADDLE_W &&
        ballX > PLAYER_X &&
        ballY > playerY &&
        ballY < playerY + PADDLE_H &&
        vx < 0
      ) {
        vx = -vx * 1.05; // 5% speedup per hit → rallies get harder
        // Angle reflection: hitting the paddle's top/bottom edge sends the
        // ball off at up to ±4 units/frame vertical; hitting dead center → 0.
        // rel ∈ [-1, 1], so vy ∈ [-4, 4].
        const rel = (ballY - (playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
        vy = rel * 4;
      }

      // AI paddle collision — mirror of the player check. `vx > 0` guard for
      // the same tunneling reason.
      if (
        ballX + BALL / 2 > AI_X &&
        ballX < AI_X + PADDLE_W &&
        ballY > aiY &&
        ballY < aiY + PADDLE_H &&
        vx > 0
      ) {
        vx = -vx * 1.05;
        const rel = (ballY - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2);
        vy = rel * 4;
      }

      // AI tracks the ball's y-position, but at a capped speed the player can
      // outpace — otherwise the AI is unbeatable. Dead zone of 6px prevents
      // jitter when the ball is directly in line with the paddle center.
      const aiCenter = aiY + PADDLE_H / 2;
      const diff = ballY - aiCenter;
      const aiSpeed = 2.4;
      if (Math.abs(diff) > 6) aiY += Math.sign(diff) * aiSpeed * dt;
      // Clamp so the paddle can't leave the board.
      aiY = Math.max(0, Math.min(H - PADDLE_H, aiY));

      // Score + serve toward the loser (classic Pong rules).
      if (ballX < 0) {
        scoreA++;
        resetBall(1);
      }
      if (ballX > W) {
        scoreP++;
        resetBall(-1);
      }

      draw();
      // Re-queue ourselves. RAF is not recursive in the stack-eating sense —
      // each call schedules the next ~16ms later; no stack frame is retained.
      raf = requestAnimationFrame(step);
    }

    // Translate a viewport Y (mouse/touch clientY) into the canvas's internal
    // pixel space. Canvas CSS height may differ from canvas.height (e.g.
    // responsive layout), so scale by H/rect.height.
    function setPlayerY(clientY: number): void {
      if (!rect) refreshRect();
      if (!rect) return;
      const y = (clientY - rect.top) * (H / rect.height);
      // Center the paddle on the cursor, then clamp inside the board.
      playerY = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    }

    function onMouseMove(e: MouseEvent): void {
      setPlayerY(e.clientY);
    }
    function onTouchMove(e: TouchEvent): void {
      const t = e.touches[0];
      if (t) setPlayerY(t.clientY);
    }
    // First tap serves the ball; subsequent taps while running are no-ops.
    // preventDefault stops the browser from treating a canvas tap as a
    // scroll/zoom gesture on mobile.
    function onStart(e: Event): void {
      e.preventDefault();
      if (!started) {
        started = true;
        resetBall(Math.random() > 0.5 ? 1 : -1);
      }
      if (!running) {
        running = true;
        lastTs = 0; // force the dt=1 first-frame path
        raf = requestAnimationFrame(step);
      }
    }
    function onResize(): void {
      refreshRect();
    }

    return {
      start(): void {
        refreshRect();
        window.addEventListener('resize', onResize);
        canvas.addEventListener('mousemove', onMouseMove);
        // passive:true lets the browser scroll without waiting on our handler,
        // which is the right call here since we never preventDefault on move.
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('click', onStart);
        canvas.addEventListener('touchstart', onStart);
        draw(); // paint the initial "click to start" frame
      },
      stop(): void {
        // Order matters: flip `running` first so an in-flight step() bails
        // instead of queuing another RAF after we cancel the current one.
        running = false;
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('click', onStart);
        canvas.removeEventListener('touchstart', onStart);
      },
    };
  },
};
