// Builds dist/: a copy of the shipped files with the git commit and UTC
// build time stamped into version.js. Deploy the contents of dist/.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIPPED_FILES } from '../shipped-files.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

let dirty = true;
let commit = 'uncommitted';
try {
  dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  commit = git('rev-parse', '--short', 'HEAD') + (dirty ? '-dirty' : '');
} catch { /* No commits yet. */ }
const builtAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

rmSync(dist, { recursive: true, force: true });
for (const file of SHIPPED_FILES) {
  if (file === 'version.js') continue;
  mkdirSync(dirname(join(dist, file)), { recursive: true });
  cpSync(join(root, file), join(dist, file));
}
writeFileSync(join(dist, 'version.js'), `export const BUILD = ${JSON.stringify({ commit, builtAt })};\n`);

console.log(`dist/ ready: ${commit} built ${builtAt}`);
if (dirty) console.warn('Warning: uncommitted changes are included; commit before deploying.');
