/**
 * SPAWN DIRECTION (P2) — per-wave spawn-direction variety. Some waves enter from
 * the far end of the single path, so *where* you build changes wave-to-wave.
 * Deterministic; default (forward) path is byte-for-byte preserved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { cellCenter } from '../../v2/sim/state.js';

const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function makeConfig(overrides = {}) {
  const c = structuredClone(CONFIG);
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'maps') { c.maps = v; continue; }
    c[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...c[k], ...v } : v;
  }
  return c;
}
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }

function oneWaveSim(pattern, extraEnemy = {}) {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 0, prepMs: 0, betweenWaveMs: 999999, patterns: [pattern] },
    lives: { max: 25 },
    enemies: { ...CONFIG.enemies, basic: { ...CONFIG.enemies.basic, ...extraEnemy } },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  return sim;
}

// 5c.1
test("entry:'end' spawns at the far terminal facing back", () => {
  const sim = oneWaveSim({ entry: 'end', enemies: [{ type: 'basic', count: 1, formation: 'single' }] });
  advance(sim, 120);
  const e = sim.state.enemies.find(en => en.alive);
  assert.ok(e, 'enemy spawned');
  const path = sim.state.map.path;
  const last = path.length - 1;
  assert.equal(e.dir, -1, 'reverse direction');
  assert.equal(e.pathIndex, last, 'starts at the far terminal index');
  assert.ok(e.x > sim.state.map.cols / 2, `spawns near the far (right) end (x=${e.x.toFixed(1)})`);
  assert.ok(Math.abs(e.x - cellCenter(path[last]).x) < 1.0, 'x sits on the far terminal cell');
});

// 5c.2
test('reverse enemy walks toward start and reaches goal exactly once', () => {
  const sim = oneWaveSim({ entry: 'end', enemies: [{ type: 'basic', count: 1, formation: 'single' }] }, { speed: 2.0 });
  advance(sim, 120);
  const e = sim.state.enemies.find(en => en.alive);
  const x0 = e.x;
  advance(sim, 1000);
  const x1 = e.x;
  assert.ok(x1 < x0, `reverse enemy moves leftward (toward start): ${x1.toFixed(1)} < ${x0.toFixed(1)}`);
  const livesBefore = sim.state.lives;
  advance(sim, 30000);
  assert.equal(sim.state.lives, livesBefore - 1, 'reachGoal fires exactly once (one livesCost)');
});

// 5c.3 — regression: default forward path preserved
test('default entry is unchanged (forward) — regression', () => {
  const sim = oneWaveSim({ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }, { speed: 2.0 });
  advance(sim, 120);
  const e = sim.state.enemies.find(en => en.alive);
  const path = sim.state.map.path;
  assert.equal(e.dir, 1, 'forward direction by default');
  assert.equal(e.pathIndex, 0, 'starts at path[0]');
  assert.ok(Math.abs(e.x - cellCenter(path[0]).x) < 1.0, 'x sits on the start cell');
  const x0 = e.x;
  advance(sim, 1000);
  assert.ok(e.x > x0, 'forward enemy moves rightward (toward goal)');
});

// 5c.4 — announcement carries threat + entry for the Recon banner
test('announcement carries threat + entry for the Recon banner', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 5000, prepMs: 5000, betweenWaveMs: 999999,
      patterns: [{ entry: 'end', enemies: [{ type: 'basic', count: 1, formation: 'single', flags: ['armored'] }] }] },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, 500); // still in prepare
  const a = sim.state.wave.announcement;
  assert.ok(a, 'announcement present during prepare');
  assert.equal(a.threat, 'armored', 'Recon banner names the threat');
  assert.equal(a.entry, 'end', 'Recon banner names the entry direction');
});
