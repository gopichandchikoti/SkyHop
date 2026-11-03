type Attr = string | number | boolean | undefined | ((event: Event) => void);
export type Child = Node | string | null | false | undefined;

/** Tiny typed element builder. Text is always inserted as text nodes, never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, Attr> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') element.className = String(value);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  append(element, children);
  return element;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(element: Element): void {
  while (element.firstChild) element.removeChild(element.firstChild);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  play: { fill: true, paths: ['M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z'] },
  pause: { fill: true, paths: ['M6.5 5h3.5v14H6.5z', 'M14 5h3.5v14H14z'] },
  soundOn: { fill: false, paths: ['M4 9.5v5h3.5L12 18V6L7.5 9.5z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a8 8 0 0 1 0 11'] },
  soundOff: { fill: false, paths: ['M4 9.5v5h3.5L12 18V6L7.5 9.5z', 'M15.5 9.5l5 5', 'M20.5 9.5l-5 5'] },
  sliders: { fill: false, paths: ['M4 7h8', 'M18 7h2', 'M4 17h2', 'M12 17h8', 'M15 4.5v5', 'M9 14.5v5'] },
  lock: { fill: false, paths: ['M6.5 10.5h11v9h-11z', 'M8.5 10.5v-2.5a3.5 3.5 0 0 1 7 0v2.5'] },
  check: { fill: false, paths: ['M5 12.5l4.5 4.5L19 7.5'] },
  home: { fill: false, paths: ['M4 11.5L12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z'] },
  retry: { fill: false, paths: ['M19.5 12a7.5 7.5 0 1 1-2.4-5.5', 'M19.5 4.5v4.5H15'] },
  close: { fill: false, paths: ['M6 6l12 12', 'M18 6L6 18'] },
  star: { fill: true, paths: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z'] },
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const spec = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('fill', spec.fill ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', spec.fill ? '1.4' : '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of spec.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

export const cssColor = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;
