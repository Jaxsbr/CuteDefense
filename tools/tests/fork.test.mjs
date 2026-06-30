/**
 * P4 — reversible max-level IDENTITY FORK (the adapted boss-tower).
 *
 * At L3 each tower forks ONCE into one of two PICTURE-ONLY arms:
 *   basic  -> Sniper (long-range crit, reuses combat.critChance/critMult)
 *           | Gunner (faster fire, reuses fireRateMs)
 *   strong -> Bomber (bigger AoE, reuses aoe.radius)
 *           | Froster (adds slow via the ONE shared P3 slow term in effectiveSpeed)
 *
 * The first fork is FREE (the felt L3 reward); switching arms costs economy.reForkCost
 * (the recurring late-game coin sink). Stats live in gameConfig.js; only Froster needs
 * new logic and it REUSES the single shared slow field (no second slow mechanic).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { levelStats, effectiveStats } from '../../v2/sim/systems/towerSystem.js';
import { fire, update as projUpdate } from '../../v2/sim/systems/projectileSystem.js';
import { spawnEnemy, effectiveSpeed } from '../../v2/sim/systems/enemySystem.js';
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
function cfg() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.economy.startingCoins = 1e9;     // enough to place + upgrade + re-fork freely
  return c;
}

// Place a tower at (gx,gy) on a buildable cell and bring it to a given level.
function placeAt(sim, gx, gy, type, level = 1) {
  sim.state.placement = { gx, gy, towerType: type };
  assert.ok(sim.placementPlace(), 'tower placed');
  const t = sim.towerAt(gx, gy);
  sim.state.selected = { kind: 'tower', id: t.id };
  for (let l = 1; l < level; l++) assert.ok(sim.upgradeSelected(), `upgraded to L${l + 1}`);
  return t;
}

// ---------------------------------------------------------------------------
test('forkSelected requires max level (L3)', () => {
  const sim = new Simulation(cfg(), { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 1);
  assert.equal(sim.forkSelected('sniper'), false, 'cannot fork at L1');
  assert.equal(t.fork, null);
  assert.ok(sim.upgradeSelected());                 // L2
  assert.equal(sim.forkSelected('sniper'), false, 'cannot fork at L2');
  assert.equal(t.fork, null);
  assert.ok(sim.upgradeSelected());                 // L3
  assert.equal(sim.forkSelected('sniper'), true, 'forks at L3');
  assert.equal(t.fork, 'sniper');
});

// ---------------------------------------------------------------------------
test('forking basic -> Sniper applies range + crit overrides', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  assert.equal(sim.forkSelected('sniper'), true);
  const f = c.towers.basic.forks.sniper;
  const base = levelStats(c, 'basic', 3);
  const es = effectiveStats(sim.state, t);
  assert.equal(es.range, base.range * f.rangeMult, 'Sniper extends range');
  // a projectile carries the Sniper crit override
  const target = spawnEnemy(sim.state, { typeId: 'basic', hp: 1000, speed: 0, reward: 1 });
  target.x = t.x + 0.5; target.y = t.y;
  fire(sim.state, t, target, es);
  const p = sim.state.projectiles[sim.state.projectiles.length - 1];
  assert.equal(p.critChance, f.critChance, 'projectile carries Sniper critChance');
  assert.equal(p.critMult, f.critMult, 'projectile carries Sniper critMult');
});

// ---------------------------------------------------------------------------
test('forking basic -> Gunner shortens the fire interval', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  assert.equal(sim.forkSelected('gunner'), true);
  const base = levelStats(c, 'basic', 3);
  const es = effectiveStats(sim.state, t);
  assert.equal(es.fireRateMs, base.fireRateMs * c.towers.basic.forks.gunner.fireRateMult);
  assert.ok(es.fireRateMs < base.fireRateMs, 'Gunner fires strictly faster');
});

// ---------------------------------------------------------------------------
test('forking strong -> Bomber widens the AoE (projectile carries it)', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'strong', 3);
  assert.equal(sim.forkSelected('bomber'), true);
  const baseR = c.towers.strong.aoe.radius;
  const es = effectiveStats(sim.state, t);
  assert.equal(es.aoeRadius, baseR * c.towers.strong.forks.bomber.aoeRadiusMult, 'Bomber widens AoE');
  const target = spawnEnemy(sim.state, { typeId: 'basic', hp: 1000, speed: 0, reward: 1 });
  target.x = t.x; target.y = t.y;
  fire(sim.state, t, target, es);
  const p = sim.state.projectiles[sim.state.projectiles.length - 1];
  assert.equal(p.aoeRadius, es.aoeRadius, 'fired bomb carries the widened AoE');
});

// ---------------------------------------------------------------------------
test('Froster fork slows on hit via the ONE shared slow field', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const s = sim.state;
  s.clock = 5000;                               // a nonzero clock to make slowUntil meaningful
  const t = placeAt(sim, 3, 4, 'strong', 3);
  assert.equal(sim.forkSelected('froster'), true);
  const fr = c.towers.strong.forks.froster.slow;
  const es = effectiveStats(s, t);
  // a target sitting at the tower cell — guaranteed inside the bomb radius
  const enemy = spawnEnemy(s, { typeId: 'basic', hp: 1e6, speed: 0, reward: 1 });
  enemy.x = t.x; enemy.y = t.y;
  fire(s, t, enemy, es);
  // step projectiles directly to impact
  for (let i = 0; i < 60 && s.projectiles.length; i++) projUpdate(s, c.timestepMs);
  assert.ok(enemy.slowUntil > s.clock, 'enemy slowUntil set into the future');
  assert.equal(enemy.slowFactor, fr.factor, 'enemy slowFactor === froster factor');
  assert.equal(effectiveSpeed(s, enemy), enemy.baseSpeed * fr.factor, 'effectiveSpeed reflects the shared slow term');
  // exactly one slow path: no froster-private slow state leaks onto the enemy
  assert.equal(enemy.frosterUntil, undefined, 'no second froster-private slow field');
  assert.equal(enemy.frozenUntil, undefined, 'no second slow field');
});

// ---------------------------------------------------------------------------
test('first fork is free; switching arms charges reForkCost; same arm is a no-op', () => {
  const c = cfg();
  c.economy.startingCoins = 1000;
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  const coinsAtL3 = sim.state.coins;
  assert.equal(sim.forkSelected('sniper'), true);
  assert.equal(sim.state.coins, coinsAtL3, 'first fork is free (firstForkCost 0)');
  const before = sim.state.coins;
  assert.equal(sim.forkSelected('gunner'), true);
  assert.equal(sim.state.coins, before - c.economy.reForkCost, 'switching arms costs reForkCost');
  const after = sim.state.coins;
  assert.equal(sim.forkSelected('gunner'), false, 'forking the SAME arm is a no-op');
  assert.equal(sim.state.coins, after, 'no charge for a same-arm no-op');
});

// ---------------------------------------------------------------------------
test('re-fork is reversible (effectiveStats reflects each arm in turn)', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  const base = levelStats(c, 'basic', 3);
  assert.equal(sim.forkSelected('sniper'), true);
  assert.equal(effectiveStats(sim.state, t).range, base.range * c.towers.basic.forks.sniper.rangeMult);
  assert.equal(sim.forkSelected('gunner'), true);
  assert.equal(effectiveStats(sim.state, t).fireRateMs, base.fireRateMs * c.towers.basic.forks.gunner.fireRateMult);
  assert.equal(effectiveStats(sim.state, t).range, base.range, 'gunner does not extend range');
  assert.equal(sim.forkSelected('sniper'), true);
  assert.equal(effectiveStats(sim.state, t).range, base.range * c.towers.basic.forks.sniper.rangeMult, 'back to sniper');
});

// ---------------------------------------------------------------------------
test('an invalid arm for a type is rejected (no charge, fork unchanged)', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  const before = sim.state.coins;
  assert.equal(sim.forkSelected('bomber'), false, 'bomber is a strong-only arm');
  assert.equal(t.fork, null, 'fork unchanged');
  assert.equal(sim.state.coins, before, 'no charge for an invalid arm');
});

// ---------------------------------------------------------------------------
test('TOWER_FORK event fires with id + arm', () => {
  const c = cfg();
  const sim = new Simulation(c, { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'strong', 3);
  let ev = null;
  sim.bus.on(EV.TOWER_FORK, (p) => ev = p);
  sim.state.frameEvents = [];
  assert.equal(sim.forkSelected('froster'), true);
  assert.ok(ev && ev.id === t.id && ev.arm === 'froster', 'bus emitted TOWER_FORK with id + arm');
  assert.ok(sim.state.frameEvents.some(e => e.type === EV.TOWER_FORK && e.id === t.id && e.arm === 'froster'),
    'frameEvents carries TOWER_FORK');
});
