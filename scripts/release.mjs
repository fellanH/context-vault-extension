#!/usr/bin/env node
/**
 * Extension release script: bump -> verify changelog -> commit -> tag -> push
 *
 * Usage:
 *   npm run release -- patch     # 2.8.0 -> 2.8.1
 *   npm run release -- minor     # 2.8.0 -> 2.9.0
 *   npm run release -- major     # 2.8.0 -> 3.0.0
 *   npm run release -- 2.9.0     # explicit version
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function parseVersion(v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Invalid version: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function bump(current, type) {
  const [major, minor, patch] = parseVersion(current);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default:
      parseVersion(type);
      return type;
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run release -- <patch|minor|major|x.y.z>');
  process.exit(1);
}

const dirty = run('git status --porcelain');
if (dirty) {
  console.error('Working tree is dirty. Commit or stash changes first.\n');
  console.error(dirty);
  process.exit(1);
}

const branch = run('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  console.error(`On branch "${branch}" — releases should be from main.`);
  process.exit(1);
}

const pkgPath = resolve(root, 'package.json');
const manifestPath = resolve(root, 'manifest.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const newVersion = bump(oldVersion, arg);

console.log(`\n  ${oldVersion} → ${newVersion}\n`);

pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('  bumped package.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = newVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('  bumped manifest.json');

// Verify CHANGELOG
let changelogExists = false;
try {
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  changelogExists = changelog.includes(`## [${newVersion}]`);
} catch {
  // No CHANGELOG yet
}

if (!changelogExists) {
  console.error(`\n  CHANGELOG.md has no entry for [${newVersion}].`);
  console.error(`  Add a "## [${newVersion}]" section before releasing.\n`);
  run('git checkout -- package.json manifest.json');
  console.error('  Reverted version bumps.');
  process.exit(1);
}

run('git add package.json manifest.json');
run(`git commit -m "v${newVersion}"`);
run(`git tag v${newVersion}`);

console.log(`\n  committed and tagged v${newVersion}`);
console.log('  pushing to origin...\n');

run('git push origin main --tags');

console.log('  done — publish-extension workflow will publish to Chrome Web Store.\n');
