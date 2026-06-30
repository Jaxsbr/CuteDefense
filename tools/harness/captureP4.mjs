// P4 capture + render-capture assertions (§5.6 / §10). Drives the LIVE V2 app over
// CDP and:
//   (a) asserts the 4 fork sprite variants are pixel-distinct from each other AND
//       from the unforked L3 (procedural overlays baked into SpriteCache),
//   (b) asserts the L3 tower card registers TWO `fork` hit-rects (not a Max-level
//       button), while a pre-L3 tower registers an `upgrade` hit-rect,
//   (c) snaps the observable visuals: the before->after upgrade card, the L3 fork
//       choice card, the re-fork affordance, the extended Sniper range ring, and a
//       Froster-slowed crowd. Saves to v2/captures/p4/.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/p4/';
await mkdir(OUT, { recursive: true });
const server = await startServer({ port: 0 });
const chrome = await launchChrome();
const errors = [];
const fails = [];

async function newPage(url, w, h) {
  const page = await chrome.openPage('about:blank');
  await page.send('Page.enable'); await page.send('Runtime.enable');
  page.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') errors.push(JSON.stringify(e.args?.map(a => a.value))); });
  page.on('Runtime.exceptionThrown', (e) => errors.push('EXCEPTION: ' + (e.exceptionDetails?.exception?.description || e.exceptionDetails?.text)));
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise(r => page.on('Page.loadEventFired', r));
  await page.send('Page.navigate', { url });
  await loaded; await new Promise(r => setTimeout(r, 700));
  await page.evaluate('window.__app && window.__app._fit()');
  await new Promise(r => setTimeout(r, 150));
  return page;
}
async function snap(page, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(OUT + name, Buffer.from(data, 'base64'));
  console.log('saved', name);
}
const waitBench = async (page) => { for (let i = 0; i < 100; i++) { if (await page.evaluate(`typeof window.__bench!=='undefined'`)) return; await new Promise(r => setTimeout(r, 100)); } };
const renderFrame = `(()=>{ window.__app.renderer.render(window.__app.sim.state); window.__app.ctx.getImageData(0,0,1,1); })()`;
function check(cond, msg) { if (cond) console.log('  ✓', msg); else { console.error('  ✗', msg); fails.push(msg); } }

const page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await waitBench(page);
await page.evaluate(`window.__bench.buildFixture()`);

// (a) §5.6 — fork sprites are visually distinct (pixel hashes differ).
const hashes = await page.evaluate(`(()=>{
  const sp = window.__app.renderer.sprites;
  const hash = (entry) => {
    const c = entry.canvas, ctx = c.getContext('2d');
    const d = ctx.getImageData(0,0,c.width,c.height).data;
    let h = 2166136261 >>> 0;
    for (let i=0;i<d.length;i+=97) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
    return c.width + 'x' + c.height + ':' + h;
  };
  return {
    basicL3:  hash(sp.tower('basic',3,'neutral',null)),
    sniper:   hash(sp.tower('basic',3,'neutral','sniper')),
    gunner:   hash(sp.tower('basic',3,'neutral','gunner')),
    strongL3: hash(sp.tower('strong',3,'neutral',null)),
    bomber:   hash(sp.tower('strong',3,'neutral','bomber')),
    froster:  hash(sp.tower('strong',3,'neutral','froster')),
  };
})()`);
const uniq = new Set(Object.values(hashes));
check(uniq.size === 6, `all 6 tower variants (L3 + 4 forks + 2 base) are pixel-distinct (got ${uniq.size}/6)`);
check(hashes.sniper !== hashes.gunner, 'Sniper vs Gunner sprites differ');
check(hashes.bomber !== hashes.froster, 'Bomber vs Froster sprites differ');
check(hashes.sniper !== hashes.basicL3 && hashes.gunner !== hashes.basicL3, 'basic forks differ from unforked L3');
check(hashes.bomber !== hashes.strongL3 && hashes.froster !== hashes.strongL3, 'strong forks differ from unforked L3');

