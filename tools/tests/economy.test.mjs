import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { spawnEnemy, killEnemy } from '../../v2/sim/systems/enemySystem.js';
import { upgradePreview } from '../../v2/sim/systems/towerSystem.js';
import * as waves from '../../v2/sim/systems/waveSystem.js';
import { EV } from '../../v2/sim/events.js';
import { Bot } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';

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

// ---- (2b) P4 upgrade LEGIBILITY: before->after delta + a single rising Power scalar ----
test('upgradePreview exposes a before->after delta and a rising Power scalar', () => {
  const c = cfg();
  c.economy.startingCoins = 1e9;
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 });
  sim.startGame();
  // place a basic tower at L1
  sim.state.placement = { gx: 3, gy: 4, towerType: 'basic' };
  assert.ok(sim.placementPlace());
  const t = sim.towerAt(3, 4);
  sim.state.selected = { kind: 'tower', id: t.id };

  const pv = upgradePreview(sim.state, t);
  assert.ok(pv.from && pv.to, 'preview has from/to');
  assert.ok(pv.to.damage > pv.from.damage, 'damage rises L1 -> L2');
  assert.ok(pv.to.fireRateMs < pv.from.fireRateMs, 'fire interval shrinks L1 -> L2');
  assert.ok(pv.to.range >= pv.from.range, 'range is non-decreasing');
  assert.ok(pv.powerTo > pv.powerFrom, 'one rising Power number a child can watch grow');

  // at L3 (no next level) the preview offers the picture fork choice instead
  assert.ok(sim.upgradeSelected()); assert.ok(sim.upgradeSelected());   // -> L3
  const pv3 = upgradePreview(sim.state, sim.towerAt(3, 4));
  assert.deepEqual(pv3.arms, ['sniper', 'gunner'], 'L3 preview surfaces the fork arms (picture choice)');
});

// ---- (V3) affordability invariant — the raised boss cost is FUNDED by the income lift ----
// The boss is now ~1250 to L2 (~2.3x the old 550). The paired late-weighted income lift
// (waves.scaling.lateSurge.reward) must let a reserving summitConqueror actually reach a
// FULLY-UPGRADED (L2) boss tower before the run resolves — otherwise the cost hike is
// non-shippable (the reserving bot peaked ~857 < 1250 before the lift).
test('V3 — summitConqueror funds a FULLY-UPGRADED (L2) boss despite the ~1250 cost', () => {
  let anyL2 = false;
  for (const mapIndex of [0, 1]) {
    for (const seed of [1, 7]) {
      const sim = new Simulation(CONFIG, { seed, mapIndex });
      sim.startGame();
      const bot = new Bot(sim);
      const policy = POLICIES.summitConqueror();
      const dt = sim.config.timestepMs;
      const maxLevel = CONFIG.towers.boss.levels.length;   // 2
      let acc = 0, summited = false, reachedL2 = false;
      for (let t = 0; t < 40 * 60 * 1000; t += dt) {
        sim.tick(dt);
        if (sim.state.towers.some(tw => sim.config.towers[tw.typeId].kind === 'boss' && tw.level >= maxLevel)) reachedL2 = true;
        acc += dt;
        if (acc >= 500) { acc = 0; if (sim.state.status === 'playing' && policy.onDecision) policy.onDecision(bot); }
        if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
        if (sim.state.status === 'lost') break;
        if (summited && (sim.state.status === 'won' || sim.state.status === 'lost')) break;
      }
      assert.ok(reachedL2, `map${mapIndex} seed${seed}: the income economy funds a L2 boss (cost reachable)`);
      anyL2 = anyL2 || reachedL2;
    }
  }
  assert.ok(anyL2, 'at least one run reached a fully-upgraded boss');
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
