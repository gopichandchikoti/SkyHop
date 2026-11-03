/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Android build, the release workflow, the README and the ignore rules must keep agreeing with each other. These
 * tests read the real files, so a rename or a half-finished edit fails here instead of on the first release.
 */
const root = join(__dirname, '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const exists = (path: string): boolean => existsSync(join(root, path));

const pkg = JSON.parse(read('package.json')) as { version: string; scripts: Record<string, string> };
const gradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const workflow = read('.github/workflows/release.yml');
const readme = read('README.md');
const gitignore = read('.gitignore');
const nativeIgnore = read('android/.gitignore');

describe('app identity', () => {
  it('uses one package name everywhere', () => {
    const appId = /appId: '([^']+)'/.exec(read('capacitor.config.ts'))?.[1];
    expect(appId).toBe('com.portfolio.skyhop');
    expect(gradle).toContain(`applicationId "${appId}"`);
    expect(gradle).toContain(`namespace = "${appId}"`);
    expect(read('android/app/src/main/res/values/strings.xml')).toContain(`<string name="package_name">${appId}</string>`);
    expect(exists('android/app/src/main/java/com/portfolio/skyhop/MainActivity.java')).toBe(true);
  });

  it('has a semantic version, because release tags must look like v1.2.3', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('derives the Android version from package.json with the documented formula', () => {
    expect(gradle).toContain("parse(file('../../package.json')).version");
    const expression = /versionCode (versionParts\[0\][^\n]+)/.exec(gradle)?.[1];
    expect(expression).toBeDefined();
    const versionCode = (parts: number[]): number => new Function('versionParts', `return ${expression}`)(parts) as number;
    expect(versionCode([2, 0, 0])).toBe(20000);
    expect(versionCode([2, 3, 4])).toBe(20304);
    expect(versionCode([2, 0, 1])).toBeGreaterThan(versionCode([2, 0, 0]));
    expect(versionCode([2, 1, 0])).toBeGreaterThan(versionCode([2, 0, 99]));
    expect(versionCode([3, 0, 0])).toBeGreaterThan(versionCode([2, 99, 99]));
  });

  it('keeps the web view background in step with the page theme colour', () => {
    const background = /backgroundColor: '([^']+)'/.exec(read('capacitor.config.ts'))?.[1];
    expect(read('index.html')).toContain(`<meta name="theme-color" content="${background}"`);
  });

  it('builds the web app where Capacitor looks for it', () => {
    expect(read('capacitor.config.ts')).toContain("webDir: 'dist'");
    expect(read('vite.config.ts')).not.toMatch(/outDir/);
  });
});

describe('privacy promises in the README', () => {
  it('requests no network permission, so "works offline, no network access" stays true', () => {
    expect(manifest).not.toMatch(/android\.permission\.INTERNET/);
    expect(readme).toMatch(/no ads, account or network access/);
  });
});

describe('release workflow', () => {
  it('runs on version tags only and may publish releases', () => {
    expect(workflow).toMatch(/on:\s+push:\s+tags:\s+- 'v\*'/);
    expect(workflow).toMatch(/permissions:\s+contents: write/);
  });

  it('publishes the same file names the README links to and the build script writes', () => {
    expect(workflow).toContain('downloads/SkyHop.apk downloads/SkyHop.apk.sha256');
    expect(read('scripts/build-apk.mjs')).toContain("join(downloads, 'SkyHop.apk')");
    expect(readme).toMatch(/\/releases\/latest\/download\/SkyHop\.apk\)/);
  });

  it('points the README at one repository everywhere', () => {
    const repos = new Set(Array.from(readme.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)\/releases/g), (m) => m[1]));
    expect(repos.size).toBe(1);
  });

  it('pins the signing certificate, and the README publishes the same fingerprint', () => {
    const pinned = /EXPECTED_CERT_SHA256: ([0-9a-f]{64})\b/.exec(workflow)?.[1];
    expect(pinned).toBeDefined();
    const published = /`((?:[0-9A-F]{2}:){31}[0-9A-F]{2})`/.exec(readme)?.[1];
    expect(published?.replace(/:/g, '').toLowerCase()).toBe(pinned);
  });

  it('uses exactly the secrets the README tells the owner to create', () => {
    const used = new Set(Array.from(workflow.matchAll(/secrets\.(ANDROID_[A-Z0-9_]+)/g), (m) => m[1]));
    expect([...used].sort()).toEqual(
      ['ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD', 'ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD'].sort(),
    );
    for (const name of used) expect(readme).toContain(`\`${name}\``);
  });

  it('checks the tag against package.json and verifies the signature before publishing', () => {
    expect(workflow).toContain("require('./package.json').version");
    expect(workflow.indexOf('apksigner')).toBeGreaterThan(-1);
    expect(workflow.indexOf('Verify the signature')).toBeLessThan(workflow.indexOf('gh release create'));
  });

  it('runs the quality gates before building', () => {
    for (const command of ['npm run typecheck', 'npm run lint', 'npm run test:coverage']) {
      expect(workflow.indexOf(command)).toBeGreaterThan(-1);
      expect(workflow.indexOf(command)).toBeLessThan(workflow.indexOf('npm run android:apk'));
    }
  });
});

describe('secrets and build output stay out of git', () => {
  it.each(['*.jks', '*.keystore', 'android/keystore.properties', 'android/local.properties', 'downloads/', 'node_modules/', 'dist/'])(
    'ignores %s',
    (pattern) => {
      expect(gitignore.split(/\r?\n/)).toContain(pattern);
    },
  );

  it('ignores the keystore and its properties inside android/ too', () => {
    expect(nativeIgnore).toMatch(/^keystore\.properties$/m);
    expect(nativeIgnore).toMatch(/^\*\.jks$/m);
  });

  it('never reads signing secrets from a tracked file', () => {
    expect(gradle).toContain("rootProject.file('keystore.properties')");
    expect(gradle).not.toMatch(/storePassword\s+["'][^"']+["']/);
  });
});

describe('npm scripts the README documents', () => {
  it.each(['android:icons', 'android:sync', 'android:apk', 'docs:banner', 'test:e2e', 'test:coverage'])('has %s', (script) => {
    expect(pkg.scripts[script]).toBeDefined();
  });
});
