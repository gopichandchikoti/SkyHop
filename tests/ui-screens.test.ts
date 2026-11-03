// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '../src/core/levels';
import { defaultSettings } from '../src/storage/repository';
import { buildLevels, buildSettings } from '../src/ui/dialogs';
import { buildError, buildGameOver, buildLevelComplete, buildMenu, buildPause } from '../src/ui/screens';
import type { UiActions } from '../src/ui/types';
import { Ui } from '../src/ui/ui';
import { trapFocus } from '../src/ui/widgets';

function makeActions(): UiActions & { [K in keyof UiActions]: ReturnType<typeof vi.fn> } {
  return {
    playLevel: vi.fn(), playEndless: vi.fn(), retry: vi.fn(), nextLevel: vi.fn(), toMenu: vi.fn(), pause: vi.fn(),
    resume: vi.fn(), restartLevel: vi.fn(), toggleSound: vi.fn(), setSetting: vi.fn(), resetProgress: vi.fn(),
    reload: vi.fn(), clicked: vi.fn(),
  } as never;
}

const byText = (root: ParentNode, text: string): HTMLElement => {
  const found = Array.from(root.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.includes(text)
    || b.getAttribute('aria-label')?.includes(text));
  if (!found) throw new Error(`no button "${text}"`);
  return found;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('menu', () => {
  const view = { nextLevel: getLevel(3), bestEndless: 0, sfx: true, storageOk: true };

  it('offers the next level and routes every control', () => {
    const actions = makeActions();
    const handlers = { onLevels: vi.fn(), onSettings: vi.fn() };
    const menu = buildMenu(view, actions, handlers);
    document.body.append(menu);
    expect(menu.querySelector('h1')?.textContent).toBe('SkyHop');
    byText(menu, 'Play level 3').click();
    expect(actions.playLevel).toHaveBeenCalledWith(3);
    byText(menu, 'Levels').click();
    byText(menu, 'Endless').click();
    byText(menu, 'Settings').click();
    byText(menu, 'Mute sound').click();
    expect(handlers.onLevels).toHaveBeenCalled();
    expect(actions.playEndless).toHaveBeenCalled();
    expect(handlers.onSettings).toHaveBeenCalled();
    expect(actions.toggleSound).toHaveBeenCalled();
    expect(actions.clicked).toHaveBeenCalledTimes(5);
  });

  it('shows the endless best only when there is one, and warns when storage is blocked', () => {
    const handlers = { onLevels: vi.fn(), onSettings: vi.fn() };
    const plain = buildMenu(view, makeActions(), handlers);
    expect(plain.textContent).not.toContain('Best');
    expect(plain.querySelector('.notice')).toBeNull();
    const rich = buildMenu({ ...view, bestEndless: 17, sfx: false, storageOk: false }, makeActions(), handlers);
    expect(rich.textContent).toContain('Best 17');
    expect(rich.querySelector('.notice')).not.toBeNull();
    expect(byText(rich, 'Turn sound on')).toBeTruthy();
  });
});

describe('dialogs and result screens', () => {
  it('pause offers resume, restart and menu', () => {
    const actions = makeActions();
    const pause = buildPause(actions);
    expect(pause.getAttribute('role')).toBe('dialog');
    byText(pause, 'Resume').click();
    byText(pause, 'Restart level').click();
    byText(pause, 'Main menu').click();
    expect(actions.resume).toHaveBeenCalled();
    expect(actions.restartLevel).toHaveBeenCalled();
    expect(actions.toMenu).toHaveBeenCalled();
  });

  it('game over adapts to campaign and endless', () => {
    const actions = makeActions();
    const campaign = buildGameOver(
      { endless: false, level: getLevel(2), score: 4, goal: 10, best: 0, isBest: false }, actions,
    );
    expect(campaign.textContent).toContain('4 of 10 pipes cleared');
    expect(campaign.textContent).not.toContain('New best');
    expect(campaign.querySelectorAll('.stat')).toHaveLength(1);
    byText(campaign, 'Try again').click();
    byText(campaign, 'Main menu').click();
    expect(actions.retry).toHaveBeenCalled();
    expect(actions.toMenu).toHaveBeenCalled();

    const endless = buildGameOver(
      { endless: true, level: getLevel(1), score: 9, goal: null, best: 9, isBest: true }, actions,
    );
    expect(endless.textContent).toContain('Endless');
    expect(endless.textContent).toContain('New best!');
    expect(endless.querySelectorAll('.stat')).toHaveLength(2);
  });

  it('level complete handles next level, final level and a new bird', () => {
    const actions = makeActions();
    const middle = buildLevelComplete({ level: getLevel(3), next: getLevel(4), newSkin: 'azure' }, actions);
    expect(middle.textContent).toContain('Up next: Golden Hour');
    expect(middle.textContent).toContain('New bird unlocked: Azure');
    byText(middle, 'Next level').click();
    byText(middle, 'Replay').click();
    byText(middle, 'Main menu').click();
    expect(actions.nextLevel).toHaveBeenCalled();
    expect(actions.playLevel).toHaveBeenCalledWith(3);
    expect(actions.toMenu).toHaveBeenCalled();

    const last = buildLevelComplete({ level: getLevel(10), next: null, newSkin: null }, actions);
    expect(last.textContent).toContain('Sky master');
    expect(last.textContent).not.toContain('Next level');
    byText(last, 'Main menu').click();
  });

  it('error screen reloads', () => {
    const actions = makeActions();
    const error = buildError('Broken', actions);
    expect(error.textContent).toContain('Broken');
    byText(error, 'Reload').click();
    expect(actions.reload).toHaveBeenCalled();
  });
});

describe('level select', () => {
  it('marks completed, open and locked levels and only starts playable ones', () => {
    const actions = makeActions();
    const close = vi.fn();
    const dialog = buildLevels({ unlocked: 3, completed: [1, 2] }, actions, close);
    document.body.append(dialog);
    const tiles = dialog.querySelectorAll<HTMLElement>('.level');
    expect(tiles).toHaveLength(10);
    expect(tiles[0]?.className).toContain('level--done');
    expect(tiles[2]?.className).toContain('level--open');
    expect(tiles[3]?.className).toContain('level--locked');
    expect(tiles[3]?.getAttribute('aria-disabled')).toBe('true');
    expect(tiles[3]?.getAttribute('aria-label')).toContain('Finish level 3 to unlock');
    tiles[3]?.click();
    expect(actions.playLevel).not.toHaveBeenCalled();
    tiles[2]?.click();
    expect(close).toHaveBeenCalled();
    expect(actions.playLevel).toHaveBeenCalledWith(3);
    byText(dialog, 'Close').click();
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe('settings', () => {
  it('toggles switches in place and reports the new value', () => {
    const actions = makeActions();
    const dialog = buildSettings({ settings: defaultSettings(), completed: [] }, actions, vi.fn());
    document.body.append(dialog);
    const assist = dialog.querySelector('[aria-labelledby="sw-assist-mode"]') as HTMLElement;
    expect(assist.getAttribute('aria-checked')).toBe('false');
    assist.click();
    expect(assist.getAttribute('aria-checked')).toBe('true');
    expect(actions.setSetting).toHaveBeenCalledWith('assist', true);
    assist.click();
    expect(actions.setSetting).toHaveBeenLastCalledWith('assist', false);
    for (const label of ['sw-sound-effects', 'sw-reduce-motion', 'sw-vibration']) {
      (dialog.querySelector(`[aria-labelledby="${label}"]`) as HTMLElement).click();
    }
    expect(actions.setSetting).toHaveBeenCalledWith('sfx', false);
    expect(actions.setSetting).toHaveBeenCalledWith('reducedMotion', true);
    expect(actions.setSetting).toHaveBeenCalledWith('haptics', true);
  });

  it('selects unlocked birds and refuses locked ones', () => {
    const actions = makeActions();
    const dialog = buildSettings({ settings: defaultSettings(), completed: [1, 2, 3] }, actions, vi.fn());
    const skins = Array.from(dialog.querySelectorAll<HTMLElement>('.skin'));
    expect(skins).toHaveLength(4);
    expect(skins[0]?.getAttribute('aria-checked')).toBe('true');
    skins[1]?.click();
    expect(actions.setSetting).toHaveBeenCalledWith('skin', 'azure');
    expect(skins[1]?.getAttribute('aria-checked')).toBe('true');
    expect(skins[0]?.getAttribute('aria-checked')).toBe('false');
    actions.setSetting.mockClear();
    skins[2]?.click();
    expect(actions.setSetting).not.toHaveBeenCalled();
    expect(skins[2]?.getAttribute('aria-label')).toContain('Complete level 6 to unlock');
  });

  it('asks twice before erasing progress', () => {
    const actions = makeActions();
    const dialog = buildSettings({ settings: defaultSettings(), completed: [] }, actions, vi.fn());
    const reset = dialog.querySelector('.btn--danger') as HTMLElement;
    reset.click();
    expect(actions.resetProgress).not.toHaveBeenCalled();
    expect(reset.textContent).toContain('again');
    reset.click();
    expect(actions.resetProgress).toHaveBeenCalledTimes(1);
  });
});

describe('trapFocus', () => {
  it('keeps Tab and Shift+Tab inside the dialog', () => {
    document.body.innerHTML = '<section id="d" tabindex="-1"><button id="a">a</button><button id="b">b</button></section>';
    const dialog = document.getElementById('d') as HTMLElement;
    const release = trapFocus(dialog);
    const [a, b] = [document.getElementById('a'), document.getElementById('b')] as HTMLElement[];
    const tab = (shiftKey = false) => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      document.activeElement?.dispatchEvent(event);
      return event;
    };
    b?.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b);
    a?.focus();
    expect(tab().defaultPrevented).toBe(false);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    release();
    b?.focus();
    expect(tab().defaultPrevented).toBe(false);
  });

  it('does nothing in an empty container', () => {
    document.body.innerHTML = '<section id="e"></section>';
    const release = trapFocus(document.getElementById('e') as HTMLElement);
    document.getElementById('e')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    release();
  });
});

describe('Ui', () => {
  let root: HTMLElement;
  let actions: ReturnType<typeof makeActions>;
  let ui: Ui;
  const menuView = { nextLevel: getLevel(1), bestEndless: 0, sfx: true, storageOk: true };

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.append(root);
    actions = makeActions();
    ui = new Ui(root, actions);
  });

  afterEach(() => vi.useRealTimers());

  it('mounts the menu, focuses Play and hides the HUD', () => {
    ui.showMenu(menuView);
    expect(root.querySelector('.menu')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Play level 1');
    expect(root.querySelector('.hud')?.hasAttribute('hidden')).toBe(true);
    expect(ui.currentMenu).toBe(menuView);
  });

  it('opens dialogs through the menu callbacks and restores focus on close', () => {
    const open = vi.fn();
    ui.onOpen = open;
    ui.showMenu(menuView);
    byText(root, 'Levels').focus();
    byText(root, 'Levels').click();
    expect(open).toHaveBeenCalledWith('levels');
    byText(root, 'Settings').click();
    expect(open).toHaveBeenCalledWith('settings');

    byText(root, 'Levels').focus();
    ui.openLevels({ unlocked: 1, completed: [] });
    expect(ui.modalOpen).toBe(true);
    expect(root.querySelector('[role=dialog]')).not.toBeNull();
    ui.closeModal(true);
    expect(ui.modalOpen).toBe(false);
    expect(document.activeElement?.textContent).toContain('Levels');
  });

  it('opens settings, pause, game over, complete and error modals one at a time', () => {
    ui.showMenu(menuView);
    ui.openSettings({ settings: defaultSettings(), completed: [] });
    expect(root.querySelectorAll('[role=dialog]')).toHaveLength(1);
    ui.showPause();
    expect(root.querySelector('#pause-title')).not.toBeNull();
    ui.showGameOver({ endless: false, level: getLevel(1), score: 1, goal: 8, best: 0, isBest: false });
    expect(root.querySelector('#over-title')).not.toBeNull();
    ui.showLevelComplete({ level: getLevel(1), next: getLevel(2), newSkin: null });
    expect(root.querySelector('#complete-title')).not.toBeNull();
    ui.showError('nope');
    expect(root.querySelector('#error-title')).not.toBeNull();
    expect(root.querySelectorAll('[role=dialog]')).toHaveLength(1);
  });

  it('refreshes the menu without stealing focus from an open dialog', () => {
    ui.showMenu(menuView);
    ui.openSettings({ settings: defaultSettings(), completed: [] });
    const inside = root.querySelector('.switch') as HTMLElement;
    inside.focus();
    ui.refreshMenu({ ...menuView, sfx: false });
    expect(document.activeElement).toBe(inside);
    expect(root.querySelector('.menu')?.textContent).toContain('');
    expect(ui.currentMenu?.sfx).toBe(false);
  });

  it('ignores a refresh before any menu exists and can clear the base screen', () => {
    ui.refreshMenu(menuView);
    expect(root.querySelector('.menu')).toBeNull();
    ui.showMenu(menuView);
    ui.clearBase();
    expect(root.querySelector('.menu')).toBeNull();
  });

  it('closing the menu also resets HUD overlays', () => {
    ui.hud.setVisible(true);
    ui.hud.showCountdown('3');
    ui.showMenu(menuView);
    expect((root.querySelector('.countdown') as HTMLElement).hidden).toBe(true);
  });
});
