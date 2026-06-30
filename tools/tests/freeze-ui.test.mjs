/**
 * W4 — Freeze ability UI: off the play grid, reads as a player ABILITY.
 *
 * Pure UI/input item. The renderer itself is canvas-bound (untestable headlessly),
 * so the two decisions it makes are extracted into the pure module v2/render/abilityHud.js:
 *   - freezeSlotRect(layout, cfg)  -> HUD-space rect (must sit OFF the play grid)
 *   - freezeUiState(state, cfg)    -> 'ready'|'active'|'cooldown'|'locked'
 *   - freezeCastable(state)        -> only true in 'ready'
 *
 * These tests pin (a) the slot geometry into the left dock gutter (gx < 0), and
 * (b) the four-state machine + its lock-step with castFreeze legality. A 5th test
 * re-asserts the P3 freeze sim numbers are byte-identical (this pass is UI-only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { freezeSlotRect, freezeUiState, freezeCastable } from '../../v2/render/abilityHud.js';

const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function uiConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.lives.max = 1000;
  c.economy.startingCoins = 1e9;
  c.waves.firstPrepMs = 100; c.waves.prepMs = 100; c.waves.betweenWaveMs = 999999;
  c.waves.patterns = [{ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }];
  return c;
}
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }

// ---------------------------------------------------------------------------
test('W4 freeze-ui #1 — slot sits OFF the play grid (in the left HUD dock)', () => {
  const r = freezeSlotRect(CONFIG.layout, CONFIG);
  assert.ok(r.x >= 0, 'slot x is non-negative');
  assert.ok(r.x + r.w <= CONFIG.layout.gridOffsetX,
    `slot right edge (${r.x + r.w}) is within the dock, left of the board (${CONFIG.layout.gridOffsetX})`);
});

// ---------------------------------------------------------------------------
test('W4 freeze-ui #2 — slot clears the build tray and stays on-canvas', () => {
  const r = freezeSlotRect(CONFIG.layout, CONFIG);
  assert.ok(r.y > 0, 'slot top is below the canvas top');
  assert.ok(r.y + r.h <= CONFIG.layout.canvasH - 180,
    `slot bottom (${r.y + r.h}) sits above the build tray top (${CONFIG.layout.canvasH - 180})`);
});

// ---------------------------------------------------------------------------
test('W4 freeze-ui #3 — freezeUiState classifies all four states', () => {
  const cfg = uiConfig();
  const sim = new Simulation(cfg, { seed: 9, mapIndex: 0 });
  sim.startGame();
  const s = sim.state;
  const readyAt = s.freeze.readyAt;

  // fresh playing, clock < readyAt -> cooldown (charging toward first cast)
  assert.equal(freezeUiState(s, cfg), 'cooldown', 'before initial-ready fraction => cooldown');

  // advance past readyAt -> ready
  advance(sim, readyAt + cfg.timestepMs);
  assert.equal(freezeUiState(s, cfg), 'ready', 'after initial-ready elapses => ready');

  // cast -> active (clock < activeUntil)
  assert.equal(sim.castFreeze(), true, 'freeze casts when ready');
  assert.equal(freezeUiState(s, cfg), 'active', 'just-cast, mid-duration => active');

  // not playing -> locked (active window wins only while active; let it lapse first)
  advance(sim, cfg.freeze.durationMs + cfg.timestepMs);
  sim.togglePause();
  assert.equal(s.status, 'paused', 'sanity: now paused');
  assert.equal(freezeUiState(s, cfg), 'locked', 'not playing => locked');
});

// ---------------------------------------------------------------------------
test('W4 freeze-ui #4 — castable ONLY in ready (affordance ⇔ castFreeze legality)', () => {
  // active
  let s = { status: 'playing', clock: 0, freeze: { activeUntil: 1000, readyAt: 0 } };
  assert.equal(freezeUiState(s, null), 'active');
  assert.equal(freezeCastable(s), false, 'active is not castable');
  // ready
  s = { status: 'playing', clock: 5000, freeze: { activeUntil: 0, readyAt: 4000 } };
  assert.equal(freezeUiState(s, null), 'ready');
  assert.equal(freezeCastable(s), true, 'ready IS castable');
  // cooldown
  s = { status: 'playing', clock: 5000, freeze: { activeUntil: 0, readyAt: 9000 } };
  assert.equal(freezeUiState(s, null), 'cooldown');
  assert.equal(freezeCastable(s), false, 'cooldown is not castable');
  // locked
  s = { status: 'paused', clock: 5000, freeze: { activeUntil: 0, readyAt: 0 } };
  assert.equal(freezeUiState(s, null), 'locked');
  assert.equal(freezeCastable(s), false, 'locked is not castable');
});

// ---------------------------------------------------------------------------
test('W4 freeze-ui #5 — freeze sim contract unchanged (UI-only pass)', () => {
  // numbers stay byte-identical to the P3 freeze
  assert.equal(CONFIG.freeze.durationMs, 2500, 'durationMs unchanged');
  assert.equal(CONFIG.freeze.cooldownMs, 32000, 'cooldownMs unchanged');
  assert.equal(CONFIG.freeze.initialReadyFraction, 0.33, 'initialReadyFraction unchanged');
  // one cast still slows all alive enemies (the P3 invariant)
  const cfg = uiConfig();
  cfg.freeze = { ...cfg.freeze, cooldownMs: 3000 };
  const ready = cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction;
  const mk = () => { const x = new Simulation(cfg, { seed: 7, mapIndex: 0 }); x.startGame(); return x; };
  const a = mk(), b = mk();
  advance(a, ready + 100); advance(b, ready + 100);
  assert.equal(a.castFreeze(), true, 'freeze casts');
  advance(a, cfg.freeze.durationMs); advance(b, cfg.freeze.durationMs);
  const ea = a.state.enemies.find(e => e.alive), eb = b.state.enemies.find(e => e.alive);
  assert.ok(ea && eb, 'both sims still have a live enemy');
  const da = ea.pathIndex + ea.progress, db = eb.pathIndex + eb.progress;
  assert.ok(da < db - 0.001, 'frozen enemy advanced strictly less than the unfrozen one');
});
