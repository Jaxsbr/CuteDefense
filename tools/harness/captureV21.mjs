// V2.1 capture harness — proves the observable NEW V2.1 behavior in the LIVE V2
// app, driven over CDP against the static server (same pattern as captureP5 /
// captureSecretWave). Saves PNGs to v2/captures/v2.1/. Exits non-zero on any page
// console error or if a capture's state-precondition was not actually reached.
//
//   01 boss-tower-placed         the 2x2 boss "fortress" on the board, BEFORE upgrade
//                                (L1; card shows "Unlock Ultimate", HUD ultimate LOCKED)
//   02 boss-tower-upgraded       SAME boss after its single upgrade (L2): card shows
//                                "Boss Blast READY" + the HUD ULTIMATE button armed
//   03 ultimate-firing           the manual full-map nuke firing — ember flash + the
//                                expanding crimson ring from the boss, hitting the
//                                secret split boss on wave 16
//   04 endgame-pressure          a late wave (~13) with enemies marching to the GOAL
//                                tile — the risen difficulty curve (no longer wiped at spawn)
//   05 summit-won                a maxed optimal({ultimate:true}) run DEFEATS the secret
//                                split boss and lands on the SUMMIT_WON victory overlay
//
// Captures only: this script never edits sim/render/config/test code; it stages
// state exactly as the existing capture harnesses do, then screenshots the renderer.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/v2.1/';
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

// Load the SAME faithful Bot + policy ladder the headless tests use, straight from
// the served source tree. Bot wraps the LIVE app sim and acts only via the public
// command API (placeBoss / upgrade / castUltimate). policies.optimal({ultimate:true})
// is the exact build the secret-wave test proves WINS the summit.
await page.evaluate(`(async()=>{
  const h = await import('/tools/balance/harness.mjs');
  const p = await import('/tools/balance/policies.mjs');
  window.__h = { Bot: h.Bot, POLICIES: p.POLICIES };
  // Place a 2x2 boss tower on the free 2x2 block CLOSEST to board center (and clear of
  // the left dock), so its menacing footprint reads on open board. Faithful: builds via
  // the Bot's public popup path. Returns the boss tower (or null).
  window.__placeBossCentral = function() {
    const app = window.__app, s = app.sim.state, bot = new window.__h.Bot(app.sim);
    const fp = 2, rows = s.map.rows, cols = s.map.cols;
    const free = (x, y) => {
      for (let dy = 0; dy < fp; dy++) for (let dx = 0; dx < fp; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx >= cols || cy >= rows) return false;
        if (!(s.map.buildable[cy] && s.map.buildable[cy][cx])) return false;
        if (app.sim.towerAt(cx, cy)) return false;
      }
      return true;
    };
    let best = null, bestD = Infinity;
    const ccx = cols / 2 - 1, ccy = rows / 2 - 1;
    for (let y = 0; y <= rows - fp; y++) for (let x = 3; x <= cols - fp; x++) {
      if (!free(x, y)) continue;
      const d = Math.abs(x - ccx) + Math.abs(y - ccy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    if (best) bot.place(best.x, best.y, 'boss'); else bot.placeBoss();
    return s.towers.find(t => app.sim.config.towers[t.typeId]?.kind === 'boss');
  };
})()`);
const haveBot = await page.evaluate('!!(window.__h && window.__h.Bot && window.__h.POLICIES)');
check(haveBot, 'loaded the Bot + POLICIES harness into the page');

// Shared: fresh playing state on a known seed/map, app RAF stopped (we drive by hand).
const FRESH = `(()=>{ const app=window.__app; app.stop(); app.sim.restart({seed:1, mapIndex:0}); return true; })()`;

// Place a boss tower (2x2) via the faithful Bot, then drape a modest upgraded
// context defense so the fortress reads as part of a real board. Returns the boss id.
const PLACE_BOSS_AND_CONTEXT = `(()=>{
  const app=window.__app, s=app.sim.state;
  s.coins=1e9; s.lives=18;
  const boss=window.__placeBossCentral();
  const anchor= boss ? {gx:boss.gx, gy:boss.gy} : null;
  // Drop a ring of single-tile towers AROUND the boss so the 2x2 footprint reads by
  // direct size contrast (the obsidian keep dwarfs the little buddies beside it).
  const {buildable,rows,cols}=s.map;
  const bcx = boss ? boss.gx+0.5 : cols/2, bcy = boss ? boss.gy+0.5 : rows/2;
  const empties=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){ if(buildable[y]&&buildable[y][x]&&app.sim.canPlace(x,y)){
    empties.push({x,y,d:Math.abs(x-bcx)+Math.abs(y-bcy)}); } }
  empties.sort((a,b)=>a.d-b.d);
  let placed=0;
  for(const c of empties){ if(placed>=10) break;
    app.sim.gridClick(c.x+0.5,c.y+0.5);
    if(s.placement){ s.placement.towerType=placed%2?'strong':'basic'; app.sim.placementPlace();
      const t=app.sim.towerAt(c.x,c.y); if(t){ s.selected={kind:'tower',id:t.id}; app.sim.upgradeSelected(); } placed++; } }
  s.status='playing';
  return { anchor, bossId: boss?boss.id:null, bossLevel: boss?boss.level:null, placed };
})()`;

