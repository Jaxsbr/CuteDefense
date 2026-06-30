/**
 * W2 — FLAG LEGEND on the pre-wave Recon banner. The announcement must carry the
 * FULL set of incoming flags (ordered/deduped/capped), and the config must supply
 * plain-words label+legend per flag plus a numeric `recon` layout block, so the
 * renderer draws an icon+words legend with NO magic numbers / hardcoded copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';

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
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }

function prepareAnnouncement(pattern) {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 5000, prepMs: 5000, betweenWaveMs: 999999, patterns: [pattern] },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, 500); // still in prepare
  return sim.state.wave.announcement;
}

// 1 — multi-flag wave: threats collects BOTH flags across groups, ordered by
// enemyFlags.order, deduped.
test('announcement.threats collects all incoming flags ordered by enemyFlags.order', () => {
  const a = prepareAnnouncement({
    enemies: [
      { type: 'basic', count: 1, formation: 'single', flags: ['evasive'] },
      { type: 'basic', count: 1, formation: 'single', flags: ['armored'] },
    ],
  });
  assert.ok(a, 'announcement present during prepare');
  assert.ok(Array.isArray(a.threats), 'announcement carries a threats array');
  // order in config is ['armored','evasive',...] so armored comes first.
  assert.deepEqual(a.threats, ['armored', 'evasive'], 'ordered by enemyFlags.order, deduped');
});

// 1b — dedupe + cap: many distinct flags collapse to <= cap.max, first by order.
test('announcement.threats dedupes and caps to enemyFlags.cap.max', () => {
  const order = CONFIG.enemyFlags.order;
  const cap = CONFIG.enemyFlags.cap.max;
  const a = prepareAnnouncement({
    enemies: [
      { type: 'basic', count: 1, formation: 'single', flags: [order[3], order[1]] },
      { type: 'basic', count: 1, formation: 'single', flags: [order[1], order[0]] }, // dup order[1]
      { type: 'basic', count: 1, formation: 'single', flags: [order[2], order[4]] },
    ],
  });
  assert.equal(a.threats.length, cap, `capped to cap.max (${cap})`);
  // no duplicates
  assert.equal(new Set(a.threats).size, a.threats.length, 'no duplicate flags');
  // first cap entries of order, restricted to those present
  const present = order.filter(f => [order[0], order[1], order[2], order[3], order[4]].includes(f));
  assert.deepEqual(a.threats, present.slice(0, cap), 'first cap.max by enemyFlags.order');
});

// 2 — backward compat: single threat still mirrors threats[0].
test('announcement.threat stays === threats[0] (backward compat)', () => {
  const a = prepareAnnouncement({
    enemies: [{ type: 'basic', count: 1, formation: 'single', flags: ['armored'] }],
  });
  assert.equal(a.threat, 'armored', 'single threat still set for old consumers');
  assert.equal(a.threat, a.threats[0], 'threat mirrors threats[0]');
});

// 3 — config: every flag has plain-words label + legend so the renderer always
// has words for whatever appears.
test('every enemyFlags def has a non-empty label and legend', () => {
  for (const flag of CONFIG.enemyFlags.order) {
    const def = CONFIG.enemyFlags.defs[flag];
    assert.ok(def, `def exists for ${flag}`);
    assert.equal(typeof def.label, 'string', `${flag}.label is a string`);
    assert.ok(def.label.trim().length > 0, `${flag}.label non-empty`);
    assert.equal(typeof def.legend, 'string', `${flag}.legend is a string`);
    assert.ok(def.legend.trim().length > 0, `${flag}.legend non-empty`);
  }
});

// 4 — config: recon layout block has numeric keys + a string entryLabel, so the
// renderer carries no magic numbers / hardcoded copy.
test('enemyFlags.recon supplies numeric layout + string entryLabel', () => {
  const recon = CONFIG.enemyFlags.recon;
  assert.ok(recon && typeof recon === 'object', 'enemyFlags.recon exists');
  for (const k of ['glyphR', 'rowGap', 'labelSize', 'legendSize', 'padY']) {
    assert.equal(typeof recon[k], 'number', `recon.${k} is numeric`);
    assert.ok(Number.isFinite(recon[k]), `recon.${k} finite`);
  }
  assert.equal(typeof recon.entryLabel, 'string', 'recon.entryLabel is a string');
  assert.ok(recon.entryLabel.trim().length > 0, 'recon.entryLabel non-empty');
});
