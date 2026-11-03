import * as THREE from 'three';
import type { ThemeState } from './palette';

const SKY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec2 uSunPos;
uniform float uSunSize;
uniform float uSunGlow;
uniform float uAspect;
uniform float uTime;
uniform float uAurora;

vec3 auroraColor(float x, float y) {
  float bands = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float wave = sin(x * (1.3 + fi * 0.7) + uTime * (0.25 + fi * 0.1) + fi * 2.0) * 0.06
               + sin(x * 3.1 - uTime * 0.4 + fi) * 0.025;
    float centre = 0.64 + fi * 0.07 + wave;
    float width = 0.1 + 0.03 * fi;
    float falloff = (y - centre) / width;
    bands += exp(-falloff * falloff) * (0.55 + 0.45 * sin(x * 6.0 + uTime * 0.8 + fi * 1.7));
  }
  vec3 tint = mix(vec3(0.1, 1.0, 0.6), vec3(0.6, 0.3, 1.0), clamp((y - 0.55) * 2.5, 0.0, 1.0));
  return tint * bands * 0.5;
}

void main() {
  float t = smoothstep(0.0, 1.0, pow(vUv.y, 0.85));
  vec3 col = mix(uHorizon, uTop, t);
  vec2 d = (vUv - uSunPos) * vec2(uAspect, 1.0);
  float r = length(d);
  col += uSun * exp(-r * 4.5) * uSunGlow * 0.55;
  col = mix(col, uSun, smoothstep(uSunSize, uSunSize * 0.9, r));
  if (uAurora > 0.001) col += auroraColor(vUv.x * uAspect, vUv.y) * uAurora;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uPixel;
varying float vTwinkle;
void main() {
  vTwinkle = 0.55 + 0.45 * sin(uTime * (1.2 + aPhase) + aPhase * 40.0);
  gl_PointSize = aSize * uPixel;
  gl_Position = vec4(position.xy, 0.9998, 1.0);
}`;

const STAR_FRAG = /* glsl */ `
precision highp float;
uniform float uOpacity;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vTwinkle * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a);
}`;

const STAR_COUNT = 140;

export class Sky {
  readonly dome: THREE.Mesh;
  readonly stars: THREE.Points;
  private readonly skyUniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() },
    uSunPos: { value: new THREE.Vector2(0.7, 0.5) },
    uSunSize: { value: 0.05 },
    uSunGlow: { value: 0.5 },
    uAspect: { value: 1.6 },
    uTime: { value: 0 },
    uAurora: { value: 0 },
  };
  private readonly starUniforms = {
    uTime: { value: 0 },
    uPixel: { value: 1 },
    uOpacity: { value: 0 },
  };

  constructor(seedRandom: () => number) {
    const material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.skyUniforms,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -100;
    this.stars = this.buildStars(seedRandom);
  }

  resize(aspect: number, pixelRatio: number): void {
    this.skyUniforms.uAspect.value = aspect;
    this.starUniforms.uPixel.value = pixelRatio;
  }

  update(theme: ThemeState, time: number): void {
    const { colors, scalars } = theme;
    this.skyUniforms.uTop.value.copy(colors.skyTop);
    this.skyUniforms.uHorizon.value.copy(colors.skyHorizon);
    this.skyUniforms.uSun.value.copy(colors.sun);
    this.skyUniforms.uSunPos.value.set(scalars.sunX, scalars.sunY);
    this.skyUniforms.uSunSize.value = scalars.sunSize;
    this.skyUniforms.uSunGlow.value = scalars.sunGlow;
    this.skyUniforms.uAurora.value = scalars.aurora;
    this.skyUniforms.uTime.value = time;
    this.starUniforms.uTime.value = time;
    this.starUniforms.uOpacity.value = scalars.stars;
    this.stars.visible = scalars.stars > 0.01;
  }

  private buildStars(random: () => number): THREE.Points {
    const positions = new Float32Array(STAR_COUNT * 3);
    const phases = new Float32Array(STAR_COUNT);
    const sizes = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = random() * 2 - 1;
      positions[i * 3 + 1] = random() * 1.15 - 0.15;
      phases[i] = random();
      sizes[i] = 1.5 + random() * 3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: this.starUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = -99;
    return points;
  }
}
