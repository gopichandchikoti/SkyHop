// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setup, type Rig } from './helpers/app-rig';

const press = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
};

const tap = (target: Element): void => {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
};

const frames = (rig: Rig, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) rig.frames.tick(1 / 60);
};

let rig: Rig;
beforeEach(() => {
  rig = setup();
});
afterEach(() => {
  rig.app.destroy();
});

describe('touch and pointer input through the whole app', () => {
  it('a tap on the open sky starts level 1, and the next tap makes the bird flap', () => {
    const root = document.getElementById('app') as HTMLElement;
    tap(root);
    expect(rig.app.session.flow.phase).toBe('ready');
    tap(root);
    frames(rig, 0.1);
    expect(rig.app.session.flow.phase).toBe('playing');
    expect(rig.app.session.bird.vy).toBeGreaterThan(0);
  });

  it('a tap on a button is that button\'s job and never a flap', () => {
    press('Space');
    const pause = document.querySelector<HTMLElement>('.hud button');
    expect(pause).not.toBeNull();
    tap(pause as HTMLElement);
    frames(rig, 0.2);
    expect(rig.app.session.flow.phase).toBe('ready');
  });

  it('ignores secondary mouse buttons', () => {
    const root = document.getElementById('app') as HTMLElement;
    root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }));
    expect(rig.app.session.flow.phase).toBe('menu');
  });
});

describe('the pause button', () => {
  it('pauses a run from the HUD, and Resume starts the 3-2-1', () => {
    press('Space');
    press('Space');
    frames(rig, 0.2);
    expect(rig.app.session.flow.phase).toBe('playing');

    (document.querySelector('button[aria-label="Pause"]') as HTMLElement).click();
    expect(rig.app.session.flow.phase).toBe('paused');
    expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Paused');

    const resume = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Resume'));
    (resume as HTMLElement).click();
    expect(rig.app.session.flow.phase).toBe('countdown');
  });
});
