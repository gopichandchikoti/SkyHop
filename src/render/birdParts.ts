import * as THREE from 'three';
import { SKIN_PALETTES } from './themeData';
import type { SkinId } from '../core/skins';

const OUTLINE_COLOR = 0x1b1f3b;
const OUTLINE_SCALE = 1.075;

export interface BirdMaterials {
  body: THREE.MeshStandardMaterial;
  belly: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  beak: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  ink: THREE.MeshBasicMaterial;
  cheek: THREE.MeshBasicMaterial;
  outline: THREE.MeshBasicMaterial;
}

export interface BirdParts {
  rig: THREE.Group;
  wings: THREE.Group[];
  eyes: THREE.Group[];
  tail: THREE.Group;
  crest: THREE.Group;
  materials: BirdMaterials;
}

function solid(color: number, roughness = 0.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, emissive: color, emissiveIntensity: 0.1 });
}

export function createMaterials(): BirdMaterials {
  const palette = SKIN_PALETTES.coral;
  return {
    body: solid(palette.body),
    belly: solid(palette.belly, 0.6),
    wing: solid(palette.wing),
    accent: solid(palette.accent),
    beak: solid(palette.beak, 0.4),
    white: solid(0xffffff, 0.25),
    ink: new THREE.MeshBasicMaterial({ color: 0x14172b }),
    cheek: new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.8 }),
    outline: new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide, fog: false }),
  };
}

export function applySkin(materials: BirdMaterials, skin: SkinId): void {
  const palette = SKIN_PALETTES[skin];
  const pairs: Array<[THREE.MeshStandardMaterial, number]> = [
    [materials.body, palette.body], [materials.belly, palette.belly], [materials.wing, palette.wing],
    [materials.accent, palette.accent], [materials.beak, palette.beak],
  ];
  for (const [material, color] of pairs) {
    material.color.set(color);
    material.emissive.set(color);
  }
}

function blob(radius: number, scale: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), material);
  mesh.scale.set(...scale);
  return mesh;
}

function outlined(mesh: THREE.Mesh, outline: THREE.Material, scale = OUTLINE_SCALE): THREE.Mesh {
  const hull = new THREE.Mesh(mesh.geometry, outline);
  hull.scale.setScalar(scale);
  mesh.add(hull);
  return mesh;
}

function buildEye(side: number, m: BirdMaterials): THREE.Group {
  const eye = new THREE.Group();
  eye.position.set(0.22, 0.14, side * 0.3);
  const sclera = blob(0.155, [1, 1.08, 0.7], m.white);
  const pupil = blob(0.088, [0.8, 1, 0.5], m.ink);
  pupil.position.set(0.055, -0.005, side * 0.075);
  const glint = blob(0.032, [1, 1, 0.6], m.white);
  glint.position.set(0.085, 0.045, side * 0.105);
  eye.add(sclera, pupil, glint);
  return eye;
}

function buildBeak(m: BirdMaterials): THREE.Group {
  const beak = new THREE.Group();
  beak.position.set(0.52, -0.05, 0);
  const upperGeometry = new THREE.ConeGeometry(0.16, 0.4, 20).rotateZ(-Math.PI / 2);
  const upper = new THREE.Mesh(upperGeometry, m.beak);
  upper.scale.set(1, 0.85, 0.85);
  const lower = new THREE.Mesh(upperGeometry, m.beak);
  lower.scale.set(0.7, 0.5, 0.6);
  lower.position.set(-0.03, -0.065, 0);
  beak.add(outlined(upper, m.outline, 1.1), lower);
  return beak;
}

function buildWing(side: number, m: BirdMaterials): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(-0.02, -0.02, side * 0.37);
  const feather = outlined(blob(0.3, [1.1, 0.46, 0.62], m.wing), m.outline, 1.09);
  feather.position.set(-0.27, 0, side * 0.02);
  const tip = blob(0.13, [1.1, 0.5, 0.6], m.accent);
  tip.position.set(-0.56, -0.025, side * 0.02);
  pivot.add(feather, tip);
  return pivot;
}

function buildTail(m: BirdMaterials): THREE.Group {
  const tail = new THREE.Group();
  tail.position.set(-0.42, 0.04, 0);
  [0.5, 0, -0.5].forEach((angle, i) => {
    const pivot = new THREE.Group();
    pivot.rotation.z = angle;
    const feather = outlined(blob(0.2, [1.2, 0.3, 0.5], i === 1 ? m.accent : m.wing), m.outline, 1.1);
    feather.position.set(-0.17, 0, 0);
    pivot.add(feather);
    tail.add(pivot);
  });
  return tail;
}

function buildCrest(m: BirdMaterials): THREE.Group {
  const crest = new THREE.Group();
  crest.position.set(0.06, 0.4, 0);
  [0.65, 0.35, 0.1].forEach((lean, i) => {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28 - i * 0.03, 12), m.accent);
    tuft.position.set(0.1 - i * 0.1, 0.05 - i * 0.015, 0);
    tuft.rotation.z = lean;
    crest.add(outlined(tuft, m.outline, 1.2));
  });
  return crest;
}

export function buildBird(materials: BirdMaterials): BirdParts {
  const rig = new THREE.Group();
  const body = outlined(blob(0.42, [1.1, 1, 0.98], materials.body), materials.outline);
  const belly = blob(0.36, [1, 0.9, 0.9], materials.belly);
  belly.position.set(0.1, -0.1, 0.08);
  const eyes = [buildEye(1, materials), buildEye(-1, materials)];
  const wings = [buildWing(1, materials), buildWing(-1, materials)];
  const tail = buildTail(materials);
  const crest = buildCrest(materials);
  const cheeks = [1, -1].map((side) => {
    const cheek = blob(0.075, [1, 0.7, 0.3], materials.cheek);
    cheek.position.set(0.3, -0.04, side * 0.33);
    return cheek;
  });
  rig.add(body, belly, buildBeak(materials), tail, crest, ...eyes, ...wings, ...cheeks);
  return { rig, wings, eyes, tail, crest, materials };
}