// ============================================================ 01 — BOSS PLACED (pre-upgrade)
await page.evaluate(FRESH);
const c1 = await page.evaluate(`(()=>{
  const r = (${PLACE_BOSS_AND_CONTEXT});
  const app=window.__app, s=app.sim.state;
  s.selected={kind:'tower', id:r.bossId};      // show the L1 boss card ("Unlock Ultimate")
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return r;
})()`);
console.log('01 boss placed:', JSON.stringify(c1));
check(c1.bossId != null, '01: a boss tower was placed');
check(c1.bossLevel === 1, '01: boss is L1 (ultimate not yet unlocked)');
await snap(page, '01-boss-tower-placed.png');

// ============================================================ 02 — BOSS UPGRADED (ultimate unlocked)
const c2 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  const boss=s.towers.find(t=> app.sim.config.towers[t.typeId]?.kind==='boss');
  s.selected={kind:'tower', id:boss.id};
  const ok=app.sim.upgradeSelected();           // L1 -> L2 unlocks the ultimate
  boss.ultReadyAt = s.clock;                     // off cooldown -> HUD button READY
  s.status='playing';
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  const def=app.sim.config.towers[boss.typeId];
  return { upgraded:ok, level:boss.level, ultimateUnlocked: !!def.levels[boss.level-1]?.ultimate, ready: app.sim.ultimateReady() };
})()`);
console.log('02 boss upgraded:', JSON.stringify(c2));
check(c2.level === 2, '02: boss upgraded to L2');
check(c2.ultimateUnlocked, '02: the L2 unlock flag is set (ultimate unlocked)');
check(c2.ready, '02: the ultimate reads READY (HUD button armed)');
await snap(page, '02-boss-tower-upgraded.png');

// ============================================================ 03 — ULTIMATE FIRING (full-map nuke)
await page.evaluate(FRESH);
const c3 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs;
  s.coins=1e9; s.lives=9999;
  s.config.waves.prepMs=80; s.config.waves.betweenWaveMs=80; s.config.waves.spawnIntervalMs=200;
  // build + upgrade the boss tower (the ultimate's owner)
  const boss=window.__placeBossCentral();
  s.selected={kind:'tower', id:boss.id}; app.sim.upgradeSelected();   // -> L2 ultimate unlocked
  s.selected={kind:null,id:null};
  // Reach the SECRET wave 16 the real way: complete wave 15 -> bank the public win ->
  // take the opt-in SUMMIT dare (continueToSummit) which resumes play into wave 16.
  s.wave.index=15; s.wave.phase='complete'; s.wave.phaseClock=1e9;
  let b1=0; while(b1++<10 && !s.publicWinBanked){ app.sim.tick(dt); }
  const summitOk = app.sim.continueToSummit();
  let g=0; while(g++<60000){ app.sim.tick(dt);
    const b=s.enemies.find(e=>e.typeId==='boss_split'&&e.alive);
    if(b && b.pathIndex>=Math.floor(s.map.path.length*0.35)) break;
    if(s.status!=='playing') break; }
  const before=s.enemies.find(e=>e.typeId==='boss_split'&&e.alive);
  s.lives=9999;
  boss.ultReadyAt = s.clock;                     // arm the ultimate now
  const fired = app.sim.castUltimate();          // FULL-MAP shield-piercing nuke
  // expand the cast FX to a dramatic mid-animation frame (ring grown, flash visible)
  const fx = s.effects.find(e=>e.kind==='ultimate'); if(fx) fx.age = fx.ttl*0.35;
  s.selected={kind:null,id:null};
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { fired, summitOk, bossWasOnBoard: !!before, hadFx: !!fx, wave:s.wave.index, banked:s.publicWinBanked };
})()`);
console.log('03 ultimate firing:', JSON.stringify(c3));
check(c3.bossWasOnBoard, '03: the secret split boss was on the board when the ultimate fired');
check(c3.fired, '03: castUltimate() actually fired the nuke');
check(c3.hadFx, '03: the full-map cast FX (flash + ring) is present in the frame');
await snap(page, '03-ultimate-firing.png');

