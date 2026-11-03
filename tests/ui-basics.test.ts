// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { COPY } from '../src/ui/copy';
import { append, clear, cssColor, h, icon, type IconName } from '../src/ui/dom';
import { Hud } from '../src/ui/hud';

describe('dom helpers', () => {
  it('builds elements with attributes, booleans and listeners', () => {
    const click = vi.fn();
    const el = h('button', { class: 'a b', type: 'button', 'data-flag': true, hidden: false, 'data-x': 3, onclick: click, skip: undefined }, 'Go');
    expect(el.className).toBe('a b');
    expect(el.getAttribute('data-flag')).toBe('');
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.getAttribute('data-x')).toBe('3');
    el.click();
    expect(click).toHaveBeenCalledTimes(1);
    expect(el.textContent).toBe('Go');
  });

  it('never parses text as HTML', () => {
    const el = h('p', {}, '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('skips empty children and appends nodes', () => {
    const child = h('span');
    const parent = h('div', {}, null, false, undefined, child, 'tail');
    expect(parent.childNodes).toHaveLength(2);
    append(parent, ['more']);
    expect(parent.textContent).toBe('tailmore');
    clear(parent);
    expect(parent.childNodes).toHaveLength(0);
  });

  it('draws every icon as a hidden, themed svg', () => {
    const names: IconName[] = ['play', 'pause', 'soundOn', 'soundOff', 'sliders', 'lock', 'check', 'home', 'retry',
      'close', 'star'];
    for (const name of names) {
      const svg = icon(name);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    }
    expect(icon('play').getAttribute('fill')).toBe('currentColor');
    expect(icon('check').getAttribute('fill')).toBe('none');
  });

  it('formats colours as css hex', () => {
    expect(cssColor(0x00ff7a)).toBe('#00ff7a');
    expect(cssColor(0xff)).toBe('#0000ff');
  });
});

describe('Hud', () => {
  let onPause: Mock<() => void>;
  let onSound: Mock<() => void>;
  let hud: Hud;

  beforeEach(() => {
    vi.useFakeTimers();
    onPause = vi.fn();
    onSound = vi.fn();
    hud = new Hud(onPause, onSound);
    document.body.append(hud.element, ...(hud.overlays.filter((n): n is Node => n instanceof Node)));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('wires the pause and sound buttons', () => {
    (hud.element.querySelector('[aria-label="Pause"]') as HTMLElement).click();
    (hud.element.querySelector('[aria-pressed]') as HTMLElement).click();
    expect(onPause).toHaveBeenCalled();
    expect(onSound).toHaveBeenCalled();
    hud.focusPause();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Pause');
  });

  it('shows and hides itself', () => {
    expect(hud.element.hidden).toBe(true);
    hud.setVisible(true);
    expect(hud.element.hidden).toBe(false);
  });

  it('reports level progress to assistive tech', () => {
    hud.setLevel('Level 3', 'High Noon', 12);
    hud.setScore(5, 12);
    const bar = hud.element.querySelector('[role=progressbar]') as HTMLElement;
    expect(bar.getAttribute('aria-valuemax')).toBe('12');
    expect(bar.getAttribute('aria-valuenow')).toBe('5');
    expect(bar.getAttribute('aria-valuetext')).toBe('5 / 12');
    expect(hud.element.querySelector('.score')?.textContent).toBe('5');
    expect(hud.element.querySelector('.pill__name')?.textContent).toBe('High Noon');
    expect((hud.element.querySelector('.progress__fill') as HTMLElement).style.transform).toBe('scaleX(0.4166666666666667)');
    hud.setScore(99, 12);
    expect((hud.element.querySelector('.progress__fill') as HTMLElement).style.transform).toBe('scaleX(1)');
  });

  it('hides the progress bar in endless mode and pops the score', () => {
    hud.setLevel('Endless', 'First Light', null);
    expect((hud.element.querySelector('.progress') as HTMLElement).hidden).toBe(true);
    hud.setScore(3, null);
    expect(hud.element.querySelector('.score')?.classList.contains('is-pop')).toBe(true);
    hud.setScore(4, null, false);
    expect(hud.element.querySelector('.score')?.textContent).toBe('4');
  });

  it('labels the sound button for its state', () => {
    hud.setSound(false);
    const button = hud.element.querySelector('[aria-pressed]') as HTMLElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(COPY.unmute);
    hud.setSound(true);
    expect(button.getAttribute('aria-label')).toBe(COPY.mute);
  });

  it('shows hints, banners and countdowns', () => {
    const hint = document.querySelector('.hint--play') as HTMLElement;
    hud.setHint('Tap!');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe('Tap!');
    hud.setHint(null);
    expect(hint.hidden).toBe(true);

    const banner = document.querySelector('.banner') as HTMLElement;
    hud.showBanner('Level 2', 'Cloud Nine', 500);
    expect(banner.classList.contains('is-show')).toBe(true);
    expect(banner.textContent).toBe('Level 2Cloud Nine');
    vi.advanceTimersByTime(600);
    expect(banner.classList.contains('is-show')).toBe(false);
    hud.showBanner('x', 'y');
    hud.hideBanner();
    expect(banner.classList.contains('is-show')).toBe(false);

    const countdown = document.querySelector('.countdown') as HTMLElement;
    hud.showCountdown('3');
    expect(countdown.hidden).toBe(false);
    expect(countdown.textContent).toBe('3');
    hud.showCountdown(null);
    expect(countdown.hidden).toBe(true);
  });

  it('announces messages through a polite live region', () => {
    hud.announce('Level 1');
    vi.advanceTimersByTime(50);
    expect(document.querySelector('[aria-live=polite]')?.textContent).toBe('Level 1');
  });
});
