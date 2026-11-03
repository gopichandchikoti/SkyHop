import { LEVELS, type LevelDef } from '../core/levels';
import { SKINS, isSkinUnlocked, type SkinDef } from '../core/skins';
import { SKIN_PALETTES, THEMES } from '../render/themeData';
import type { Settings } from '../storage/repository';
import { COPY } from './copy';
import { cssColor, h, icon } from './dom';
import type { LevelsView, SettingsView, UiActions } from './types';
import { closeButton, dialogHeader, wideModal } from './widgets';

type LevelState = 'done' | 'open' | 'locked';

function levelState(level: LevelDef, view: LevelsView): LevelState {
  if (view.completed.includes(level.id)) return 'done';
  return level.id <= view.unlocked ? 'open' : 'locked';
}

function levelTile(level: LevelDef, view: LevelsView, actions: UiActions, onPick: () => void): HTMLElement {
  const state = levelState(level, view);
  const theme = THEMES[level.theme];
  const status = state === 'done' ? COPY.stateDone : state === 'open' ? COPY.stateOpen : COPY.stateLocked(level.id - 1);
  const badge = state === 'done' ? icon('check') : state === 'locked' ? icon('lock') : null;
  return h('li', {}, h('button', {
    class: `level level--${state}`,
    type: 'button',
    'aria-disabled': state === 'locked' ? 'true' : undefined,
    'aria-label': `${COPY.levelLabel(level.id)}, ${level.name}. ${status}`,
    style: `--sky-top:${cssColor(theme.skyTop)};--sky-bottom:${cssColor(theme.skyHorizon)}`,
    onclick: () => {
      actions.clicked();
      if (state === 'locked') return;
      onPick();
      actions.playLevel(level.id);
    },
  }, h('span', { class: 'level__sky' }, h('b', { class: 'level__num' }, String(level.id)), badge),
  h('span', { class: 'level__meta' }, h('strong', {}, level.name), h('small', {}, `${level.goal} pipes`))));
}

export function buildLevels(view: LevelsView, actions: UiActions, onClose: () => void): HTMLElement {
  const grid = h('ul', { class: 'levels' }, ...LEVELS.map((level) => levelTile(level, view, actions, onClose)));
  return wideModal('levels-title', dialogHeader('levels-title', COPY.chooseLevel, closeButton(actions, onClose)), [grid]);
}

interface SwitchSpec {
  label: string;
  hint: string;
  initial: boolean;
  onChange: (value: boolean) => void;
}

function switchRow(spec: SwitchSpec, actions: UiActions): HTMLElement {
  const { label, hint, onChange } = spec;
  const id = `sw-${label.replace(/\s+/g, '-').toLowerCase()}`;
  let checked = spec.initial;
  const control = h('button', {
    class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(checked), 'aria-labelledby': id,
    onclick: () => {
      actions.clicked();
      checked = !checked;
      control.setAttribute('aria-checked', String(checked));
      onChange(checked);
    },
  }, h('span', { class: 'switch__knob' }));
  return h('div', { class: 'row-setting' },
    h('div', { class: 'row-setting__text' }, h('span', { id, class: 'row-setting__label' }, label),
      h('small', {}, hint)), control);
}

function skinSwatch(skin: SkinDef, settings: Settings, completed: readonly number[], actions: UiActions): HTMLElement {
  const palette = SKIN_PALETTES[skin.id];
  const unlocked = isSkinUnlocked(skin.id, completed);
  const selected = settings.skin === skin.id;
  return h('button', {
    class: `skin${selected ? ' is-selected' : ''}`,
    type: 'button',
    role: 'radio',
    'aria-checked': String(selected),
    'aria-disabled': unlocked ? undefined : 'true',
    'aria-label': unlocked ? skin.name : `${skin.name}. ${COPY.skinLocked(skin.unlockLevel)}`,
    style: `--skin-a:${cssColor(palette.body)};--skin-b:${cssColor(palette.accent)}`,
    'data-skin': skin.id,
    onclick: (event) => {
      actions.clicked();
      if (!unlocked) return;
      actions.setSetting('skin', skin.id);
      markSelected((event.currentTarget as HTMLElement).parentElement, skin.id);
    },
  }, h('span', { class: 'skin__orb' }, unlocked ? null : icon('lock')),
  h('small', {}, unlocked ? skin.name : COPY.skinLocked(skin.unlockLevel)));
}

function markSelected(group: HTMLElement | null, id: string): void {
  group?.querySelectorAll<HTMLElement>('.skin').forEach((skin) => {
    const selected = skin.dataset['skin'] === id;
    skin.classList.toggle('is-selected', selected);
    skin.setAttribute('aria-checked', String(selected));
  });
}

export function buildSettings(view: SettingsView, actions: UiActions, onClose: () => void): HTMLElement {
  const { settings, completed } = view;
  const rows = [
    switchRow({ label: COPY.sfx, hint: COPY.sfxHint, initial: settings.sfx,
      onChange: (value) => actions.setSetting('sfx', value) }, actions),
    switchRow({ label: COPY.assist, hint: COPY.assistHint, initial: settings.assist,
      onChange: (value) => actions.setSetting('assist', value) }, actions),
    switchRow({ label: COPY.reducedMotion, hint: COPY.reducedMotionHint, initial: settings.reducedMotion,
      onChange: (value) => actions.setSetting('reducedMotion', value) }, actions),
    switchRow({ label: COPY.haptics, hint: COPY.hapticsHint, initial: settings.haptics,
      onChange: (value) => actions.setSetting('haptics', value) }, actions),
  ];
  const skins = h('div', { class: 'skins', role: 'radiogroup', 'aria-label': COPY.bird },
    ...SKINS.map((skin) => skinSwatch(skin, settings, completed, actions)));
  return wideModal('settings-title', dialogHeader('settings-title', COPY.settingsTitle, closeButton(actions, onClose)), [
    h('div', { class: 'settings' }, ...rows, h('p', { class: 'row-setting__label' }, COPY.bird), skins,
      resetButton(actions)),
  ]);
}

function resetButton(actions: UiActions): HTMLElement {
  const label = h('span', { class: 'btn__text' }, COPY.resetProgress);
  let armed = false;
  return h('button', {
    class: 'btn btn--danger', type: 'button',
    onclick: () => {
      actions.clicked();
      if (!armed) {
        armed = true;
        label.textContent = COPY.resetConfirm;
        return;
      }
      actions.resetProgress();
    },
  }, label);
}
