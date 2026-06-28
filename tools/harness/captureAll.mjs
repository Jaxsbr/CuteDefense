// Comprehensive after-capture for the cute-soul overhaul. Drives the LIVE V2 app
// over CDP, exercises every changed surface, dumps console errors, saves PNGs to
// v2/captures/after/. Exits non-zero if the page logged any console error/exception.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/after/';
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
async function click(page, bx, by) {
  const rect = await page.evaluate(`(()=>{const r=document.getElementById('gameCanvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}})()`);
  const x = rect.l + bx * (rect.w / BW), y = rect.t + by * (rect.h / BH);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await new Promise(r => setTimeout(r, 150));
}

// 1) START MENU — let menuClock animate the title/cast a moment.
let page = await newPage(server.url + '/?v=2', 1366, 768);
await new Promise(r => setTimeout(r, 900));
await snap(page, '01-start-menu.png');

// 2) GAMEPLAY + HUD — play, place towers near the path, let a wave run & fire.
await click(page, BW / 2, BH * 0.76);                  // Play (primary CTA, lower third)
let status = await page.evaluate('window.__app.sim.state.status');
console.log('after Play, status =', status);
// place a few towers on buildable tiles adjacent to the path, via the popup
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.coins=9999;
  const {path,buildable}=s.map; let placed=0;
  for(const p of path){ for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
    const x=p.x+dx,y=p.y+dy;
    if(buildable[y]&&buildable[y][x]&&app.sim.canPlace(x,y)){ app.sim.gridClick(x+0.5,y+0.5); if(s.placement){s.placement.towerType=placed%2?'strong':'basic'; app.sim.placementPlace(); placed++;} }
    if(placed>=8) break;
  } if(placed>=8) break; }
})()`);
await new Promise(r => setTimeout(r, 2600));           // let first wave spawn & towers fire
await snap(page, '02-gameplay-hud.png');

// 3) TOWER SELECTED — shows the recolored white/dashed range circle + tower card.
await page.evaluate(`(()=>{const s=window.__app.sim.state; if(s.towers[0]) s.selected={kind:'tower',id:s.towers[0].id};})()`);
await new Promise(r => setTimeout(r, 120));
await snap(page, '03-tower-selected-range.png');

// 4) PLACEMENT POPUP — open it on an empty buildable tile.
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state; s.selected={kind:null,id:null};
  for(let y=0;y<s.map.rows;y++)for(let x=0;x<s.map.cols;x++){ if(app.sim.canPlace(x,y)){ app.sim.gridClick(x+0.5,y+0.5); if(s.placement) return; } }
})()`);
await new Promise(r => setTimeout(r, 150));
await snap(page, '04-placement-popup.png');
// cycle the tower type to show the popup updates which tower it'll place
await page.evaluate(`window.__app.sim.placementCycle()`);
await new Promise(r => setTimeout(r, 120));
await snap(page, '05-placement-popup-cycled.png');
page.close();

// 6) BUSY FIXTURE (saturation contrast at scale; towers firing = shock+puff, enemies hit = ouch).
const fixturePrep = `(()=>{window.__bench.buildFixture();window.__app.renderer.render(window.__app.sim.state);})()`;
page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await page.evaluate(fixturePrep);
await new Promise(r => setTimeout(r, 1000));           // let towers fire so shock/ouch frames show
await snap(page, '06-busy-fixture-16x9.png');
page.close();

page = await newPage(server.url + '/?v=2&bench=1', 1024, 768);
await page.evaluate(fixturePrep);
await new Promise(r => setTimeout(r, 1000));
await snap(page, '07-busy-fixture-tablet-4x3.png');
page.close();

// 8) BOSS WAVE announcement + a boss on the board.
page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state; window.__bench.buildFixture();
  s.wave.announcement={text:'BOSS WAVE',kind:'boss'}; s.wave.isBossWave=true; s.wave.index=5;
  s.wavePopUntil=s.clock+700;
  app.renderer.render(s);
})()`);
await new Promise(r => setTimeout(r, 150));
await snap(page, '08-boss-announcement.png');
page.close();

// 9) WIN overlay.
page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await page.evaluate(`(()=>{const app=window.__app,s=app.sim.state; window.__bench.buildFixture(); s.status='won'; s.lives=18; s.stats={wavesCleared:15,towersBuilt:11,enemiesKilled:213,coinsEarned:642,elapsedMs:300000}; app.renderer.render(s);})()`);
await new Promise(r => setTimeout(r, 150));
await snap(page, '09-win.png');
page.close();

// 10) LOSE overlay.
page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
await page.evaluate(`(()=>{const app=window.__app,s=app.sim.state; window.__bench.buildFixture(); s.status='lost'; s.lives=0; s.stats={wavesCleared:7,towersBuilt:9,enemiesKilled:118,coinsEarned:300,elapsedMs:210000}; app.renderer.render(s);})()`);
await new Promise(r => setTimeout(r, 150));
await snap(page, '10-lose.png');
page.close();

await chrome.kill(); await server.close();
console.log('\nCAPTURE DONE.');
if (errors.length) { console.log('CONSOLE ERRORS (' + errors.length + '):'); errors.forEach(e => console.log('  ' + e)); process.exit(2); }
console.log('No console errors.');
process.exit(0);
