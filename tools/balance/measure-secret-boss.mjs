/**
 * measure-secret-boss.mjs — empirical tuning for the SECRET WAVE 16 boss.
 *
 * Drives strong-player games to wave 16 and measures the MAXIMUM damage any
 * current tower build lands on the split boss while it crosses the map. The
 * boss's HP must sit comfortably above that so it cannot be killed without the
 * (out-of-scope) boss-tower upgrades. Two scenarios:
 *
 *   A) OPTIMAL bot on the real maps (the realistic "strong player").
 *   B) A saturated manual loadout on a short straight line (worst-case DPS).
 *
 * Run: node tools/balance/measure-secret-boss.mjs
 */
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { Bot } from './harness.mjs';
import { POLICIES } from './policies.mjs';
import { EV } from '../../v2/sim/events.js';

const SECRET_INDEX = CONFIG.waves.patterns.length; // 16

// Track the wave-16 boss across a run: lowest HP it ever dropped to, whether it
// was killed, and whether it reached the goal.
function instrument(sim) {
  const rec = { spawned: false, maxHp: 0, minHp: Infinity, killed: false, reachedGoal: false, children: 0, childReachedGoal: 0, freezeCasts: 0 };
  const bossIds = new Set();
  const childIds = new Set();
  sim.bus.on(EV.FREEZE_CAST, () => rec.freezeCasts++);
  sim.bus.on(EV.ENEMY_SPAWN, ({ id }) => {
    const e = sim.state.enemies.find(x => x.id === id);
    if (!e) return;
    if (e.typeId === 'boss_split') { bossIds.add(id); rec.spawned = true; rec.maxHp = Math.max(rec.maxHp, e.maxHp); }
    if (e.typeId === 'boss_splitling') { childIds.add(id); rec.children++; }
  });
  sim.bus.on(EV.ENEMY_DEATH, ({ id }) => { if (bossIds.has(id)) rec.killed = true; });
  sim.bus.on(EV.ENEMY_REACH_END, ({ id }) => {
    if (bossIds.has(id)) rec.reachedGoal = true;
    if (childIds.has(id)) rec.childReachedGoal++;
  });
  return { rec, sampleBoss: () => { for (const e of sim.state.enemies) if (bossIds.has(e.id) && e.alive) rec.minHp = Math.min(rec.minHp, e.hp); } };
}

function runInstrumented(sim, makePolicy, { maxMs = 40 * 60 * 1000 } = {}) {
  const bot = new Bot(sim);
  const policy = makePolicy ? makePolicy(bot) : null;
  const { rec, sampleBoss } = instrument(sim);
  const dt = sim.config.timestepMs;
  let acc = 0, summited = false;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    sampleBoss();
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing' && policy?.onDecision) policy.onDecision(bot); }
    // P5 — the public win now fires at wave 15. Take the opt-in SUMMIT so the run
    // still reaches and measures the secret wave-16 boss (the margin must keep
    // measuring the REAL game, not stop at the public win).
    if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    // Once the boss is resolved (killed or reached the goal) the measurement is
    // complete; stop early so high-lives scenarios don't idle out the time budget.
    if (rec.reachedGoal || rec.killed) break;
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  const dmg = rec.minHp === Infinity ? 0 : rec.maxHp - rec.minHp;
  return { status: sim.state.status, finalWave: sim.state.wave.index, summited, ...rec, damageTaken: Math.round(dmg) };
}

// --- Scenario A: OPTIMAL bot on the real maps ---
console.log('\n=== Scenario A — OPTIMAL bot, real maps (realistic strong player) ===');
let peak = 0;
for (const mapIndex of [0, 1]) {
  for (const seed of [1, 2, 3, 7]) {
    const sim = new Simulation(CONFIG, { seed, mapIndex }); sim.startGame();
    const r = runInstrumented(sim, () => POLICIES.optimal());
    peak = Math.max(peak, r.damageTaken);
    console.log(`  map${mapIndex} seed${seed}: status=${r.status} finalWave=${r.finalWave} bossReachedGoal=${r.reachedGoal} bossKilled=${r.killed} maxHp=${Math.round(r.maxHp)} damageTaken=${r.damageTaken} freezeCasts=${r.freezeCasts}`);
  }
}

