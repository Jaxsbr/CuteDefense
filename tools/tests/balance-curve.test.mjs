/**
 * W9 — BALANCE CURVE: the late difficulty curve must RISE, not fall.
 *
 * Grounded problem (see v2/docs/v2.1/research/W9-balance-curve.md): a saturated
 * optimal board kills LATE enemies at ~1/3 the path-depth of the opening — they
 * die near spawn, so every NON-boss late wave is a formality. The `lateSurge`
 * lever (waves.scaling.lateSurge, applied in computeScaling) bends the late
 * NON-boss tail UP: enemies survive deeper and threaten the goal, WITHOUT
 * re-flooding income (reward is deliberately NOT surged) and WITHOUT touching the
 * hand-tuned boss waves (5/10/15) or the secret wave-16 wall.
 *
 * These tests are RED with the surge inert (lateSurge hp/count/speed = 1.0, the
 * pre-rebalance merge state) and GREEN once the single post-merge rebalance
 * activates it. They are self-contained (drive the real Simulation via the same
 * harness the ladder uses) so they touch no shared file.
 *
 * PARITY: the rebalance must keep optimal() WINNING all 15 public waves with a
 * fair life budget (balance-ladder #4/#8) — so the surge raises late PRESSURE
 * (penetration toward the goal) while the affinity/freeze/fork kit still absorbs it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { Bot } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';
import { computeScaling } from '../../v2/sim/systems/waveSystem.js';

const SEEDS = [1, 2, 3, 7];
const MAPS = [0, 1];

// Deepest path fraction (0 = spawn, 1 = goal) an enemy reaches, mirroring the sim's
// own path-progress model (reverse waves measured from their own entry).
function frac(e, map) {
  const last = map.path.length - 1;
  const idx = e.dir === -1 ? (last - e.pathIndex) : e.pathIndex;
  return Math.min(1, (idx + (e.progress || 0)) / last);
}

// Drive optimal() through a full public game, recording the deepest penetration any
// alive enemy reached during EACH wave. Self-contained tick loop (like measure-secret-boss).
function penetrationByWave(seed, mapIndex) {
  const sim = new Simulation(CONFIG, { seed, mapIndex });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = POLICIES.optimal();
  const dt = sim.config.timestepMs;
  const map = sim.state.map;
  const deepest = {};
  let acc = 0;
  for (let t = 0; t < 30 * 60 * 1000; t += dt) {
    sim.tick(dt);
    const w = sim.state.wave.index;
    for (const e of sim.state.enemies) {
      if (!e.alive || e.reachedGoal) continue;
      const f = frac(e, map);
      if (!(w in deepest) || f > deepest[w]) deepest[w] = f;
    }
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  return deepest;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------------------------------------------------------------------------
// 1. The falling curve RISES: late non-boss penetration is no longer the
// die-at-spawn ~1/3 of the opening. With the surge inert it sits at ~0.30x early
// (RED); the activated surge lifts it to ~0.55x+ on every seed and BOTH maps.
test('W9 #1 — the late curve rises: late penetration is no longer a small fraction of early', () => {
  for (const mapIndex of MAPS) {
    for (const seed of SEEDS) {
      const d = penetrationByWave(seed, mapIndex);
      const early = mean([2, 3, 4].map(w => d[w] || 0));
      const late = mean([11, 12, 13, 14].map(w => d[w] || 0));
      const ratio = late / early;
      assert.ok(ratio >= 0.5,
        `map${mapIndex} seed${seed}: late/early penetration ${ratio.toFixed(2)} must be >= 0.50 (was ~0.30 die-at-spawn before the surge)`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Late waves THREATEN the goal on the hard map (Comb/map1): the deepest late
// enemy now reaches well past the path midpoint toward the goal. Inert ~0.33 (RED);
// activated ~0.57 (GREEN).
test('W9 #2 — late waves threaten the goal on the hard map (Comb)', () => {
  for (const seed of SEEDS) {
    const d = penetrationByWave(seed, /*Comb*/ 1);
    const maxLate = Math.max(...[11, 12, 13, 14, 15].map(w => d[w] || 0));
    assert.ok(maxLate >= 0.5,
      `Comb seed${seed}: deepest late penetration ${maxLate.toFixed(2)} must reach >= 0.50 of the path (was ~0.33 before the surge)`);
  }
});

// ---------------------------------------------------------------------------
// 3. The MECHANISM: the surge raises late NON-boss on-field pressure (per-enemy HP
// + count) WITHOUT re-flooding income (reward is NOT surged), and DELIBERATELY does
// NOT touch the hand-tuned boss waves (so the public nail-biters + the wave-16 wall
// stay exact). Deterministic; RED when lateSurge is inert.
test('W9 #3 — lateSurge raises late NON-boss HP/count but NOT reward, and spares boss waves', () => {
  const ls = CONFIG.waves.scaling.lateSurge;
  assert.ok(ls && ls.fromWave >= 1, 'lateSurge is configured');

  // Inert clone (the pre-rebalance baseline) to compare against.
  const inert = structuredClone(CONFIG);
  inert.waves.scaling.lateSurge = { ...ls, hp: 1, count: 1, speed: 1 };

  // A late NON-boss wave (13) past the knee: HP, count and speed must RISE.
  const W = 13;
  const sc = computeScaling(CONFIG, W, /*isBossWave*/ false);
  const base = computeScaling(inert, W, false);
  assert.ok(sc.hpMult > base.hpMult, `late HP/enemy rises (${sc.hpMult.toFixed(2)} > ${base.hpMult.toFixed(2)})`);
  assert.ok(sc.countMult > base.countMult, `late enemy count rises (${sc.countMult.toFixed(2)} > ${base.countMult.toFixed(2)})`);
  assert.ok(sc.speedMult > base.speedMult, `late speed rises (deeper penetration)`);
  // Income must NOT keep pace — reward is deliberately un-surged (no overbuild loop).
  assert.equal(sc.rewardMult, base.rewardMult, 'reward is NOT surged (late difficulty rises while income does not)');

  // PUBLIC boss waves (5/10/15) are EXCLUDED: their hand-tuned life-drain + the ladder
  // life budget stay exact.
  for (const bw of [5, 10, 15]) {
    const scB = computeScaling(CONFIG, bw, /*isBossWave*/ true);
    const baseB = computeScaling(inert, bw, true);
    assert.equal(scB.hpMult, baseB.hpMult, `public boss wave ${bw} HP is NOT surged (nail-biters/ladder preserved)`);
  }
  // The SECRET wave-16 boss IS surged — the wall gets MEANER (brief: "pushing the
  // unbeatable wall even higher"), which the boss-tower ultimate is tuned to overturn.
  const sc16 = computeScaling(CONFIG, 16, /*isBossWave*/ true);
  const base16 = computeScaling(inert, 16, true);
  assert.ok(sc16.hpMult > base16.hpMult, `secret wave-16 wall IS surged (${sc16.hpMult.toFixed(2)} > ${base16.hpMult.toFixed(2)})`);
});
