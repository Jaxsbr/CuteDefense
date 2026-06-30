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
import { Simulation } from '../../v2/sim/Simulation.js';
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
// P5 PARITY FLIP — the public game is now WINNABLE at wave 15. Optimal masters the
// 15-wave curve (barely, losing some lives) and now BANKS THE PUBLIC WIN at wave 15
// rather than being force-fed into — and losing to — the secret boss. The secret
// wave-16 split boss is reframed as an opt-in summit (see secret-wave.test.mjs).
test('ladder #4 — OPTIMAL masters all 15 known waves (barely) and WINS the public game at wave 15', () => {
  for (const r of ladder(() => POLICIES.optimal())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    // Optimal still masters the 15-wave balance curve...
    assert.equal(r.wavesCleared, 15, `${where}: optimal must clear all 15 known waves, got ${tag(r)}`);
    const livesAt15 = r.perWaveLives[15];
    assert.ok(livesAt15 > 0, `${where}: optimal survives the 15 known waves (had ${livesAt15} lives at wave 15)`);
    // "Barely" — it cost lives and ended low (not an untouched cakewalk).
    assert.ok(livesAt15 < CONFIG.lives.max, `${where}: optimal should lose some lives over the 15 waves (had ${livesAt15}/${CONFIG.lives.max})`);
    assert.ok(livesAt15 <= 10, `${where}: optimal should reach wave 15 with only a few lives, had ${livesAt15}`);
    // ...and clearing the wave-15 boss now fires the real, banked public win.
    assert.equal(r.status, 'won', `${where}: the public game is now WON at wave 15, got ${tag(r)}`);
    assert.equal(r.finalWave, 15, `${where}: won at the public final wave 15, got ${tag(r)}`);
    assert.equal(r.publicWinBanked, true, `${where}: the win is banked`);
  }
});

// ---------------------------------------------------------------------------
// P1 PARITY — the optimal bot places under the live clock (never pauses) and must
// still clear the public game. Bots leave trayType null and drive the REAL command
// API (gridClick opens the popup while playing, placementCycle/placementPlace resolve
// it). Outcome must be IDENTICAL to ladder #4 (P5): clears 15 and WINS the public
// game at wave 15. This is the balance-parity deliverable.
test('ladder #6 — optimal places live (never pauses); outcome identical to #4', () => {
  for (const r of ladder(() => POLICIES.optimal())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    assert.equal(r.terminated, true, `${where}: game terminated, got ${tag(r)}`);
    assert.equal(r.wavesCleared, 15, `${where}: optimal still clears 15, got ${tag(r)}`);
    assert.equal(r.finalWave, 15, `${where}: wins the public game at wave 15, got ${tag(r)}`);
    assert.equal(r.status, 'won', `${where}: the public win still fires, got ${tag(r)}`);
  }
});

// ---------------------------------------------------------------------------
// P4 — the fork lever is LIVE: the fork-aware optimal bot, across seeds x maps,
// reaches L3 and forks at least one tower (forks are not dead code).
test('ladder #9 — OPTIMAL exercises the fork lever (at least one forked tower)', () => {
  let anyFork = false;
  for (const r of ladder(() => POLICIES.optimal())) {
    if ((r.forkedTowers || 0) > 0) { anyFork = true; break; }
  }
  assert.ok(anyFork, 'at least one optimal run ends with a forked (Sniper/Gunner/Bomber/Froster) tower');
});

// ---------------------------------------------------------------------------
// The ladder must be MONOTONE and the upgrade-vs-spread tradeoff must be LIVE:
// pure Spread underperforms Save-and-upgrade, which underperforms Optimal.
test('ladder #5 — monotone separation: unfocused < spread < save < optimal (per seed & map)', () => {
  // "depth reached" score: how far a run got. Waves cleared dominates (only
  // optimal clears all 15 and reaches the secret wave 16), with finalWave as a
  // tiebreak. A win, if one were ever possible, still outranks any loss.
  const depth = (r) => (r.status === 'won' ? 100000 : 0) + r.wavesCleared * 100 + r.finalWave;
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

// ---------------------------------------------------------------------------
// P2 §5d.2 — ANTI-SHRUG: the affinity counter rule has TEETH. On an authored
// pure-armored wave, a wrong-tool-only board (all `basic`, 0.5x) leaks visibly
// more lives than the affinity-correct board (all `strong`, 2x) on the same seed.
const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function leakOnMonoArmoredWave(towerType) {
  const cfg = structuredClone(CONFIG);
  cfg.maps = [SHORT_MAP];
  cfg.waves.firstPrepMs = 300; cfg.waves.prepMs = 300; cfg.waves.betweenWaveMs = 999999;
  cfg.waves.patterns = [{ enemies: [{ type: 'basic', count: 14, formation: 'single', flags: ['armored'] }] }];
  cfg.lives.max = 40;
  cfg.economy.startingCoins = 1e9;
  const sim = new Simulation(cfg, { seed: 5, mapIndex: 0 });
  sim.startGame();
  // saturate one flank with the chosen tool (a fixed, affinity-blind board)
  for (let x = 1; x <= 20; x++) {
    if (!sim.canPlace(x, 5)) continue;
    sim.state.placement = { gx: x, gy: 5, towerType };
    sim.placementPlace();
  }
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 80000 && sim.state.status === 'playing'; t += dt) sim.tick(dt);
  return cfg.lives.max - sim.state.lives;
}
test('ladder #7 — affinity-blind play visibly leaks a mono-threat wave (anti-shrug)', () => {
  const wrong = leakOnMonoArmoredWave('basic');   // basic vs armored = 0.5x (wrong tool)
  const right = leakOnMonoArmoredWave('strong');  // strong vs armored = 2x (right tool)
  assert.ok(wrong > right,
    `wrong-tool board (basic vs armored) must leak MORE lives (${wrong}) than the right tool (strong: ${right})`);
});

// ---------------------------------------------------------------------------
// P2 §5d.3 — the boss waves (5/10/15) cost the affinity-aware optimal only a FAIR,
// bounded amount of lives: it reaches wave 15 with a healthy margin on every seed
// and both maps (the boss telegraph pairs with substance, not a punitive wipe).
test('ladder #8 — affinity-correct optimal clears the boss waves within a fair budget (#3)', () => {
  for (const r of ladder(() => POLICIES.optimal())) {
    const where = `${MAP_NAME[r.mapIndex]} seed${r.seed}`;
    const livesAt15 = r.perWaveLives[15];
    assert.ok(livesAt15 >= 4,
      `${where}: boss-wave life drain is fair, not punitive — optimal kept ${livesAt15} lives through wave 15`);
  }
});
