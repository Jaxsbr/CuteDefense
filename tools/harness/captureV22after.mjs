// V2.2 AFTER-state capture harness — snapshots the boss-tower surfaces AFTER the
// V2.2 boss-tower rework, mirroring captureV22before.mjs 1:1 so each after/ PNG pairs
// with its before/ sibling. Drives the LIVE V2 app over CDP against the static server
// (same pattern as captureV21 / captureV22before / captureSecretWave). Saves PNGs to
// v2/captures/v2.2/after/.
// CAPTURES ONLY — never edits sim/render/config/test code; it stages live state via the
// public command API + faithful Bot, then screenshots the renderer.
//
//   01 boss-l1-on-board        the 2x2 boss tower on the board at LEVEL 1 — the NEW soft
//                              orchid / gold-crown look (vs the old obsidian fortress)
//   02 boss-l2-upgraded        the SAME boss after its single upgrade (LEVEL 2) — visibly
//                              bolder / more intense L2 look
//   03 special-beam-firing     the NEW special: a SINGLE-TARGET aimed BEAM/LASER streaming
//                              onto one enemy, captured mid-DoT (not the old full-map AoE)
//   04 basic-attack-projectile the boss tower's BASIC attack projectile in flight — now
//                              ~2x larger (size 28) than the old baseline
//   05 bug-tray-cost-overlap   FIXED: the boss cost (750) reads in full, clear of its icon
//                              in the LEFT build/ability tray (no more "50" overlap)
//   06 bug-placement-overlap   FIXED: the boss cost (750) on the tower-PLACEMENT popup
//                              buy-button sits clear, no overflow
//   07 special-name-beam-hud   the ability/HUD with the special's NEW name visible —
//                              dock "Beam!" + card "Boss Beam READY" (renamed off "Blast")
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

// Load the faithful Bot harness straight from the served source tree (same as
// captureV22before) so the boss is placed via the real public popup path, and add a
// helper that drops a 2x2 boss tower on the free block CLOSEST to board centre.
await page.evaluate(`(async()=>{
  const h = await import('/tools/balance/harness.mjs');
  const p = await import('/tools/balance/policies.mjs');
  window.__h = { Bot: h.Bot, POLICIES: p.POLICIES };
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
const haveBot = await page.evaluate('!!(window.__h && window.__h.Bot)');
check(haveBot, 'loaded the Bot harness + __placeBossCentral into the page');

// Shared: fresh playing state on a known seed/map, app RAF stopped (we drive by hand).
const FRESH = `(()=>{ const app=window.__app; app.stop(); app.sim.restart({seed:1, mapIndex:0}); return true; })()`;

// Place a boss tower (2x2) via the faithful Bot, then ring it with a handful of
// upgraded single-tile towers so the 2x2 footprint reads by direct size contrast.
// Returns the boss id/level. (Mirrors captureV22before's PLACE_BOSS_AND_CONTEXT.)
const PLACE_BOSS_AND_CONTEXT = `(()=>{
  const app=window.__app, s=app.sim.state;
  s.coins=1e9; s.lives=18;
  const boss=window.__placeBossCentral();
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
  return { bossId: boss?boss.id:null, bossLevel: boss?boss.level:null, placed };
})()`;

// ============================================================ 01 — BOSS at LEVEL 1 (new soft look)
await page.evaluate(FRESH);
const c1 = await page.evaluate(`(()=>{
  const r = (${PLACE_BOSS_AND_CONTEXT});
  const app=window.__app, s=app.sim.state;
  s.selected={kind:'tower', id:r.bossId};        // show the L1 boss card
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return r;
})()`);
console.log('01 boss L1:', JSON.stringify(c1));
check(c1.bossId != null, '01: a boss tower was placed');
check(c1.bossLevel === 1, '01: boss is LEVEL 1');
await snap(page, '01-boss-l1-on-board.png');

// ============================================================ 02 — BOSS at LEVEL 2 (upgraded, bolder)
const c2 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state;
  const boss=s.towers.find(t=> app.sim.config.towers[t.typeId]?.kind==='boss');
  s.selected={kind:'tower', id:boss.id};
  const ok=app.sim.upgradeSelected();            // L1 -> L2
  boss.ultReadyAt = s.clock;                      // off cooldown so the look reads "armed"
  s.status='playing';
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { upgraded:ok, level:boss.level };
})()`);
console.log('02 boss L2:', JSON.stringify(c2));
check(c2.level === 2, '02: boss upgraded to LEVEL 2');
await snap(page, '02-boss-l2-upgraded.png');

