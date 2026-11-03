import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { worldYForApparent } from './clouds';
import type { ThemeState } from './palette';
import { wrap } from './spring';

const HILL_WIDTH = 760;
const GROUND_WIDTH = 520;
const GROUND_DEPTH = 12;
const GROUND_TILE = 9;
const BUSH_PERIOD = 96;

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function shadeTexture(): THREE.CanvasTexture {
  return canvasTexture(4, 64, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#b9b9c4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 64);
  });
}

function groundTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#e1e8dc';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64 + 32, 0);
      ctx.lineTo(i * 64 + 64, 0);
      ctx.lineTo(i * 64 + 32, 128);
      ctx.lineTo(i * 64, 128);
      ctx.closePath();
      ctx.fill();
    }
    const edge = ctx.createLinearGradient(0, 0, 0, 128);
    edge.addColorStop(0, 'rgba(0,0,0,0.16)');
    edge.addColorStop(0.18, 'rgba(0,0,0,0)');
    edge.addColorStop(0.85, 'rgba(255,255,255,0)');
    edge.addColorStop(1, 'rgba(255,255,255,0.14)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 256, 128);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(GROUND_WIDTH / GROUND_TILE, 1);
  return texture;
}

interface HillSpec {
  depth: number;
  period: number;
  base: number;
  amplitude: number;
  tint: 'hillFar' | 'hillMid' | 'hillNear';
}

const HILLS: HillSpec[] = [
  { depth: -120, period: 320, base: 6.3, amplitude: 1.7, tint: 'hillFar' },
  { depth: -72, period: 240, base: 4.2, amplitude: 1.6, tint: 'hillMid' },
  { depth: -40, period: 168, base: 2.5, amplitude: 1.05, tint: 'hillNear' },
];

function ridgeGeometry(spec: HillSpec, rng: Rng): THREE.BufferGeometry {
  const segments = Math.round(HILL_WIDTH / 4);
  const phases: [number, number, number] = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const bottom = worldYForApparent(-6, spec.depth);
  for (let i = 0; i <= segments; i++) {
    const x = -HILL_WIDTH / 2 + (i / segments) * HILL_WIDTH;
    const turn = (x / spec.period) * Math.PI * 2;
    const wave = 0.55 * Math.sin(turn + phases[0]) + 0.3 * Math.sin(turn * 2 + phases[1])
      + 0.15 * Math.sin(turn * 5 + phases[2]);
    const top = worldYForApparent(spec.base + spec.amplitude * wave, spec.depth);
    positions.push(x, top, 0, x, bottom, 0);
    uvs.push(i / segments, 1, i / segments, 0);
    if (i < segments) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export class Terrain {
  readonly group = new THREE.Group();
  private readonly hills: Array<{ mesh: THREE.Mesh; spec: HillSpec; material: THREE.MeshBasicMaterial }> = [];
  private readonly groundMaterial: THREE.MeshLambertMaterial;
  private readonly groundTop: THREE.Mesh;
  private readonly groundBlock: THREE.Mesh;
  private readonly dirtMaterial = new THREE.MeshLambertMaterial({ color: 0xd8b27a, map: shadeTexture() });
  private readonly texture = groundTexture();
  private readonly bushes: THREE.InstancedMesh;
  private readonly bushMaterial = new THREE.MeshLambertMaterial({ flatShading: true });

  constructor(rng: Rng) {
    const shade = shadeTexture();
    for (const spec of HILLS) {
      const material = new THREE.MeshBasicMaterial({ map: shade });
      const mesh = new THREE.Mesh(ridgeGeometry(spec, rng), material);
      mesh.position.z = spec.depth;
      mesh.renderOrder = -50 + Math.round(spec.depth / -10);
      this.group.add(mesh);
      this.hills.push({ mesh, spec, material });
    }
    this.groundMaterial = new THREE.MeshLambertMaterial({ map: this.texture });
    this.groundTop = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_WIDTH, GROUND_DEPTH), this.groundMaterial);
    this.groundTop.rotation.x = -Math.PI / 2;
    this.groundBlock = new THREE.Mesh(new THREE.BoxGeometry(GROUND_WIDTH, 10, GROUND_DEPTH), this.dirtMaterial);
    this.groundBlock.position.y = -5.02;
    this.bushes = this.buildBushes(rng);
    this.group.add(this.groundTop, this.groundBlock, this.bushes);
  }

  update(theme: ThemeState, camX: number, scroll: number): void {
    for (const { mesh, spec, material } of this.hills) {
      material.color.copy(theme.colors[spec.tint]);
      mesh.position.x = camX - wrap(scroll, spec.period);
    }
    this.groundMaterial.color.copy(theme.colors.grassA);
    this.dirtMaterial.color.copy(theme.colors.dirt);
    this.groundTop.position.x = camX;
    this.groundBlock.position.x = camX;
    this.texture.offset.x = (camX + scroll) / GROUND_TILE;
    this.bushMaterial.color.copy(theme.colors.grassB).multiplyScalar(0.8);
    this.bushes.position.x = camX - wrap(scroll, BUSH_PERIOD);
  }

  private buildBushes(rng: Rng): THREE.InstancedMesh {
    const perPeriod = 22;
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.bushMaterial, perPeriod * 3);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const layout = Array.from({ length: perPeriod }, () => ({
      x: rng.next() * BUSH_PERIOD,
      z: -2.4 - rng.next() * 3.2,
      size: 0.45 + rng.next() * 0.75,
      tone: 0.8 + rng.next() * 0.45,
    }));
    for (let repeat = 0; repeat < 3; repeat++) {
      layout.forEach((bush, i) => {
        const index = repeat * perPeriod + i;
        matrix.makeScale(bush.size * 1.25, bush.size * 0.85, bush.size);
        matrix.setPosition((repeat - 1) * BUSH_PERIOD + bush.x - BUSH_PERIOD / 2, bush.size * 0.55, bush.z);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, color.setScalar(bush.tone));
      });
    }
    mesh.frustumCulled = false;
    return mesh;
  }
}
