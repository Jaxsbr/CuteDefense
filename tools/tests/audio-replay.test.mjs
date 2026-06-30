/**
 * AUDIO-REPLAY REGRESSION (W5).
 *
 * BUG: after losing/winning and tapping "Play Again", every replay was silent.
 * Root cause: AudioBridge wires ~20 bus.on(...) subscriptions once, against the
 * bus instance that lives inside state (state.bus). restart()/toMenu() rebuilt
 * state from the pure factory, minting a NEW bus and orphaning every AudioBridge
 * subscription on the now-dead old bus -> total silence on replay.
 *
 * Fix (sim-side, root cause): preserve the existing event bus across the state
 * rebuild in restart() and toMenu(). The bus is infrastructure / a coupling
 * point, not per-play gameplay state, so carrying it forward keeps the pristine
 * restart guarantee while keeping every subscriber armed.
 *
 * These two assertions FAIL on the pre-fix code and PASS after.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { AudioBridge } from '../../v2/audio/AudioBridge.js';

// Place a tower through the command API on the first buildable tile (fires
// EV.TOWER_PLACE, an audible event). Returns whether a tower was placed.
function placeOneTower(sim) {
  const s = sim.state;
  for (let y = 0; y < s.map.rows; y++)
    for (let x = 0; x < s.map.cols; x++)
      if (sim.canPlace(x, y)) {
        s.placement = { gx: x, gy: y, towerType: 'basic' };
        if (sim.placementPlace()) return true;
      }
  return false;
}

// ---------------------------------------------------------------------------
test('event bus identity survives restart() (subscribers stay armed)', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const bus0 = sim.bus;
  sim.restart({ seed: 2, mapIndex: 0 });
  assert.equal(sim.bus, bus0, 'event bus is preserved across restart');
});

test('event bus identity survives toMenu() (subscribers stay armed)', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const bus0 = sim.bus;
  sim.toMenu();
  assert.equal(sim.bus, bus0, 'event bus is preserved across toMenu');
});

// ---------------------------------------------------------------------------
test('AudioBridge stays armed across a lose->replay cycle (end-to-end)', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();

  // Real AudioBridge wired to the real sim bus. In node, `new Audio()` throws,
  // so the pools stay empty; stub `play` so we count triggers directly off the
  // bus->handler wiring (the thing this bug breaks).
  const audio = new AudioBridge(sim.bus, { muted: false });
  let plays = 0;
  audio.play = () => { plays++; };

  // First play: placing a tower fires EV.TOWER_PLACE -> a play.
  assert.ok(placeOneTower(sim), 'placed a tower on first play');
  assert.ok(plays > 0, 'first play: audio fired off the bus');

  // Simulate the "lose -> Play Again" flow.
  sim.state.lives = 0;
  sim.tick(sim.config.timestepMs);           // _checkWinLose -> status 'lost'
  assert.equal(sim.state.status, 'lost', 'sim reached lost state');
  sim.restart({ seed: 2, mapIndex: 0 });

  // Replay: audio must fire AGAIN. Pre-fix this is 0 (orphaned bus).
  plays = 0;
  assert.ok(placeOneTower(sim), 'placed a tower on replay');
  assert.ok(plays > 0, 'replay: audio re-armed and fired off the new game');
});
