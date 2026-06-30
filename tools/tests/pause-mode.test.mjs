/**
 * SPEC-P1 — Pause (inspect-only) + tap-once tray + auto-collect lock-in.
 *
 * V4 reworked plan-mode into a plain Pause: the sim still freezes, but building
 * (place/upgrade/sell/fork) is now ILLEGAL while paused and the auto-pause-on-popup
 * mechanism is gone. The deeper inspect-only contract lives in pause-rework.test.mjs;
 * this file keeps the tray + auto-collect invariants and the renamed pause toggle.
 *
 * TDD spec tests. Mirrors sim.test.mjs helpers (SHORT_MAP, makeConfig, advance).
 * Everything drives the PUBLIC command API only (gridClick / togglePause /
 * selectTray / placementPlace / placementClose / upgradeSelected /
 * sellSelected) exactly as the input layer would.
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
// Place N towers of `type` on buildable cells adjacent to the path via the tray.
function placeAlongPath(sim, type, n) {
  sim.selectTray(type);
  const { path: P, buildable } = sim.state.map;
  let placed = 0;
  for (const p of P) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = p.x + dx, y = p.y + dy;
      if (buildable[y]?.[x] && sim.canPlace(x, y)) {
        if (sim.gridClick(x + 0.5, y + 0.5) === 'placed') placed++;
      }
      if (placed >= n) break;
    }
    if (placed >= n) break;
  }
  sim.selectTray(null);
  return placed;
}

// ---------------------------------------------------------------------------
// 1. INVARIANT — first placement is unchanged & the tray is additive.
test('P1 #1 INVARIANT — first placement unchanged; reachable with zero mode discovery', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 100 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  assert.equal(sim.state.status, 'playing');
  assert.equal(sim.state.trayType, null, 'no tray selected by default');
  const cell = firstBuildable(sim);
  const r = sim.gridClick(cell.x + 0.5, cell.y + 0.5);
  assert.equal(r, 'placement', 'empty buildable cell opens the placement popup');
  assert.deepEqual(sim.state.placement, { gx: cell.x, gy: cell.y, towerType: 'basic' });
  assert.equal(sim.placementPlace(), true);
  assert.ok(sim.towerAt(cell.x, cell.y), 'tower built — identical to today');
  assert.equal(sim.state.trayType, null, 'no tray/mode was required to place');
});

// ---------------------------------------------------------------------------
// 2. Pause freezes the sim (zero ticks) and resumes cleanly.
test('P1 #2 pause freezes the sim (zero ticks) then resumes', () => {
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
  advance(sim, 2000); // many ticks while frozen
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
// 3. Building is ILLEGAL while paused (inspect-only — no risk-free spending).
test('P1 #3 paused blocks all spending (place/upgrade/sell), coins never change', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 500 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  // build a tower LIVE so upgrade/sell have a target
  const cell = firstBuildable(sim);
  sim.selectTray('basic');
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'placed');
  sim.selectTray(null);
  const t = sim.towerAt(cell.x, cell.y);

  // now pause and confirm every spend command is inert
  sim.togglePause();
  assert.equal(sim.state.status, 'paused');
  const before = sim.state.coins;
  sim.selectTray('basic');
  // tray place on another buildable cell does nothing
  let other = null;
  for (let y = 0; y < sim.state.map.rows && !other; y++)
    for (let x = 0; x < sim.state.map.cols && !other; x++)
      if ((x !== cell.x || y !== cell.y) && sim.canPlace(x, y)) other = { x, y };
  assert.equal(sim.gridClick(other.x + 0.5, other.y + 0.5), 'empty', 'tray place blocked while paused');
  assert.equal(sim.towerAt(other.x, other.y), null, 'nothing built while paused');
  sim.selectTray(null);
  // upgrade blocked
  sim.state.selected = { kind: 'tower', id: t.id };
  assert.equal(sim.upgradeSelected(), false, 'upgrade blocked while paused');
  // sell blocked
  assert.equal(sim.sellSelected(), false, 'sell blocked while paused');
  assert.equal(sim.state.coins, before, 'coins never change while paused');
  assert.equal(sim.state.status, 'paused', 'still paused');
});

// ---------------------------------------------------------------------------
// 4. togglePause is playing<->paused ONLY.
test('P1 #4 togglePause is playing<->paused only; no-op from menu/won/lost', () => {
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
// 5. Auto-pause-on-popup is GONE: opening a popup stays 'playing'.
test('P1 #5 opening a popup no longer auto-pauses (auto-pause mechanism removed)', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 100 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const cell = firstBuildable(sim);
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'placement');
  assert.equal(sim.state.status, 'playing', 'popup opens but the clock keeps running');
  assert.equal(sim.state.autoPlanned, undefined, 'autoPlanned state field removed');
  assert.ok(sim.state.placement, 'popup still opens');
  assert.equal(sim.placementPlace(), true, 'placing works under the live clock');
  assert.equal(sim.state.status, 'playing', 'still playing after placing');
  // closing a popup also leaves status untouched
  const cell2 = firstBuildable(sim);
  sim.gridClick(cell2.x + 0.5, cell2.y + 0.5);
  assert.equal(sim.state.status, 'playing');
  sim.placementClose();
  assert.equal(sim.state.status, 'playing', 'closing leaves status playing');
  assert.equal(CONFIG.plan.autoPauseOnPopup, undefined, 'config lever deleted');
});

// ---------------------------------------------------------------------------
// 6. Tap-once tray direct-places, respects affordability, no popup.
test('P1 #6 tap-once tray direct-places, respects affordability, no popup', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 100 } });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  sim.selectTray('strong');
  assert.equal(sim.state.trayType, 'strong');
  const cell = firstBuildable(sim);
  const before = sim.state.coins;
  assert.equal(sim.gridClick(cell.x + 0.5, cell.y + 0.5), 'placed');
  assert.equal(sim.towerAt(cell.x, cell.y).typeId, 'strong');
  assert.equal(sim.state.coins, before - cfg.towers.strong.levels[0].cost);
  assert.equal(sim.state.placement, null, 'no popup opened on the tray fast path');

  // idempotent toggle: tapping the selected tray clears it
  sim.selectTray(null);
  sim.selectTray('strong');
  assert.equal(sim.state.trayType, 'strong');
  sim.selectTray('strong');
  assert.equal(sim.state.trayType, null, 'selecting the active tray toggles it off');

  // unaffordable: places nothing, returns 'empty'
  const cfg2 = makeConfig({ maps: [SHORT_MAP], economy: { ...CONFIG.economy, startingCoins: 1 } });
  const sim2 = new Simulation(cfg2, { seed: 1, mapIndex: 0 });
  sim2.startGame();
  sim2.selectTray('strong');
  const c = firstBuildable(sim2);
  assert.equal(sim2.gridClick(c.x + 0.5, c.y + 0.5), 'empty');
  assert.equal(sim2.towerAt(c.x, c.y), null, 'nothing built when broke');

  // selectTray(null) restores the popup invariant path
  sim.selectTray(null);
  assert.equal(sim.state.trayType, null);
  const cell3 = firstBuildable(sim);
  assert.equal(sim.gridClick(cell3.x + 0.5, cell3.y + 0.5), 'placement', 'popup path restored');
});

// ---------------------------------------------------------------------------
// 7. Auto-collect is locked (no loose coins; no coin-collect command).
test('P1 #7 auto-collect locked — no loose coins ever; no coin command in input', () => {
  // Default map (long real path) so towers actually land kills, mirroring the
  // economy guarantee in sim.test.mjs — but placing via the new tap-once tray.
  const cfg = makeConfig({
    waves: { ...CONFIG.waves, firstPrepMs: 300, prepMs: 300, betweenWaveMs: 200,
      patterns: [{ enemies: [{ type: 'basic', count: 4, formation: 'single' }] }] },
    economy: { ...CONFIG.economy, startingCoins: 1000 },
  });
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  assert.ok(placeAlongPath(sim, 'basic', 6) >= 3, 'placed enough towers');
  const before = sim.state.coins;
  const dt = sim.config.timestepMs;
  let maxLoose = 0;
  for (let t = 0; t < 40000; t += dt) { sim.tick(dt); maxLoose = Math.max(maxLoose, sim.state.coinsList.length); }
  assert.equal(maxLoose, 0, 'no loose coins on the board, ever');
  assert.ok(sim.state.stats.enemiesKilled > 0, 'towers killed enemies');
  assert.ok(sim.state.coins > before, 'kills credited directly to the wallet');

  // The InputController dispatch has NO coin-collect action/command.
  const src = readFileSync(path.join(HERE, '../../v2/input/InputController.js'), 'utf8');
  assert.ok(!/case ['"]coin/i.test(src), 'no coin case in dispatch');
  assert.ok(!/collectCoin/i.test(src), 'no collectCoin command');
});
