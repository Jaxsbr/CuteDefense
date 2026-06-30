/**
 * P5 — REAL PUBLIC WIN at wave 15.
 *
 * The public game (15 known waves, boss at 5/10/15) is now WINNABLE: clearing
 * the wave-15 boss_regenerate fires a permanent, banked celebration. The secret
 * wave-16 split boss is no longer force-fed into the run; it is an opt-in summit
 * (see summit.test.mjs). These tests drive the REAL headless Simulation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import * as waves from '../../v2/sim/systems/waveSystem.js';
import { EV } from '../../v2/sim/events.js';

// Short straight map so a full 15-wave game completes quickly & deterministically.
const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};

function fastConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.waves.firstPrepMs = 200; c.waves.prepMs = 200; c.waves.betweenWaveMs = 100; c.waves.spawnIntervalMs = 250;
  c.economy.startingCoins = 100000;
  // Mechanics fixture (win/summit terminals), NOT a balance fixture: neutralize the
  // W9 late-surge so the fixed heavy build trivially clears the public game on the
  // degenerate test line (the surge is validated by balance-ladder/balance-curve).
  c.waves.scaling.lateSurge = { ...c.waves.scaling.lateSurge, hp: 1, count: 1, speed: 1 };
  return c;
}

// Heavy L3 loadout: AoE strong towers on one flank, basic on the other.
function buildHeavy(sim) {
  let built = 0;
  for (const y of [5, 7]) {
    for (let x = 1; x <= 20; x++) {
      if (!sim.canPlace(x, y)) continue;
      const type = y === 5 ? 'strong' : 'basic';
      sim.state.placement = { gx: x, gy: y, towerType: type };
      if (sim.placementPlace()) {
        built++;
        sim.state.selected = { kind: 'tower', id: sim.towerAt(x, y).id };
        sim.upgradeSelected(); sim.upgradeSelected(); // -> L3
      }
    }
  }
  return built;
}

function advanceUntilTerminal(sim, maxMs = 900000) {
  const dt = sim.config.timestepMs;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    if (sim.state.status === 'won' || sim.state.status === 'lost') return t;
  }
  return -1;
}

// ---------------------------------------------------------------------------
test('public win fires at wave 15, not wave 16', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  const built = buildHeavy(sim);
  assert.ok(built >= 20, `built a strong loadout (${built} towers)`);

  let reached16 = false;
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 900000; t += dt) {
    sim.tick(dt);
    if (sim.state.wave.index === 16) reached16 = true;
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  assert.equal(sim.state.status, 'won', `the public game is WON (lives ${sim.state.lives})`);
  assert.equal(sim.state.wave.index, 15, 'won at the public final wave 15');
  assert.equal(sim.state.stats.wavesCleared, 15, 'all 15 public waves cleared');
  assert.equal(reached16, false, 'the run NEVER reaches the secret wave 16 (no force-feed)');
});

// ---------------------------------------------------------------------------
test('GAME_WON fires exactly once and carries stars in [1,3]', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  buildHeavy(sim);

  let count = 0, payload = null;
  sim.bus.on(EV.GAME_WON, (p) => { count++; payload = p; });

  const finishedAt = advanceUntilTerminal(sim);
  assert.notEqual(finishedAt, -1, 'game terminated');
  assert.equal(sim.state.status, 'won', 'won');
  assert.equal(count, 1, 'GAME_WON fired exactly once');
  assert.ok(payload && Number.isInteger(payload.stars), 'payload carries integer stars');
  assert.ok(payload.stars >= 1 && payload.stars <= 3, `stars in [1,3], got ${payload.stars}`);
  assert.equal(sim.state.publicWinBanked, true, 'the win is banked');
});

// ---------------------------------------------------------------------------
test('isFinalWaveComplete is keyed to publicWaveCount, not patternCount', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  const s = sim.state;
  const pub = waves.publicWaveCount(s);
  assert.ok(pub < waves.patternCount(s), 'there IS a secret wave beyond the public count');

  s.wave.phase = 'complete';
  s.wave.index = pub;
  assert.equal(waves.isFinalWaveComplete(s), true, 'final public wave complete -> true');
  s.wave.index = pub - 1;
  assert.equal(waves.isFinalWaveComplete(s), false, 'one short of the final public wave -> false');
});

// ---------------------------------------------------------------------------
test('BOSS_DEFEATED fires on every public boss wave (5/10/15) with the matching boss id', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  buildHeavy(sim);

  const seen = new Map(); // index -> boss id
  sim.bus.on(EV.BOSS_DEFEATED, ({ index, boss }) => { seen.set(index, boss); });

  const finishedAt = advanceUntilTerminal(sim);
  assert.notEqual(finishedAt, -1, 'game terminated');
  assert.equal(sim.state.status, 'won', 'won the public game');
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), [5, 10, 15], 'a boss-defeated for each public boss wave');
  assert.equal(seen.get(5), 'boss_shield');
  assert.equal(seen.get(10), 'boss_speed');
  assert.equal(seen.get(15), 'boss_regenerate');
});
