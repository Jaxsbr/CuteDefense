/**
 * W7 — In-game RESTART.
 *
 * V1 let a player bail out and start over at any time; V2 only exposed restart on
 * the won/lost overlay. This item adds an in-game RESTART entry point (HUD bottom
 * control row, 2->3 buttons) that lands in a fresh, immediately-playable state
 * with audio intact (the path flows through the W5-repaired restart()/toMenu()
 * that preserves the event bus).
 *
 * Coverage:
 *   1. sim.restart() from playing / won / lost -> a fresh playable state.
 *   2. sim.toMenu() from playing / won / lost -> menu, then startGame() -> playing.
 *   3. render hit-registry: the in-game 'restart' button is reachable while
 *      playing/paused and ABSENT on menu/won/lost (those use their own flows).
 *   4. renderer.confirmRestart() two-tap arm: false then true.
 *   5. InputController._dispatch('restart'): app.restart NOT called on the arming
 *      tap, IS called on the confirming tap.
 *   6. audio-intact cross-check: a bus subscriber armed before the in-game restart
 *      still fires afterwards (the W5 tie, exercised through the W7 path).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';

// ---------------------------------------------------------------------------
// Headless canvas + 2D-context mock. The Renderer bakes offscreen canvases via
// shapes.makeCanvas (document.createElement) and draws through a 2D ctx; neither
// exists in node. A Proxy ctx returns a no-op function for any method, a gradient
// stub for create*Gradient, and a width stub for measureText. addHit() still runs
// for real, so the hit registry is faithfully populated.
function makeMockCtx() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient' || prop === 'createPattern') return () => gradient;
      if (prop === 'getImageData') return () => ({ data: [0, 0, 0, 0] });
      if (prop === 'canvas') return { width: 0, height: 0 };
      return () => {};
    },
    set(t, prop, value) { t[prop] = value; return true; },
  });
}
const MOCK_CTX = makeMockCtx();
globalThis.document = globalThis.document || {
  createElement: () => ({ width: 0, height: 0, getContext: () => MOCK_CTX }),
};
// Import the Renderer AFTER the document polyfill is in place.
const { Renderer } = await import('../../v2/render/Renderer.js');
const { InputController } = await import('../../v2/input/InputController.js');

// Drive a sim to 'lost' (genuine terminal): drop lives, let _checkWinLose fire.
function driveToLost(sim) {
  sim.startGame();
  sim.state.lives = 0;
  sim.tick(sim.config.timestepMs);
  assert.equal(sim.state.status, 'lost', 'sanity: reached lost');
}
// Drive to 'won' (genuine terminal) on a short straight map with a heavy loadout.
function driveToWon(cfg) {
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  for (const y of [5, 7]) for (let x = 1; x <= 20; x++) {
    if (!sim.canPlace(x, y)) continue;
    sim.state.placement = { gx: x, gy: y, towerType: y === 5 ? 'strong' : 'basic' };
    if (sim.placementPlace()) {
      sim.state.selected = { kind: 'tower', id: sim.towerAt(x, y).id };
      sim.upgradeSelected(); sim.upgradeSelected();
    }
  }
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 900000; t += dt) { sim.tick(dt); if (sim.state.status === 'won' || sim.state.status === 'lost') break; }
  assert.equal(sim.state.status, 'won', 'sanity: reached won');
  return sim;
}
function fastConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [{
    name: 'TestLine',
    grid: [
      '......................', '......................', '......................',
      '......................', '......................', '......................',
      'S####################E', '......................', '......................',
      '......................', '......................', '......................',
    ],
  }];
  c.waves.firstPrepMs = 200; c.waves.prepMs = 200; c.waves.betweenWaveMs = 100; c.waves.spawnIntervalMs = 250;
  c.economy.startingCoins = 100000;
  // Mechanics fixture (restart/toMenu), NOT a balance fixture: neutralize the W9
  // late-surge so the fixed heavy build reliably reaches a WON state on the test line.
  c.waves.scaling.lateSurge = { ...c.waves.scaling.lateSurge, hp: 1, count: 1, speed: 1 };
  return c;
}

// Assert the sim is a fresh, immediately-playable game.
function assertFreshPlayable(sim, cfg, label) {
  const s = sim.state;
  assert.equal(s.status, 'playing', `${label}: status playing`);
  assert.equal(s.lives, cfg.lives.max, `${label}: lives at max`);
  assert.equal(s.coins, cfg.economy.startingCoins, `${label}: coins at starting`);
  assert.equal(s.clock, 0, `${label}: clock reset`);
  assert.equal(s.wave.index, 1, `${label}: wave index 1`);
  assert.equal(s.enemies.length, 0, `${label}: no enemies`);
  assert.equal(s.towers.length, 0, `${label}: no towers`);
  assert.equal(s.nextId, 1, `${label}: id counter reset`);
}

// ---------------------------------------------------------------------------
test('W7 #1 — sim.restart() from playing/won/lost yields a fresh playable state', () => {
  // from playing
  const p = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  p.startGame();
  p.restart({ seed: 2, mapIndex: 0 });
  assertFreshPlayable(p, CONFIG, 'from playing');

  // from lost
  const l = new Simulation(CONFIG, { seed: 3, mapIndex: 0 });
  driveToLost(l);
  l.restart({ seed: 4, mapIndex: 0 });
  assertFreshPlayable(l, CONFIG, 'from lost');

  // from won
  const cfg = fastConfig();
  const w = driveToWon(cfg);
  w.restart({ seed: 5, mapIndex: 0 });
  assertFreshPlayable(w, cfg, 'from won');
});

// ---------------------------------------------------------------------------
test('W7 #2 — sim.toMenu() from playing/won/lost yields menu, then playable', () => {
  const p = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  p.startGame();
  p.toMenu();
  assert.equal(p.state.status, 'menu', 'from playing -> menu');
  p.startGame();
  assert.equal(p.state.status, 'playing', 'from menu -> playing');

  const l = new Simulation(CONFIG, { seed: 3, mapIndex: 0 });
  driveToLost(l);
  l.toMenu();
  assert.equal(l.state.status, 'menu', 'from lost -> menu');
  assert.equal(l.state.lives, CONFIG.lives.max, 'menu state is pristine (lives)');

  const w = driveToWon(fastConfig());
  w.toMenu();
  assert.equal(w.state.status, 'menu', 'from won -> menu');
});

// ---------------------------------------------------------------------------
test('W7 #3 — in-game restart button reachable while playing/paused, absent on menu/won/lost', () => {
  const r = new Renderer(MOCK_CTX, CONFIG);
  const hasRestart = (sim) => { r.render(sim.state); return r.hits.some(h => h.action === 'restart'); };

  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  assert.ok(hasRestart(sim), 'restart button present while playing');

  sim.togglePause();
  assert.equal(sim.state.status, 'paused', 'sanity: paused');
  assert.ok(hasRestart(sim), 'restart button present while paused');

  sim.state.status = 'menu';
  assert.ok(!hasRestart(sim), 'no in-game restart button on the menu (Play flow only)');

  sim.state.status = 'won';
  assert.ok(!hasRestart(sim), 'no in-game restart button on won (overlay Play Again only)');

  sim.state.status = 'lost';
  assert.ok(!hasRestart(sim), 'no in-game restart button on lost (overlay Play Again only)');
});

// ---------------------------------------------------------------------------
test('W7 #4 — renderer.confirmRestart() arms then fires (two-tap)', () => {
  const r = new Renderer(MOCK_CTX, CONFIG);
  assert.equal(r.confirmRestart(), false, 'first tap arms (no fire)');
  assert.equal(r.confirmRestart(), true, 'second tap confirms (fire)');
  // after firing it disarms again
  assert.equal(r.confirmRestart(), false, 're-arms after firing');
});

// ---------------------------------------------------------------------------
test('W7 #5 — _dispatch("restart") needs a confirm tap before restarting', () => {
  let restarts = 0;
  const app = { restart() { restarts++; } };
  const r = new Renderer(MOCK_CTX, CONFIG);
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const ic = Object.create(InputController.prototype);
  ic.sim = sim; ic.app = app; ic.renderer = r;

  ic._dispatch('restart');
  assert.equal(restarts, 0, 'arming tap does not restart');
  ic._dispatch('restart');
  assert.equal(restarts, 1, 'confirming tap restarts');
});

// ---------------------------------------------------------------------------
test('W7 #6 — audio stays armed across the in-game restart (W5 tie)', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const bus0 = sim.bus;
  let fired = 0;
  bus0.on('tower:place', () => { fired++; });

  // in-game restart (the W7 path) goes through sim.restart()
  sim.restart({ seed: 2, mapIndex: 0 });
  assert.equal(sim.bus, bus0, 'bus identity preserved (subscriber stays armed)');

  // emit the audible event on the post-restart game; the pre-restart subscriber fires.
  sim.bus.emit('tower:place', {});
  assert.equal(fired, 1, 'subscriber armed before restart fired after restart');
});
