/**
 * AFFINITY (P2) — soft 2-way tower affinity: the right tool ~2x, wrong tool ~0.5x,
 * neutral 1x. Never immunity (weakMult > 0). The damage source threads from
 * fire() -> impact() -> damageEnemy via p.sourceType, surfaced on ENEMY_HIT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { affinityMult, spawnEnemy, damageEnemy } from '../../v2/sim/systems/enemySystem.js';
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

function makeConfig(overrides = {}) {
  const c = structuredClone(CONFIG);
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'maps') { c.maps = v; continue; }
    c[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...c[k], ...v } : v;
  }
  return c;
}
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }
function freshSim() {
  const sim = new Simulation(makeConfig({ maps: [SHORT_MAP] }), { seed: 1, mapIndex: 0 });
  sim.startGame();
  return sim;
}

// 5a.1
test('affinityMult is right-tool 2x, wrong-tool 0.5x, neutral 1x', () => {
  assert.equal(affinityMult(CONFIG, 'basic', ['evasive']), 2.0);
  assert.equal(affinityMult(CONFIG, 'strong', ['evasive']), 0.5);
  assert.equal(affinityMult(CONFIG, 'strong', ['armored']), 2.0);
  assert.equal(affinityMult(CONFIG, 'basic', []), 1.0);
  assert.equal(affinityMult(CONFIG, null, ['armored']), 1.0);
});

// 5a.2
test('damageEnemy applies the source multiplier to hp', () => {
  const sim = freshSim();
  const mk = () => spawnEnemy(sim.state, { typeId: 'basic', hp: 100, speed: 0, reward: 3, flags: ['evasive'] });
  let e = mk();
  damageEnemy(sim.state, e, 10, { sourceType: 'basic' });   // 10 * 2
  assert.equal(e.hp, 80);
  e = mk();
  damageEnemy(sim.state, e, 10, { sourceType: 'strong' });  // 10 * 0.5
  assert.equal(e.hp, 95);
  e = mk();
  damageEnemy(sim.state, e, 10);                             // no source -> x1
  assert.equal(e.hp, 90);
});

// 5a.3
test('damageEnemy emits an affinity tell on ENEMY_HIT', () => {
  const sim = freshSim();
  const hits = [];
  sim.bus.on(EV.ENEMY_HIT, (p) => hits.push(p));
  const mk = () => spawnEnemy(sim.state, { typeId: 'basic', hp: 100, speed: 0, reward: 3, flags: ['evasive'] });
  damageEnemy(sim.state, mk(), 10, { sourceType: 'basic' });   // right tool
  damageEnemy(sim.state, mk(), 10, { sourceType: 'strong' });  // wrong tool
  damageEnemy(sim.state, mk(), 10);                            // untagged
  const tagged = hits.filter(h => h.affinity);
  assert.equal(tagged[0].affinity, 'strong'); assert.equal(tagged[0].mult, 2);
  assert.equal(tagged[1].affinity, 'weak'); assert.equal(tagged[1].mult, 0.5);
  assert.equal(tagged[2].affinity, 'neutral');
});

// 5a.4
test('fire->impact threads sourceType end-to-end', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 200, prepMs: 200, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 1, formation: 'single', flags: ['evasive'] }] }] },
    economy: { ...CONFIG.economy, startingCoins: 1000 },
  });
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  const hits = [];
  sim.bus.on(EV.ENEMY_HIT, (p) => { if (p.affinity) hits.push(p); });
  // Place a basic tower adjacent to the path so it fires at the evasive enemy.
  const { path, buildable } = sim.state.map;
  let placed = false;
  for (const p of path) {
    for (const [dx, dy] of [[0, 1], [0, -1]]) {
      const x = p.x + dx, y = p.y + dy;
      if (buildable[y]?.[x] && sim.canPlace(x, y)) {
        sim.gridClick(x + 0.5, y + 0.5);
        if (sim.state.placement) { sim.state.placement.towerType = 'basic'; if (sim.placementPlace()) { placed = true; break; } }
      }
    }
    if (placed) break;
  }
  assert.ok(placed, 'placed a basic tower');
  advance(sim, 8000);
  assert.ok(hits.length > 0, 'the basic tower hit the evasive enemy');
  assert.ok(hits.some(h => h.affinity === 'strong'), 'basic vs evasive registers as a right-tool (strong) hit');
});

// 5a.5
test('weakMult never reaches 0 (no hard immunity)', () => {
  assert.ok(CONFIG.combat.affinity.weakMult > 0, 'two towers must never hard-leak an enemy');
});
