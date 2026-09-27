#!/usr/bin/env node
// Production perf budget: next start + headless Chromium.
//
//   node scripts/perf-audit.mjs [--port=3112] [--profiles=desktop,mobile]
//       [--out=docs/perf-runs/latest.json]
//
// Expects `npm run build` already. Starts `next start` itself unless
// PERF_AUDIT_EXTERNAL=1 (then only the base URL is used).
//
// Does not rewrite docs/perf-budget.md. Prints a markdown table and writes JSON.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const outPath = resolve(repoRoot, flag('out', 'docs/perf-runs/latest.json'));
const profiles = flag('profiles', 'desktop,mobile')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

// Chrome DevTools "Fast 4G": ~1.6 Mbps down, 750 Kbps up, 150 ms RTT.
const FAST_4G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const PRESETS = {
  desktop: {
    label: 'desktop',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    throttle: 'none',
    cpuRate: 1,
    settleMs: 2500,
  },
  mobile: {
    label: 'mobile-390x844-fast4g',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    throttle: 'fast4g',
    cpuRate: 4,
    settleMs: 8000,
  },
};

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
  return 'other';
}

function emptyTypes() {
  return { document: 0, js: 0, css: 0, image: 0, font: 0, other: 0 };
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

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function launchBrowser() {
  const gpuArgs = [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-gl=angle',
  ];
  // System Google Chrome. The bundled Playwright browser is not installed here,
  // and `channel: 'chromium'` still downloads Playwright's headless shell.
  return chromium.launch({
    headless: true,
    channel: 'chrome',
    args: gpuArgs,
  });
}

async function measure(browser, preset) {
  const byType = emptyTypes();
  const resources = [];
  let totalBytes = 0;
  const context = await browser.newContext({
    viewport: preset.viewport,
    deviceScaleFactor: preset.deviceScaleFactor,
    isMobile: preset.isMobile ?? false,
    hasTouch: preset.hasTouch ?? false,
  });
  const page = await context.newPage();
  let throttleApplied = false;
  let throttleError = null;
  if (preset.throttle === 'fast4g' || preset.cpuRate > 1) {
    try {
      const client = await context.newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (preset.throttle === 'fast4g') {
        await client.send('Network.emulateNetworkConditions', FAST_4G);
        throttleApplied = true;
      }
      if (preset.cpuRate > 1) {
        await client.send('Emulation.setCPUThrottlingRate', {
          rate: preset.cpuRate,
        });
      }
    } catch (error) {
      throttleError = error instanceof Error ? error.message : String(error);
    }
  }

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
      resources.push({
        url: url.replace(base, ''),
        type,
        bytes: size,
      });
    } catch {
      /* closed mid-flight */
    }
  });

  const navStart = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });

  const entranceMs = await (async () => {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const ready = await page
        .evaluate(() => {
          const shell = document.querySelector('.app-shell');
          const hero = document.querySelector('.entrance-hero');
          if (!shell || !hero) return false;
          return shell.getAttribute('aria-busy') !== 'true';
        })
        .catch(() => false);
      if (ready) return Date.now() - navStart;
      await page.waitForTimeout(200);
    }
    return null;
  })();

  const loaderGoneMs = await page
    .waitForFunction(() => !document.querySelector('.scene-loader'), {
      timeout: 15000,
    })
    .then(() => Date.now() - navStart)
    .catch(() => null);

  const atEntrance = {
    ...byType,
    total: totalBytes,
  };

  await page.waitForTimeout(preset.settleMs);

  const stepInsideEnabled = await page
    .getByRole('button', { name: 'Step inside' })
    .isEnabled()
    .catch(() => false);

  const wire = await page
    .evaluate(() =>
      performance.getEntriesByType('resource').reduce(
        (sum, entry) => {
          const timing = entry;
          sum.transfer += timing.transferSize || 0;
          sum.decoded += timing.decodedBodySize || 0;
          return sum;
        },
        { transfer: 0, decoded: 0 },
      ),
    )
    .catch(() => ({ transfer: 0, decoded: 0 }));

  const top = [...resources].sort((a, b) => b.bytes - a.bytes).slice(0, 18);

  const result = {
    profile: preset.label,
    viewport: preset.viewport,
    deviceScaleFactor: preset.deviceScaleFactor,
    throttle: preset.throttle,
    throttleApplied,
    throttleError,
    cpuRate: preset.cpuRate,
    entranceMs,
    loaderGoneMs,
    stepInsideEnabled,
    wire,
    atEntrance,
    settled: { ...byType, total: totalBytes },
    top,
  };
  await context.close();
  return result;
}

let server = null;
if (!external) {
  server = spawn(
    'npx',
    ['next', 'start', '--hostname', '127.0.0.1', '-p', port],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: port },
    },
  );
  server.stdout.on('data', (chunk) => process.stderr.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer(base);
}

const browser = await launchBrowser();
const runs = [];
for (const name of profiles) {
  const preset = PRESETS[name];
  if (!preset) throw new Error(`Unknown profile ${name}`);
  process.stderr.write(`\nMeasuring ${preset.label}…\n`);
  runs.push(await measure(browser, preset));
}
await browser.close();

const report = {
  measuredAt: new Date().toISOString(),
  base,
  runs,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [`Measured ${report.measuredAt} against \`${base}\`.`, ''];
for (const run of runs) {
  lines.push(
    `### ${run.profile}`,
    '',
    `Viewport ${run.viewport.width}×${run.viewport.height} @${run.deviceScaleFactor}x, throttle ${run.throttle} (applied: ${run.throttleApplied}), CPU ×${run.cpuRate}.`,
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Entrance visible | ${run.entranceMs ?? 'timeout'} ms |`,
    `| Scene loader gone | ${run.loaderGoneMs ?? 'n/a'} ms |`,
    `| Step inside enabled | ${run.stepInsideEnabled} |`,
    `| Wire transfer (Resource Timing) | ${kb(run.wire?.transfer ?? 0)} |`,
    `| Transfer at entrance | ${kb(run.atEntrance.total)} |`,
    `| Transfer after settle | ${kb(run.settled.total)} |`,
    `| JS | ${kb(run.settled.js)} |`,
    `| CSS | ${kb(run.settled.css)} |`,
    `| Images | ${kb(run.settled.image)} |`,
    `| Fonts | ${kb(run.settled.font)} |`,
    `| Document | ${kb(run.settled.document)} |`,
    '',
  );
}
console.log(lines.join('\n'));
console.log(`Wrote ${outPath}`);

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