// (b) §5.6 — a pre-L3 tower card registers `upgrade`; an L3 card registers TWO `fork` rects.
const preL3 = await page.evaluate(`(()=>{
  const s = window.__app.sim.state; const t = s.towers[0];
  t.level = 1; t.fork = null; s.selected = { kind:'tower', id: t.id };
  window.__app.renderer.render(s);
  const hits = window.__app.renderer.hits;
  return { upgrade: hits.filter(h=>h.action==='upgrade').length, fork: hits.filter(h=>h.action==='fork').length };
})()`);
check(preL3.upgrade === 1 && preL3.fork === 0, `pre-L3 card shows an Upgrade hit-rect, no fork (upgrade=${preL3.upgrade}, fork=${preL3.fork})`);

const atL3 = await page.evaluate(`(()=>{
  const s = window.__app.sim.state; const t = s.towers[0];
  t.level = 3; t.fork = null; s.selected = { kind:'tower', id: t.id };
  window.__app.renderer.render(s);
  const hits = window.__app.renderer.hits;
  const forks = hits.filter(h=>h.action==='fork');
  return { fork: forks.length, arms: forks.map(h=>h.data).sort(), upgrade: hits.filter(h=>h.action==='upgrade').length };
})()`);
check(atL3.fork === 2 && atL3.upgrade === 0, `L3 card shows TWO fork hit-rects, no Max-level/upgrade button (fork=${atL3.fork})`);
check(JSON.stringify(atL3.arms) === JSON.stringify(['gunner','sniper']), `the two arms are the basic forks (${atL3.arms.join(',')})`);

// (c) Visuals -------------------------------------------------------------
// before -> after upgrade card (delta + Power + range-ring preview) on a basic L2.
await page.evaluate(`(()=>{
  const s = window.__app.sim.state; const t = s.towers.find(x=>x.typeId==='basic') || s.towers[0];
  t.level = 2; t.fork = null; s.selected = { kind:'tower', id: t.id };
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '01-upgrade-delta.png');

// L3 fork choice card (two legible buttons, unforked).
await page.evaluate(`(()=>{ const s = window.__app.sim.state; const t = s.selected.id ? s.towers.find(x=>x.id===s.selected.id) : s.towers[0]; t.level = 3; t.fork = null; })()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '02-fork-choice.png');

// W3 — the L3 fork buttons now carry plain-words: sample the word column of each
// fork hit-rect and assert it has drawn text (many distinct pixel values), i.e. the
// card is no longer icon-only.
const blurb = await page.evaluate(`(()=>{
  const app = window.__app; const ctx = app.ctx;
  const forks = app.renderer.hits.filter(h=>h.action==='fork');
  const out = [];
  for (const f of forks) {
    const tx = Math.round(f.x + f.h * 0.85);            // word column, right of the icon
    const tw = Math.max(1, Math.round(f.x + f.w - tx - 4));
    const by = Math.round(f.y + f.h * 0.5);             // name+blurb band
    const bh = Math.max(1, Math.round(f.h * 0.5));
    const d = ctx.getImageData(tx, by, tw, bh).data;
    const vals = new Set();
    for (let i=0;i<d.length;i+=4) vals.add(d[i]+','+d[i+1]+','+d[i+2]);
    out.push(vals.size);
  }
  return out;
})()`);
check(blurb.length === 2 && blurb.every(v => v > 4), `both fork buttons show drawn words beside the icon (distinct-pixel counts ${blurb.join(',')})`);

// after forking sniper — re-fork affordance (+Nc) on the other arm.
await page.evaluate(`(()=>{ const s = window.__app.sim.state; const t = s.towers.find(x=>x.id===s.selected.id); t.fork = 'sniper'; })()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '03-refork-affordance.png');

// Sniper extended range ring on the board.
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 80));
await snap(page, '04-sniper-range.png');

// Froster-slowed crowd: make a strong tower a Froster and slow the fixture crowd.
await page.evaluate(`(()=>{
  const s = window.__app.sim.state;
  const t = s.towers.find(x=>x.typeId==='strong'); if (t) { t.level = 3; t.fork = 'froster'; }
  for (const e of s.enemies) { e.slowUntil = s.clock + 1200; e.slowFactor = 0.5; }
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '05-froster-slow.png');

page.close();
await chrome.kill(); await server.close();
if (errors.length) { console.error('CONSOLE ERRORS:', errors); process.exit(1); }
if (fails.length) { console.error(`\n❌ P4 render-capture assertions FAILED: ${fails.length}`); process.exit(1); }
console.log('\n✅ P4 captures + render-capture assertions OK');
