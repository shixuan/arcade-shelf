export interface CanvasSize {
  width: number;
  height: number;
}

export interface GameHandle {
  start(): void;
  stop(): void;
}

export interface Game {
  /** Unique identifier shown as the list entry text. */
  name: string;
  /** Short visual (emoji or short string) shown next to the name. */
  icon?: string;
  /** Short one-line description, shown in tooltips / screen readers. */
  description?: string;
  /** Display order in the list; lower numbers render first. Defaults to Infinity. */
  order?: number;
  /** Canvas pixel dimensions. Defaults to 380×280. */
  canvasSize?: CanvasSize;
  /**
   * Optional trivial content shown below the canvas inside the modal — useful
   * for attribution, credits, controls hints, etc. A string is rendered as
   * text (safe); an HTMLElement is appended as-is (so you can build a link).
   */
  footer?: string | HTMLElement;
  /** Factory that receives a canvas and returns start/stop handles. */
  init(canvas: HTMLCanvasElement): GameHandle;
}

export interface ShelfOptions {
  /** Target container: DOM element or CSS selector. */
  container: HTMLElement | string;
  /** Card title. Defaults to "Let's play!". */
  title?: string;
  /** If set, only these game names are shown (in this order unless `order` is also set). */
  whitelist?: string[];
  /** Explicit display order by name. Games not listed fall back to their `order` field. */
  order?: string[];
}

export interface Shelf {
  /** Register a game with this shelf. */
  register(game: Game): this;
  /** Mount the shelf into its container and render the game list. */
  mount(): this;
  /** Unmount: stop any running game, remove rendered DOM. */
  unmount(): void;
}
