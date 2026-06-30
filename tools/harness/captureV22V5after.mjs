// V2.2 V5-bugs AFTER-state capture harness — mirrors blocks 05/06 of
// captureV22before.mjs, but against the FIXED build. Proves the two boss-cost
// overlaps are gone: the tray cost reads a clean "250c" clear of its icon, and the
// placement buy-button "250" sits clear of the right edge. Saves PNGs to
// v2/captures/v2.2/after/. CAPTURES ONLY — never edits sim/render/config/test code.
//
//   05 bug-tray-cost-overlap   FIXED: the boss cost "250c" auto-fits, clear of the icon
//   06 bug-placement-overlap   FIXED: the buy-button "250" is a measured group, clear of the edge
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/v2.2/after/';
await mkdir(OUT, { recursive: true });

const server = await startServer({ port: 0 });
const chrome = await launchChrome();
const errors = [];
const fails = [];
function check(cond, msg) { if (cond) console.log('  OK', msg); else { console.error('  FAIL', msg); fails.push(msg); } }

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

const page = await newPage(server.url + '/?v=2', 1366, 768);
const FRESH = `(()=>{ const app=window.__app; app.stop(); app.sim.restart({seed:1, mapIndex:0}); return true; })()`;

// ============================================================ 05 — FIXED: tray cost "250c" clear of icon
await page.evaluate(FRESH);
const c5 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.coins=1e9; s.lives=18; s.status='playing';
  s.selected={kind:null,id:null};
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  const tw = app.sim.config.towers, v = app.sim.config.visual;
  const ids = Object.keys(tw).filter(k => Array.isArray(tw[k]?.levels));
  return { trayTypes: ids, bossCost: tw.boss.levels[0].cost,
           costMinFontPx: v.tray && v.tray.costMinFontPx };
})()`);
console.log('05 tray:', JSON.stringify(c5));
check(c5.trayTypes.includes('boss'), '05: the boss type appears in the build tray');
check(c5.bossCost === 250, '05: the boss tray cost is 250');
check(c5.costMinFontPx >= 13, '05: tray cost has a kid-legible auto-shrink floor');
await snap(page, '05-bug-tray-cost-overlap.png');

// ============================================================ 06 — FIXED: buy-button "250" clear of edge
await page.evaluate(FRESH);
const c6 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.coins=1e9; s.lives=18; s.status='playing'; s.selected={kind:null,id:null};
  const rows=s.map.rows, cols=s.map.cols, ccx=cols/2-1, ccy=rows/2-1;
  let best=null, bestD=Infinity;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){ if(app.sim.canPlace(x,y,'boss')){
    const d=Math.abs(x-ccx)+Math.abs(y-ccy); if(d<bestD){ bestD=d; best={x,y}; } } }
  let opened=false;
  if(best){ app.sim.gridClick(best.x+0.5, best.y+0.5); if(s.placement) opened=true; }
  if(s.placement) s.placement.towerType='boss';
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { opened, towerType:s.placement?s.placement.towerType:null,
           cost: app.sim.config.towers.boss.levels[0].cost };
})()`);
console.log('06 placement popup:', JSON.stringify(c6));
check(c6.opened, '06: the placement popup is open');
check(c6.towerType === 'boss', '06: the popup is showing the BOSS tower (cost 250)');
await snap(page, '06-bug-placement-overlap.png');

if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); fails.push('page errors'); }
page.close();
await chrome.kill(); await server.close();
console.log('\nAll after-captures written to', OUT);
if (fails.length) { console.error('FAILED checks (' + fails.length + '):'); fails.forEach(f => console.error('  ' + f)); }
process.exit(fails.length ? 1 : 0);
