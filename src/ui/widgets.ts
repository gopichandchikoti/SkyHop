import { COPY } from './copy';
import { h, icon, type Child, type IconName } from './dom';
import type { UiActions } from './types';

export interface ButtonOptions {
  primary?: boolean;
  large?: boolean;
  icon?: IconName;
  aria?: string;
  autofocus?: boolean;
  iconOnly?: boolean;
  extra?: Child;
}

/** Every button plays the UI click through `actions.clicked` so audio unlocks on the first press. */
export function button(
  text: string,
  actions: UiActions,
  onPress: () => void,
  options: ButtonOptions = {},
): HTMLButtonElement {
  const classes = ['btn', options.primary && 'btn--primary', options.large && 'btn--xl', options.iconOnly && 'btn--icon']
    .filter(Boolean)
    .join(' ');
  return h(
    'button',
    {
      class: classes,
      type: 'button',
      'aria-label': options.iconOnly ? text : options.aria,
      'data-autofocus': options.autofocus,
      onclick: () => {
        actions.clicked();
        onPress();
      },
    },
    options.icon && icon(options.icon),
    options.iconOnly ? null : h('span', { class: 'btn__text' }, text),
    options.extra,
  );
}

export function closeButton(actions: UiActions, onClose: () => void): HTMLButtonElement {
  return button(COPY.close, actions, onClose, { icon: 'close', iconOnly: true });
}

/** A modal panel over a dimmed backdrop. Taps on the backdrop never reach the game. */
export function modal(titleId: string, title: string, body: Child[], extraClass = ''): HTMLElement {
  const panel = h('div', { class: `panel ${extraClass}`.trim() }, h('h2', { id: titleId, class: 'panel__title' }, title),
    ...body);
  return h('section', {
    class: 'screen screen--modal', 'data-ui': '', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': titleId, tabindex: '-1',
  }, panel);
}

/** Header row with a title and a close button, used by the wide dialogs. */
export function dialogHeader(titleId: string, title: string, close: HTMLElement): HTMLElement {
  return h('header', { class: 'panel__head' }, h('h2', { id: titleId, class: 'panel__title' }, title), close);
}

export function wideModal(titleId: string, header: HTMLElement, body: Child[]): HTMLElement {
  return h('section', {
    class: 'screen screen--modal', 'data-ui': '', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': titleId, tabindex: '-1',
  }, h('div', { class: 'panel panel--wide' }, header, ...body));
}

/** Keeps Tab inside an open dialog. Returns a function that removes the trap. */
export function trapFocus(container: HTMLElement): () => void {
  const selector = 'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])';
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}
