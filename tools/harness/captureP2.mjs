// P2 capture — drives the LIVE V2 app over CDP and snaps the observable changes:
// flag glyphs (spikes/shimmer/leaf + composite), a reverse-entry wave, and the
// Tactical Recon banner (threat icon + entry arrow). Saves PNGs to v2/captures/p2/.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/p2/';
await mkdir(OUT, { recursive: true });
const BW = 2514, BH = 1154;
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

// 1) FLAG GLYPHS — the locked bench fixture now carries armored/evasive/regen on
// its 40 enemies; build it and render one frame.
let page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await waitBench(page);
await page.evaluate(`(()=>{ window.__bench.buildFixture(); window.__app.renderer.render(window.__app.sim.state); window.__app.ctx.getImageData(0,0,1,1); })()`);
await new Promise(r => setTimeout(r, 150));
await snap(page, '01-flag-glyphs-fixture.png');
page.close();

// 2) REVERSE-ENTRY WAVE + TACTICAL RECON BANNER — inject an armored, end-entry wave
// and sit in prepare so the banner (threat glyph + entry arrow) shows; then let it
// spawn so the enemies appear at the FAR end heading back.
page = await newPage(server.url + '/?v=2', 1366, 768);
await page.evaluate(`(()=>{
  const c=window.__app.sim.state.config;   // the running game uses state.config
  c.waves.firstPrepMs=2500; c.waves.prepMs=2500;
  c.enemies.basic.speed=0.6;
  // W2: distinct flags across two groups so the pre-wave LEGEND stack (icon +
  // words per incoming flag) + the entry row are all observable in one snap.
  c.waves.patterns=[{ entry:'end', enemies:[
    { type:'basic', count:5, formation:'line', flags:['armored'] },
    { type:'basic', count:3, formation:'line', flags:['evasive','regen'] },
  ] }];
})()`);
// click Play
await (async () => {
  const rect = await page.evaluate(`(()=>{const r=document.getElementById('gameCanvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}})()`);
  const x = rect.l + (BW / 2) * (rect.w / BW), y = rect.t + (BH * 0.76) * (rect.h / BH);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 1 });
})();
await new Promise(r => setTimeout(r, 900));
await snap(page, '02-recon-banner-prepare.png');
await new Promise(r => setTimeout(r, 4000));   // let the wave spawn at the far end
await snap(page, '03-reverse-entry-wave.png');
page.close();

await chrome.kill(); await server.close();
if (errors.length) { console.error('CONSOLE ERRORS:', errors); process.exit(1); }
console.log('P2 captures OK');
