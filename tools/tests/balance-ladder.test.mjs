/**
 * BALANCE ACCEPTANCE GATE — the difficulty ladder.
 *
 * Four deterministic, seeded player-policy bots play full 15-wave games through
 * the real Simulation command API. Each must reach its target outcome ROBUSTLY
 * across multiple seeds AND both maps (mapIndex 0 = Ribbon, 1 = Comb):
 *
 *   1. unfocused   -> loses early (~wave 3).
 *   2. spread      -> L1 towers, never upgrades -> leaks and loses mid-run.
 *   3. saveUpgrade -> few towers + banking + upgrades -> reaches the final waves
 *                     but loses (close, no win).
 *   4. optimal     -> chokepoints + continual placing + upgrades + repositioning
 *                     -> barely wins all 15 with only a few lives left.
 *
 * The bots and harness live in tools/balance/. The tuned values they validate
 * live in v2/config/gameConfig.js. See v2/docs/BALANCE.md for the methodology,
 * the full per-archetype/seed/map results table, and the re-tune procedure.
 *
 * NOTE on map asymmetry (surfaced honestly, see BALANCE.md): Ribbon (long,
 * snaking, slow) is the easy map and Comb (short, fast) is the hard map. Optimal
 * therefore wins Comb on a knife-edge (a few lives) and Ribbon with a slightly
 * larger but still modest margin. The thresholds below hold on BOTH.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { runGame } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';

const SEEDS = [1, 2, 3, 7];
const MAPS = [0, 1];
const MAP_NAME = ['Ribbon(map0)', 'Comb(map1)'];

// Run an archetype across every seed x map and return the flat result list.
function ladder(makePolicy) {
  const out = [];
  for (const mapIndex of MAPS)
    for (const seed of SEEDS)
      out.push(runGame(CONFIG, { seed, mapIndex, makePolicy }));
  return out;
}
const tag = (r) => r.status === 'won' ? `WON(${r.lives} lives)` : `lost@W${r.finalWave}`;

// ---------------------------------------------------------------------------
test('ladder #1 — UNFOCUSED loses early (~wave 3) on every seed and both maps', () => {
  for (const r of ladder(() => POLICIES.unfocused())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    assert.equal(r.status, 'lost', `${where}: unfocused must lose, got ${tag(r)}`);
    assert.ok(r.finalWave <= 4, `${where}: unfocused must lose EARLY (<=W4), lost@W${r.finalWave}`);
    assert.ok(r.finalWave >= 2, `${where}: should at least survive the first wave, lost@W${r.finalWave}`);
  }
});

// ---------------------------------------------------------------------------
test('ladder #2 — SPREAD (L1 only, never upgrades) leaks and loses mid-run, before the final wave', () => {
  for (const r of ladder(() => POLICIES.spread())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    assert.equal(r.status, 'lost', `${where}: spread must lose, got ${tag(r)}`);
    assert.ok(r.finalWave < 15, `${where}: spread must lose BEFORE the final wave, lost@W${r.finalWave}`);
    assert.ok(r.finalWave >= 6, `${where}: spread should reach mid-run (outlasting unfocused), lost@W${r.finalWave}`);
  }
});

// ---------------------------------------------------------------------------
test('ladder #3 — SAVE-AND-UPGRADE reaches the final waves but loses (close, no win)', () => {
  for (const r of ladder(() => POLICIES.saveUpgrade())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    assert.equal(r.status, 'lost', `${where}: save-and-upgrade must NOT win, got ${tag(r)}`);
    assert.ok(r.finalWave >= 10, `${where}: save-and-upgrade should reach the late/final waves (>=W10), lost@W${r.finalWave}`);
  }
});

// ---------------------------------------------------------------------------
test('ladder #4 — OPTIMAL barely wins all 15 waves with only a few lives left', () => {
  for (const r of ladder(() => POLICIES.optimal())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    assert.equal(r.status, 'won', `${where}: optimal must WIN, got ${tag(r)}`);
    assert.equal(r.wavesCleared, 15, `${where}: optimal must clear all 15 waves`);
    assert.ok(r.lives > 0, `${where}: a win keeps at least one life`);
    // "Barely" — the run COST lives (not an untouched cakewalk) and ends low.
    assert.ok(r.lives < CONFIG.lives.max, `${where}: optimal should lose some lives, not coast untouched (lives ${r.lives}/${CONFIG.lives.max})`);
    assert.ok(r.lives <= 10, `${where}: optimal should win with only a few lives left, had ${r.lives}`);
  }
});

// ---------------------------------------------------------------------------
// The ladder must be MONOTONE and the upgrade-vs-spread tradeoff must be LIVE:
// pure Spread underperforms Save-and-upgrade, which underperforms Optimal.
test('ladder #5 — monotone separation: unfocused < spread < save < optimal (per seed & map)', () => {
  // "depth reached" score: how far a run got. A win outranks any loss.
  const depth = (r) => r.status === 'won' ? 100 + r.lives : r.finalWave;
  for (const mapIndex of MAPS) {
    for (const seed of [SEEDS[0], SEEDS[SEEDS.length - 1]]) {  // two seeds per map keeps this cross-product check affordable
      const u = runGame(CONFIG, { seed, mapIndex, makePolicy: () => POLICIES.unfocused() });
      const s = runGame(CONFIG, { seed, mapIndex, makePolicy: () => POLICIES.spread() });
      const v = runGame(CONFIG, { seed, mapIndex, makePolicy: () => POLICIES.saveUpgrade() });
      const o = runGame(CONFIG, { seed, mapIndex, makePolicy: () => POLICIES.optimal() });
      const where = `${MAP_NAME[mapIndex]} seed${seed}`;
      assert.ok(depth(u) < depth(s), `${where}: unfocused(${tag(u)}) must underperform spread(${tag(s)})`);
      assert.ok(depth(s) < depth(v), `${where}: SPREAD(${tag(s)}) must UNDERPERFORM SAVE-AND-UPGRADE(${tag(v)}) — the live upgrade tradeoff`);
      assert.ok(depth(v) < depth(o), `${where}: save-and-upgrade(${tag(v)}) must underperform optimal(${tag(o)})`);
    }
  }
});
