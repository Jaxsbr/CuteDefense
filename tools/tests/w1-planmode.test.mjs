/**
 * SPEC-W1 — Remove the skip-the-countdown valve entirely; keep pause usable
 * DURING a wave (freeze-the-board).
 *
 * The "I'm ready!" valve (readyNow / _readyValve / confirmReady / waves.readyBonusCoins)
 * is deleted wholesale. Pause (togglePause freeze) survives untouched and works
 * mid-wave. These tests fail RED against the pre-removal code and pass after the deletion.
 *
 * Drives only the public command API + source scans (mirrors plan-mode.test.mjs #7 guard).
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

// 1. The valve sim API is gone.
test('W1 #1 readyNow() is removed from the Simulation command surface', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  assert.equal(typeof sim.readyNow, 'undefined', 'readyNow must not exist on Simulation');
});

// 2. The config lever is gone.
test('W1 #2 waves.readyBonusCoins config lever is removed', () => {
  assert.equal(CONFIG.waves.readyBonusCoins, undefined, 'readyBonusCoins must be undefined (key deleted)');
});

// 3. No 'ready' / valve wiring left in the input + render source.
test('W1 #3 no ready/valve wiring in InputController or Renderer source', () => {
  const inputSrc = readFileSync(path.join(HERE, '../../v2/input/InputController.js'), 'utf8');
  assert.ok(!/case ['"]ready['"]/.test(inputSrc), "no case 'ready' in dispatch");
  assert.ok(!/readyNow/.test(inputSrc), 'no readyNow reference in input');

  const renderSrc = readFileSync(path.join(HERE, '../../v2/render/Renderer.js'), 'utf8');
  assert.ok(!/_readyValve/.test(renderSrc), 'no _readyValve symbol in renderer');
  assert.ok(!/confirmReady/.test(renderSrc), 'no confirmReady symbol in renderer');
  assert.ok(!/_readyArmed/.test(renderSrc), 'no _readyArmed flag in renderer');

  const policySrc = readFileSync(path.join(HERE, '../balance/policies.mjs'), 'utf8');
  assert.ok(!/readyAwareOptimal/.test(policySrc), 'no readyAwareOptimal policy left');
});

// 4. Pause-during-wave is preserved: freeze a live mid-wave phase, resume advances it.
test('W1 #4 pause still freezes mid-wave (spawning/active) and resumes cleanly', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 300, prepMs: 300, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 3, formation: 'single' }] }] },
  });
  const sim = new Simulation(cfg, { seed: 4, mapIndex: 0 });
  sim.startGame();
  advance(sim, 1500); // into spawning/active with an enemy on the path
  const enemy = sim.state.enemies.find(e => e.alive && !e.reachedGoal);
  assert.ok(enemy, 'an enemy is on the path mid-wave');
  assert.notEqual(sim.state.wave.phase, 'prepare', 'we are past prepare (mid-wave)');

  sim.togglePause();
  assert.equal(sim.state.status, 'paused', 'toggled into pause mid-wave');
  const phaseClock = sim.state.wave.phaseClock, ex = enemy.x, prog = enemy.progress;
  advance(sim, 3000); // many ticks while frozen
  assert.equal(sim.state.status, 'paused', 'stays paused across ticks');
  assert.equal(sim.state.wave.phaseClock, phaseClock, 'wave phase clock frozen mid-wave');
  assert.equal(enemy.x, ex, 'enemy x frozen mid-wave');
  assert.equal(enemy.progress, prog, 'enemy progress frozen mid-wave');

  sim.togglePause();
  assert.equal(sim.state.status, 'playing', 'resumes to playing');
  advance(sim, 600);
  assert.ok(enemy.progress > prog || !enemy.alive, 'enemy advanced (or died) after resume');
});
