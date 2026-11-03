import { buildLevels, buildSettings } from './dialogs';
import { clear, h } from './dom';
import { Hud } from './hud';
import { buildError, buildGameOver, buildLevelComplete, buildMenu, buildPause } from './screens';
import type { GameOverView, LevelCompleteView, LevelsView, MenuView, SettingsView, UiActions } from './types';
import { trapFocus } from './widgets';

/** Owns every piece of DOM that sits on top of the 3D canvas. */
export class Ui {
  readonly hud: Hud;
  private readonly base = h('div', { class: 'screens__base' });
  private readonly overlay = h('div', { class: 'screens__modal' });
  private releaseTrap: (() => void) | null = null;
  private opener: HTMLElement | null = null;
  private menuView: MenuView | null = null;

  constructor(
    root: HTMLElement,
    private readonly actions: UiActions,
  ) {
    this.hud = new Hud(actions.pause, actions.toggleSound);
    root.append(this.hud.element, ...this.hud.overlays.filter((node): node is Node => node instanceof Node),
      h('div', { class: 'screens' }, this.base, this.overlay));
  }

  get modalOpen(): boolean {
    return this.overlay.firstChild !== null;
  }

  showMenu(view: MenuView): void {
    this.menuView = view;
    this.closeModal(false);
    this.hud.setVisible(false);
    this.hud.setHint(null);
    this.hud.hideBanner();
    this.hud.showCountdown(null);
    this.mountBase(this.menuScreen(view));
  }

  /** Re-renders the menu in place, for example after sound is toggled. */
  refreshMenu(view: MenuView): void {
    this.menuView = view;
    if (this.base.firstChild) this.mountBase(this.menuScreen(view), false);
  }

  clearBase(): void {
    clear(this.base);
  }

  openLevels(view: LevelsView): void {
    this.openModal(buildLevels(view, this.actions, () => this.closeModal(true)));
  }

  openSettings(view: SettingsView): void {
    this.openModal(buildSettings(view, this.actions, () => this.closeModal(true)));
  }

  showPause(): void {
    this.openModal(buildPause(this.actions));
  }

  showGameOver(view: GameOverView): void {
    this.openModal(buildGameOver(view, this.actions));
  }

  showLevelComplete(view: LevelCompleteView): void {
    this.openModal(buildLevelComplete(view, this.actions));
  }

  showError(message: string): void {
    this.openModal(buildError(message, this.actions));
  }

  closeModal(restoreFocus: boolean): void {
    this.releaseTrap?.();
    this.releaseTrap = null;
    clear(this.overlay);
    if (restoreFocus && this.opener?.isConnected) this.opener.focus();
    this.opener = null;
  }

  /** The app sets this so the menu buttons can request dialogs that need fresh data. */
  onOpen: (kind: 'levels' | 'settings') => void = () => undefined;

  get currentMenu(): MenuView | null {
    return this.menuView;
  }

  private menuScreen(view: MenuView): HTMLElement {
    return buildMenu(view, this.actions, {
      onLevels: () => this.onOpen('levels'),
      onSettings: () => this.onOpen('settings'),
    });
  }

  private mountBase(screen: HTMLElement, focus = true): void {
    clear(this.base);
    this.base.append(screen);
    if (focus) screen.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }

  private openModal(screen: HTMLElement): void {
    const active = document.activeElement;
    if (!this.modalOpen && active instanceof HTMLElement && active !== document.body) this.opener = active;
    this.releaseTrap?.();
    clear(this.overlay);
    this.overlay.append(screen);
    this.releaseTrap = trapFocus(screen);
    const target = screen.querySelector<HTMLElement>('[data-autofocus]') ?? screen;
    target.focus({ preventScroll: true });
  }
}