// --- Scenario A2 (P4 §5.5): fork-aware OPTIMAL with FREEZE DISABLED — the fork ALONE
// must not become "buy the win". Records the no-Freeze margin the spec gates at >= 3x. ---
console.log('\n=== Scenario A2 — fork-aware OPTIMAL, NO Freeze (P4 buy-the-win guard) ===');
let peakNoFreeze = 0;
for (const mapIndex of [0, 1]) {
  for (const seed of [1, 2, 3, 7]) {
    const sim = new Simulation(CONFIG, { seed, mapIndex }); sim.startGame();
    const r = runInstrumented(sim, () => POLICIES.optimal({ freeze: false }));
    peakNoFreeze = Math.max(peakNoFreeze, r.damageTaken);
    console.log(`  map${mapIndex} seed${seed}: status=${r.status} finalWave=${r.finalWave} bossKilled=${r.killed} damageTaken=${r.damageTaken} freezeCasts=${r.freezeCasts}`);
  }
}
peak = Math.max(peak, peakNoFreeze);

// --- Scenario B: saturated manual loadout on a short straight line (worst-case DPS) ---
console.log('\n=== Scenario B — saturated L3 loadout on a short straight line (worst-case DPS) ===');
const SHORT_MAP = { name: 'TestLine', grid: [
  '......................','......................','......................',
  '......................','......................','......................',
  'S####################E','......................','......................',
  '......................','......................','......................',
] };
function fastHeavyConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.waves.firstPrepMs = 100; c.waves.prepMs = 100; c.waves.betweenWaveMs = 50; c.waves.spawnIntervalMs = 120;
  c.economy.startingCoins = 1e9;
  c.lives.max = 100000; // don't lose to waves 1-15; we only care about the boss
  return c;
}
{
  const cfg = fastHeavyConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 }); sim.startGame();
  // Saturate both flanks of the path with L3 towers (max realistic firepower).
  for (const y of [5, 7]) for (let x = 1; x <= 20; x++) {
    if (!sim.canPlace(x, y)) continue;
    sim.state.placement = { gx: x, gy: y, towerType: y === 5 ? 'strong' : 'basic' };
    if (sim.placementPlace()) { sim.state.selected = { kind: 'tower', id: sim.towerAt(x, y).id }; sim.upgradeSelected(); sim.upgradeSelected(); }
  }
  console.log(`  towers placed: ${sim.state.towers.length} (all L3)`);
  const r = runInstrumented(sim, null);
  peak = Math.max(peak, r.damageTaken);
  console.log(`  status=${r.status} finalWave=${r.finalWave} bossReachedGoal=${r.reachedGoal} bossKilled=${r.killed} maxHp=${Math.round(r.maxHp)} damageTaken=${r.damageTaken}`);
}

// --- Scenario C (B5/B6 — THE WINNABLE-SUMMIT SEPARATION): the boss-tower ULTIMATE
// build WINS the summit, and the SAME kit WITHOUT the ultimate LOSES — on every
// map x seed. optimal({ultimate:true}) builds + upgrades the boss tower and times its
// flat, full-map, shield-piercing nuke against the split boss / its shards. This runs
// to the TRUE terminal (SUMMIT_WON) rather than stopping at the boss-crossing measure,
// and FAILS the script unless every map/seed separates (WITH = win+lives, WITHOUT = loss). ---
function runToTerminal(makePolicy, seed, mapIndex) {
  const sim = new Simulation(CONFIG, { seed, mapIndex }); sim.startGame();
  const bot = new Bot(sim);
  const policy = makePolicy(bot);
  const dt = sim.config.timestepMs;
  let ultCasts = 0; sim.bus.on(EV.ULTIMATE_CAST, () => ultCasts++);
  let summitWonEv = false; sim.bus.on(EV.SUMMIT_WON, () => summitWonEv = true);
  let acc = 0, summited = false;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing' && policy.onDecision) policy.onDecision(bot); }
    if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    if (summited && (sim.state.status === 'won' || sim.state.status === 'lost')) break;
    if (!summited && sim.state.status === 'lost') break;
  }
  return { status: sim.state.status, lives: sim.state.lives, summitWon: sim.state.summitWon, summitWonEv, ultCasts };
}

