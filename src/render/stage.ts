import * as THREE from 'three';
import { WORLD } from '../core/config';
import { clamp } from './spring';

export const FOV = 38;
const TARGET_HEIGHT = 15.8;
const MIN_WIDTH = 12.5;
const CAMERA_Y = 6.7;
const GROUND_MARGIN = 1.7;
const HALF_TAN = Math.tan((FOV * Math.PI) / 360);

export interface Framing {
  distance: number;
  visibleWidth: number;
  visibleHeight: number;
  camX: number;
  camY: number;
}

/**
 * Chooses a camera distance that keeps the whole play column visible on tall phones and wide monitors,
 * and keeps the bird horizontally centred on screen.
 */
export function computeFraming(aspect: number): Framing {
  const safeAspect = clamp(aspect, 0.3, 4);
  const distance = Math.max(TARGET_HEIGHT / 2 / HALF_TAN, MIN_WIDTH / 2 / (HALF_TAN * safeAspect));
  const visibleHeight = 2 * distance * HALF_TAN;
  const visibleWidth = visibleHeight * safeAspect;
  return {
    distance,
    visibleWidth,
    visibleHeight,
    camX: WORLD.birdX,
    camY: Math.max(CAMERA_Y, visibleHeight / 2 - GROUND_MARGIN),
  };
}

export interface StageHandlers {
  onContextLost: () => void;
  onContextRestored: () => void;
}

export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 500);
  readonly renderer: THREE.WebGLRenderer;
  framing: Framing = computeFraming(16 / 9);
  private pixelRatio = 1;

  constructor(
    private readonly container: HTMLElement,
    handlers: StageHandlers,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 1);
    const canvas = this.renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'SkyHop game view');
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      handlers.onContextLost();
    });
    canvas.addEventListener('webglcontextrestored', handlers.onContextRestored);
    container.appendChild(canvas);
    this.resize();
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.framing = computeFraming(this.camera.aspect);
    this.placeCamera(0, 0, 0);
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(
      Math.max(1, this.container.clientWidth),
      Math.max(1, this.container.clientHeight),
      false,
    );
  }

  /** Offsets are small nudges from the home view used for follow-the-bird sway and screen shake. */
  placeCamera(offsetY: number, shakeX: number, shakeY: number): void {
    const { camX, camY, distance } = this.framing;
    this.camera.position.set(camX + shakeX, camY + offsetY + shakeY, distance);
    this.camera.lookAt(camX + shakeX * 0.5, camY - 0.4 + offsetY * 0.6, 0);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
