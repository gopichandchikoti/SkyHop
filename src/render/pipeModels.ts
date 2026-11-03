import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../core/config';
import { gapCenter, type Pipe } from '../core/pipes';
import type { ThemeState } from './palette';

const BODY_RADIUS = WORLD.pipeWidth / 2;
const CAP_RADIUS = WORLD.capWidth / 2;
const BOTTOM_Y = -6;
const TOP_Y = 40;
const SEGMENTS = 40;
const MOVING_COLOR = new THREE.Color(0xffa63d);

/** Horizontal brightness ramp with a sheen stripe, wrapped around the cylinder as a stylised highlight. */
function sheenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256;
      const shade = 0.8 + 0.12 * Math.cos((u - 0.96) * Math.PI * 2);
      const stripe = Math.max(0, 1 - Math.abs(u - 0.915) / 0.022);
      const value = Math.min(1, shade + stripe * 0.3);
      ctx.fillStyle = `rgb(${Math.round(value * 255)},${Math.round(value * 255)},${Math.round(value * 255)})`;
      ctx.fillRect(x, 0, 1, 4);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function capGeometry(): THREE.BufferGeometry {
  const half = WORLD.capHeight / 2;
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(CAP_RADIUS, CAP_RADIUS, WORLD.capHeight, SEGMENTS)];
  for (const y of [half, -half]) {
    const lip = new THREE.TorusGeometry(CAP_RADIUS, 0.075, 10, SEGMENTS).rotateX(Math.PI / 2).translate(0, y, 0);
    parts.push(lip);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return merged;
}

const REVEAL_SECONDS = 0.55;
const easeOutBack = (t: number): number => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** 0 while hidden, 1 when fully grown. Pipes further right rise a beat later for a rolling entrance. */
function growFor(pipe: Pipe, revealAge: number): number {
  const delay = Math.max(0, pipe.x - 6) * 0.03;
  const t = Math.min(1, Math.max(0, (revealAge - delay) / REVEAL_SECONDS));
  return t <= 0 ? 0 : easeOutBack(t);
}

/** Per-frame values that place the pipes: render-time shift, sliding look-ahead, clock and entrance age. */
export interface PipeFrame {
  shiftX: number;
  lookAhead: number;
  time: number;
  revealAge: number;
}

interface PipeView {
  group: THREE.Group;
  bottomBody: THREE.Mesh;
  bottomCap: THREE.Mesh;
  topBody: THREE.Mesh;
  topCap: THREE.Mesh;
}

export class PipeLayer {
  readonly group = new THREE.Group();
  private readonly views: PipeView[] = [];
  private readonly bodyGeometry = new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, 1, SEGMENTS, 1, true);
  private readonly capGeometry = capGeometry();
  private readonly map = sheenTexture();
  private readonly still = this.makeMaterial();
  private readonly sliding = this.makeMaterial();

  /** Places every pipe for this frame. `lookAhead` projects sliding gaps to the interpolated render time. */
  sync(pipes: readonly Pipe[], frame: PipeFrame, theme: ThemeState): void {
    const { time, revealAge } = frame;
    this.still.color.copy(theme.colors.pipe);
    this.sliding.color.copy(theme.colors.pipe).lerp(MOVING_COLOR, 0.6);
    this.sliding.emissive.copy(MOVING_COLOR).multiplyScalar(0.18 + 0.12 * Math.sin(time * 5));
    while (this.views.length < pipes.length) this.views.push(this.createView());
    this.views.forEach((view, index) => {
      const pipe = pipes[index];
      const grow = pipe ? growFor(pipe, revealAge) : 0;
      view.group.visible = pipe !== undefined && grow > 0.02;
      if (pipe && view.group.visible) this.place(view, pipe, frame, grow);
    });
  }

  private place(view: PipeView, pipe: Pipe, frame: PipeFrame, grow: number): void {
    const centre = gapCenter(pipe, frame.lookAhead);
    const material = pipe.amplitude > 0 ? this.sliding : this.still;
    const bottomEdge = BOTTOM_Y + (centre - pipe.gap / 2 - BOTTOM_Y) * grow;
    const topEdge = TOP_Y - (TOP_Y - (centre + pipe.gap / 2)) * grow;
    const bottomBodyHeight = bottomEdge - WORLD.capHeight - BOTTOM_Y;
    const topBodyHeight = TOP_Y - topEdge - WORLD.capHeight;
    view.group.position.x = pipe.x - frame.shiftX;
    this.shape(view.bottomBody, material, BOTTOM_Y + bottomBodyHeight / 2, bottomBodyHeight);
    this.shape(view.bottomCap, material, bottomEdge - WORLD.capHeight / 2);
    this.shape(view.topBody, material, topEdge + WORLD.capHeight + topBodyHeight / 2, topBodyHeight);
    this.shape(view.topCap, material, topEdge + WORLD.capHeight / 2);
  }

  private shape(mesh: THREE.Mesh, material: THREE.Material, y: number, height?: number): void {
    mesh.material = material;
    mesh.position.y = y;
    if (height !== undefined) mesh.scale.y = Math.max(0.001, height);
  }

  private createView(): PipeView {
    const group = new THREE.Group();
    const part = (geometry: THREE.BufferGeometry) => {
      const mesh = new THREE.Mesh(geometry, this.still);
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };
    const view = {
      group,
      bottomBody: part(this.bodyGeometry),
      bottomCap: part(this.capGeometry),
      topBody: part(this.bodyGeometry),
      topCap: part(this.capGeometry),
    };
    this.group.add(group);
    return view;
  }

  private makeMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ map: this.map, roughness: 0.42, metalness: 0.04 });
  }
}
