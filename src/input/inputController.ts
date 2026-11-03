export interface InputHandlers {
  /** Space, up arrow, W, Enter or a tap: flap while playing, or confirm on menus. */
  primary(): void;
  pause(): void;
  toggleSound(): void;
}

const PRIMARY_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter', 'NumpadEnter']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="switch"], [role="radio"], [data-ui]';

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

/** Keyboard, mouse, touch and pen all funnel into the same three intents. */
export class InputController {
  private attached = false;

  constructor(
    private readonly surface: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    this.surface.addEventListener('pointerdown', this.onPointerDown);
  }

  detach(): void {
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.handleSystemKey(event)) return;
    if (!PRIMARY_KEYS.has(event.code) || event.repeat || isInteractive(event.target)) return;
    event.preventDefault();
    this.handlers.primary();
  };

  /** Pause and mute keys. Returns true when the key was one of them. */
  private handleSystemKey(event: KeyboardEvent): boolean {
    if (PAUSE_KEYS.has(event.code)) {
      if (!event.repeat) this.handlers.pause();
      return true;
    }
    if (event.code !== 'KeyM') return false;
    if (!event.repeat && !isInteractive(event.target)) this.handlers.toggleSound();
    return true;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || isInteractive(event.target)) return;
    this.handlers.primary();
  };
}
