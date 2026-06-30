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
import { damageEnemy, affinityMult } from '../../v2/sim/systems/enemySystem.js';
import { EV } from '../../v2/sim/events.js';

const SECRET_INDEX = CONFIG.waves.patterns.length; // 16

// Drive an optimal "strong player" to a terminal state, tracking the wave-16
// boss and its split children via the event bus. Optionally force-kill the boss
// the instant it appears (to exercise the split fail-safe).
// P5 — the public win now fires at wave 15. To still measure the secret wave-16
// boss, the strong player takes the opt-in SUMMIT dare (continueToSummit) once the
// public win is banked, then keeps driving into wave 16. The banked win is NEVER
// revoked, so a losing summit still leaves publicWinBanked === true.
function strongRun(seed, mapIndex, { forceKillBoss = false, summit = true, ultimate = false } = {}) {
  const sim = new Simulation(CONFIG, { seed, mapIndex });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = POLICIES.optimal({ ultimate });   // W11: ultimate=true wields the boss-tower nuke (the win key)
  const dt = sim.config.timestepMs;

  const bossIds = new Set(), childIds = new Set();
  const rec = { bossSpawned: false, bossKilled: false, bossReachedGoal: false, childrenSpawned: 0, childrenReachedGoal: 0, summitWonEv: false };
  sim.bus.on(EV.SUMMIT_WON, () => { rec.summitWonEv = true; });
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

  let acc = 0, summited = false;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    if (forceKillBoss && sim.state.wave.index === SECRET_INDEX) {
      const boss = sim.state.enemies.find(e => e.typeId === 'boss_split' && e.alive);
      if (boss) damageEnemy(sim.state, boss, 1e9); // instant-kill near the start
    }
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
    if (summit && sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  return { status: sim.state.status, finalWave: sim.state.wave.index, wavesCleared: sim.state.stats.wavesCleared, publicWinBanked: sim.state.publicWinBanked, summitWon: sim.state.summitWon, lives: sim.state.lives, ...rec };
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
// P2 §5e.1 — affinity must NOT trivialize the secret boss: it carries no affinity
// weakness, so BOTH towers deal a neutral 1x (no 2x cheese), and the affinity-aware
// optimal bot (which now drives every gate above) still cannot kill it.
test('affinity does not trivialize the secret boss (it is affinity-neutral)', () => {
  const traits = CONFIG.enemies.boss_split.traits || [];
  assert.equal(affinityMult(CONFIG, 'basic', traits), 1.0, 'basic deals neutral damage to the split boss');
  assert.equal(affinityMult(CONFIG, 'strong', traits), 1.0, 'strong deals neutral damage to the split boss');
  // the children inherit no affinity weakness either
  const childTraits = CONFIG.enemies[CONFIG.enemies.boss_split.behavior.childType].traits || [];
  assert.equal(affinityMult(CONFIG, 'strong', childTraits), 1.0, 'shards are affinity-neutral too');
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
// W11 KEEP — the wall still stands for the STANDARD kit. A strong player WITHOUT
// the boss-tower ultimate banks the public win, takes the SUMMIT dare, and STILL
// cannot kill the secret boss: it reaches the goal and ends the summit in a loss
// (the public win stays banked). This is the no-ultimate half of the separation.
test('a strong player WITHOUT the boss-tower ultimate loses the summit (the wall stands)', () => {
  for (const mapIndex of [0, 1]) {
    for (const seed of [1, 7]) {
      const r = strongRun(seed, mapIndex);   // optimal(), NO ultimate; summit dare after the public win
      const where = `map${mapIndex} seed${seed}`;
      assert.equal(r.wavesCleared, 15, `${where}: optimal masters all 15 known waves`);
      assert.equal(r.publicWinBanked, true, `${where}: the public win was banked at wave 15`);
      assert.equal(r.finalWave, SECRET_INDEX, `${where}: the summit climbs into the secret wave 16`);
      assert.ok(r.bossSpawned, `${where}: the secret boss spawned`);
      assert.equal(r.bossKilled, false, `${where}: the standard kit never kills the boss`);
      assert.equal(r.bossReachedGoal, true, `${where}: the boss reached the goal`);
      assert.equal(r.summitWon, false, `${where}: no SUMMIT_WON without the ultimate`);
      assert.equal(r.status, 'lost', `${where}: the wall ends the summit in a loss (but the win stays banked)`);
    }
  }
});

// ---------------------------------------------------------------------------
// V2.2 REVERSAL — THE BEAM WIN. A strong player WITH the boss-tower ultimate (the
// AIMED, single-target, shield-piercing DoT BEAM) WINS the summit with lives to spare,
// on BOTH maps x seeds [1,7]. ~2 aimed casts crack the ~580k parent EARLY (so its 3
// shards traverse the kill-zone) and the buffed basic + freeze + one leftover beam cast
// clear the shards — where the standard kit's chip can't. The public win stays banked;
// the true ending fires a SEPARATE SUMMIT_WON, never GAME_WON.
test('a strong player WITH the boss-tower ultimate WINS the summit with lives to spare', () => {
  for (const mapIndex of [0, 1]) {
    for (const seed of [1, 7]) {
      const r = strongRun(seed, mapIndex, { ultimate: true });
      const where = `map${mapIndex} seed${seed}`;
      assert.equal(r.publicWinBanked, true, `${where}: the public win is still banked at wave 15`);
      assert.equal(r.finalWave, SECRET_INDEX, `${where}: the run climbs into the secret wave 16`);
      assert.ok(r.bossSpawned, `${where}: the secret boss spawned`);
      assert.equal(r.bossReachedGoal, false, `${where}: the boss never reached the goal (it was beaten)`);
      assert.equal(r.summitWon, true, `${where}: state.summitWon latched`);
      assert.equal(r.summitWonEv, true, `${where}: a SUMMIT_WON event fired`);
      assert.equal(r.status, 'won', `${where}: the summit is WON`);
      assert.ok(r.lives > 0, `${where}: won with lives to spare (had ${r.lives})`);
    }
  }
});

// ---------------------------------------------------------------------------
// P4 §5.5 — the fork ALONE (no Freeze) is a ROLE, not "buy the win". A fork-aware
// optimal bot with freeze DISABLED still cannot beat the split boss: it is never
// killed and the damage margin (scaledBossHp / max damage landed) stays >= 3x.
function forkNoFreezeRun(seed, mapIndex) {
  const sim = new Simulation(CONFIG, { seed, mapIndex });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = POLICIES.optimal({ freeze: false });   // forks, but never freezes
  const dt = sim.config.timestepMs;
  const bossIds = new Set();
  const rec = { killed: false, reachedGoal: false, maxHp: 0, minHp: Infinity };
  sim.bus.on(EV.ENEMY_SPAWN, ({ id }) => {
    const e = sim.state.enemies.find(x => x.id === id); if (!e) return;
    if (e.typeId === 'boss_split') { bossIds.add(id); rec.maxHp = Math.max(rec.maxHp, e.maxHp); }
  });
  sim.bus.on(EV.ENEMY_DEATH, ({ id }) => { if (bossIds.has(id)) rec.killed = true; });
  sim.bus.on(EV.ENEMY_REACH_END, ({ id }) => { if (bossIds.has(id)) rec.reachedGoal = true; });
  let acc = 0, summited = false;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    for (const e of sim.state.enemies) if (bossIds.has(e.id) && e.alive) rec.minHp = Math.min(rec.minHp, e.hp);
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
    // P5 — take the summit after the public win to still reach & measure wave 16.
    if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  const damage = rec.minHp === Infinity ? 0 : rec.maxHp - rec.minHp;
  return { status: sim.state.status, killed: rec.killed, reachedGoal: rec.reachedGoal, maxHp: rec.maxHp, damage };
}

test('P4 §5.5 — the fork alone (no Freeze) does NOT make the split boss beatable (margin >= 3x)', () => {
  for (const mapIndex of [0, 1]) {
    for (const seed of [1, 7]) {
      const r = forkNoFreezeRun(seed, mapIndex);
      const where = `map${mapIndex} seed${seed}`;
      assert.equal(r.killed, false, `${where}: the fork alone never kills the split boss`);
      assert.equal(r.status, 'lost', `${where}: the run still ends in a loss at the secret wave`);
      const margin = r.maxHp / Math.max(1, r.damage);
      assert.ok(margin >= 3, `${where}: no-Freeze margin ${margin.toFixed(1)}x must stay >= 3x (not buy-the-win)`);
    }
  }
});

// ---------------------------------------------------------------------------
// V2.2 PARITY FLIP — the split MECHANISM is intact (a dead parent still spawns 3 boss
// shards), but the old terminal "a force-killed parent always leaks a shard" no longer
// holds: V2.2 DELIBERATELY weakens the shards (childHp 22000 -> 6000, shield uptime cut)
// so the boss-beam kit CAN clear them — that IS the re-derived win. The real anti-cheese
// is now elsewhere: the beam is a DoT whose totalDamage < the parent HP, so a single
// action can NEVER instant-kill the parent (offense-beam.test "never instant-kills"),
// and without the beam the parent never dies at all (the WITHOUT test above). So here we
// assert the split mechanism only: a force-killed parent splits into exactly 3 boss shards.
test('fail-safe: a killed parent still splits into 3 boss shards (mechanism intact)', () => {
  for (const mapIndex of [0, 1]) {
    const r = strongRun(1, mapIndex, { forceKillBoss: true });
    const where = `map${mapIndex}`;
    assert.equal(r.bossKilled, true, `${where}: the boss was force-killed`);
    assert.equal(r.childrenSpawned, 3, `${where}: it split into 3 shards`);
    // each shard is a boss-type Star Shard (cannot be cheesed into trivial enemies)
    assert.equal(CONFIG.enemies[CONFIG.enemies.boss_split.behavior.childType].isBoss, true, `${where}: shards are boss-type`);
  }
});