console.log('\n=== Scenario C — WINNABLE-SUMMIT SEPARATION (boss-tower BEAM) ===');
let allSeparate = true;
let castsInBudget = true;   // V2.2: the LONG-cooldown beam lands ~2-3 casts/crossing, never 5+ spam.
for (const mapIndex of [0, 1]) {
  for (const seed of [1, 7]) {
    const w = runToTerminal((bot) => POLICIES.optimal({ ultimate: true }), seed, mapIndex);
    const wo = runToTerminal((bot) => POLICIES.optimal(), seed, mapIndex);
    const wonWith = w.status === 'won' && w.summitWon && w.summitWonEv && w.lives > 0;
    const lostWithout = wo.status === 'lost';
    const sep = wonWith && lostWithout;
    const budget = w.ultCasts >= 1 && w.ultCasts <= 5;   // aim-confirm + long cooldown gate
    if (!sep) allSeparate = false;
    if (!budget) castsInBudget = false;
    console.log(`  map${mapIndex} seed${seed}: WITH[status=${w.status} summitWon=${w.summitWon} lives=${w.lives} casts=${w.ultCasts}]  WITHOUT[status=${wo.status} lives=${wo.lives}]  separates=${sep} budget(1..5)=${budget}`);
  }
}

console.log('\n=== SUMMARY ===');
const sc = CONFIG.waves.scaling;
const eff16 = Math.min(SECRET_INDEX, sc.capWave);
// W9: the SECRET wave-16 boss IS surged (only PUBLIC bosses 5/10/15 are excluded), so
// the honest on-field HP includes the lateSurge hp factor (the meaner wall).
const lateHp16 = sc.lateSurge ? Math.pow(sc.lateSurge.hp, Math.max(0, eff16 - sc.lateSurge.fromWave)) : 1;
const scaledHp = Math.round(CONFIG.enemies.boss_split.hp * Math.pow(sc.hp, eff16 - 1) * sc.bossMult * lateHp16);
console.log(`  wave-16 on-field boss HP (base ${CONFIG.enemies.boss_split.hp} x scaling x lateSurge ${lateHp16.toFixed(2)}) ≈ ${scaledHp}`);
console.log(`  PEAK damage landed on the boss across all scenarios = ${peak}`);
console.log(`  safety margin at current HP = ${(scaledHp / Math.max(1, peak)).toFixed(1)}x`);
console.log(`  recommended on-field HP (5x peak) = ${peak * 5}  -> base hp ≈ ${Math.ceil(peak * 5 / (scaledHp / CONFIG.enemies.boss_split.hp))}`);

// P3/P4 parity deliverable: the freeze- AND fork-aware optimal bot now exercises
// every lever, yet the secret boss must remain UNBEATABLE.
//  - Freeze-aware peak margin stays >= 5x (the P3 safety cushion, restored after the
//    fork raised peak boss damage by bumping the boss base hp 20000 -> 24000).
//  - P4 §5.5: the fork ALONE (no Freeze) margin stays >= 3x — proving the fork is a
//    ROLE, not "buy the win". P5 (not P4) owns gating the summit win.
const margin = scaledHp / Math.max(1, peak);
const marginNoFreeze = scaledHp / Math.max(1, peakNoFreeze);
console.log(`  P4 no-Freeze (fork-only) peak = ${peakNoFreeze}  -> margin ${marginNoFreeze.toFixed(1)}x (guard >= 3x)`);
if (marginNoFreeze < 3) {
  console.error(`\n❌ FAIL — P4 no-Freeze margin ${marginNoFreeze.toFixed(1)}x < 3x; the fork alone is becoming buy-the-win.`);
  process.exit(1);
}
if (margin < 5) {
  console.error(`\n❌ FAIL — secret-boss margin ${margin.toFixed(1)}x < 5x; the boss is no longer safely unbeatable WITHOUT the ultimate.`);
  process.exit(1);
}
if (!allSeparate) {
  console.error(`\n❌ FAIL — Scenario C: the winnable-summit separation broke (some map/seed did not WIN-with-beam / LOSE-without).`);
  process.exit(1);
}
if (!castsInBudget) {
  console.error(`\n❌ FAIL — Scenario C: a WITH-beam run cast outside the 1..5 budget (the long-cooldown aim-confirm beam should land ~2-3 casts/crossing, not spam).`);
  process.exit(1);
}
console.log(`\n✅ PASS — no-ultimate wall stands (freeze+fork margin ${margin.toFixed(1)}x >= 5x, fork-only ${marginNoFreeze.toFixed(1)}x >= 3x) AND the boss-tower BEAM WINS the summit with lives to spare on every map x seed (clean separation, ~2-3 casts/crossing).`);
