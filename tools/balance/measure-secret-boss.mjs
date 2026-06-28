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
  const rec = { spawned: false, maxHp: 0, minHp: Infinity, killed: false, reachedGoal: false, children: 0, childReachedGoal: 0 };
  const bossIds = new Set();
  const childIds = new Set();
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
  let acc = 0;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    sampleBoss();
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing' && policy?.onDecision) policy.onDecision(bot); }
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  const dmg = rec.minHp === Infinity ? 0 : rec.maxHp - rec.minHp;
  return { status: sim.state.status, finalWave: sim.state.wave.index, ...rec, damageTaken: Math.round(dmg) };
}

// --- Scenario A: OPTIMAL bot on the real maps ---
console.log('\n=== Scenario A — OPTIMAL bot, real maps (realistic strong player) ===');
let peak = 0;
for (const mapIndex of [0, 1]) {
  for (const seed of [1, 2, 3, 7]) {
    const sim = new Simulation(CONFIG, { seed, mapIndex }); sim.startGame();
    const r = runInstrumented(sim, () => POLICIES.optimal());
    peak = Math.max(peak, r.damageTaken);
    console.log(`  map${mapIndex} seed${seed}: status=${r.status} finalWave=${r.finalWave} bossReachedGoal=${r.reachedGoal} bossKilled=${r.killed} maxHp=${Math.round(r.maxHp)} damageTaken=${r.damageTaken}`);
  }
}

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

console.log('\n=== SUMMARY ===');
const scaledHp = Math.round(CONFIG.enemies.boss_split.hp * Math.pow(CONFIG.waves.scaling.hp, Math.min(SECRET_INDEX, CONFIG.waves.scaling.capWave) - 1) * CONFIG.waves.scaling.bossMult);
console.log(`  wave-16 on-field boss HP (base ${CONFIG.enemies.boss_split.hp} x scaling) ≈ ${scaledHp}`);
console.log(`  PEAK damage landed on the boss across all scenarios = ${peak}`);
console.log(`  safety margin at current HP = ${(scaledHp / Math.max(1, peak)).toFixed(1)}x`);
console.log(`  recommended on-field HP (5x peak) = ${peak * 5}  -> base hp ≈ ${Math.ceil(peak * 5 / (scaledHp / CONFIG.enemies.boss_split.hp))}`);
