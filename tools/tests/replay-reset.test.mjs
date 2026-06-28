/**
 * REPEATED-REPLAY RESET GATE.
 *
 * Plays many full games back-to-back through the replay path (restart(), the
 * "Play Again" flow) and asserts the game resets PROPERLY every time — no state
 * leaks across plays. Covers lives, coins, enemies, towers, projectiles, the
 * coin list, effects, wave index/phase/queue, stats, selection, placement, the
 * id counter, and seeded-RNG determinism.
 *
 * Determinism guarantees asserted:
 *   - a replay with the SAME seed reproduces the game IDENTICALLY;
 *   - a replay with a NEW seed produces a genuinely different game (it does not
 *     inherit anything from the prior play).
 *
 * Findings: clean. restart() throws away the old state and rebuilds it from the
 * pure factory (createInitialState) with a fresh seeded RNG, so nothing can
 * carry over. No reset anomalies were found. (See v2/docs/BALANCE.md.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { drive } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';

// Assert the sim is in a pristine just-started state (right after restart()).
function assertPristine(sim, expectMapIndex, label) {
  const s = sim.state;
  assert.equal(s.status, 'playing', `${label}: status playing after (re)start`);
  assert.equal(s.lives, CONFIG.lives.max, `${label}: lives reset to max`);
  assert.equal(s.coins, CONFIG.economy.startingCoins, `${label}: coins reset to starting`);
  assert.equal(s.clock, 0, `${label}: clock reset`);
  assert.equal(s.enemies.length, 0, `${label}: no enemies carried over`);
  assert.equal(s.towers.length, 0, `${label}: no towers carried over`);
  assert.equal(s.projectiles.length, 0, `${label}: no projectiles carried over`);
  assert.equal(s.coinsList.length, 0, `${label}: no board coins carried over`);
  assert.equal(s.effects.length, 0, `${label}: no effects carried over`);
  assert.equal(s.wave.index, 1, `${label}: wave index reset to 1`);
  assert.equal(s.wave.phase, 'prepare', `${label}: wave phase reset to prepare`);
  assert.equal(s.wave.spawnQueue.length, 0, `${label}: spawn queue empty`);
  assert.equal(s.wave.spawnedCount, 0, `${label}: spawnedCount reset`);
  assert.equal(s.wave.earnings, 0, `${label}: wave earnings reset`);
  assert.equal(s.stats.wavesCleared, 0, `${label}: wavesCleared reset`);
  assert.equal(s.stats.enemiesKilled, 0, `${label}: enemiesKilled reset`);
  assert.equal(s.stats.coinsEarned, 0, `${label}: coinsEarned reset`);
  assert.equal(s.stats.towersBuilt, 0, `${label}: towersBuilt reset`);
  assert.equal(s.stats.elapsedMs, 0, `${label}: elapsedMs reset`);
  assert.equal(s.selected.kind, null, `${label}: selection cleared`);
  assert.equal(s.selected.id, null, `${label}: selection id cleared`);
  assert.equal(s.placement, null, `${label}: placement cleared`);
  assert.equal(s.nextId, 1, `${label}: id counter reset`);
  assert.equal(s.mapIndex, expectMapIndex, `${label}: map is the requested one`);
}

// ---------------------------------------------------------------------------
test('repeated-replay: 12 back-to-back plays each reset to a pristine state (no leaks)', () => {
  let curMap = 0;
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: curMap });
  sim.startGame();

  for (let game = 0; game < 12; game++) {
    // Fresh-state invariant holds at the START of every play.
    assertPristine(sim, curMap, `game ${game} start`);

    // Play it to the end (spread builds many towers + runs many waves -> exercises
    // towers, projectiles, enemies, stats, selection, placement heavily).
    const r = drive(sim, () => POLICIES.spread());
    assert.ok(r.terminated, `game ${game}: reached a terminal state`);
    // The play genuinely dirtied state — so the next pristine check is meaningful.
    assert.ok(r.towersBuilt > 0, `game ${game}: built towers (state was dirtied)`);
    assert.ok(r.enemiesKilled > 0, `game ${game}: killed enemies (state was dirtied)`);
    assert.ok(sim.state.status === 'won' || sim.state.status === 'lost', `game ${game}: terminal status`);

    // Replay via the Play-Again path, alternating map + advancing seed each time.
    curMap = (game + 1) % 2;
    sim.restart({ seed: 200 + game, mapIndex: curMap });
  }
});

// ---------------------------------------------------------------------------
// Full-game signature: deterministic + seed-sensitive (exercises combat RNG —
// fire jitter, crits, boss ability timing — through a tower-building policy).
function signature(sim) {
  const r = drive(sim, () => POLICIES.saveUpgrade());
  return JSON.stringify({
    status: r.status, finalWave: r.finalWave, wavesCleared: r.wavesCleared,
    lives: r.lives, coins: Math.round(r.coins), enemiesKilled: r.enemiesKilled,
    towersBuilt: r.towersBuilt, perWaveLives: r.perWaveLives,
  });
}

test('replay determinism: same seed reproduces identically; a new seed does not inherit', () => {
  // Two FRESH instances, same seed+map -> byte-identical games.
  const freshA = new Simulation(CONFIG, { seed: 1, mapIndex: 0 }); freshA.startGame();
  const freshB = new Simulation(CONFIG, { seed: 1, mapIndex: 0 }); freshB.startGame();
  const sigFreshA = signature(freshA);
  assert.equal(signature(freshB), sigFreshA, 'two fresh same-seed games are identical');

  // The Play-Again path on ONE instance reproduces the identical game...
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 }); sim.startGame();
  const sigViaFirst = signature(sim);
  assert.equal(sigViaFirst, sigFreshA, 'first play matches the fresh instance');
  sim.restart({ seed: 1, mapIndex: 0 });
  assert.equal(signature(sim), sigViaFirst, 'restart with the SAME seed reproduces the identical game');

  // ...and a replay with a NEW seed is a genuinely different game (no inheritance).
  sim.restart({ seed: 2, mapIndex: 0 });
  assert.notEqual(signature(sim), sigViaFirst, 'a new seed yields a different game (state did not carry over)');
});

// ---------------------------------------------------------------------------
test('seeded RNG is isolated per play: identical seeds step identically, different seeds diverge', () => {
  // Build a couple of firing towers so the RNG stream (jitter/crit) is exercised,
  // then sample the RNG internal state after a fixed number of ticks.
  const sampleRng = (seed) => {
    const sim = new Simulation(CONFIG, { seed, mapIndex: 0 });
    sim.startGame();
    // place two towers on the first buildable tiles near the path
    let placed = 0;
    for (let y = 0; y < sim.state.map.rows && placed < 3; y++)
      for (let x = 0; x < sim.state.map.cols && placed < 3; x++)
        if (sim.canPlace(x, y)) { sim.state.placement = { gx: x, gy: y, towerType: 'basic' }; if (sim.placementPlace()) placed++; }
    const dt = sim.config.timestepMs;
    for (let i = 0; i < 4000; i++) sim.tick(dt);
    return { rng: sim.state.rng.state, kills: sim.state.stats.enemiesKilled };
  };
  const a = sampleRng(7), aAgain = sampleRng(7), b = sampleRng(8);
  assert.deepEqual(aAgain, a, 'same seed -> identical RNG state + kill count after identical play');
  assert.notEqual(b.rng, a.rng, 'different seed -> divergent RNG stream');
});
