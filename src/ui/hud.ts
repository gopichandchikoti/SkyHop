import { COPY } from './copy';
import { h, icon, type Child } from './dom';

/** In-game overlay: score, level progress, quick buttons, level banner, countdown and the flap hint. */
export class Hud {
  readonly element: HTMLElement;
  private readonly score = h('div', { class: 'score', 'aria-hidden': 'true' }, '0');
  private readonly levelNumber = h('span', { class: 'pill__label' });
  private readonly levelName = h('span', { class: 'pill__name' });
  private readonly progress: HTMLElement;
  private readonly progressFill = h('span', { class: 'progress__fill' });
  private readonly progressText = h('span', { class: 'progress__text' });
  private readonly pauseButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly banner = h('div', { class: 'banner', 'aria-hidden': 'true' });
  private readonly countdown = h('div', { class: 'countdown', 'aria-hidden': 'true' });
  private readonly hint = h('p', { class: 'hint hint--play' });
  private readonly live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
  private bannerTimer = 0;

  constructor(onPause: () => void, onSound: () => void) {
    this.pauseButton = h('button', { class: 'btn btn--icon btn--small', type: 'button', 'aria-label': COPY.pause,
      onclick: onPause }, icon('pause'));
    this.soundButton = h('button', { class: 'btn btn--icon btn--small', type: 'button', 'aria-pressed': 'false',
      onclick: onSound });
    this.progress = h('div', { class: 'progress', role: 'progressbar', 'aria-label': COPY.levelProgress,
      'aria-valuemin': '0', 'aria-valuemax': '1', 'aria-valuenow': '0' }, this.progressFill, this.progressText);
    const pill = h('div', { class: 'pill' }, this.levelNumber, this.levelName);
    const top = h('div', { class: 'hud__top' }, pill, h('div', { class: 'hud__buttons' }, this.soundButton,
      this.pauseButton));
    this.element = h('div', { class: 'hud', hidden: true }, top, this.score, this.progress);
    this.setSound(true);
  }

  /** Elements that live outside the HUD box (they are centred on the whole screen). */
  get overlays(): Child[] {
    return [this.banner, this.countdown, this.hint, this.live];
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  setLevel(label: string, name: string, goal: number | null): void {
    this.levelNumber.textContent = label;
    this.levelName.textContent = name;
    this.progress.hidden = goal === null;
    if (goal !== null) this.progress.setAttribute('aria-valuemax', String(goal));
    this.setScore(0, goal, false);
  }

  setScore(score: number, goal: number | null, pop = true): void {
    this.score.textContent = String(score);
    if (pop) this.retrigger(this.score, 'is-pop');
    if (goal === null) return;
    this.progress.setAttribute('aria-valuenow', String(score));
    this.progress.setAttribute('aria-valuetext', COPY.pipesProgress(score, goal));
    this.progressFill.style.transform = `scaleX(${Math.min(1, score / goal)})`;
    this.progressText.textContent = COPY.pipesProgress(score, goal);
  }

  setSound(on: boolean): void {
    this.soundButton.setAttribute('aria-pressed', String(on));
    this.soundButton.setAttribute('aria-label', on ? COPY.mute : COPY.unmute);
    this.soundButton.replaceChildren(icon(on ? 'soundOn' : 'soundOff'));
  }

  setHint(text: string | null): void {
    this.hint.textContent = text ?? '';
    this.hint.hidden = text === null;
  }

  showBanner(title: string, subtitle: string, milliseconds = 2200): void {
    this.banner.replaceChildren(h('strong', {}, title), h('span', {}, subtitle));
    this.retrigger(this.banner, 'is-show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('is-show'), milliseconds);
  }

  hideBanner(): void {
    window.clearTimeout(this.bannerTimer);
    this.banner.classList.remove('is-show');
  }

  showCountdown(label: string | null): void {
    this.countdown.hidden = label === null;
    if (label === null) return;
    this.countdown.textContent = label;
    this.retrigger(this.countdown, 'is-tick');
  }

  announce(message: string): void {
    this.live.textContent = '';
    window.setTimeout(() => {
      this.live.textContent = message;
    }, 30);
  }

  focusPause(): void {
    this.pauseButton.focus();
  }

  private retrigger(element: HTMLElement, className: string): void {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }
}
