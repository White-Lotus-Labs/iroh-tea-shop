#!/usr/bin/env node
// Production perf budget: next start + headless Chromium (Metal GPU).
//
//   node scripts/perf-audit.mjs [--port=3112] [--base=http://127.0.0.1:3112]
//
// Expects `npm run build` already. Starts `next start` itself unless
// PERF_AUDIT_EXTERNAL=1 (then only the base URL is used).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const port = flag('port', '3112');
const base = flag('base', `http://127.0.0.1:${port}`);
const external = process.env.PERF_AUDIT_EXTERNAL === '1';

function classify(resourceType, url) {
  if (resourceType === 'stylesheet' || url.includes('.css')) return 'css';
  if (resourceType === 'script' || url.includes('.js')) return 'js';
  if (
    resourceType === 'image' ||
    /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url)
  )
    return 'image';
  if (resourceType === 'font' || /\.(woff2?|ttf|otf)(\?|$)/i.test(url))
    return 'font';
  if (resourceType === 'document') return 'document';
  if (resourceType === 'websocket') return 'other';
  return 'other';
}

async function waitForServer(url, ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

let server = null;
if (!external) {
  server = spawn('npx', ['next', 'start', '--hostname', '127.0.0.1', '-p', port], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: port },
  });
  server.stdout.on('data', (chunk) => process.stderr.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer(base);
}

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: [
    '--use-angle=metal',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
});

const byType = {
  document: 0,
  js: 0,
  css: 0,
  image: 0,
  font: 0,
  other: 0,
};
let totalBytes = 0;

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.on('response', async (response) => {
  try {
    const url = response.url();
    if (!url.startsWith('http')) return;
    const headers = response.headers();
    let size = Number(headers['content-length'] || 0);
    if (!size) {
      try {
        const body = await response.body();
        size = body.byteLength;
      } catch {
        return;
      }
    }
    const type = classify(response.request().resourceType(), url);
    byType[type] += size;
    totalBytes += size;
  } catch {
    /* closed mid-flight */
  }
});

const navStart = Date.now();
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });

// Entrance is held behind the loader while aria-busy is true.
const entranceMs = await page
  .waitForFunction(
    () => {
      const shell = document.querySelector('.app-shell');
      const hero = document.querySelector('.entrance-hero');
      if (!shell || !hero) return false;
      return shell.getAttribute('aria-busy') !== 'true';
    },
    { timeout: 120000 },
  )
  .then(() => Date.now() - navStart);

const loaderGoneMs = await page
  .waitForFunction(() => !document.querySelector('.scene-loader'), {
    timeout: 120000,
  })
  .then(() => Date.now() - navStart);

// Let late responses settle for byte totals.
await page.waitForTimeout(2500);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const lines = [
  '# Perf budget',
  '',
  `Measured ${new Date().toISOString()} against \`${base}\` (production \`next start\`, headless Chromium, ANGLE Metal, unthrottled).`,
  '',
  '## Timing',
  '',
  `| Milestone | Time |`,
  `| --- | ---: |`,
  `| Entrance visible | ${entranceMs} ms |`,
  `| Scene loader gone | ${loaderGoneMs} ms |`,
  '',
  '## Transferred bytes (by type)',
  '',
  `| Type | Bytes |`,
  `| --- | ---: |`,
  `| document | ${kb(byType.document)} |`,
  `| js | ${kb(byType.js)} |`,
  `| css | ${kb(byType.css)} |`,
  `| image | ${kb(byType.image)} |`,
  `| font | ${kb(byType.font)} |`,
  `| other | ${kb(byType.other)} |`,
  `| **total** | **${kb(totalBytes)}** |`,
  '',
  '## Notes',
  '',
  '- Network throttling via Chrome DevTools Protocol was not recorded; CDP throttling is unreliable in this headless Metal setup.',
  '- GPU flags: `--use-angle=metal --enable-gpu --ignore-gpu-blocklist --enable-webgl`.',
  '',
];

const outPath = resolve(repoRoot, 'docs/perf-budget.md');
writeFileSync(outPath, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`Wrote ${outPath}`);

await browser.close();
if (server) {
  server.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  try {
    server.kill('SIGKILL');
  } catch {
    /* already dead */
  }
}
process.exit(0);
