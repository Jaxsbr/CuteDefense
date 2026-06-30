/**
 * P3 — Recoverable tower NAP (disabler) + anti-stun-lock governor.
 *
 * A silly `disabler` enemy fires a telegraphed sleepy-beam at its NEAREST
 * eligible tower; the tower naps (skips firing) for nap.durationMs, then wakes
 * and is immune for nap.immunityMs (so it can never be chain-napped). A disabler
 * past nap.maxPathFraction never beams (never near a leak).
 *
 * These drive the REAL Simulation. Tuned constants live in gameConfig.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { EV } from '../../v2/sim/events.js';

const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};

// Build a cloned config for fast, deterministic disabler tests: a single
// disabler on the short line, short prep, and a quick nap cadence.
function napConfig(over = {}) {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.economy.startingCoins = 1e9;
  c.lives.max = 1000;
  c.waves.firstPrepMs = 300; c.waves.prepMs = 300; c.waves.betweenWaveMs = 999999;
  c.waves.patterns = [{ enemies: [{ type: 'disabler', count: 1, formation: 'single' }] }];
  // Keep the disabler put + alive so positions/targets are predictable.
  c.enemies.disabler = { ...c.enemies.disabler, speed: 0, hp: 1e6 };
  c.enemies.disabler.behavior = { ...c.enemies.disabler.behavior, cooldownMs: 300 };
  Object.assign(c.nap, over.nap || {});
  return c;
}

function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }

// Place a tower directly via the popup path (deterministic, no tray).
function place(sim, gx, gy, type) {
  sim.state.placement = { gx, gy, towerType: type };
  return sim.placementPlace();
}

// ---------------------------------------------------------------------------
test('P3 nap #1 — disabler naps its NEAREST eligible tower, not a far one', () => {
  const cfg = napConfig();
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  // near the start (in beamRange of the disabler at path[0]) and far down the line.
  assert.ok(place(sim, 1, 5, 'basic'), 'near tower placed');
  assert.ok(place(sim, 18, 5, 'basic'), 'far tower placed');
  const near = sim.towerAt(1, 5), far = sim.towerAt(18, 5);

  const stuns = [];
  sim.bus.on(EV.TOWER_STUN, (p) => stuns.push(p));

  advance(sim, 2500); // past first napCdAt (300) + telegraph (900)
  assert.ok(near.stunnedUntil > sim.state.clock, 'NEAR tower is napping');
  assert.equal(far.stunnedUntil, 0, 'FAR tower (out of beamRange) is untouched');
  assert.ok(stuns.some(s => s.towerId === near.id), 'TOWER_STUN fired for the near tower');
  assert.ok(!stuns.some(s => s.towerId === far.id), 'no TOWER_STUN for the far tower');
});

// ---------------------------------------------------------------------------
test('P3 nap #2 — a napping tower fires ZERO projectiles, then resumes after recovery', () => {
  const cfg = napConfig();
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  assert.ok(place(sim, 1, 5, 'basic'), 'tower placed in range of the disabler');
  const tw = sim.towerAt(1, 5);

  const fires = [];
  let stun = null, wakes = 0;
  sim.bus.on(EV.PROJECTILE_FIRE, (p) => { if (p.towerId === tw.id) fires.push(sim.state.clock); });
  sim.bus.on(EV.TOWER_STUN, (p) => { if (p.towerId === tw.id) stun = { ...p, at: sim.state.clock }; });
  sim.bus.on(EV.TOWER_WAKE, (p) => { if (p.towerId === tw.id) wakes++; });

  advance(sim, 1600);                 // up to / into the nap
  assert.ok(stun, 'tower got stunned');
  const napStart = stun.untilClock - stun.durationMs;
  advance(sim, cfg.nap.durationMs + 2500); // through the nap and well past wake
  assert.equal(wakes, 1, 'TOWER_WAKE fired exactly once');
  // No projectile from this tower landed during the nap window.
  const during = fires.filter(c => c >= napStart && c < stun.untilClock);
  assert.equal(during.length, 0, 'ZERO projectiles fired while napping');
  // It resumed after waking.
  const after = fires.filter(c => c >= stun.untilClock);
  assert.ok(after.length > 0, 'tower resumes firing after it wakes');
});

// ---------------------------------------------------------------------------
test('P3 nap #3 — governor: a freshly-woken tower is immune for nap.immunityMs (no chain-nap)', () => {
  const cfg = napConfig();
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  assert.ok(place(sim, 1, 5, 'basic'));
  const tw = sim.towerAt(1, 5);
  const stuns = [];
  sim.bus.on(EV.TOWER_STUN, (p) => { if (p.towerId === tw.id) stuns.push({ ...p, at: sim.state.clock }); });

  advance(sim, cfg.nap.telegraphMs + 1500);   // first nap lands
  assert.equal(stuns.length, 1, 'first nap landed');
  const firstUntil = tw.stunnedUntil;
  // Advance through recovery into the immunity window.
  advance(sim, cfg.nap.durationMs);
  assert.ok(tw.stunImmuneUntil > sim.state.clock, 'tower is immune right after waking');
  const countAfterWake = stuns.length;
  // Sit inside the immunity window; the disabler keeps trying but cannot re-nap it.
  advance(sim, cfg.nap.immunityMs - cfg.nap.durationMs - 800);
  assert.equal(stuns.length, countAfterWake, 'NOT re-stunned during the immunity window');
  assert.equal(tw.stunnedUntil, firstUntil, 'stunnedUntil unchanged during immunity');
  // Once immunity lapses, a fresh beam CAN re-nap it.
  advance(sim, cfg.nap.immunityMs + cfg.nap.telegraphMs + 1000);
  assert.ok(stuns.length > countAfterWake, 'can be re-napped after immunity lapses');
});

// ---------------------------------------------------------------------------
test('P3 nap #4 — telegraph precedes the nap by nap.telegraphMs', () => {
  const cfg = napConfig();
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  assert.ok(place(sim, 1, 5, 'basic'));
  const tw = sim.towerAt(1, 5);

  let beam = null, stun = null;
  let stunnedAtBeamTime = null;
  sim.bus.on(EV.DISABLER_BEAM, (p) => {
    if (p.towerId !== tw.id) return;
    beam = { ...p, at: sim.state.clock };
    stunnedAtBeamTime = tw.stunnedUntil;     // tower must still be awake during the wind-up
  });
  sim.bus.on(EV.TOWER_STUN, (p) => { if (p.towerId === tw.id) stun = { ...p, at: sim.state.clock }; });

  advance(sim, cfg.nap.telegraphMs + 700);
  assert.ok(beam, 'DISABLER_BEAM telegraph fired');
  assert.ok(stun, 'the nap landed');
  // telegraph fires telegraphMs before the beam fire time.
  assert.ok(Math.abs((beam.fireAtClock - cfg.nap.telegraphMs) - beam.at) <= sim.config.timestepMs,
    'beam telegraph starts telegraphMs before the fire time');
  assert.equal(stunnedAtBeamTime, 0, 'tower was still firing (not stunned) when the telegraph began');
  assert.ok(stun.at >= beam.fireAtClock - sim.config.timestepMs, 'the stun only lands at/after the fire time');
});

// ---------------------------------------------------------------------------
test('P3 nap #5 — never near a leak: a disabler past nap.maxPathFraction starts no beam', () => {
  const cfg = napConfig();
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  // Place a tower the disabler WOULD nap if it were allowed to.
  assert.ok(place(sim, 1, 5, 'basic'));
  const tw = sim.towerAt(1, 5);
  // Spawn the disabler, then shove it past the leak guard.
  advance(sim, 400); // let the wave spawn the disabler
  const e = sim.state.enemies.find(x => x.typeId === 'disabler');
  assert.ok(e, 'disabler spawned');
  const last = sim.state.map.path.length - 1;
  e.pathIndex = last;                 // way past last * maxPathFraction
  e.bs.napCdAt = 0;                   // make it eager to beam

  let beams = 0, stuns = 0;
  sim.bus.on(EV.DISABLER_BEAM, () => beams++);
  sim.bus.on(EV.TOWER_STUN, () => stuns++);
  advance(sim, cfg.enemies.disabler.behavior.cooldownMs + cfg.nap.telegraphMs + 1500);
  assert.equal(beams, 0, 'no telegraph when past the leak guard');
  assert.equal(stuns, 0, 'no nap when past the leak guard');
  assert.equal(tw.stunnedUntil, 0, 'tower stays awake');
});
