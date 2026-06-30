/**
 * W6 — BUG: unrounded stat numbers spill the tower card.
 *
 * The Sniper fork at L3 computes range 3 * 1.6 = 4.800000000000001, which the
 * renderer printed raw. fmtStat() is the single pure formatter every displayed
 * numeric routes through: rounds to a config-driven precision and drops trailing
 * zeros (String(Number)) so we get "4.8" / "138" / "2.5", never "2.50".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtStat } from '../../v2/render/format.js';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { effectiveStats } from '../../v2/sim/systems/towerSystem.js';

const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function cfg() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.economy.startingCoins = 1e9;
  return c;
}
function placeAt(sim, gx, gy, type, level = 1) {
  sim.state.placement = { gx, gy, towerType: type };
  assert.ok(sim.placementPlace(), 'tower placed');
  const t = sim.towerAt(gx, gy);
  sim.state.selected = { kind: 'tower', id: t.id };
  for (let l = 1; l < level; l++) assert.ok(sim.upgradeSelected(), `upgraded to L${l + 1}`);
  return t;
}

test('fmtStat rounds the documented Sniper spill', () => {
  assert.equal(fmtStat(3 * 1.6), '4.8');        // 4.800000000000001 -> "4.8"
  assert.equal(fmtStat(120 * 1.15), '138');     // exact int stays clean
  assert.equal(fmtStat(2.5), '2.5');            // no trailing-zero noise
  assert.equal(fmtStat(18), '18');
});

test('fmtStat is total — non-finite / non-number pass through as String', () => {
  assert.equal(fmtStat(NaN), 'NaN');
  assert.equal(fmtStat(Infinity), 'Infinity');
  assert.equal(fmtStat(undefined), 'undefined');
});

test('fmtStat respects an explicit decimals argument', () => {
  assert.equal(fmtStat(4.800000000000001, 0), '5');
  assert.equal(fmtStat(4.46, 1), '4.5');
});

test('integration: forked Sniper L3 range formats to 4.8 with no long float', () => {
  const sim = new Simulation(cfg(), { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  assert.equal(sim.forkSelected('sniper'), true);
  const es = effectiveStats(sim.state, t);
  const out = fmtStat(es.range, CONFIG.visual.statDecimals);
  assert.equal(out, '4.8');
  assert.ok(!/\d\.\d{4,}/.test(out), `no long float in "${out}"`);
});
