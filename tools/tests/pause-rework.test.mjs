/**
 * SPEC-V4 — "Plan" → "Pause" rework: pause is INSPECT-ONLY.
 *
 * Plan-mode (place/upgrade/sell/fork while frozen + auto-pause-on-popup) is
 * demoted to a plain Pause: the sim freezes, the board stays fully visible, you
 * may TAP towers/enemies to inspect, but you cannot spend coins — no place
 * (tray or popup), no upgrade, no sell, no fork. The standalone cast-freeze
 * ABILITY is untouched (separate feature).
 *
 * Drives the PUBLIC command API only (togglePause / gridClick / selectTray /
 * placementPlace / upgradeSelected / sellSelected / forkSelected / castFreeze)
 * plus source scans for the removed auto-pause mechanism.
 *
 * RED against current (plan-mode) code; GREEN after the rework.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

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
function advance(sim, ms) {
  const dt = sim.config.timestepMs;
  for (let t = 0; t < ms; t += dt) sim.tick(dt);
}
function firstBuildable(sim) {
  for (let y = 0; y < sim.state.map.rows; y++)
    for (let x = 0; x < sim.state.map.cols; x++)
      if (sim.canPlace(x, y)) return { x, y };
  throw new Error('no buildable cell');
}

// ---------------------------------------------------------------------------
// 1. Pause BLOCKS the popup path (no spend, no popup).
test('V4 #1 paused gridClick on a buildable cell is inert (no popup, no spend)', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 500 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  const cell = firstBuildable(sim);
  const before = sim.state.coins;
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'empty', 'paused buildable tap returns empty');
  assert.equal(sim.state.placement, null, 'no popup opened while paused');
  assert.equal(sim.towerAt(cell.x, cell.y), null, 'nothing built while paused');
  assert.equal(sim.state.coins, before, 'coins unchanged while paused');
});

// ---------------------------------------------------------------------------
// 2. Pause BLOCKS the tray fast-path.
test('V4 #2 paused tray tap places nothing (tray fast-path blocked)', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 500 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  sim.selectTray('basic');
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  const cell = firstBuildable(sim);
  const before = sim.state.coins;
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'empty', 'tray fast-path blocked while paused');
  assert.equal(sim.towerAt(cell.x, cell.y), null, 'nothing built while paused');
  assert.equal(sim.state.coins, before, 'coins unchanged while paused');
});

// ---------------------------------------------------------------------------
// 3. Pause BLOCKS placementPlace / upgrade / sell / fork.
test('V4 #3 pausing after opening a popup blocks place/upgrade/sell/fork', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 1000 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  // build a tower live first so upgrade/sell/fork have a target
  const cell = firstBuildable(sim);
  sim.selectTray('basic');
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'placed');
  sim.selectTray(null);
  const t = sim.towerAt(cell.x, cell.y);
  sim.state.selected = { kind: 'tower', id: t.id };

  // open a placement popup at another cell while playing, THEN pause
  const cell2 = firstBuildable2(sim, cell);
  assert.equal(sim.gridClick(cell2.x + 0.5, cell2.y + 0.5), 'placement');
  sim.state.selected = { kind: 'tower', id: t.id }; // re-select the existing tower
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');

  const before = sim.state.coins;
  assert.equal(sim.placementPlace(), false, 'placementPlace blocked while paused');
  assert.equal(sim.upgradeSelected(), false, 'upgradeSelected blocked while paused');
  assert.equal(sim.sellSelected(), false, 'sellSelected blocked while paused');
  assert.equal(sim.forkSelected('a'), false, 'forkSelected blocked while paused');
  assert.equal(sim.state.coins, before, 'coins unchanged while paused');
});

function firstBuildable2(sim, skip) {
  for (let y = 0; y < sim.state.map.rows; y++)
    for (let x = 0; x < sim.state.map.cols; x++)
      if ((x !== skip.x || y !== skip.y) && sim.canPlace(x, y)) return { x, y };
  throw new Error('no second buildable cell');
}

// ---------------------------------------------------------------------------
// 4. Inspection still works while paused.
test('V4 #4 paused: tapping an existing tower still selects it (inspection)', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 500 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const cell = firstBuildable(sim);
  sim.selectTray('basic');
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'placed');
  sim.selectTray(null);
  sim.state.selected = { kind: null, id: null };
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'tower', 'tower tap inspects while paused');
  assert.equal(sim.state.selected.kind, 'tower', 'tower selected while paused');
});

// ---------------------------------------------------------------------------
// 5. togglePause is playing<->paused ONLY.
test('V4 #5 togglePause is playing<->paused only; no-op from menu/won/lost', () => {
  const sim = new Simulation(makeConfig(), { seed: 1, mapIndex: 0 });
  assert.equal(sim.state.status, 'menu');
  sim.togglePause();
  assert.equal(sim.state.status, 'menu', 'no-op from menu');
  sim.startGame();
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  sim.togglePause();
  assert.equal(sim.state.status, 'playing');
  sim.state.status = 'won'; sim.togglePause(); assert.equal(sim.state.status, 'won', 'no-op from won');
  sim.state.status = 'lost'; sim.togglePause(); assert.equal(sim.state.status, 'lost', 'no-op from lost');
});

// ---------------------------------------------------------------------------
// 6. Sim still freezes while paused (port of plan #2).
test('V4 #6 sim freezes while paused (zero ticks) then resumes', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 300, prepMs: 300, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 3, formation: 'single' }] }] },
  });
  const sim = new Simulation(cfg, { seed: 4, mapIndex: 0 });
  sim.startGame();
  advance(sim, 1500);
  const enemy = sim.state.enemies.find(e => e.alive && !e.reachedGoal);
  assert.ok(enemy, 'an enemy is on the path');
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  const clock = sim.state.clock, ex = enemy.x, prog = enemy.progress, pc = sim.state.wave.phaseClock;
  advance(sim, 2000);
  assert.equal(sim.state.status, 'paused', 'stays paused across ticks');
  assert.equal(sim.state.clock, clock, 'clock frozen');
  assert.equal(enemy.x, ex, 'enemy x frozen');
  assert.equal(enemy.progress, prog, 'enemy progress frozen');
  assert.equal(sim.state.wave.phaseClock, pc, 'wave phaseClock frozen');
  sim.togglePause();
  advance(sim, 500);
  assert.ok(sim.state.clock > clock, 'clock advances after resume');
  assert.ok(enemy.x !== ex || enemy.reachedGoal, 'enemy moved after resume');
});

// ---------------------------------------------------------------------------
// 7. Cast-freeze still LOCKED while paused (regression guard for the kept ability).
test('V4 #7 cast-freeze stays locked while paused, legal once playing', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], freeze: { ...CONFIG.freeze, cooldownMs: 3000 } });
  const ready = cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction;
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, ready + 200); // off cooldown so only status blocks it
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  assert.equal(sim.castFreeze(), false, 'castFreeze illegal while paused');
  sim.togglePause();
  assert.equal(sim.castFreeze(), true, 'castFreeze legal once playing');
});

// ---------------------------------------------------------------------------
// 8. The auto-pause mechanism is gone (source scans + behavioral check).
test('V4 #8 auto-pause-on-popup mechanism fully removed', () => {
  const simSrc = readFileSync(path.join(HERE, '../../v2/sim/Simulation.js'), 'utf8');
  assert.ok(!/autoPauseOnPopup/.test(simSrc), 'no autoPauseOnPopup in Simulation');
  assert.ok(!/autoPlanned/.test(simSrc), 'no autoPlanned in Simulation');
  assert.ok(!/_resumeAutoPlan/.test(simSrc), 'no _resumeAutoPlan in Simulation');
  assert.ok(!/togglePlanning/.test(simSrc), 'no togglePlanning in Simulation');

  const cfgSrc = readFileSync(path.join(HERE, '../../v2/config/gameConfig.js'), 'utf8');
  assert.ok(!/autoPauseOnPopup/.test(cfgSrc), 'no autoPauseOnPopup in gameConfig');

  const inputSrc = readFileSync(path.join(HERE, '../../v2/input/InputController.js'), 'utf8');
  assert.ok(!/case ['"]plan['"]/.test(inputSrc), "no case 'plan' in dispatch");
  assert.ok(!/togglePlanning/.test(inputSrc), 'no togglePlanning in input');

  // behavioral: opening a popup while playing stays 'playing'
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 100 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const cell = firstBuildable(sim);
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'placement');
  assert.equal(sim.state.status, 'playing', 'opening a popup no longer auto-pauses');
  assert.equal(sim.state.autoPlanned, undefined, 'autoPlanned state field removed');
});
