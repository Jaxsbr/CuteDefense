/**
 * P3 — One active FIELD FREEZE ability (the single shared slow mechanism).
 *
 * castFreeze() slows ALL alive enemies via effectiveSpeed() for freeze.durationMs,
 * on a precious cooldown (first cast available after ~33% of a cooldown). It is
 * legal ONLY while status==='playing' (the P1 command-legality dependency). It
 * deals NO damage — it must DENT, not DELETE, the public bosses. The slow is one
 * multiplicative term in effectiveSpeed (the seam P4's Froster reuses).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { effectiveSpeed, applySlow } from '../../v2/sim/systems/enemySystem.js';
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

function freezeConfig(over = {}) {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.lives.max = 1000;
  c.economy.startingCoins = 1e9;
  c.waves.firstPrepMs = 100; c.waves.prepMs = 100; c.waves.betweenWaveMs = 999999;
  c.waves.patterns = over.patterns || [{ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }];
  Object.assign(c.freeze, over.freeze || {});
  return c;
}
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }
function dist(sim, e) { return e.pathIndex + e.progress; } // monotone travel measure along the line

// ---------------------------------------------------------------------------
test('P3 freeze #6 — castFreeze slows ALL alive enemies via effectiveSpeed', () => {
  const cfg = freezeConfig({ freeze: { cooldownMs: 3000 } });
  const ready = cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction;
  const mk = () => { const s = new Simulation(cfg, { seed: 9, mapIndex: 0 }); s.startGame(); return s; };
  const a = mk(), b = mk();
  advance(a, ready + 100); advance(b, ready + 100);

  let castEv = null;
  a.bus.on(EV.FREEZE_CAST, (p) => castEv = p);
  assert.equal(a.castFreeze(), true, 'freeze is ready and casts');
  assert.ok(castEv, 'FREEZE_CAST emitted');
  assert.equal(castEv.activeUntil, a.state.clock + cfg.freeze.durationMs, 'activeUntil = clock + durationMs');

  advance(a, cfg.freeze.durationMs); advance(b, cfg.freeze.durationMs);
  const ea = a.state.enemies.find(e => e.alive);
  const eb = b.state.enemies.find(e => e.alive);
  assert.ok(ea && eb, 'both sims still have a live enemy');
  assert.ok(dist(a, ea) < dist(b, eb) - 0.001, 'frozen enemy advanced strictly LESS than the unfrozen one');
});

// ---------------------------------------------------------------------------
test('P3 freeze #7 — respects cooldown and the ~33% initial ready', () => {
  const cfg = freezeConfig({ freeze: { cooldownMs: 4000 } });
  const ready = cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction;
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  assert.equal(sim.castFreeze(), false, 'NOT castable at clock 0 (initial ready is a fraction of cooldown)');
  advance(sim, ready + sim.config.timestepMs);
  assert.equal(sim.castFreeze(), true, 'castable once the initial-ready fraction elapses');
  assert.equal(sim.castFreeze(), false, 'cannot immediately re-cast (on cooldown)');
  advance(sim, cfg.freeze.cooldownMs);
  assert.equal(sim.castFreeze(), true, 'castable again after a full cooldown');
});

// ---------------------------------------------------------------------------
test('P3 freeze #8 — illegal unless playing (P1 command-legality)', () => {
  const cfg = freezeConfig({ freeze: { cooldownMs: 3000 } });
  const ready = cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction;
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, ready + 200); // make it OFF cooldown so only status blocks it
  for (const status of ['paused', 'menu', 'won', 'lost']) {
    sim.state.status = status;
    const before = sim.state.freeze.activeUntil;
    assert.equal(sim.castFreeze(), false, `castFreeze illegal while ${status}`);
    assert.equal(sim.state.freeze.activeUntil, before, `activeUntil unchanged while ${status}`);
  }
  sim.state.status = 'playing';
  assert.equal(sim.castFreeze(), true, 'legal again once playing');
});

// ---------------------------------------------------------------------------
test('P3 freeze #9 — DENTS but does not DELETE a public boss', () => {
  const cfg = freezeConfig({
    freeze: { cooldownMs: 4000 },
    patterns: [{ boss: 'boss_shield', enemies: [{ type: 'boss_shield', count: 1, formation: 'single' }] }],
  });
  const sim = new Simulation(cfg, { seed: 4, mapIndex: 0 });
  sim.startGame();
  let bossKilled = false, bossReached = false;
  sim.bus.on(EV.ENEMY_DEATH, ({ isBoss }) => { if (isBoss) bossKilled = true; });
  sim.bus.on(EV.ENEMY_REACH_END, () => { bossReached = true; });
  const livesBefore = sim.state.lives;
  // No towers at all: freeze deals no damage, so the boss must survive and leak.
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 120000 && sim.state.status === 'playing'; t += dt) {
    sim.tick(dt);
    if (sim.castFreeze) sim.castFreeze();   // spam it whenever ready
  }
  assert.equal(bossKilled, false, 'freeze alone never KILLS the boss (deals no damage)');
  assert.equal(bossReached, true, 'the slowed-but-alive boss still reaches the goal');
  assert.equal(sim.state.lives, livesBefore - cfg.enemies.boss_shield.livesCost, 'boss still deducts its livesCost');
});

// ---------------------------------------------------------------------------
test('P3 freeze #10 — composes multiplicatively with a speed boss (one shared slow field)', () => {
  const cfg = freezeConfig({
    freeze: { cooldownMs: 1500 },
    patterns: [{ boss: 'boss_speed', enemies: [{ type: 'boss_speed', count: 1, formation: 'single' }] }],
  });
  // make the speed buff turn on quickly so we measure during its active window
  cfg.enemies.boss_speed = { ...cfg.enemies.boss_speed };
  cfg.enemies.boss_speed.behavior = { ...cfg.enemies.boss_speed.behavior, cooldownMs: 500, durationMs: 8000 };
  const mk = () => { const s = new Simulation(cfg, { seed: 2, mapIndex: 0 }); s.startGame(); return s; };
  const a = mk(), b = mk();
  // advance until the boss's speed buff is active in both (and freeze is ready)
  const ready = cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction;
  const step = (s) => {
    for (let i = 0; i < 6000 / s.config.timestepMs; i++) {
      s.tick(s.config.timestepMs);
      const e = s.state.enemies.find(x => x.typeId === 'boss_speed' && x.alive);
      if (e && e.bs.speedActive && s.state.clock >= ready) return e;
    }
    return null;
  };
  const ea = step(a), eb = step(b);
  assert.ok(ea && eb && ea.bs.speedActive && eb.bs.speedActive, 'both bosses are in their speed-active window');
  assert.equal(a.castFreeze(), true, 'cast freeze on sim A while the boss is speed-boosted');
  const beforeA = ea.pathIndex + ea.progress, beforeB = eb.pathIndex + eb.progress;
  for (let i = 0; i < 10; i++) { a.tick(a.config.timestepMs); b.tick(b.config.timestepMs); }
  const movedA = (ea.pathIndex + ea.progress) - beforeA;
  const movedB = (eb.pathIndex + eb.progress) - beforeB;
  assert.ok(movedA < movedB, `frozen speed-boss moves slower (${movedA.toFixed(3)}) than the unfrozen speed-boss (${movedB.toFixed(3)})`);
});

// ---------------------------------------------------------------------------
// W10 — Freeze cap: a FLOOR on effective speed expressed as a fraction of an
// enemy's OWN base speed. Slows (freeze + Froster) may DENT speed but never drag
// any enemy below this floor — a fast boss keeps meaningful speed while frozen.
// Tests use the pure exported effectiveSpeed + a minimal state, matching the
// "exactly ONE slow path" invariant in enemySystem.

function capState(over = {}) {
  const sim = new Simulation(structuredClone(CONFIG), { seed: 1, mapIndex: 0 });
  Object.assign(sim.state.config.freeze, over);
  return sim.state;
}
function fakeEnemy(baseSpeed, { slowUntil = 0, slowFactor = 1 } = {}) {
  return { baseSpeed, slowUntil, slowFactor, behavior: null, bs: {}, alive: true, reachedGoal: false };
}

test('W10 freeze-cap #1 — high floor BITES: fast enemy retains baseSpeed * minSpeedFraction under freeze', () => {
  const st = capState({ minSpeedFraction: 0.30 }); // above slowMult 0.18 so the floor bites
  st.clock = 0; st.freeze.activeUntil = 1000;       // frozen now
  const e = fakeEnemy(2.7);                          // boss_speed-class baseSpeed
  const v = effectiveSpeed(st, e);
  assert.equal(v, e.baseSpeed * 0.30, 'floored to baseSpeed * minSpeedFraction');
  assert.ok(v > e.baseSpeed * st.config.freeze.slowMult, 'strictly faster than the pre-W10 slowMult-only value');
});

test('W10 freeze-cap #2 — stacked freeze + Froster never drops below the floor', () => {
  const st = capState(); // default minSpeedFraction 0.15
  st.clock = 0; st.freeze.activeUntil = 1000;
  const e = fakeEnemy(2.7);
  applySlow(st, e, 0.5, 1200); // Froster
  const v = effectiveSpeed(st, e);
  const rawProduct = e.baseSpeed * st.config.freeze.slowMult * 0.5; // 0.09 of base, below floor
  assert.ok(rawProduct < e.baseSpeed * st.config.freeze.minSpeedFraction, 'sanity: raw stacked product is below the floor');
  assert.ok(v >= e.baseSpeed * st.config.freeze.minSpeedFraction - 1e-9, 'effective speed never drops below the floor');
});

test('W10 freeze-cap #3 — floor scales with own speed (fast boss > swarm while frozen)', () => {
  const st = capState({ minSpeedFraction: 0.30 });
  st.clock = 0; st.freeze.activeUntil = 1000;
  const fast = fakeEnemy(2.7);
  const slow = fakeEnemy(0.8);
  assert.ok(effectiveSpeed(st, fast) > effectiveSpeed(st, slow), 'fast enemy keeps strictly more frozen speed than a slow one');
});

test('W10 freeze-cap #4 — regression: non-slowed speed is byte-for-byte baseSpeed', () => {
  const st = capState({ minSpeedFraction: 0.30 });
  st.clock = 0; st.freeze.activeUntil = 0; // no freeze
  const e = fakeEnemy(2.7);
  assert.equal(effectiveSpeed(st, e), e.baseSpeed, 'no slow active => exactly baseSpeed (floor must not raise an un-slowed enemy)');
  // speed-boss burst path untouched
  const burst = { baseSpeed: 1.0, slowUntil: 0, slowFactor: 1, behavior: { type: 'speed', multiplier: 2 }, bs: { speedActive: true } };
  assert.equal(effectiveSpeed(st, burst), 2.0, 'speed-boss burst path (baseSpeed * multiplier) unchanged');
});
