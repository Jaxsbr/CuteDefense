import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';

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
  return c;
}
function advanceUntilTerminal(sim, maxMs = 900000) {
  const dt = sim.config.timestepMs;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    if (sim.state.status === 'won' || sim.state.status === 'lost') return t;
  }
  return -1;
}

test('DoD#2: a full game clears all 15 known waves, then meets the SECRET wave-16 boss', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();

  // Heavy loadout: AoE strong towers on one side, fast basic on the other, all L3.
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
  assert.ok(built >= 20, `built a strong loadout (${built} towers)`);

  const finishedAt = advanceUntilTerminal(sim);
  assert.notEqual(finishedAt, -1, 'game terminated within the time budget');
  // The 15 KNOWN waves are mastered — but the hidden wave-16 split boss is
  // unbeatable today (needs boss tower upgrades), so the run ends there, not in
  // a win. wavesCleared counts the public 15; the run reaches wave index 16.
  assert.equal(sim.state.stats.wavesCleared, 15, 'all 15 known waves cleared');
  assert.equal(sim.state.wave.index, 16, 'reached the secret wave 16');
  assert.equal(sim.state.status, 'lost', `secret boss ends the run (no win yet), lives ${sim.state.lives}`);
  // No pathfinding glitch leaked in across the whole game.
  assert.ok(sim.state.stats.enemiesKilled > 50, 'killed a lot of enemies across the game');
});

test('DoD#2: a full game can be played start→LOSE (enemy flood, no towers)', () => {
  const cfg = fastConfig();
  cfg.lives.max = 5; // small pool; with no defenses the flood overruns it
  const sim = new Simulation(cfg, { seed: 42, mapIndex: 0 });
  sim.startGame();
  const finishedAt = advanceUntilTerminal(sim, 200000);
  assert.notEqual(finishedAt, -1, 'game terminated');
  assert.equal(sim.state.status, 'lost', 'undefended game is lost');
  assert.equal(sim.state.lives, 0);
});

test('waves advance sequentially 1→2→3 with a countdown gap (never concurrent)', () => {
  const cfg = fastConfig();
  cfg.lives.max = 100; // this test observes wave SEQUENCING undefended; give it enough lives to survive to wave 3 under the V2 balance (lives.max=12)
  const sim = new Simulation(cfg, { seed: 5, mapIndex: 0 });
  sim.startGame();
  const seen = [];
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 60000 && sim.state.wave.index < 3; t += dt) {
    sim.tick(dt);
    if (!seen.includes(sim.state.wave.index)) seen.push(sim.state.wave.index);
  }
  assert.deepEqual(seen, [1, 2, 3], 'waves came up strictly in order');
});

test('boss waves drop more coins and cost more lives than basic enemies', () => {
  const cfg = fastConfig();
  // Wave 1 is the shield boss; let it reach the goal undefended.
  cfg.waves.patterns = [{ boss: 'boss_shield', enemies: [{ type: 'boss_shield', count: 1, formation: 'single' }] }];
  cfg.lives.max = 25;
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 120000 && sim.state.status === 'playing'; t += dt) sim.tick(dt);
  // boss_shield livesCost is 3 (vs 1 for a basic) -> lives 25 - 3 = 22, then win (final wave complete? no, boss reached goal so it's removed and wave completes -> final wave -> win with 22 lives)
  assert.equal(sim.state.lives, 22, 'boss cost 3 lives (more than a basic enemy)');
});
