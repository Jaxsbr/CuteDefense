// P3 capture — drives the LIVE V2 app over CDP and snaps the observable changes:
// a napping tower (zzz bubble + wake countdown), the disabler sleepy-beam
// telegraph, the freeze frost field, and the HUD freeze button (ready vs
// cooldown sweep). Builds the locked bench fixture for real towers/enemies, then
// sets the new sim fields and renders one frame per shot. Saves to v2/captures/p3/.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/p3/';
await mkdir(OUT, { recursive: true });
const server = await startServer({ port: 0 });
const chrome = await launchChrome();
const errors = [];

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

const page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await waitBench(page);

// (1) NAPPING TOWER — build the fixture, turn the freeze field off, and nap one
// tower so the zzz bubble + integer wake countdown shows.
await page.evaluate(`(()=>{
  window.__bench.buildFixture();
  const s = window.__app.sim.state;
  s.freeze.activeUntil = 0;
  const t = s.towers[0];
  t.stunnedUntil = s.clock + 2500; t.napWoken = false;
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '01-tower-nap.png');

// (2) DISABLER BEAM TELEGRAPH — point a disabler's sleepy-beam at a tower mid
// wind-up so the charging dashed line + impact glow shows.
await page.evaluate(`(()=>{
  const s = window.__app.sim.state;
  s.freeze.activeUntil = 0;
  for (const t of s.towers) { t.stunnedUntil = 0; t.napWoken = true; }
  const d = s.enemies.find(e => e.typeId === 'disabler');
  const t = s.towers[3] || s.towers[0];
  if (d && t) { d.bs.beamTowerId = t.id; d.bs.beamFireAt = s.clock + 450; }
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '02-disabler-beam.png');

// (3) FREEZE FIELD — the shared slow field active over the board.
await page.evaluate(`(()=>{
  const s = window.__app.sim.state;
  const d = s.enemies.find(e => e.typeId === 'disabler');
  if (d) { d.bs.beamTowerId = null; }
  s.freeze.activeUntil = s.clock + 2500;
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '03-freeze-field.png');

// (4) HUD FREEZE BUTTON — ready (bright).
await page.evaluate(`(()=>{
  const s = window.__app.sim.state;
  s.freeze.activeUntil = 0; s.freeze.readyAt = 0;
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '04-freeze-button-ready.png');

// (5) HUD FREEZE BUTTON — mid-cooldown sweep.
await page.evaluate(`(()=>{
  const s = window.__app.sim.state;
  s.freeze.readyAt = s.clock + s.config.freeze.cooldownMs * 0.5;
})()`);
await page.evaluate(renderFrame); await new Promise(r => setTimeout(r, 120));
await snap(page, '05-freeze-button-cooldown.png');

page.close();
await chrome.kill(); await server.close();
if (errors.length) { console.error('CONSOLE ERRORS:', errors); process.exit(1); }
console.log('P3 captures OK');
