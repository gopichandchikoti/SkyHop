import { SKINS } from '../core/skins';
import { COPY } from './copy';
import { h, icon } from './dom';
import type { GameOverView, LevelCompleteView, MenuView, UiActions } from './types';
import { button, modal } from './widgets';

export interface MenuHandlers {
  onLevels: () => void;
  onSettings: () => void;
}

/** Title screen. Only the controls take pointer events, so a tap anywhere else starts the game. */
export function buildMenu(view: MenuView, actions: UiActions, handlers: MenuHandlers): HTMLElement {
  const play = button(COPY.playLevel(view.nextLevel.id), actions, () => actions.playLevel(view.nextLevel.id), {
    primary: true, large: true, icon: 'play', autofocus: true,
  });
  const levels = button(COPY.levels, actions, handlers.onLevels);
  const endless = button(COPY.endless, actions, actions.playEndless, {
    extra: view.bestEndless > 0 ? h('small', { class: 'btn__sub' }, COPY.bestOf(view.bestEndless)) : null,
  });
  const settings = button(COPY.settings, actions, handlers.onSettings, { icon: 'sliders', iconOnly: true });
  const sound = button(view.sfx ? COPY.mute : COPY.unmute, actions, actions.toggleSound, {
    icon: view.sfx ? 'soundOn' : 'soundOff', iconOnly: true,
  });
  return h('section', { class: 'screen menu', 'aria-label': 'Main menu' },
    h('header', { class: 'menu__head' }, h('h1', { class: 'logo' }, COPY.title), h('p', { class: 'tagline' }, COPY.tagline)),
    h('div', { class: 'menu__actions' },
      play,
      h('div', { class: 'row' }, levels, endless),
      h('div', { class: 'row' }, settings, sound),
      view.storageOk ? null : h('p', { class: 'notice', role: 'status' }, COPY.storageBlocked),
      h('p', { class: 'hint' }, COPY.startHint)));
}

export function buildPause(actions: UiActions): HTMLElement {
  return modal('pause-title', COPY.paused, [
    h('div', { class: 'stack' },
      button(COPY.resume, actions, actions.resume, { primary: true, large: true, icon: 'play', autofocus: true }),
      button(COPY.restart, actions, actions.restartLevel, { icon: 'retry' }),
      button(COPY.menu, actions, actions.toMenu, { icon: 'home' })),
  ]);
}

function stat(label: string, value: string, accent = false): HTMLElement {
  return h('div', { class: accent ? 'stat stat--accent' : 'stat' },
    h('span', { class: 'stat__label' }, label), h('strong', { class: 'stat__value' }, value));
}

export function buildGameOver(view: GameOverView, actions: UiActions): HTMLElement {
  const progress = view.goal === null
    ? COPY.endlessLabel
    : `${COPY.levelReached(view.level.id, view.level.name)} · ${COPY.pipesCleared(view.score, view.goal)}`;
  return modal('over-title', COPY.gameOver, [
    h('p', { class: 'panel__sub' }, progress),
    h('div', { class: 'stats' }, stat(COPY.score, String(view.score), true), view.endless && stat(COPY.best,
      String(view.best))),
    view.isBest && h('p', { class: 'badge' }, COPY.newBest),
    h('div', { class: 'stack' },
      button(COPY.tryAgain, actions, actions.retry, { primary: true, large: true, icon: 'retry', autofocus: true }),
      button(COPY.menu, actions, actions.toMenu, { icon: 'home' })),
  ]);
}

export function buildLevelComplete(view: LevelCompleteView, actions: UiActions): HTMLElement {
  const unlocked = view.newSkin ? SKINS.find((skin) => skin.id === view.newSkin) : undefined;
  const primary = view.next
    ? button(COPY.nextLevel, actions, actions.nextLevel, { primary: true, large: true, icon: 'play', autofocus: true })
    : button(COPY.menu, actions, actions.toMenu, { primary: true, large: true, icon: 'home', autofocus: true });
  return modal('complete-title', COPY.levelComplete, [
    h('p', { class: 'panel__sub' }, COPY.levelReached(view.level.id, view.level.name)),
    h('div', { class: 'trophy', 'aria-hidden': 'true' }, icon('star')),
    view.next ? h('p', { class: 'panel__sub' }, COPY.upNext(view.next.name)) : h('p', { class: 'badge' }, COPY.allDone),
    unlocked && h('p', { class: 'badge badge--teal' }, COPY.skinUnlocked(unlocked.name)),
    h('div', { class: 'stack' }, primary,
      button(COPY.replay, actions, () => actions.playLevel(view.level.id), { icon: 'retry' }),
      view.next && button(COPY.menu, actions, actions.toMenu, { icon: 'home' })),
  ]);
}

export function buildError(message: string, actions: UiActions): HTMLElement {
  return modal('error-title', COPY.errorTitle, [
    h('p', { class: 'panel__sub' }, message),
    h('div', { class: 'stack' }, button(COPY.reload, actions, actions.reload, {
      primary: true, large: true, icon: 'retry', autofocus: true,
    })),
  ]);
}
