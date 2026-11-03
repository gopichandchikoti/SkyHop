import * as THREE from 'three';
import { approach } from './spring';
import { COLOR_KEYS, SCALAR_KEYS, type ColorKey, type ScalarKey, type ThemeDef } from './themeData';

/** Live theme values. Colours and scalars glide toward the target so level changes feel like time passing. */
export class ThemeState {
  readonly colors = {} as Record<ColorKey, THREE.Color>;
  readonly scalars = {} as Record<ScalarKey, number>;
  private readonly scratch = new THREE.Color();

  constructor(def: ThemeDef) {
    for (const key of COLOR_KEYS) this.colors[key] = new THREE.Color(def[key]);
    for (const key of SCALAR_KEYS) this.scalars[key] = def[key];
  }

  snapTo(def: ThemeDef): void {
    for (const key of COLOR_KEYS) this.colors[key].set(def[key]);
    for (const key of SCALAR_KEYS) this.scalars[key] = def[key];
  }

  approach(def: ThemeDef, rate: number, dt: number): void {
    const k = 1 - Math.exp(-rate * dt);
    for (const key of COLOR_KEYS) this.colors[key].lerp(this.scratch.set(def[key]), k);
    for (const key of SCALAR_KEYS) this.scalars[key] = approach(this.scalars[key], def[key], rate, dt);
  }
}
