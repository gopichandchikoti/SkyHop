import type { ThemeId } from '../core/levels';
import type { SkinId } from '../core/skins';

export const COLOR_KEYS = [
  'skyTop', 'skyHorizon', 'sun', 'cloud', 'hillFar', 'hillMid', 'hillNear', 'grassA', 'grassB',
  'dirt', 'pipe', 'hemiSky', 'hemiGround', 'light',
] as const;

export const SCALAR_KEYS = [
  'sunX', 'sunY', 'sunSize', 'sunGlow', 'stars', 'aurora', 'lightIntensity', 'hemiIntensity',
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];
export type ScalarKey = (typeof SCALAR_KEYS)[number];
export type ThemeDef = Record<ColorKey, number> & Record<ScalarKey, number>;

export const THEMES: Record<ThemeId, ThemeDef> = {
  meadow: {
    skyTop: 0x7cc4ff, skyHorizon: 0xffe9c9, sun: 0xfff1b8, cloud: 0xffffff,
    hillFar: 0x9bd6c6, hillMid: 0x72c79f, hillNear: 0x4fb283, grassA: 0x86e05a, grassB: 0x73cc4a,
    dirt: 0xd8b27a, pipe: 0x4ccd5e, hemiSky: 0xcfeaff, hemiGround: 0x9bd18a, light: 0xfff4d6,
    sunX: 0.74, sunY: 0.66, sunSize: 0.05, sunGlow: 0.55, stars: 0, aurora: 0, lightIntensity: 2.2, hemiIntensity: 1.3,
  },
  noon: {
    skyTop: 0x2e8bff, skyHorizon: 0xbfe6ff, sun: 0xffffe0, cloud: 0xffffff,
    hillFar: 0x9fd9cf, hillMid: 0x74c9a6, hillNear: 0x4fb584, grassA: 0x6bd048, grassB: 0x5bbd3b,
    dirt: 0xcfa56a, pipe: 0x34b84a, hemiSky: 0xd9f0ff, hemiGround: 0x7fc47a, light: 0xffffff,
    sunX: 0.62, sunY: 0.84, sunSize: 0.04, sunGlow: 0.4, stars: 0, aurora: 0, lightIntensity: 2.4, hemiIntensity: 1.4,
  },
  goldenHour: {
    skyTop: 0x5878d8, skyHorizon: 0xffc07a, sun: 0xffdf8a, cloud: 0xffe4bd,
    hillFar: 0xe9bf91, hillMid: 0xc9a36a, hillNear: 0x9bab59, grassA: 0xaed05a, grassB: 0x9cc049,
    dirt: 0xc99a5e, pipe: 0x6bbd4c, hemiSky: 0xffe3c0, hemiGround: 0xb08a5a, light: 0xffd9a0,
    sunX: 0.76, sunY: 0.42, sunSize: 0.085, sunGlow: 0.85, stars: 0, aurora: 0, lightIntensity: 2.4, hemiIntensity: 1.2,
  },
  dusk: {
    skyTop: 0x3b2f86, skyHorizon: 0xff8fae, sun: 0xffb0a0, cloud: 0xffb5cc,
    hillFar: 0x9a74b8, hillMid: 0x7a5aa0, hillNear: 0x5b4584, grassA: 0x5db36b, grassB: 0x4ea35d,
    dirt: 0x8f6a68, pipe: 0x3fd1a1, hemiSky: 0xe6b0d8, hemiGround: 0x6a5a9a, light: 0xffc0d0,
    sunX: 0.3, sunY: 0.38, sunSize: 0.08, sunGlow: 0.75, stars: 0.25, aurora: 0, lightIntensity: 1.9,
    hemiIntensity: 1.1,
  },
  night: {
    skyTop: 0x060a26, skyHorizon: 0x26357a, sun: 0xf6f3e4, cloud: 0x6e7fc4,
    hillFar: 0x1f2d6b, hillMid: 0x172358, hillNear: 0x101a46, grassA: 0x2f8a63, grassB: 0x287655,
    dirt: 0x3a3560, pipe: 0x3be0a0, hemiSky: 0x6f86d8, hemiGround: 0x24305e, light: 0xb7c8ff,
    sunX: 0.78, sunY: 0.74, sunSize: 0.045, sunGlow: 0.5, stars: 1, aurora: 0, lightIntensity: 1.6, hemiIntensity: 1.1,
  },
  aurora: {
    skyTop: 0x030b1d, skyHorizon: 0x103a55, sun: 0xdff7ff, cloud: 0x4d7ea0,
    hillFar: 0x143a5e, hillMid: 0x0f2e4c, hillNear: 0x0a233b, grassA: 0x2aa07a, grassB: 0x228c6b,
    dirt: 0x2d3f5a, pipe: 0x5af0d0, hemiSky: 0x7fe3d0, hemiGround: 0x1d3a5a, light: 0xcfe9ff,
    sunX: 0.24, sunY: 0.8, sunSize: 0.04, sunGlow: 0.35, stars: 1, aurora: 1, lightIntensity: 1.6, hemiIntensity: 1.2,
  },
};

export interface SkinPalette {
  body: number;
  belly: number;
  wing: number;
  accent: number;
  beak: number;
}

export const SKIN_PALETTES: Record<SkinId, SkinPalette> = {
  coral: { body: 0xff7a59, belly: 0xffe0c2, wing: 0xff5c3a, accent: 0x2ec4b6, beak: 0xffb703 },
  azure: { body: 0x3f8cff, belly: 0xdcefff, wing: 0x2b6be0, accent: 0xffd23f, beak: 0xff9f1c },
  mint: { body: 0x3ed6a0, belly: 0xe5fff3, wing: 0x23b585, accent: 0xff7ab8, beak: 0xffb703 },
  gold: { body: 0xffc233, belly: 0xfff3c4, wing: 0xf59e0b, accent: 0xff4d6d, beak: 0xff7b00 },
};
