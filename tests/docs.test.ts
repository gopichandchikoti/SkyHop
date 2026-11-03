/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/core/levels';

/** The documentation makes promises about the code. These tests read the real files so the docs cannot quietly rot. */
const root = join(__dirname, '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const readme = read('README.md');
const architecture = read('ARCHITECTURE.md');

/** Backticked repository paths such as `src/core/levels.ts`. Only committed locations are checked. */
function mentionedPaths(markdown: string): string[] {
  const found = new Set<string>();
  for (const match of markdown.matchAll(/`((?:src|tests|scripts|android|docs|\.github)\/[\w./-]+)`/g)) {
    const path = match[1] as string;
    if (!path.includes('*') && !path.endsWith('...')) found.add(path.replace(/[.,]$/, ''));
  }
  return [...found];
}

describe('README', () => {
  it('shows the level table that the code generates', () => {
    const cells = ['(\\d+)', '([^|]+)', '(\\w+)', '(\\d+)', '([\\d.]+)', '([\\d.]+)', '([\\d.]+)'];
    const rows = Array.from(readme.matchAll(new RegExp(`^\\| ${cells.join(' \\| ')} \\|`, 'gm')));
    expect(rows).toHaveLength(LEVELS.length);
    rows.forEach((row, index) => {
      const level = LEVELS[index];
      expect(level).toBeDefined();
      expect(Number(row[1])).toBe(level?.id);
      expect((row[2] as string).trim()).toBe(level?.name);
      expect(row[3]).toBe(level?.theme);
      expect(Number(row[4])).toBe(level?.goal);
      expect(row[5]).toBe(level?.speed.toFixed(2));
      expect(row[6]).toBe(level?.gap.toFixed(2));
      expect(row[7]).toBe(level?.interval.toFixed(2));
    });
  });

  it('only links to files that exist, and its images are committed', () => {
    const links = Array.from(readme.matchAll(/\]\((?!https?:|#|mailto:)([^)\s?#]+)/g), (m) => m[1] as string);
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect(existsSync(join(root, link)), `README links to missing ${link}`).toBe(true);
    const images = Array.from(readme.matchAll(/src="([^"]+)"/g), (m) => m[1] as string);
    for (const image of images) expect(existsSync(join(root, image)), `README shows missing ${image}`).toBe(true);
  });

  it('points to the architecture document', () => {
    expect(readme).toContain('(ARCHITECTURE.md)');
  });
});

describe('ARCHITECTURE.md', () => {
  it('mentions only repository paths that exist', () => {
    const paths = mentionedPaths(architecture);
    expect(paths.length).toBeGreaterThan(40);
    for (const path of paths) expect(existsSync(join(root, path)), `ARCHITECTURE.md mentions missing ${path}`).toBe(true);
  });

  it('shows only images that exist', () => {
    const images = Array.from(architecture.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g), (m) => m[1] as string);
    expect(images.length).toBeGreaterThan(8);
    for (const image of images) expect(existsSync(join(root, image)), `ARCHITECTURE.md shows missing ${image}`).toBe(true);
  });

  it('has balanced, non-empty Mermaid diagrams of the expected kinds', () => {
    const fences = architecture.match(/^```/gm) ?? [];
    expect(fences.length % 2).toBe(0);
    const blocks = Array.from(architecture.matchAll(/```mermaid\n([\s\S]*?)\n```/g), (m) => m[1] as string);
    expect(blocks.length).toBeGreaterThanOrEqual(12);
    const kinds = blocks.map((block) => block.trim().split(/\s/)[0]);
    for (const kind of ['flowchart', 'sequenceDiagram', 'stateDiagram-v2', 'classDiagram']) expect(kinds).toContain(kind);
    for (const block of blocks) expect(block.trim().length).toBeGreaterThan(40);
  });

  it('describes every phase of the state machine', () => {
    const phaseType = /export type Phase =([\s\S]*?);/.exec(read('src/core/phase.ts'))?.[1] ?? '';
    const phases = Array.from(phaseType.matchAll(/'(\w+)'/g), (m) => m[1] as string);
    expect(phases.length).toBe(8);
    for (const phase of phases) expect(architecture, `phase ${phase} missing from the diagram`).toContain(phase);
  });

  it('quotes the physics constants that live in config.ts', () => {
    const config = read('src/core/config.ts');
    const numbers: Record<string, string> = { gravity: '32', flapVelocity: '9.2', maxFallSpeed: '17', settleDelay: '0.7', hitRadius: '0.36' };
    for (const [name, value] of Object.entries(numbers)) {
      expect(config, `${name} changed in config.ts`).toMatch(new RegExp(`${name}: ${value.replace('.', '\\.')},`));
      expect(architecture).toContain(value);
    }
  });

  it('keeps the six sky themes and four birds it describes', () => {
    for (const theme of ['meadow', 'noon', 'golden hour', 'dusk', 'night', 'aurora']) expect(architecture.toLowerCase()).toContain(theme);
    for (const bird of ['Coral', 'Azure', 'Mint', 'Sunrise Gold']) expect(architecture).toContain(bird);
  });
});
