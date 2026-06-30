// P5 capture harness — regenerates the FULL before/after pair set (SPEC-P5 §7)
// under v2/captures/before-p5/ and v2/captures/after-p5/. Drives the LIVE V2 app
// over CDP. Each pair isolates ONE observable P5 change:
//   01 win-screen      before = forced lost@16 overlay        / after = real won@15 + 3 stars + summit dare
//   02 l3-sprite-fit   before = 3 L3 bodies overlapping (~19px) / after = same layout, bodies contained in tile
//   03 boss-banner     before = generic green "Wave 5 Complete!" / after = distinct gold "Boss down!" banner
//   04 summit-dare     before = win card, summit OFF (no button) / after = win card WITH "Try the SUPER boss?"
//   05 wave16-board    before = wave-16 board reached by forced loss / after = reached via summit, win banked
//   06 summit-loss     before = plain lost@16                  / after = softened "You did it!…great try" card
// Saves to the two dirs. Exits non-zero on any console error.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const ROOT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/';
const DIRS = { before: ROOT + 'before-p5/', after: ROOT + 'after-p5/' };
await mkdir(DIRS.before, { recursive: true });
await mkdir(DIRS.after, { recursive: true });

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
async function snap(page, phase, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(DIRS[phase] + name, Buffer.from(data, 'base64'));
  console.log('saved', phase + '/' + name);
}

// Shared setup: start a game, take over stepping, fast config, saturate the path
// with upgraded towers (visual context). Returns nothing; mutates the live state.
const HEAVY_SETUP = `(()=>{
  const app=window.__app;
  app.sim.restart({}); app.stop();   // FRESH state each block — no banked-win/summit leak across captures
  const s=app.sim.state;
  s.coins=1e9; s.lives=12;
  s.config.waves.prepMs=80; s.config.waves.betweenWaveMs=80; s.config.waves.spawnIntervalMs=200;
  const {path,buildable}=s.map; let placed=0;
  for(const p of path){ for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){ const x=p.x+dx,y=p.y+dy;
    if(buildable[y]&&buildable[y][x]&&app.sim.canPlace(x,y)){ app.sim.gridClick(x+0.5,y+0.5);
      if(s.placement){ s.placement.towerType=placed%2?'strong':'basic'; app.sim.placementPlace();
        const t=app.sim.towerAt(x,y); if(t){ s.selected={kind:'tower',id:t.id}; app.sim.upgradeSelected(); app.sim.upgradeSelected(); } placed++; } } }
    if(placed>=16) break; }
  s.selected={kind:null,id:null};
})()`;

const page = await newPage(server.url + '/?v=2', 1366, 768);

// ============================================================ 01 — WIN SCREEN
// before: pre-P5 forced loss at the secret wave 16 (status='lost', not banked).
await page.evaluate(HEAVY_SETUP);
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.status='lost'; s.publicWinBanked=false; s.summitMode=false; s.stars=0;
  s.wave.index=16; s.wave.phase='active'; s.wave.announcement=null;
  s.stats.wavesCleared=15; s.lives=0;
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
})()`);
await snap(page, 'before', '01-win-screen.png');

// after: the REAL public win at wave 15 with a 3-star quality score + summit dare.
await page.evaluate(HEAVY_SETUP);
const winAfter = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.lives=12; s.coins=0; s.stats.elapsedMs=120000; s.stats.wavesCleared=15;  // -> 3 stars
  s.wave.index=15; s.wave.phase='complete'; s.wave.phaseClock=1e9; s.wave.announcement=null;
  app.sim.tick(app.cfg.timestepMs);   // central _checkWinLose banks the win + computes stars
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { status:s.status, stars:s.stars, banked:s.publicWinBanked, wave:s.wave.index };
})()`);
console.log('win after:', JSON.stringify(winAfter));
await snap(page, 'after', '01-win-screen.png');

// ======================================================== 02 — L3 SPRITE-FIT
// Inject 3 horizontally-adjacent L3 towers on a buildable row, render twice:
// before = footprint cap lifted (raw sizeScale -> ~19px overlap), after = capped.
const spriteFit = `((cap)=>{
  const app=window.__app;
  app.sim.restart({}); app.stop();
  const s=app.sim.state;
  s.status='playing'; s.selected={kind:null,id:null}; s.placement=null;
  s.towers.length=0;
  // find a row with 3 consecutive buildable cells, preferring a central row and a
  // column a few tiles in (so the trio sits in open board space, clear of the HUD).
  const {buildable}=s.map; let row=-1, col=-1;
  const rows=buildable.length, mid=Math.floor(rows/2);
  const order=[...Array(rows).keys()].sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid));
  for(const y of order){ if(row>=0) break; const w=buildable[y].length;
    for(let x=3;x+2<w-2;x++){ if(buildable[y][x]&&buildable[y][x+1]&&buildable[y][x+2]){ row=y; col=x; break; } } }
  if(row<0){ for(let y=0;y<rows && row<0;y++){ for(let x=0;x+2<buildable[y].length;x++){
    if(buildable[y][x]&&buildable[y][x+1]&&buildable[y][x+2]){ row=y; col=x; break; } } } }
  const types=['basic','strong','basic'];
  for(let i=0;i<3;i++){ const gx=col+i, gy=row;
    s.towers.push({ id:1000+i, typeId:types[i], level:3, fork:null, gx, gy, x:gx+0.5, y:gy+0.5,
      cooldown:0, faceFrame:'neutral', naps:{} }); }
  app.cfg.towers.footprintScaleCap = cap;
  if(app.renderer.sprites && app.renderer.sprites.cfg) app.renderer.sprites.cfg.towers.footprintScaleCap = cap;
  app.renderer.sprites.cache.clear();   // force re-bake at the new cap
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { row, col, cap };
})`;
const sfBefore = await page.evaluate(spriteFit + '(1.0)');   // cap not binding -> raw 0.6 sizeScale
console.log('sprite-fit before:', JSON.stringify(sfBefore));
await snap(page, 'before', '02-l3-sprite-fit.png');
const sfAfter = await page.evaluate(spriteFit + '(0.46)');   // P5 cap -> bodies contained
console.log('sprite-fit after:', JSON.stringify(sfAfter));
await snap(page, 'after', '02-l3-sprite-fit.png');
// restore default cap + cache for the rest of the run
await page.evaluate(`(()=>{ const app=window.__app; app.cfg.towers.footprintScaleCap=0.46;
  if(app.renderer.sprites?.cfg) app.renderer.sprites.cfg.towers.footprintScaleCap=0.46;
  app.renderer.sprites.cache.clear(); })()`);

