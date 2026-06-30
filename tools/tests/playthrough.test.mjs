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
  // Mechanics fixture (start->win / start->lose playthrough), NOT a balance fixture:
  // neutralize the W9 late-surge so the fixed heavy build clears the public game on
  // the degenerate test line (the surge is validated by balance-ladder/balance-curve).
  c.waves.scaling.lateSurge = { ...c.waves.scaling.lateSurge, hp: 1, count: 1, speed: 1 };
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

// Heavy loadout: AoE strong towers on one side, fast basic on the other, all L3.
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

// P5 PARITY FLIP — the public game is now WINNABLE. A heavy L3 loadout clears all
// 15 known waves and WINS at wave 15 (was: force-fed into the unbeatable wave-16
// boss and lost). The secret boss is now an opt-in summit, exercised separately below.
test('DoD#2: a heavy full game WINS the public game at wave 15', () => {
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
  assert.equal(sim.state.stats.wavesCleared, 15, 'all 15 known waves cleared');
  assert.equal(sim.state.wave.index, 15, 'won at the public final wave 15');
  assert.equal(sim.state.status, 'won', `the public game is WON, lives ${sim.state.lives}`);
  assert.equal(reached16, false, 'never force-fed into the secret wave 16');
  // No pathfinding glitch leaked in across the whole game.
  assert.ok(sim.state.stats.enemiesKilled > 50, 'killed a lot of enemies across the game');
});

// P5 — the SAME heavy build, taking the opt-in summit, reaches the secret wave 16
// and LOSES (the split boss stays unbeatable); the banked public win is never revoked.
test('DoD#2: with continueToSummit the same build reaches wave 16 and loses (summit stays unbeatable)', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  buildHeavy(sim);

  // First bank the public win.
  let summited = false;
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 2400000; t += dt) {
    sim.tick(dt);
    if (sim.state.status === 'won' && !summited) { assert.equal(sim.continueToSummit(), true); summited = true; continue; }
    if (sim.state.status === 'lost') break;
  }
  assert.equal(summited, true, 'the summit dare was accepted after the public win');
  assert.equal(sim.state.wave.index, 16, 'the summit reaches the secret wave 16');
  assert.equal(sim.state.status, 'lost', 'the unbeatable split boss ends the summit in a loss');
  assert.equal(sim.state.publicWinBanked, true, 'the public victory is NEVER revoked');
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
