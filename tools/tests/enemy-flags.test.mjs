/**
 * ENEMY FLAGS (P2) — composable property flags authored onto base bodies in the
 * wave list (not new enemy types). Flags carry a trait (for affinity) and an
 * optional behavior (regen heal, buffer damage-shield). Legibility cap enforced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { spawnEnemy, damageEnemy } from '../../v2/sim/systems/enemySystem.js';
import { flagMask } from '../../v2/sim/flags.js';

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
function spawnFirst(patternEnemies) {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 0, prepMs: 0, betweenWaveMs: 999999,
      patterns: [{ enemies: patternEnemies }] },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, 120);
  return sim.state.enemies.find(e => e.alive);
}

// 5b.1
test('group.flags propagate schema -> queue -> enemy.traits', () => {
  const e = spawnFirst([{ type: 'basic', count: 1, formation: 'single', flags: ['armored'] }]);
  assert.ok(e, 'enemy spawned');
  assert.ok(e.flags.includes('armored'), 'flags carried onto the live enemy');
  assert.ok(e.traits.includes('armored'), 'flag trait composed into enemy.traits');
});

// 5b.2
test('base-type traits compose with flags', () => {
  const e = spawnFirst([{ type: 'fast', count: 1, formation: 'single', flags: ['armored'] }]);
  assert.ok(e.traits.includes('evasive'), 'fast keeps its base evasive trait');
  assert.ok(e.traits.includes('armored'), 'plus the authored armored flag trait');
});

// 5b.3
test('regen flag attaches the regen behavior (animation-only heal, no state counter)', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 0, prepMs: 0, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 1, formation: 'single', flags: ['regen'] }] }] },
    enemies: { ...CONFIG.enemies, basic: { ...CONFIG.enemies.basic, speed: 0 } },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, 120);
  const e = sim.state.enemies.find(en => en.alive);
  assert.ok(e, 'enemy spawned');
  damageEnemy(sim.state, e, 5);
  const after = e.hp;
  assert.ok(after < e.maxHp, 'enemy was damaged');
  advance(sim, 2000);
  assert.ok(e.hp > after, 'regen flag heals hp back up over time');
  assert.equal(sim.state.regenHealed, undefined, 'no numeric-heal counter introduced into state');
});

// 5b.4
test('flag cap is enforced (clamped to enemyFlags.cap.max)', () => {
  assert.equal(CONFIG.enemyFlags.cap.early, 2);
  assert.equal(CONFIG.enemyFlags.cap.max, 3);
  const e = spawnFirst([{ type: 'basic', count: 1, formation: 'single',
    flags: ['armored', 'evasive', 'regen', 'swarm', 'buffer'] }]);
  assert.ok(e.flags.length <= CONFIG.enemyFlags.cap.max, `flags clamped to max (${e.flags.length})`);
  assert.ok(e.traits.length <= CONFIG.enemyFlags.cap.max, `traits within max (${e.traits.length})`);
});

// 5b.5
test('flagMask is stable regardless of author order', () => {
  assert.equal(flagMask(CONFIG, ['evasive', 'armored']), flagMask(CONFIG, ['armored', 'evasive']));
  assert.equal(flagMask(CONFIG, []), 0);
  assert.notEqual(flagMask(CONFIG, ['armored']), flagMask(CONFIG, ['evasive']));
});

// 5b.6
test('buffer flag reduces damage to nearby enemies until the buffer is killed', () => {
  const cfg = makeConfig({ maps: [SHORT_MAP] });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const buffer = spawnEnemy(sim.state, { typeId: 'basic', hp: 100, speed: 0, reward: 3, flags: ['buffer'] });
  const victim = spawnEnemy(sim.state, { typeId: 'basic', hp: 100, speed: 0, reward: 3 });
  victim.x = buffer.x + 0.5; victim.y = buffer.y;   // well within buffRadius
  damageEnemy(sim.state, victim, 10, { sourceType: 'basic' });
  const mult = CONFIG.enemyFlags.defs.buffer.behavior.buffMult;
  assert.equal(victim.hp, 100 - 10 * mult, 'shielded by the buffer (reduced damage)');
  // kill the buffer, then the victim takes full damage
  buffer.alive = false; buffer.dying = true;
  const before = victim.hp;
  damageEnemy(sim.state, victim, 10, { sourceType: 'basic' });
  assert.equal(victim.hp, before - 10, 'full damage once the umbrella monster is popped');
});
