/**
 * Builds the signed release APK and copies it to downloads/ (git-ignored) with a checksum file.
 *
 *   npm run android:apk        # builds the web app, syncs it into android/, runs Gradle, copies the APK
 *
 * Releases are published by .github/workflows/release.yml when a version tag is pushed; it runs this same script.
 *
 * Needs JDK 21 (JAVA_HOME) and the Android SDK (ANDROID_HOME or android/local.properties), plus
 * android/keystore.properties for signing. An unsigned APK cannot be installed on a phone, so that is an error here.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');
const outputs = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
const downloads = join(root, 'downloads');
const isWindows = process.platform === 'win32';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function runGradle() {
  // Through `sh` on Linux and macOS, because a checkout from Windows may not keep gradlew's executable bit.
  const [command, args] = isWindows ? ['.\\gradlew.bat', ['assembleRelease']] : ['sh', ['./gradlew', 'assembleRelease']];
  const result = spawnSync(command, args, { cwd: androidDir, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) fail(`Gradle failed (exit ${result.status ?? 'none'}).`);
}

function findSignedApk() {
  const signed = join(outputs, 'app-release.apk');
  if (existsSync(signed)) return signed;
  if (existsSync(join(outputs, 'app-release-unsigned.apk'))) {
    fail('Built an UNSIGNED apk. Create android/keystore.properties (see README) and run again.');
  }
  return fail(`No APK found in ${outputs}.`);
}

function publish(apk) {
  mkdirSync(downloads, { recursive: true });
  const target = join(downloads, 'SkyHop.apk');
  copyFileSync(apk, target);
  const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
  writeFileSync(`${target}.sha256`, `${hash} *SkyHop.apk\n`);
  process.stdout.write(`\nPublished ${target}\nSHA-256 ${hash}\n`);
}

runGradle();
publish(findSignedApk());
