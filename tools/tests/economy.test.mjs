import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { spawnEnemy, killEnemy } from '../../v2/sim/systems/enemySystem.js';
import * as waves from '../../v2/sim/systems/waveSystem.js';
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
function cfg() { const c = structuredClone(CONFIG); c.maps = [SHORT_MAP]; return c; }
const HEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

// ---- (1) coins credited directly to the wallet; nothing dropped on the board ----
test('killing an enemy credits its reward straight to the wallet (no coin on the board)', () => {
  const sim = new Simulation(cfg(), { seed: 1, mapIndex: 0 });
  sim.startGame();
  const before = sim.state.coins;
  const e = spawnEnemy(sim.state, { typeId: 'basic', hp: 10, speed: 0, reward: 7 });
  killEnemy(sim.state, e);
  assert.equal(sim.state.coins, before + 7, 'reward added straight to the wallet');
  assert.equal(sim.state.coinsList.length, 0, 'no collectable coin entity is created');
});

test('coins are never dropped on the board during a wave (no manual collection needed)', () => {
  const c = cfg();
  c.waves.firstPrepMs = 200; c.waves.prepMs = 200; c.waves.spawnIntervalMs = 250;
  c.waves.patterns = [{ enemies: [{ type: 'basic', count: 5, formation: 'single' }] }];
  c.economy.startingCoins = 1000;
  const sim = new Simulation(c, { seed: 3, mapIndex: 0 });
  sim.startGame();
  // a loadout that reliably kills (so the test is meaningful)
  for (const x of [5, 10, 15]) {
    sim.state.placement = { gx: x, gy: 5, towerType: 'basic' };
    if (sim.placementPlace()) {
      sim.state.selected = { kind: 'tower', id: sim.towerAt(x, 5).id };
      sim.upgradeSelected(); sim.upgradeSelected(); // -> L3 (range 7, fast)
    }
  }
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 60000; t += dt) {
    sim.tick(dt);
    assert.equal(sim.state.coinsList.length, 0, 'board never has loose coins');
    if (sim.state.status !== 'playing') break;
  }
  assert.ok(sim.state.stats.enemiesKilled > 0, 'enemies were killed');
});

// ---- (2) end-of-wave 25% bonus, animated + sfx ----
test('completing a wave awards 25% of that wave\'s earnings as a bonus (with sfx + pulse)', () => {
  const sim = new Simulation(cfg(), { seed: 9, mapIndex: 0 });
  sim.startGame();
  const s = sim.state;
  // Force the wave into 'active' with no remaining enemies and a known earnings total.
  s.wave.phase = 'active';
  s.wave.earnings = 100;
  s.enemies = [];
  const before = s.coins;
  s.frameEvents = [];
  waves.update(s, sim.config.timestepMs);
  assert.equal(s.wave.phase, 'complete', 'wave completed');
  assert.equal(s.coins, before + 25, '25% of 100 earnings awarded as a bonus');
  assert.ok(s.frameEvents.some(e => e.type === EV.WAVE_BONUS && e.amount === 25), 'WAVE_BONUS event fired with amount');
  assert.ok((s.coinPulseEnd || 0) > 0, 'coin display pulse animation triggered');
});

test('wave earnings reset between waves (bonus is per-wave, not cumulative)', () => {
  const c = cfg();
  c.waves.firstPrepMs = 100; c.waves.prepMs = 100; c.waves.betweenWaveMs = 100; c.waves.spawnIntervalMs = 200;
  const sim = new Simulation(c, { seed: 4, mapIndex: 0 });
  sim.startGame();
  // After starting, earnings should be a clean 0 for wave 1.
  assert.equal(sim.state.wave.earnings, 0, 'earnings start at 0 for the wave');
});

// ---- (3) crash fix: coin sprite colors are always valid hex ----
test('coin sprite colors are valid hex for every state (fixes addColorStop crash)', async () => {
  const colors = await import('../../v2/render/colors.js');
  assert.equal(typeof colors.withAlpha, 'function', 'withAlpha helper exists');
  assert.equal(typeof colors.coinColors, 'function', 'coinColors helper exists');
  // The exact crash input: appending alpha to an already-8-digit color must NOT yield 10 digits.
  assert.match(colors.withAlpha('#FF888888', '66'), HEX);
  assert.notEqual(colors.withAlpha('#FF888888', '66'), '#FF88888866');
  assert.match(colors.withAlpha('#FF8888', '66'), HEX);
  for (const phase of ['normal', 'warning', 'expired']) {
    const c = colors.coinColors(phase);
    for (const key of ['body', 'border', 'glow']) {
      assert.match(c[key], HEX, `coin ${phase}.${key} is valid hex`);
      assert.match(colors.withAlpha(c[key], '66'), HEX, `coin ${phase}.${key}+alpha is valid hex`);
    }
  }
});
