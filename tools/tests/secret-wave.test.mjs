/**
 * SECRET WAVE 16 — acceptance gate for the hidden split-boss wave.
 *
 * Design (see v2/docs/SECRET-WAVE.md):
 *   - A 16th wave is appended to waves.patterns but flagged `secret: true`, so the
 *     public wave count stays 15 (HUD reads "16/15" only once it appears).
 *   - The split boss is intentionally UNBEATABLE with current towers (it needs the
 *     out-of-scope "boss tower upgrades"): its HP is ~7x the most damage any build
 *     lands on it crossing the map, and its livesCost is a one-shot game-ender.
 *   - If it ever IS killed, it splits into 3 weaker BOSS shards (boss_splitling)
 *     that carry on to the goal, so the wave still can't be cheesed.
 *
 * These tests drive the REAL Simulation via the same headless harness the balance
 * ladder uses. The tuned values they validate live in v2/config/gameConfig.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { Bot } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';
import * as waves from '../../v2/sim/systems/waveSystem.js';
import { damageEnemy } from '../../v2/sim/systems/enemySystem.js';
import { EV } from '../../v2/sim/events.js';

const SECRET_INDEX = CONFIG.waves.patterns.length; // 16

// Drive an optimal "strong player" to a terminal state, tracking the wave-16
// boss and its split children via the event bus. Optionally force-kill the boss
// the instant it appears (to exercise the split fail-safe).
function strongRun(seed, mapIndex, { forceKillBoss = false } = {}) {
  const sim = new Simulation(CONFIG, { seed, mapIndex });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = POLICIES.optimal();
  const dt = sim.config.timestepMs;

  const bossIds = new Set(), childIds = new Set();
  const rec = { bossSpawned: false, bossKilled: false, bossReachedGoal: false, childrenSpawned: 0, childrenReachedGoal: 0 };
  sim.bus.on(EV.ENEMY_SPAWN, ({ id }) => {
    const e = sim.state.enemies.find(x => x.id === id); if (!e) return;
    if (e.typeId === 'boss_split') { bossIds.add(id); rec.bossSpawned = true; }
    if (e.typeId === 'boss_splitling') { childIds.add(id); rec.childrenSpawned++; }
  });
  sim.bus.on(EV.ENEMY_DEATH, ({ id }) => { if (bossIds.has(id)) rec.bossKilled = true; });
  sim.bus.on(EV.ENEMY_REACH_END, ({ id }) => {
    if (bossIds.has(id)) rec.bossReachedGoal = true;
    if (childIds.has(id)) rec.childrenReachedGoal++;
  });

  let acc = 0;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    if (forceKillBoss && sim.state.wave.index === SECRET_INDEX) {
      const boss = sim.state.enemies.find(e => e.typeId === 'boss_split' && e.alive);
      if (boss) damageEnemy(sim.state, boss, 1e9); // instant-kill near the start
    }
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  return { status: sim.state.status, finalWave: sim.state.wave.index, wavesCleared: sim.state.stats.wavesCleared, ...rec };
}

// ---------------------------------------------------------------------------
test('secret wave is HIDDEN from the public count (HUD reads "16/15")', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  // 16 patterns total, but only 15 are public — the denominator the player sees.
  assert.equal(CONFIG.waves.patterns.length, 16, 'there are 16 wave patterns');
  assert.equal(waves.publicWaveCount(sim.state), 15, 'public wave count stays 15');
  const secret = CONFIG.waves.patterns[15];
  assert.equal(secret.secret, true, 'the 16th pattern is flagged secret');
  assert.equal(secret.boss, 'boss_split', 'the secret wave is the split boss');
});

// ---------------------------------------------------------------------------
test('the split boss splits into weaker BOSS shards — never basic enemies', () => {
  const split = CONFIG.enemies.boss_split.behavior;
  assert.equal(split.type, 'split');
  assert.notEqual(split.childType, 'basic', 'children are NOT basic enemies');
  const child = CONFIG.enemies[split.childType];
  assert.ok(child, `child type ${split.childType} is defined`);
  assert.equal(child.isBoss, true, 'split children are boss-type');
  // "weaker": a shard has far less HP than the parent boss on the field (the boss
  // base HP is scaled ~7.3x at wave 16; the shard's childHp is flat), and is smaller
  // and cheaper to leak.
  const sc = CONFIG.waves.scaling;
  const bossEffHp = CONFIG.enemies.boss_split.hp * Math.pow(sc.hp, Math.min(SECRET_INDEX, sc.capWave) - 1) * sc.bossMult;
  assert.ok(split.childHp < bossEffHp, `shards (${split.childHp} HP) are weaker than the on-field boss (${Math.round(bossEffHp)} HP)`);
  assert.ok(child.size < CONFIG.enemies.boss_split.size, 'shards are smaller than the parent');
  assert.ok(child.livesCost < CONFIG.enemies.boss_split.livesCost, 'shards cost fewer lives than the parent');
});

// ---------------------------------------------------------------------------
test('a STRONG player reaches the secret wave 16 and CANNOT kill the boss', () => {
  for (const mapIndex of [0, 1]) {
    for (const seed of [1, 7]) {
      const r = strongRun(seed, mapIndex);
      const where = `map${mapIndex} seed${seed}`;
      assert.equal(r.wavesCleared, 15, `${where}: optimal masters all 15 known waves`);
      assert.equal(r.finalWave, SECRET_INDEX, `${where}: the run reaches the secret wave 16`);
      assert.ok(r.bossSpawned, `${where}: the secret boss spawned`);
      assert.equal(r.bossKilled, false, `${where}: the boss was NOT killed`);
      assert.equal(r.bossReachedGoal, true, `${where}: the boss reached the goal`);
      assert.equal(r.status, 'lost', `${where}: an unbeatable boss reaching the goal ends the run`);
    }
  }
});

// ---------------------------------------------------------------------------
test('fail-safe: if the boss IS killed, its boss shards still make it to the end', () => {
  // Force-kill the boss the instant it appears (near the start) on the HARDEST
  // map, under an optimal build — the worst case for the children.
  for (const mapIndex of [0, 1]) {
    const r = strongRun(1, mapIndex, { forceKillBoss: true });
    const where = `map${mapIndex}`;
    assert.equal(r.bossKilled, true, `${where}: the boss was force-killed`);
    assert.equal(r.childrenSpawned, 3, `${where}: it split into 3 shards`);
    assert.ok(r.childrenReachedGoal >= 1, `${where}: at least one shard reached the goal (${r.childrenReachedGoal}/3)`);
    assert.equal(r.status, 'lost', `${where}: the shards finishing the path still ends the run`);
  }
});