// ======================================================== 03 — BOSS BANNER
await page.evaluate(HEAVY_SETUP);
// before: the OLD generic green wave-complete banner shown after a boss wave.
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.status='playing'; s.wave.index=5; s.wave.phase='complete';
  s.wave.announcement={ text:'Wave 5 Complete!  +18c bonus', kind:'complete' };
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
})()`);
await snap(page, 'before', '03-boss-banner.png');
// after: the NEW distinct gold "Boss down!" celebration banner.
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.status='playing'; s.wave.index=5; s.wave.phase='complete';
  s.wave.announcement={ text:'Boss down! 🎉  +18c bonus', kind:'bossdown' };
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
})()`);
await snap(page, 'after', '03-boss-banner.png');

// ======================================================== 04 — SUMMIT DARE
await page.evaluate(HEAVY_SETUP);
// before: a banked win with the summit feature OFF -> no dare button on the card.
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.lives=12; s.coins=0; s.stats.elapsedMs=120000; s.stats.wavesCleared=15;
  s.wave.index=15; s.wave.phase='complete'; s.wave.phaseClock=1e9; s.wave.announcement=null;
  app.sim.tick(app.cfg.timestepMs);
  const summitWas = s.config.waves.summit.enabled; s.config.waves.summit.enabled=false; // pre-P5: no summit
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  s.config.waves.summit.enabled=summitWas;
})()`);
await snap(page, 'before', '04-summit-dare.png');
// after: the same banked win WITH the "Try the SUPER boss?" dare button present.
const dareAfter = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.config.waves.summit.enabled=true;
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  const hits=app.renderer.hits||[];
  return { dareHit: hits.some(h=>h.action==='continueSummit'), summit:s.config.waves.summit.enabled };
})()`);
console.log('summit-dare after:', JSON.stringify(dareAfter));
await snap(page, 'after', '04-summit-dare.png');

// ======================================================== 05 — WAVE-16 BOARD
// before: pre-P5, reaching wave 16 only ever happened via a forced loss path.
await page.evaluate(HEAVY_SETUP);
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs;
  s.coins=1e9; s.lives=9999;
  s.wave.index=15; s.wave.phase='complete'; s.wave.phaseClock=1e9;
  s.publicWinBanked=false; s.summitMode=true;          // pre-P5: no banked win, just rolls onward
  let g=0; while(g++<8000){ app.sim.tick(dt); if(s.wave.index===16 && s.wave.phase!=='complete') break; if(s.status!=='playing') break; }
  s.publicWinBanked=false;                              // before: the win was never real
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { wave:s.wave.index, phase:s.wave.phase };
})()`);
await snap(page, 'before', '05-wave16-board.png');
// after: reach wave 16 the RIGHT way — bank the win, then take the summit dare.
await page.evaluate(HEAVY_SETUP);
const w16After = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs;
  s.coins=1e9; s.lives=12; s.stats.elapsedMs=120000; s.stats.wavesCleared=15;
  s.wave.index=15; s.wave.phase='complete'; s.wave.phaseClock=1e9;
  app.sim.tick(dt);                                     // banks the public win
  const ok = app.sim.continueToSummit();                // opt-in dare into wave 16
  let g=0; while(g++<8000){ app.sim.tick(dt); if(s.wave.index===16 && s.wave.phase!=='complete') break; if(s.status!=='playing') break; }
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { ok, wave:s.wave.index, phase:s.wave.phase, banked:s.publicWinBanked, summit:s.summitMode, status:s.status };
})()`);
console.log('wave16 after:', JSON.stringify(w16After));
await snap(page, 'after', '05-wave16-board.png');

// ======================================================== 06 — SUMMIT-LOSS COPY
await page.evaluate(HEAVY_SETUP);
// before: pre-P5 a wave-16 defeat was just a plain loss (no banked win to soften it).
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.status='lost'; s.publicWinBanked=false; s.summitMode=true; s.stars=0; s.lives=0;
  s.wave.index=16; s.wave.phase='active'; s.wave.announcement=null; s.stats.wavesCleared=15;
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
})()`);
await snap(page, 'before', '06-summit-loss.png');
// after: a summit loss AFTER a banked win reads as a celebrated win ("…great try!").
await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  s.status='lost'; s.publicWinBanked=true; s.summitMode=true; s.stars=3; s.lives=0;
  s.wave.index=16; s.wave.phase='active'; s.wave.announcement=null; s.stats.wavesCleared=15;
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
})()`);
await snap(page, 'after', '06-summit-loss.png');

page.close();
await chrome.kill(); await server.close();
console.log('\nP5 CAPTURE DONE — before/after pairs written.');
if (errors.length) { console.log('CONSOLE ERRORS (' + errors.length + '):'); errors.forEach(e => console.log('  ' + e)); process.exit(2); }
console.log('No console errors.');
process.exit(0);
