/**
 * W8 — BOSS TOWER (the 3rd tower type + its manual ultimate). MECHANISM only;
 * the tuned ultimate/boss numbers + the winnable-summit reversal land in B5/B6.
 *
 * These tests drive the REAL Simulation / towerSystem / enemySystem headlessly:
 *   - 2x2 multi-tile placement (footprint reserves + occupies 4 tiles; center at
 *     anchor + 1.0; canPlace rejects out-of-bounds / non-buildable / occupied cells;
 *     towerAt selects the boss from ANY of its 4 cells).
 *   - full-map range (a boss in one corner damages an enemy in the far corner).
 *   - slow fire rate (a heavy, occasional plink, not a DPS workhorse).
 *   - single upgrade caps at L2 (L1->L2 succeeds, past L2 fails; no fork arms).
 *   - the manual ULTIMATE: gated (locked at L1 / illegal while not playing / on
 *     per-tower cooldown; legal at L2 off-cooldown), emits EV.ULTIMATE_CAST, and
 *     PIERCES shields (a shielded boss_splitling takes damage during its shield).
 *   - harness helpers placeBoss / castUltimate / ultimateReady mirror freeze.
 *
 * PARITY: this batch must NOT make the standard kit beat the secret split boss
 * (that reversal is B5/B6). The summitConqueror policy here only proves the
 * MECHANISM is reachable (a boss is built, upgraded, and its ultimate cast).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import {
  placeTower, canPlace, towerAt, upgradeTower, effectiveStats, footprintOf, forkArmsFor,
} from '../../v2/sim/systems/towerSystem.js';
import { spawnEnemy, damageEnemy } from '../../v2/sim/systems/enemySystem.js';
import { EV } from '../../v2/sim/events.js';
import { Bot } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';

// A wide-open arena so a 2x2 footprint always has room and full-map range is easy
// to exercise. Single short path along row 5 so towers can sit off it.
const ARENA = {
  name: 'Arena',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', 'S####################E',
    '......................', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function arenaConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [ARENA];
  c.lives.max = 100000;
  c.economy.startingCoins = 1e9;
  // Effectively-infinite prep so NO wave ever spawns/completes: status stays
  // 'playing' for the whole test while we drive our OWN enemies. (A finishing wave
  // would flip status to 'won' and gate the ultimate, which is legal only while playing.)
  c.waves.firstPrepMs = 10 * 60 * 1000; c.waves.prepMs = 10 * 60 * 1000; c.waves.betweenWaveMs = 999999;
  c.waves.patterns = [{ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }];
  return c;
}
function mkSim() { const s = new Simulation(arenaConfig(), { seed: 5, mapIndex: 0 }); s.startGame(); return s; }
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }

// ==========================================================================
// 0. CONFIG — the boss tower block exists and is shaped per the spec.
// ==========================================================================
test('W8 config — towers.boss is a 2x2, full-map, 2-level type with an ultimate sub-block', () => {
  const b = CONFIG.towers.boss;
  assert.ok(b, 'towers.boss exists');
  assert.equal(b.kind, 'boss', 'kind is boss');
  assert.equal(b.footprint, 2, 'footprint 2 (2x2)');
  assert.equal(b.fullMap, true, 'fullMap true');
  assert.equal(b.levels.length, 2, 'exactly 2 levels (single upgrade)');
  assert.ok(!b.forks, 'boss has no fork arms');
  // V3 economy nerf — the boss is a DELIBERATE late-game investment (~1250 to L2).
  assert.ok(b.levels[0].cost >= 700, 'L1 boss is a deliberate late-game investment');
  assert.ok(b.levels[1].cost >= 450, 'L2 upgrade is a real second sink');
  assert.ok(b.levels[0].cost + b.levels[1].cost >= 1100, 'total-to-ultimate ~1250 (~2.3x the old 550)');
  assert.ok(b.levels[0].fireRateMs >= 3000, 'L1 fire rate is SLOW (a heavy plink)');
  assert.equal(b.levels[0].ultimate ?? false, false, 'L1 ultimate LOCKED');
  assert.equal(b.levels[1].ultimate, true, 'L2 ultimate UNLOCKED');
  // V2.2 — the ultimate is an aimed single-target BEAM (a DoT block), not a flat nuke.
  const u = b.ultimate;
  assert.equal(u.damage, undefined, 'no flat full-map damage field (replaced by the beam DoT)');
  assert.ok(u.beam && u.beam.totalDamage > 0, 'ultimate.beam.totalDamage configured');
  assert.ok(u.beam.durationMs > 0 && u.beam.tickMs > 0, 'beam DoT cadence configured');
  assert.equal(u.requireTarget, true, 'aim-confirm: a cast needs a target');
  assert.ok(typeof u.cooldownMs === 'number' && u.cooldownMs >= 7000, 'ultimate.cooldownMs is LONG (no spam; well above the old 5000)');
  assert.equal(u.piercesShield, true, 'ultimate pierces shields');
});

// ==========================================================================
// 1. FOOTPRINT — 2x2 placement occupies 4 tiles; selection + collision.
// ==========================================================================
test('W8 footprint — placing a boss reserves & occupies a 2x2 block', () => {
  const sim = mkSim(); const s = sim.state;
  const t = placeTower(s, 3, 3, 'boss');
  assert.ok(t, 'boss placed');
  assert.equal(footprintOf(s.config, 'boss'), 2, 'footprintOf(boss) = 2');
  // anchor stored as top-left; center at anchor + 1.0 (the shared 2x2 corner)
  assert.equal(t.gx, 3); assert.equal(t.gy, 3);
  assert.equal(t.x, 4); assert.equal(t.y, 4);
  // towerAt returns the boss for ALL four cells (tap any cell selects it)
  for (const [cx, cy] of [[3, 3], [4, 3], [3, 4], [4, 4]]) {
    assert.equal(towerAt(s, cx, cy)?.id, t.id, `cell ${cx},${cy} selects the boss`);
  }
  // a cell outside the footprint is NOT the boss
  assert.equal(towerAt(s, 5, 5), null, 'a cell past the footprint is empty');
});

test('W8 footprint — canPlace validates ALL four cells', () => {
  const sim = mkSim(); const s = sim.state;
  // happy path
  assert.equal(canPlace(s, 3, 3, 'boss'), true, 'open 2x2 is placeable');
  // occupy one cell with a basic tower, then a boss overlapping it must fail
  placeTower(s, 4, 3, 'basic');
  assert.equal(canPlace(s, 3, 3, 'boss'), false, 'a boss overlapping an existing tower is rejected');
  // out of bounds: anchor near the bottom-right edge so the 2x2 leaves the board
  const { cols, rows } = s.map;
  assert.equal(canPlace(s, cols - 1, 3, 'boss'), false, 'a 2x2 off the right edge is rejected');
  assert.equal(canPlace(s, 3, rows - 1, 'boss'), false, 'a 2x2 off the bottom edge is rejected');
  // a path tile is non-buildable: row 5 is the path -> a boss spanning it fails
  assert.equal(canPlace(s, 3, 4, 'boss'), false, 'a 2x2 spanning the (non-buildable) path is rejected');
});

test('W8 footprint — a single-tile tower is unaffected (fp defaults to 1)', () => {
  const sim = mkSim(); const s = sim.state;
  const t = placeTower(s, 2, 2, 'basic');
  assert.equal(footprintOf(s.config, 'basic'), 1, 'basic footprint = 1');
  assert.equal(t.x, 2.5); assert.equal(t.y, 2.5);  // unchanged cellCenter
  assert.equal(towerAt(s, 2, 2)?.id, t.id);
  assert.equal(towerAt(s, 3, 2), null, 'neighbour cell is not the basic tower');
});

// ==========================================================================
// 2. FULL-MAP RANGE — sees the whole board.
// ==========================================================================
test('W8 full-map range — effectiveStats spans the whole board', () => {
  const sim = mkSim(); const s = sim.state;
  const t = placeTower(s, 1, 1, 'boss');
  const st = effectiveStats(s, t);
  assert.ok(st.range >= s.map.cols + s.map.rows - 1, `boss range (${st.range}) spans the board`);
  // basic stays finite/local
  const b = placeTower(s, 8, 1, 'basic');
  assert.ok(effectiveStats(s, b).range < 6, 'basic range stays local');
});

test('W8 full-map range — a corner boss damages an enemy in the far corner', () => {
  const sim = mkSim(); const s = sim.state;
  placeTower(s, 1, 1, 'boss');   // top-left corner
  // a target far away (bottom row), held still
  const e = spawnEnemy(s, { typeId: 'strong', hp: 1000, speed: 0, reward: 0 });
  e.pathIndex = 0; e.progress = 0; e.x = 20; e.y = 10; e.maxHp = 1000;
  const hp0 = e.hp;
  advance(sim, 8000);   // a few slow plinks + travel time
  assert.ok(e.hp < hp0, `far-corner enemy took boss damage (${e.hp} < ${hp0})`);
});

// ==========================================================================
// 3. SLOW FIRE RATE — heavy occasional plink, not a DPS workhorse.
// ==========================================================================
test('W8 slow fire — the boss fires at most about once per (slow) fireRateMs', () => {
  const sim = mkSim(); const s = sim.state;
  const t = placeTower(s, 1, 1, 'boss');
  const e = spawnEnemy(s, { typeId: 'strong', hp: 1e9, speed: 0, reward: 0 });
  e.x = 15; e.y = 8; e.maxHp = 1e9;
  let fires = 0;
  sim.bus.on(EV.PROJECTILE_FIRE, ({ towerId }) => { if (towerId === t.id) fires++; });
  const windowMs = 20000;
  advance(sim, windowMs);
  const fr = s.config.towers.boss.levels[0].fireRateMs;
  const maxExpected = Math.ceil(windowMs / fr) + 1;   // +1 for the immediate first shot
  assert.ok(fires > 0, 'the boss does plink');
  assert.ok(fires <= maxExpected, `slow fire: ${fires} shots <= ~${maxExpected} over ${windowMs}ms`);
});

// ==========================================================================
// 4. SINGLE UPGRADE — caps at L2, no fork arms.
// ==========================================================================
test('W8 upgrade — L1->L2 succeeds, past L2 fails; no fork arms', () => {
  const sim = mkSim(); const s = sim.state;
  placeTower(s, 3, 3, 'boss');
  assert.equal(upgradeTower(s, 3, 3), 2, 'L1 -> L2');
  assert.equal(towerAt(s, 3, 3).level, 2, 'now level 2');
  assert.equal(upgradeTower(s, 3, 3), false, 'cannot upgrade past L2');
  assert.equal(towerAt(s, 4, 4).level, 2, 'selecting via another footprint cell sees L2 too');
  assert.deepEqual(forkArmsFor(s.config, 'boss'), [], 'boss has no fork arms');
});

test('W8 upgrade — basic/strong cap unchanged (still 3 levels)', () => {
  const sim = mkSim(); const s = sim.state;
  placeTower(s, 2, 2, 'basic');
  assert.equal(upgradeTower(s, 2, 2), 2);
  assert.equal(upgradeTower(s, 2, 2), 3);
  assert.equal(upgradeTower(s, 2, 2), false, 'basic still caps at L3');
});

// ==========================================================================
// 5. THE MANUAL ULTIMATE — gated like Freeze; pierces shields.
// ==========================================================================
test('W8 ultimate — gated: locked at L1, on cooldown, illegal while not playing', () => {
  const sim = mkSim(); const s = sim.state;
  placeTower(s, 3, 3, 'boss');           // L1 -> ultimate LOCKED
  // a live target so only the GATE (not aim-confirm) is under test
  const mkTarget = () => { const e = spawnEnemy(s, { typeId: 'strong', hp: 1e9, speed: 0, reward: 0 }); e.x = 16; e.y = 8; e.maxHp = 1e9; return e; };
  assert.equal(sim.ultimateReady(), false, 'L1: ultimate locked');
  assert.equal(sim.castUltimate(mkTarget()), false, 'L1: cannot cast even with a target');
  upgradeTower(s, 3, 3);                  // L2 -> unlocked
  // first cast is ready a fraction in
  advance(sim, s.config.towers.boss.ultimate.cooldownMs);  // ensure off any initial cooldown
  assert.equal(sim.ultimateReady(), true, 'L2 off-cooldown: ready');
  assert.equal(sim.castUltimate(mkTarget()), true, 'L2 off-cooldown: casts at a target');
  assert.equal(sim.ultimateReady(), false, 'right after a cast: on its per-tower cooldown');
  assert.equal(sim.castUltimate(mkTarget()), false, 'cannot re-cast during cooldown');
  // illegal while paused
  advance(sim, s.config.towers.boss.ultimate.cooldownMs);
  sim.togglePause();
  assert.equal(s.status, 'paused');
  assert.equal(sim.castUltimate(mkTarget()), false, 'illegal while not playing');
});

// V2.2 REVERSAL — the old "damages ALL alive enemies" AoE contract is DELETED. The
// beam is SINGLE-TARGET: it damages ONLY the aimed enemy (over time), still piercing
// shields. Other alive enemies are untouched.
test('W8 ultimate — emits EV.ULTIMATE_CAST and damages ONLY the aimed enemy, PIERCING shields', () => {
  const sim = mkSim(); const s = sim.state;
  placeTower(s, 3, 3, 'boss');
  upgradeTower(s, 3, 3);   // L2
  advance(sim, s.config.towers.boss.ultimate.cooldownMs);

  // a shielded boss shard with its shield ACTIVE (normally immune to fire) = the target
  const shard = spawnEnemy(s, { typeId: 'boss_splitling', hp: 1e9, speed: 0, reward: 0 });
  shard.x = 18; shard.y = 9; shard.maxHp = 1e9;
  shard.bs.shieldActive = true; shard.bs.shieldEndsAt = s.clock + 1e9;
  // a bystander enemy that must NOT be hit (single-target)
  const bystander = spawnEnemy(s, { typeId: 'strong', hp: 1e9, speed: 0, reward: 0 });
  bystander.x = 8; bystander.y = 7; bystander.maxHp = 1e9;
  const by0 = bystander.hp;
  // sanity: ordinary fire is blocked by the active shield
  assert.equal(damageEnemy(s, shard, 100, { sourceType: 'basic' }), false, 'shield blocks ordinary fire');
  const before = shard.hp;

  let cast = 0; sim.bus.on(EV.ULTIMATE_CAST, () => cast++);
  assert.equal(sim.castUltimate(shard), true, 'ultimate casts at the chosen target');
  assert.equal(cast, 1, 'EV.ULTIMATE_CAST emitted once');
  assert.ok(s.frameEvents.some(e => e.type === EV.ULTIMATE_CAST), 'frameEvent recorded');
  advance(sim, s.config.towers.boss.ultimate.beam.durationMs + 500);   // let the DoT run
  assert.ok(shard.hp < before, `the SHIELDED shard took beam DoT (${shard.hp} < ${before}) -> shield pierced`);
  assert.equal(bystander.hp, by0, 'the bystander enemy is UNTOUCHED (single-target, no AoE)');
  const total = s.config.towers.boss.ultimate.beam.totalDamage;
  assert.ok(Math.abs((before - shard.hp) - total) < total * 0.02, 'dealt ~beam.totalDamage over the window (affinity-neutral)');
});

// ==========================================================================
// 6. HARNESS helpers — placeBoss / castUltimate / ultimateReady mirror freeze.
// ==========================================================================
test('W8 harness — Bot.placeBoss reserves a 2x2 and the ultimate helpers work', () => {
  const sim = mkSim();
  const bot = new Bot(sim);
  const placed = bot.placeBoss();
  assert.ok(placed, 'placeBoss found a free 2x2 and built the boss');
  const boss = sim.state.towers.find(t => sim.config.towers[t.typeId].kind === 'boss');
  assert.ok(boss, 'a boss tower now stands');
  // 2x2 occupied
  assert.equal(towerAt(sim.state, boss.gx + 1, boss.gy + 1)?.id, boss.id);
  // upgrade to unlock, then cast through the bot at a live target
  bot.selectTower(boss); sim.upgradeSelected();
  advance(sim, sim.config.towers.boss.ultimate.cooldownMs);
  const e = spawnEnemy(sim.state, { typeId: 'strong', hp: 1e9, speed: 0, reward: 0 });
  e.x = 16; e.y = 8; e.maxHp = 1e9;
  assert.equal(bot.ultimateReady(), true, 'bot.ultimateReady mirrors sim');
  assert.equal(bot.castUltimate(), false, 'bot.castUltimate with no target -> no cast (aim-confirm)');
  assert.equal(bot.castUltimate(e.id), true, 'bot.castUltimate casts at a target id');
});

// ==========================================================================
// 7. summitConqueror — proves the MECHANISM is reachable (NOT a win; B5/B6
// ship the winnable reversal). Ladder bots 1-4 stay boss-UNAWARE.
// ==========================================================================
test('W8 ladder bots stay boss-UNAWARE (never build the boss tower)', () => {
  // the four ladder policies must never select the boss type, so the public
  // ladder + secret-boss margins are unchanged by W8.
  for (const name of ['unfocused', 'spread', 'saveUpgrade', 'optimal']) {
    const sim = new Simulation(CONFIG, { seed: 3, mapIndex: 0 });
    sim.startGame();
    const bot = new Bot(sim);
    const policy = POLICIES[name]();
    const dt = sim.config.timestepMs;
    let acc = 0;
    for (let t = 0; t < 6 * 60 * 1000; t += dt) {
      sim.tick(dt);
      acc += dt;
      if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
      if (sim.state.status === 'won' || sim.state.status === 'lost') break;
    }
    const builtBoss = sim.state.towers.some(t => sim.config.towers[t.typeId].kind === 'boss');
    assert.equal(builtBoss, false, `${name} never builds a boss tower`);
  }
});

test('W8 summitConqueror — builds + upgrades a boss and casts the ultimate (mechanism reachable)', () => {
  assert.ok(POLICIES.summitConqueror, 'summitConqueror policy exists');
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = POLICIES.summitConqueror();
  const dt = sim.config.timestepMs;
  let casts = 0; sim.bus.on(EV.ULTIMATE_CAST, () => casts++);
  let acc = 0, summited = false;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing' && policy.onDecision) policy.onDecision(bot); }
    if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    if (sim.state.status === 'lost') break;
    if (sim.state.status === 'won' && summited && casts > 0 && sim.state.wave.index > CONFIG.waves.patterns.length - 1) {
      // mechanism exercised; no need to run the whole budget
    }
  }
  assert.equal(sim.state.publicWinBanked, true, 'summitConqueror still banks the public win (ladder unchanged)');
  const builtBoss = sim.state.towers.some(t => sim.config.towers[t.typeId].kind === 'boss');
  assert.equal(builtBoss, true, 'summitConqueror builds the boss tower for the summit');
  assert.ok(casts > 0, 'summitConqueror casts the ultimate at least once');
  // V2.2 — the LONG-cooldown aim-confirm beam lands a BOUNDED number of casts (no spam):
  // ~2-3 per parent crossing, never the old 5+. This is the "not a faceroll" half.
  assert.ok(casts <= 6, `summitConqueror casts a bounded number of beams (got ${casts}, must be <= 6 — no spam)`);
  // PARITY: the standard reversal (a WIN over the split boss) is B5/B6 — NOT asserted here.
});