// ============================================================ 03 — NEW SPECIAL: single-target BEAM firing (mid-DoT)
await page.evaluate(FRESH);
const c3 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs;
  s.coins=1e9; s.lives=9999;
  s.config.waves.prepMs=80; s.config.waves.betweenWaveMs=80; s.config.waves.spawnIntervalMs=200;
  // build + upgrade the boss tower (the beam's owner) with context defenders
  const r=(${PLACE_BOSS_AND_CONTEXT});
  const boss=s.towers.find(t=> app.sim.config.towers[t.typeId]?.kind==='boss');
  s.selected={kind:'tower', id:boss.id}; app.sim.upgradeSelected();   // -> L2 special unlocked
  s.selected={kind:null,id:null};
  // roll a normal wave so the board has enemies for the beam to lock onto
  s.wave.index=3; s.wave.phase='complete'; s.wave.phaseClock=1e9;
  let g=0, target=null;
  const bx=boss.x, by=boss.y;
  const dist=(e)=>Math.hypot(e.x-bx, e.y-by);
  while(g++<60000){ app.sim.tick(dt);
    for(const e of s.enemies){ if(e.alive){ e.hp=1e12; e.maxHp=1e12; } }  // invincible: the beam STREAMS (we're not proving the kill)
    // pick an enemy well ONTO the board AND clearly separated from the fortress so the
    // beam reads as a distinct streaming line, not a stub hidden behind the tower.
    const cands=s.enemies.filter(e=>e.alive&&!e.reachedGoal&&e.pathIndex>=4&&dist(e)>=3).sort((a,b)=>dist(b)-dist(a));
    if(cands.length){ target=cands[0]; break; }
    if(s.status!=='playing') break; }
  // arm + fire the NEW aimed beam at the chosen single target
  boss.ultReadyAt = s.clock;
  const fired = target ? app.sim.castUltimate(target) : false;
  // advance to MID-DoT so the streaming beam + impact glow are clearly mid-animation,
  // keeping the target alive so the beam doesn't drop before we snap it.
  let mid=0;
  if(fired){ const want=1100; let acc=0;
    while(acc<want && s.beams.length){ app.sim.tick(dt); acc+=dt;
      for(const e of s.enemies){ if(e.alive){ e.hp=1e12; e.maxHp=1e12; } } }
    const beam=s.beams.find(b=>b.targetId===target.id); mid=beam?+beam.age.toFixed(0):0; }
  const beamNow=s.beams[0]||null;
  s.selected={kind:null,id:null};
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { fired, hadTarget:!!target, beamCount:s.beams.length, beamAge:mid,
           beamHasLine: beamNow ? (Math.hypot(beamNow.tx-beamNow.x, beamNow.ty-beamNow.y).toFixed(2)) : null,
           level:boss.level };
})()`);
console.log('03 special beam:', JSON.stringify(c3));
check(c3.level === 2, '03: boss is L2 (special unlocked)');
check(c3.hadTarget, '03: a single enemy target was on the board for the beam to lock onto');
check(c3.fired, '03: castUltimate(target) fired the aimed single-target beam');
check(c3.beamCount >= 1, '03: a beam is active in state.beams (streaming)');
check(c3.beamAge > 0 && c3.beamAge < 2500, '03: the beam was captured MID-DoT (0 < age < durationMs)');
check(c3.beamHasLine != null && Number(c3.beamHasLine) >= 3, '03: the beam spans a visible line from tower to target');
await snap(page, '03-special-blast-firing.png');  // before-paired filename; content is the NEW beam

// ============================================================ 04 — BASIC ATTACK PROJECTILE in flight (~2x larger)
await page.evaluate(FRESH);
const c4 = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, dt=app.cfg.timestepMs;
  s.coins=1e9; s.lives=9999;
  s.config.waves.prepMs=80; s.config.waves.betweenWaveMs=80; s.config.waves.spawnIntervalMs=200;
  // ONLY the boss tower on the board, so any projectile in flight is unambiguously the
  // boss's BASIC attack. Upgrade to L2 for the slightly faster fire rate (sooner shot).
  const boss=window.__placeBossCentral();
  s.selected={kind:'tower', id:boss.id}; app.sim.upgradeSelected();
  s.selected={kind:null,id:null};
  s.status='playing';
  s.wave.index=3; s.wave.phase='complete'; s.wave.phaseClock=1e9;
  const bx=boss.x, by=boss.y;
  const dist=(p)=>Math.hypot(p.x-bx, p.y-by);
  // Capture the boss BASIC shot well into its flight (dist >= 6 AND a built-up trail) so
  // the size-28 trail reads as a FAT orchid streak — the visible "~2x larger" signal (the
  // body sprite is baked per-kind, so the size lives in the streaming trail thickness).
  let g=0, captured=null;
  while(g++<60000){ app.sim.tick(dt);
    for(const e of s.enemies){ if(e.alive){ e.hp=1e12; e.maxHp=1e12; } }  // keep targets alive so a shot stays in flight
    const proj = s.projectiles.filter(p=>dist(p)>=6 && p.trail && p.trail.length>=4).sort((a,b)=>dist(b)-dist(a))[0];
    if(proj){ captured={ kind:proj.kind, size:proj.size, color:proj.color, trail:proj.trail.length, dist:+dist(proj).toFixed(2), x:+proj.x.toFixed(2), y:+proj.y.toFixed(2) }; break; }
    if(s.status!=='playing') break; }
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { projCount:s.projectiles.length, boss:{x:+bx.toFixed(2),y:+by.toFixed(2)}, captured,
           cfgSize: app.sim.config.towers.boss.projectile.size };
})()`);
console.log('04 basic projectile:', JSON.stringify(c4));
check(c4.projCount >= 1, '04: a boss BASIC projectile is in flight');
check(c4.captured && c4.captured.kind === 'single', '04: it is a single (non-bomb) basic projectile');
check(c4.cfgSize >= 24, '04: the boss basic projectile is the new ~2x-larger size (>=24)');
await snap(page, '04-basic-attack-projectile.png');

