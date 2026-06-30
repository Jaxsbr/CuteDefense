/**
 * P5 — L3 SPRITE-FIT (#8).
 *
 * Tower visual scale is decoupled from the grid footprint: the drawn body radius
 * is clamped to towers.footprintScaleCap so no tower body overflows its tile.
 * Config-driven invariant — no canvas needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';

// Only real tower defs (the towers block also carries scalar footprint keys).
const TOWER_TYPES = Object.keys(CONFIG.towers).filter(k => CONFIG.towers[k] && Array.isArray(CONFIG.towers[k].levels));

test('every tower level body fits inside its tile (clamped to the footprint cap)', () => {
  const cap = CONFIG.towers.footprintScaleCap;
  const margin = CONFIG.towers.footprintMargin;
  assert.ok(typeof cap === 'number' && cap > 0, 'footprintScaleCap is configured');
  assert.ok(typeof margin === 'number' && margin >= 0, 'footprintMargin is configured');
  for (const type of TOWER_TYPES) {
    const def = CONFIG.towers[type];
    def.levels.forEach((lvl, i) => {
      const effDiameter = 2 * Math.min(lvl.sizeScale, cap);
      assert.ok(effDiameter <= 1 - margin,
        `${type} L${i + 1}: clamped body diameter ${effDiameter.toFixed(3)} must fit a tile with ${margin} margin`);
    });
  }
});

test('the cap actually binds the L3 footprint (it is doing real work)', () => {
  assert.ok(CONFIG.towers.basic.levels[2].sizeScale > CONFIG.towers.footprintScaleCap,
    'basic L3 raw sizeScale exceeds the cap, so the clamp is non-vacuous');
  assert.ok(CONFIG.towers.strong.levels[2].sizeScale > CONFIG.towers.footprintScaleCap,
    'strong L3 raw sizeScale exceeds the cap, so the clamp is non-vacuous');
});
