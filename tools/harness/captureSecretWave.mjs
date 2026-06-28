// Capture the SECRET WAVE 16 split boss in the LIVE V2 app, proving the HUD reads
// "16/15" with the unbeatable star boss on the board. Drives the real sim (jumps
// to the end of wave 15 so the next ticks roll into the hidden wave 16), then
// screenshots both the reveal banner and the boss mid-path. Saves to
// v2/captures/secret-wave/. Exits non-zero on any console error.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/secret-wave/';
const BW = 2514, BH = 1154;
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

const page = await newPage(server.url + '/?v=2', 1366, 768);

// Start a real game, take over stepping, build a heavy loadout for context, then
// jump to the end of wave 15 so the next ticks advance into the SECRET wave 16.
const setup = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  app.sim.startGame();
  app.stop();                       // we drive the sim by hand from here
  s.coins=1e9; s.lives=9999;        // capture-only: guarantee we reach wave 16
  s.config.waves.prepMs=80; s.config.waves.betweenWaveMs=80; s.config.waves.spawnIntervalMs=200;
  // saturate the path with upgraded towers (visual context: a maxed defense)
  const {path,buildable}=s.map; let placed=0;
  for(const p of path){ for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){ const x=p.x+dx,y=p.y+dy;
    if(buildable[y]&&buildable[y][x]&&app.sim.canPlace(x,y)){ app.sim.gridClick(x+0.5,y+0.5);
      if(s.placement){ s.placement.towerType=placed%2?'strong':'basic'; app.sim.placementPlace();
        const t=app.sim.towerAt(x,y); if(t){ s.selected={kind:'tower',id:t.id}; app.sim.upgradeSelected(); app.sim.upgradeSelected(); } placed++; } } }
    if(placed>=16) break; }
  s.selected={kind:null,id:null};
  s.wave.index=15; s.wave.phase='complete'; s.wave.phaseClock=1e9;   // end of wave 15
  return { placed, publicWaves: app.renderer.publicWaves };
})()`);
console.log('setup:', JSON.stringify(setup));

// (1) REVEAL — tick into wave-16 prep, show the "SECRET BOSS" banner + 16/15 chip.
const reveal = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs; let g=0;
  while(g++<8000){ app.sim.tick(dt); if(s.wave.index===16 && s.wave.phase==='prepare') break; if(s.status!=='playing') break; }
  s.wave.announcement={text:'SECRET BOSS',kind:'boss'}; s.wave.isBossWave=true; s.wavePopUntil=s.clock+700;
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { index:s.wave.index, phase:s.wave.phase, status:s.status };
})()`);
console.log('reveal:', JSON.stringify(reveal));
await snap(page, '01-secret-reveal-16of15.png');

// (2) BOSS ON THE BOARD — tick until the star boss is ~40% along the path.
const onBoard = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs; let g=0;
  while(g++<30000){ app.sim.tick(dt);
    const b=s.enemies.find(e=>e.typeId==='boss_split'&&e.alive);
    if(b && b.pathIndex>=Math.floor(s.map.path.length*0.4)) break;
    if(s.status!=='playing') break; }
  const b=s.enemies.find(e=>e.typeId==='boss_split'&&e.alive);
  s.wave.isBossWave=true; s.wave.announcement={text:'SECRET BOSS',kind:'boss'}; s.wavePopUntil=s.clock+700;
  s.selected={kind:'enemy',id:b?b.id:null};   // select the boss so its stat card shows
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { index:s.wave.index, phase:s.wave.phase, status:s.status, bossOnBoard:!!b,
           shape:b?b.shape:null, hp:b?Math.round(b.hp):0, maxHp:b?Math.round(b.maxHp):0, pathIndex:b?b.pathIndex:-1 };
})()`);
console.log('onBoard:', JSON.stringify(onBoard));
await snap(page, '02-boss-on-board-16of15.png');

page.close();
await chrome.kill(); await server.close();
console.log('\nCAPTURE DONE.');
if (errors.length) { console.log('CONSOLE ERRORS (' + errors.length + '):'); errors.forEach(e => console.log('  ' + e)); process.exit(2); }
console.log('No console errors.');
process.exit(0);
