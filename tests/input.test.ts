// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputController } from '../src/input/inputController';

describe('InputController', () => {
  let surface: HTMLElement;
  let input: InputController;
  const handlers = { primary: vi.fn(), pause: vi.fn(), toggleSound: vi.fn() };

  const key = (code: string, init: KeyboardEventInit = {}, target: EventTarget = window): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="surface"><button id="btn">go</button><p id="free">text</p></div>';
    surface = document.getElementById('surface') as HTMLElement;
    input = new InputController(surface, handlers);
    input.attach();
  });

  afterEach(() => input.detach());

  it.each(['Space', 'ArrowUp', 'KeyW', 'Enter', 'NumpadEnter'])('%s triggers the primary action', (code) => {
    const event = key(code);
    expect(handlers.primary).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores held keys, modifiers and unrelated keys', () => {
    key('Space', { repeat: true });
    key('Space', { ctrlKey: true });
    key('Space', { metaKey: true });
    key('Space', { altKey: true });
    key('KeyQ');
    expect(handlers.primary).not.toHaveBeenCalled();
  });

  it('lets focused buttons keep their own Space and Enter', () => {
    const button = document.getElementById('btn') as HTMLElement;
    const event = key('Space', {}, button);
    expect(handlers.primary).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('pauses on Escape and P once per press', () => {
    key('Escape');
    key('KeyP');
    key('Escape', { repeat: true });
    expect(handlers.pause).toHaveBeenCalledTimes(2);
  });

  it('toggles sound with M except while a control is focused', () => {
    key('KeyM');
    key('KeyM', { repeat: true });
    key('KeyM', {}, document.getElementById('btn') as HTMLElement);
    expect(handlers.toggleSound).toHaveBeenCalledTimes(1);
  });

  it('treats a primary-button press on empty space as the primary action', () => {
    const press = (target: Element, button = 0) =>
      target.dispatchEvent(new MouseEvent('pointerdown', { button, bubbles: true }));
    press(document.getElementById('free') as Element);
    press(surface);
    expect(handlers.primary).toHaveBeenCalledTimes(2);
    press(document.getElementById('btn') as Element);
    press(surface, 2);
    expect(handlers.primary).toHaveBeenCalledTimes(2);
  });

  it('stops listening after detach and attaches only once', () => {
    input.attach();
    key('Space');
    expect(handlers.primary).toHaveBeenCalledTimes(1);
    input.detach();
    key('Space');
    surface.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(handlers.primary).toHaveBeenCalledTimes(1);
  });
});
