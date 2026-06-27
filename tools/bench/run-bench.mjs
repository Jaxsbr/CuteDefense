// CuteDefense benchmark runner (dev-only, zero npm deps).
//
// Loads the locked synthetic fixture (40 enemies / 12 towers / 30 coins) in the
// real page under a fixed Chrome 4x CPU throttle and records p50/p95/p99 frame
// time. Measures V1 and V2 the same way so the comparison is apples-to-apples.
//
// Usage:
//   node tools/bench/run-bench.mjs                 # both versions, compare + gate
//   node tools/bench/run-bench.mjs --only v1       # capture/refresh V1 baseline
//   node tools/bench/run-bench.mjs --only v2
//   node tools/bench/run-bench.mjs --frames 400 --throttle 4
//
// Gate (exit 1) when V2 p95 >= V1 p95, or when V2 regresses past its own prior
// recorded p95 by more than the regression margin.
import { startServer } from '../harness/staticServer.mjs';
import { launchChrome } from '../harness/cdp.mjs';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(HERE, 'results');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const ONLY = arg('--only', null);          // 'v1' | 'v2' | null(both)
const FRAMES = Number(arg('--frames', '300'));
const WARMUP = Number(arg('--warmup', '60'));
const THROTTLE = Number(arg('--throttle', '4'));
const REGRESSION_MARGIN = 0.15;            // 15% over own prior p95 = alarm

async function benchVersion(chrome, baseUrl, version) {
  const url = `${baseUrl}/?v=${version === 'v1' ? '1' : '2'}&bench=1`;
  const page = await chrome.openPage('about:blank');
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r));
  await page.send('Page.navigate', { url });
  await loaded;

  // Wait until the version's bench harness is installed.
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 15000) {
    ready = await page.evaluate(`typeof window.__bench !== 'undefined' && typeof window.__bench.run === 'function'`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    page.close();
    throw new Error(`${version}: window.__bench never appeared (is the bench harness wired for ${version}?)`);
  }

  // Apply the deterministic CPU throttle, then run the measured frames.
  await page.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const result = await page.evaluate(`window.__bench.run(${FRAMES}, ${WARMUP})`);
  result.throttle = THROTTLE;
  page.close();
  return result;
}

function fmt(n) { return n.toFixed(2).padStart(8); }
function printResult(r) {
  console.log(`  ${r.version.toUpperCase()}  fixture=${JSON.stringify(r.fixture)}  throttle=${r.throttle}x  frames=${r.frames}`);
  console.log(`        p50=${fmt(r.p50)}ms  p95=${fmt(r.p95)}ms  p99=${fmt(r.p99)}ms  mean=${fmt(r.mean)}ms  (min ${r.min.toFixed(2)} / max ${r.max.toFixed(2)})`);
  if (r.counts) console.log(`        live counts: ${JSON.stringify(r.counts)}`);
}

async function loadJSON(p) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } }

(async () => {
  await mkdir(RESULTS, { recursive: true });
  const server = await startServer({ port: 0 });
  const chrome = await launchChrome();
  let exitCode = 0;
  try {
    const want = ONLY ? [ONLY] : ['v1', 'v2'];
    const out = {};
    for (const v of want) {
      console.log(`\n▶ Benchmarking ${v.toUpperCase()} …`);
      try {
        out[v] = await benchVersion(chrome, server.url, v);
        printResult(out[v]);
      } catch (e) {
        console.log(`  ⚠ ${v} bench skipped/failed: ${e.message}`);
        out[v] = { error: e.message };
      }
    }

    // Persist results.
    const stamp = new Date(Number(process.env.BENCH_TS) || 0); // deterministic-friendly
    if (out.v1 && !out.v1.error) {
      await writeFile(path.join(RESULTS, 'v1-baseline.json'), JSON.stringify(out.v1, null, 2));
    }
    if (out.v2 && !out.v2.error) {
      await writeFile(path.join(RESULTS, 'v2-latest.json'), JSON.stringify(out.v2, null, 2));
    }
    await writeFile(path.join(RESULTS, 'latest.json'), JSON.stringify(out, null, 2));

    // Gates.
    const v1 = out.v1 && !out.v1.error ? out.v1 : await loadJSON(path.join(RESULTS, 'v1-baseline.json'));
    const v2 = out.v2 && !out.v2.error ? out.v2 : null;
    if (v1 && v2) {
      console.log('\n── Gate: V2 must beat V1 (p95) ──');
      const delta = v1.p95 - v2.p95;
      const pct = (delta / v1.p95) * 100;
      console.log(`  V1 p95 = ${v1.p95.toFixed(2)}ms   V2 p95 = ${v2.p95.toFixed(2)}ms   Δ = ${delta.toFixed(2)}ms (${pct.toFixed(1)}% ${delta >= 0 ? 'faster' : 'SLOWER'})`);
      if (v2.p95 >= v1.p95) {
        console.log('  ❌ FAIL — V2 p95 is not lower than V1 p95.');
        exitCode = 1;
      } else {
        console.log('  ✅ PASS — V2 beats V1 on p95 frame time.');
      }
      // Self-regression vs prior V2 p95.
      const prior = await loadJSON(path.join(RESULTS, 'v2-prior.json'));
      if (prior && prior.p95) {
        const grew = (v2.p95 - prior.p95) / prior.p95;
        console.log(`  Self-check vs prior V2 p95 ${prior.p95.toFixed(2)}ms: ${(grew * 100).toFixed(1)}%`);
        if (grew > REGRESSION_MARGIN) {
          console.log(`  ❌ FAIL — V2 regressed past its own prior p95 by >${REGRESSION_MARGIN * 100}%.`);
          exitCode = 1;
        }
      }
    }
  } finally {
    await chrome.kill();
    await server.close();
  }
  process.exit(exitCode);
})();
