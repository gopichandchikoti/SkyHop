import * as THREE from 'three';

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  gravity: number;
  drag: number;
}

export interface Emit {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  life: number;
  size: number;
  color: number;
  gravity?: number;
  drag?: number;
}

const CAPACITY = 360;

/** One draw call for every puff, feather and confetti piece. Particles shrink to nothing as they expire. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly pool: Particle[] = Array.from({ length: CAPACITY }, () => ({
    alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 1, gravity: 0, drag: 0,
  }));
  private readonly matrix = new THREE.Matrix4();
  private readonly colour = new THREE.Color();
  private cursor = 0;

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      CAPACITY,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.matrix.makeScale(0, 0, 0);
    for (let i = 0; i < CAPACITY; i++) {
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.colour.set(0xffffff));
    }
  }

  emit(options: Emit): void {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % CAPACITY;
    const particle = this.pool[index];
    if (!particle) return;
    Object.assign(particle, {
      alive: true, x: options.x, y: options.y, z: options.z ?? 0.4, vx: options.vx, vy: options.vy,
      vz: options.vz ?? 0, age: 0, life: options.life, size: options.size, gravity: options.gravity ?? 0,
      drag: options.drag ?? 0,
    });
    this.mesh.setColorAt(index, this.colour.set(options.color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    this.pool.forEach((particle, index) => {
      if (!particle.alive) return;
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.alive = false;
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(index, this.matrix);
        return;
      }
      const damp = Math.exp(-particle.drag * dt);
      particle.vx *= damp;
      particle.vy = particle.vy * damp - particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      const remaining = 1 - particle.age / particle.life;
      const scale = particle.size * Math.min(1, remaining * 2.2);
      this.matrix.makeScale(scale, scale, scale);
      this.matrix.setPosition(particle.x, particle.y, particle.z);
      this.mesh.setMatrixAt(index, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.pool.forEach((particle) => {
      particle.alive = false;
    });
    this.matrix.makeScale(0, 0, 0);
    for (let i = 0; i < CAPACITY; i++) this.mesh.setMatrixAt(i, this.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Expanding glow rings that mark a scored pipe. */
export class Rings {
  readonly group = new THREE.Group();
  private readonly rings: Array<{ mesh: THREE.Mesh; age: number; life: number }> = [];

  constructor(count = 6) {
    const geometry = new THREE.RingGeometry(0.86, 1, 56);
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, fog: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 9;
      this.group.add(mesh);
      this.rings.push({ mesh, age: 0, life: 0 });
    }
  }

  pulse(x: number, y: number, color: number, size: number): void {
    const ring = this.rings.find((item) => !item.mesh.visible) ?? this.rings[0];
    if (!ring) return;
    ring.age = 0;
    ring.life = 0.55;
    ring.mesh.visible = true;
    ring.mesh.position.set(x, y, 0.5);
    ring.mesh.scale.setScalar(size * 0.3);
    (ring.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    ring.mesh.userData['size'] = size;
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.mesh.visible = false;
        continue;
      }
      const size = Number(ring.mesh.userData['size'] ?? 1);
      ring.mesh.scale.setScalar(size * (0.3 + 0.7 * (1 - (1 - t) ** 3)));
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    }
  }
}
