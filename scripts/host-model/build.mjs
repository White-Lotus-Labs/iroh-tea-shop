#!/usr/bin/env node
// Builds the tea room host model from a Tripo GLB.
//
//   node scripts/host-model/build.mjs <tripo.glb> [debugDir]
//
// Runs prepare.py in Blender, then writes meshopt + WebP copies with 2048 and
// 1024 textures to public/models/iroh-host[-1k].<hash>.glb and prints the
// names to paste into src/scene/IrohModel.tsx. Needs `blender` on PATH.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [src, debug] = process.argv.slice(2);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const rigged = join(tmpdir(), 'iroh-host-rigged.glb');
run('blender', [
  '-b',
  '--factory-startup',
  '-P',
  'scripts/host-model/prepare.py',
  '--',
  src,
  rigged,
  ...(debug ? [debug] : []),
]);

for (const old of readdirSync('public/models'))
  if (old.startsWith('iroh-host')) rmSync(join('public/models', old));
for (const [suffix, size] of [
  ['', 2048],
  ['-1k', 1024],
]) {
  const tmp = join(tmpdir(), `iroh-host${suffix}.glb`);
  // Keep the skin, the separate hair mesh and the custom _MASK attribute.
  run('npx', [
    '--yes',
    '@gltf-transform/cli@4',
    'optimize',
    rigged,
    tmp,
    '--compress',
    'meshopt',
    '--texture-compress',
    'webp',
    '--texture-size',
    String(size),
    '--simplify',
    'false',
    '--join',
    'false',
    '--flatten',
    'false',
    '--instance',
    'false',
    '--palette',
    'false',
    '--prune-attributes',
    'false',
  ]);
  const hash = createHash('sha256')
    .update(readFileSync(tmp))
    .digest('hex')
    .slice(0, 6);
  const name = `iroh-host${suffix}.${hash}.glb`;
  renameSync(tmp, join('public/models', name));
  console.log(`public/models/${name}`);
}