// ============================================================ 04 — ENDGAME PRESSURE (enemies near the goal)
await page.evaluate(FRESH);
const c4 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs;
  s.coins=1e9; s.lives=9999;                     // survive leaks so we can frame the pressure
  s.config.waves.prepMs=120; s.config.waves.betweenWaveMs=400;
  // a LIGHT, front-loaded defense only (towers near the spawn half) so surged late
  // enemies survive and march on the goal — the risen V2.1 curve made visible.
  const {path,buildable}=s.map; const half=Math.floor(path.length*0.45); let placed=0;
  for(let i=0;i<half;i++){ const pt=path[i]; for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){ const x=pt.x+dx,y=pt.y+dy;
    if(buildable[y]&&buildable[y][x]&&app.sim.canPlace(x,y)){ app.sim.gridClick(x+0.5,y+0.5);
      if(s.placement){ s.placement.towerType='basic'; app.sim.placementPlace(); placed++; } break; } }
    if(placed>=7) break; }
  s.selected={kind:null,id:null};
  // jump to the end of wave 12 so the next ticks roll into the late wave 13
  s.wave.index=12; s.wave.phase='complete'; s.wave.phaseClock=1e9;
  const last=s.map.path.length-1; let g=0, deepest=0, reached=0;
  // capture the FIRST moment a leader actually reaches the GOAL tile (the wall the old
  // game never let enemies near). A trailing column proves the sustained late pressure.
  while(g++<60000){ app.sim.tick(dt);
    for(const ev of s.frameEvents) if(ev.type==='enemy:reachEnd') reached++;
    let md=0; for(const e of s.enemies){ if(e.alive && !e.reachedGoal){ const d=e.dir===-1?(last-e.pathIndex):e.pathIndex; if(d>md) md=d; } }
    if(md>deepest) deepest=md;
    if(s.wave.index>=13 && reached>=1 && md>=last-3) break;
    if(s.status!=='playing') break; }
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  const alive=s.enemies.filter(e=>e.alive&&!e.reachedGoal);
  return { wave:s.wave.index, last, deepest, reached, aliveCount:alive.length };
})()`);
console.log('04 endgame pressure:', JSON.stringify(c4));
check(c4.wave >= 13 && c4.wave <= 15, '04: a late wave (13-15) is active');
check(c4.reached >= 1, '04: enemies actually REACHED the goal tile (the risen-curve pressure)');
check(c4.deepest >= c4.last - 3, '04: a leader is right at the END tile (deepest within 3 of the goal)');
await snap(page, '04-endgame-pressure.png');

// ============================================================ 05 — SUMMIT WON (defeat the split boss)
await page.evaluate(FRESH);
const c5 = await page.evaluate(`(()=>{
  const app=window.__app; app.stop(); app.sim.restart({seed:1, mapIndex:0});
  const sim=app.sim, s=sim.state;
  const bot=new window.__h.Bot(sim);
  const policy=window.__h.POLICIES.optimal({ ultimate:true });   // wields the boss-tower nuke
  const dt=app.cfg.timestepMs;
  let acc=0, summited=false;
  for(let t=0;t<40*60*1000;t+=dt){
    sim.tick(dt);
    acc+=dt;
    if(acc>=500){ acc=0; if(s.status==='playing') policy.onDecision(bot); }
    if(s.status==='won' && !summited){ if(sim.continueToSummit()){ summited=true; continue; } }
    if(s.status==='won' || s.status==='lost') break;
  }
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { status:s.status, summitWon:s.summitWon, publicWinBanked:s.publicWinBanked,
           finalWave:s.wave.index, lives:s.lives, stars:s.stars, summited };
})()`);
console.log('05 summit run:', JSON.stringify(c5));
check(c5.publicWinBanked, '05: the public win (wave 15) was banked');
check(c5.summited, '05: the wave-16 summit dare was taken');
check(c5.summitWon, '05: the secret split boss was DEFEATED (state.summitWon latched)');
check(c5.status === 'won', '05: the run terminates as a WIN (the SUMMIT_WON overlay)');
check(c5.lives > 0, '05: won with lives to spare');
await snap(page, '05-summit-won.png');

page.close();
await chrome.kill(); await server.close();

console.log('\nV2.1 CAPTURE DONE.');
if (errors.length) { console.log('CONSOLE ERRORS (' + errors.length + '):'); errors.forEach(e => console.log('  ' + e)); }
if (fails.length) { console.error('PRECONDITION FAILURES (' + fails.length + '):'); fails.forEach(f => console.error('  ' + f)); }
process.exit(errors.length || fails.length ? 1 : 0);
