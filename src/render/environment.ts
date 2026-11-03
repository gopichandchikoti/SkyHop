import * as THREE from 'three';
import type { ThemeId } from '../core/levels';
import type { Rng } from '../core/rng';
import { Clouds } from './clouds';
import { ThemeState } from './palette';
import { THEMES, type ThemeDef } from './themeData';
import { Sky } from './sky';
import type { EnvFrame } from './envFrame';
import { Terrain } from './terrain';

const THEME_BLEND_RATE = 1.6;

/** Everything behind the action: sky, sun, stars, clouds, hills, ground and the lights that tint the scene. */
export class Environment {
  readonly theme = new ThemeState(THEMES.meadow);
  private target: ThemeDef = THEMES.meadow;
  private readonly sky: Sky;
  private readonly clouds: Clouds;
  private readonly terrain: Terrain;
  private readonly hemisphere = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  private readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  private readonly fog = new THREE.Fog(0xffffff, 110, 520);

  constructor(scene: THREE.Scene, rng: Rng) {
    this.sky = new Sky(() => rng.next());
    this.clouds = new Clouds(rng);
    this.terrain = new Terrain(rng);
    this.sun.position.set(-9, 16, 14);
    scene.fog = this.fog;
    scene.add(this.sky.dome, this.sky.stars, this.terrain.group, this.clouds.group, this.hemisphere, this.sun);
  }

  setTheme(id: ThemeId, instant: boolean): void {
    this.target = THEMES[id];
    if (instant) this.theme.snapTo(this.target);
  }

  update(frame: EnvFrame): void {
    this.theme.approach(this.target, THEME_BLEND_RATE, frame.dt);
    const { colors, scalars } = this.theme;
    this.hemisphere.color.copy(colors.hemiSky);
    this.hemisphere.groundColor.copy(colors.hemiGround);
    this.hemisphere.intensity = scalars.hemiIntensity;
    this.sun.color.copy(colors.light);
    this.sun.intensity = scalars.lightIntensity;
    this.fog.color.copy(colors.skyHorizon);
    this.sky.resize(frame.aspect, frame.pixelRatio);
    this.sky.update(this.theme, frame.time);
    this.clouds.update(this.theme, frame);
    this.terrain.update(this.theme, frame.framing.camX, frame.scroll);
  }
}
