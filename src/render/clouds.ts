import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../core/rng';
import type { ThemeState } from './palette';
import type { EnvFrame } from './envFrame';
import { FOV } from './stage';
import { wrap } from './spring';

const REFERENCE_DISTANCE = 25;
const REFERENCE_CAM_Y = 6.8;
const HALF_TAN = Math.tan((FOV * Math.PI) / 360);
const CLOUD_COUNT = 13;
const DRIFT = 0.35;

/** World height that appears at `apparentY` on the z = 0 plane when the object sits `depth` units behind it. */
export function worldYForApparent(apparentY: number, depth: number): number {
  const k = REFERENCE_DISTANCE / (REFERENCE_DISTANCE + Math.abs(depth));
  return REFERENCE_CAM_Y + (apparentY - REFERENCE_CAM_Y) / k;
}

function puffGeometry(): THREE.BufferGeometry {
  const blobs: Array<[number, number, number, number]> = [
    [0, 0, 0, 1], [1.1, -0.15, 0.1, 0.8], [-1.15, -0.2, -0.1, 0.78], [0.45, 0.45, 0.1, 0.75], [-0.5, 0.3, 0, 0.7],
  ];
  const parts = blobs.map(([x, y, z, r]) => {
    const sphere = new THREE.SphereGeometry(r, 14, 10);
    sphere.translate(x, y, z);
    return sphere;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  merged.scale(1, 0.72, 0.8);
  return merged;
}

interface CloudItem {
  mesh: THREE.Mesh;
  base: number;
  depth: number;
  drift: number;
}

export class Clouds {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  private readonly items: CloudItem[] = [];

  constructor(rng: Rng) {
    const geometry = puffGeometry();
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const depth = -(14 + rng.next() * 70);
      const k = REFERENCE_DISTANCE / (REFERENCE_DISTANCE - depth);
      const apparentWidth = 2.2 + rng.next() * 3.2;
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.scale.setScalar(apparentWidth / 3.4 / k);
      mesh.position.set(0, worldYForApparent(8.6 + rng.next() * 7, depth), depth);
      this.group.add(mesh);
      this.items.push({ mesh, base: rng.next() * 400, depth, drift: 0.6 + rng.next() * 0.8 });
    }
  }

  update(theme: ThemeState, frame: EnvFrame): void {
    const { framing, aspect, scroll, time } = frame;
    this.material.color.copy(theme.colors.cloud);
    this.material.emissive.copy(theme.colors.cloud).multiplyScalar(0.72);
    for (const item of this.items) {
      const visible = (framing.distance - item.depth) * 2 * HALF_TAN * aspect;
      const span = visible + 30;
      const travelled = scroll + time * DRIFT * item.drift;
      item.mesh.position.x = framing.camX + wrap(item.base - travelled + span / 2, span) - span / 2;
    }
  }
}
