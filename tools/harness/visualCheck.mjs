// Phase 5 visual verification (dev-only). Drives the LIVE V2 app with real mouse
// events to confirm the input→sim→render loop works, captures the placement popup,
// both target aspect ratios, and the lose overlay. Saves PNGs to v2/captures/.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/';
const BW = 2514, BH = 1154; // backing store

const server = await startServer({ port: 0 });
const chrome = await launchChrome();

async function newPage(url, w, h) {
  const page = await chrome.openPage('about:blank');
  await page.send('Page.enable'); await page.send('Runtime.enable');
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
// Map a backing-store coord to CSS viewport coord and dispatch a real click.
async function click(page, bx, by) {
  const rect = await page.evaluate(`(()=>{const r=document.getElementById('gameCanvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}})()`);
  const x = rect.l + bx * (rect.w / BW);
  const y = rect.t + by * (rect.h / BH);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await new Promise(r => setTimeout(r, 150));
}

// --- LIVE interaction on a laptop 16:9 viewport ---
let page = await newPage(server.url + '/?v=2', 1366, 768);
await click(page, BW / 2, BH * 0.52);                 // Play button
let status = await page.evaluate('window.__app.sim.state.status');
console.log('after Play, status =', status);
await click(page, 400 + 5.5 * 96, 5.5 * 96);          // empty buildable tile -> popup
const hasPopup = await page.evaluate('!!window.__app.sim.state.placement');
console.log('placement popup open =', hasPopup);
await snap(page, '04-placement-popup.png');
// click the popup "place" button (top button, centered above tile)
const placeRect = await page.evaluate(`(()=>{const h=window.__app.renderer.hits.find(h=>h.action==='place');return h?{x:h.x+h.w/2,y:h.y+h.h/2}:null})()`);
if (placeRect) await click(page, placeRect.x, placeRect.y);
const towers = await page.evaluate('window.__app.sim.state.towers.length');
console.log('towers after place click =', towers);
await snap(page, '05-tower-placed.png');
page.close();

// --- aspect ratios: busy fixture scene ---
const fixturePrep = `(()=>{window.__bench.buildFixture();window.__app.renderer.render(window.__app.sim.state);})()`;
page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await page.evaluate(fixturePrep); await new Promise(r => setTimeout(r, 200));
await snap(page, '06-laptop-16x9.png'); page.close();

page = await newPage(server.url + '/?v=2&bench=1', 1024, 768);
await page.evaluate(fixturePrep); await new Promise(r => setTimeout(r, 200));
await snap(page, '07-tablet-4x3.png'); page.close();

// --- lose overlay ---
page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await page.evaluate(`(()=>{window.__bench.buildFixture();const s=window.__app.sim.state;s.status='lost';s.lives=0;s.stats={wavesCleared:7,towersBuilt:9,enemiesKilled:118,coinsEarned:300,elapsedMs:210000};window.__app.renderer.render(s);})()`);
await new Promise(r => setTimeout(r, 200));
await snap(page, '08-lose.png'); page.close();

await chrome.kill(); await server.close();
console.log('VISUAL CHECK DONE');
process.exit(0);