// ============================================================ 05 — FIXED: tray cost reads in full (750), clear of icon
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
check(c5.bossCost === 750, '05: the boss tray cost is its full value 750');
check(c5.costMinFontPx >= 13, '05: tray cost has a kid-legible auto-shrink floor');
await snap(page, '05-bug-tray-cost-overlap.png');

// ============================================================ 06 — FIXED: placement buy-button cost (750), no overflow
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
check(c6.towerType === 'boss', '06: the popup is showing the BOSS tower');
check(c6.cost === 750, '06: the buy-button cost is its full value 750');
await snap(page, '06-bug-placement-overlap.png');

// ============================================================ 07 — NEW special NAME in HUD ("Boss Beam" / "Beam!")
await page.evaluate(FRESH);
const c7 = await page.evaluate(`(()=>{
  const r=(${PLACE_BOSS_AND_CONTEXT});
  const app=window.__app, s=app.sim.state;
  const boss=s.towers.find(t=> app.sim.config.towers[t.typeId]?.kind==='boss');
  s.selected={kind:'tower', id:boss.id};
  app.sim.upgradeSelected();                      // -> L2: card shows "Boss Beam READY"
  boss.ultReadyAt = s.clock;                       // ready -> dock button shows "Beam!"
  s.status='playing';
  app.renderer.render(s); app.ctx.getImageData(0,0,1,1);
  return { level:boss.level, ultName: app.sim.config.towers.boss.ultimate.name };
})()`);
console.log('07 special name:', JSON.stringify(c7));
check(c7.level === 2, '07: boss is L2 (special unlocked, name shown)');
check(c7.ultName === 'Boss Beam', '07: the special name is the renamed "Boss Beam" (off "Blast")');
check(!/blast/i.test(c7.ultName), '07: the name no longer contains "Blast"');
await snap(page, '07-special-name-blast-hud.png');  // before-paired filename; content is the NEW "Boss Beam" name

page.close();
await chrome.kill(); await server.close();

console.log('\nV2.2 AFTER CAPTURE DONE.');
if (errors.length) { console.error('CONSOLE ERRORS (' + errors.length + '):'); errors.forEach(e => console.error('  ' + e)); }
if (fails.length) { console.error('PRECONDITION FAILURES (' + fails.length + '):'); fails.forEach(f => console.error('  ' + f)); }
process.exit(errors.length || fails.length ? 1 : 0);
