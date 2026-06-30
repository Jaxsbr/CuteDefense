/**
 * V2.2 OFFENSE — the boss-tower ULTIMATE is now an AIMED, SINGLE-TARGET BEAM that
 * applies damage-over-time (was a full-map AoE nuke). These tests drive the REAL
 * Simulation / beamSystem / enemySystem headlessly:
 *
 *   - target REQUIRED (aim-confirm): castUltimate() with no/dead target -> false,
 *     no beam, no cooldown spent, no event; castUltimate(enemy) -> true, one beam.
 *   - DoT over the window: a single tick removes ~one chunk (small fraction); the
 *     full beam.totalDamage is dealt only after durationMs; cumulative dealt is
 *     capped at totalDamage (never over).
 *   - NEVER instant-kills a hard boss: one full beam on a wave-16-scaled parent
 *     leaves it ALIVE (totalDamage < on-field HP) and one tick removes < 10%.
 *   - SINGLE-TARGET: a cast damages ONLY the aimed enemy; other alive enemies are
 *     untouched (the old AoE "all enemies" contract is DELETED).
 *   - pierces shields: a shielded boss_splitling takes beam DoT mid-shield.
 *   - aiming seams: armUltimate() arms only when ready; gridClick on an enemy while
 *     aiming fires + clears the flag; gridClick on empty cancels.
 *   - boss basic buff: projectile ~2x larger + faster fireRateMs (still >= 3000).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { placeTower, upgradeTower } from '../../v2/sim/systems/towerSystem.js';
import { spawnEnemy } from '../../v2/sim/systems/enemySystem.js';
import { computeScaling } from '../../v2/sim/systems/waveSystem.js';
import { EV } from '../../v2/sim/events.js';

const ARENA = {
  name: 'Arena',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', 'S####################E',
    '......................', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function arenaConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [ARENA];
  c.lives.max = 100000;
  c.economy.startingCoins = 1e9;
  c.waves.firstPrepMs = 10 * 60 * 1000; c.waves.prepMs = 10 * 60 * 1000; c.waves.betweenWaveMs = 999999;
  c.waves.patterns = [{ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }];
  return c;
}
function mkSim() { const s = new Simulation(arenaConfig(), { seed: 5, mapIndex: 0 }); s.startGame(); return s; }
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }
// place + upgrade a boss tower to L2 (ultimate unlocked), off any initial cooldown
function readyBoss(sim) {
  const s = sim.state;
  placeTower(s, 3, 3, 'boss');
  upgradeTower(s, 3, 3);
  advance(sim, s.config.towers.boss.ultimate.cooldownMs);
  return s;
}
function stillEnemy(s, typeId, hp, x = 16, y = 8) {
  const e = spawnEnemy(s, { typeId, hp, speed: 0, reward: 0 });
  e.x = x; e.y = y; e.maxHp = hp;
  return e;
}

// ==========================================================================
// CONFIG — the beam sub-block exists; no flat `damage` nuke field.
// ==========================================================================
test('beam config — ultimate carries a beam DoT block (no flat AoE damage)', () => {
  const u = CONFIG.towers.boss.ultimate;
  assert.equal(u.name, 'Boss Beam', 'renamed to a beam theme');
  assert.equal(u.damage, undefined, 'the flat full-map damage field is GONE');
  assert.ok(u.beam, 'beam sub-block exists');
  assert.ok(u.beam.totalDamage > 0, 'beam.totalDamage configured');
  assert.ok(u.beam.durationMs > 0, 'beam.durationMs configured');
  assert.ok(u.beam.tickMs > 0 && u.beam.tickMs <= u.beam.durationMs, 'beam.tickMs configured');
  assert.equal(u.requireTarget, true, 'aim-confirm: requireTarget');
  assert.equal(u.piercesShield, true, 'pierces shields');
  assert.ok(u.cooldownMs >= 7000, 'LONG cooldown (no spam; well above the old 5000)');
  // the never-instant-kill invariant: a full beam must not exceed the on-field parent HP.
  const sc = computeScaling(CONFIG, CONFIG.waves.patterns.length, true);
  const parentHp = CONFIG.enemies.boss_split.hp * sc.hpMult;
  assert.ok(u.beam.totalDamage < parentHp, `one beam (${u.beam.totalDamage}) < on-field parent HP (${Math.round(parentHp)})`);
});

// ==========================================================================
// AIM-CONFIRM — a cast REQUIRES a live enemy target.
// ==========================================================================
test('beam aim-confirm — no target -> no cast, no cooldown, no beam, no event', () => {
  const sim = mkSim(); const s = readyBoss(sim);
  let cast = 0; sim.bus.on(EV.ULTIMATE_CAST, () => cast++);
  assert.equal(sim.ultimateReady(), true, 'ready');
  assert.equal(sim.castUltimate(), false, 'no target -> false');
  assert.equal(sim.castUltimate(999999), false, 'missing id -> false');
  assert.equal(s.beams.length, 0, 'no beam pushed');
  assert.equal(cast, 0, 'no ULTIMATE_CAST emitted');
  assert.equal(sim.ultimateReady(), true, 'still ready (no cooldown spent)');
});

test('beam aim-confirm — with a live target -> fires once, one beam, one event', () => {
  const sim = mkSim(); const s = readyBoss(sim);
  const e = stillEnemy(s, 'strong', 1e9);
  let cast = 0, payload = null; sim.bus.on(EV.ULTIMATE_CAST, (p) => { cast++; payload = p; });
  assert.equal(sim.castUltimate(e), true, 'fires at a live enemy');
  assert.equal(s.beams.length, 1, 'one beam pushed');
  assert.equal(cast, 1, 'one ULTIMATE_CAST');
  assert.equal(payload.targetId, e.id, 'event carries the targetId');
  assert.equal(payload.damage, undefined, 'no flat damage in the payload');
  assert.equal(sim.ultimateReady(), false, 'now on cooldown');
});

// ==========================================================================
// DoT — chunked over the window, capped at totalDamage.
// ==========================================================================
test('beam DoT — one tick removes ~one chunk; full total only after durationMs; capped', () => {
  const sim = mkSim(); const s = readyBoss(sim);
  const beamCfg = s.config.towers.boss.ultimate.beam;
  const e = stillEnemy(s, 'strong', 1e9);
  const hp0 = e.hp;
  assert.equal(sim.castUltimate(e), true);
  const chunk = beamCfg.totalDamage * beamCfg.tickMs / beamCfg.durationMs;

  // after one tick cadence: ~one chunk gone (not the whole total)
  advance(sim, beamCfg.tickMs + sim.config.timestepMs);
  const afterOne = hp0 - e.hp;
  assert.ok(afterOne > 0, 'DoT started dealing');
  assert.ok(Math.abs(afterOne - chunk) < chunk * 0.5, `~one chunk after one tick (got ${Math.round(afterOne)} vs chunk ${Math.round(chunk)})`);
  assert.ok(afterOne < beamCfg.totalDamage * 0.5, 'far from the full total after one tick');

  // after the whole window: exactly totalDamage, capped (not more)
  advance(sim, beamCfg.durationMs + 500);
  const total = hp0 - e.hp;
  assert.ok(Math.abs(total - beamCfg.totalDamage) <= chunk * 0.01 + 1, `cumulative dealt == totalDamage (got ${Math.round(total)})`);
  assert.equal(s.beams.length, 0, 'beam expired after its window');
});

// ==========================================================================
// NEVER INSTANT-KILL a hard boss; SINGLE-TARGET.
// ==========================================================================
test('beam never instant-kills a wave-16 parent (one cast leaves it alive; one tick < 10%)', () => {
  const sim = mkSim(); const s = readyBoss(sim);
  // the REAL on-field wave-16 parent HP (the arena clone has only 1 pattern, so derive
  // the honest wall from the real CONFIG's secret wave-16 scaling).
  const sc = computeScaling(CONFIG, CONFIG.waves.patterns.length, true);
  const parentHp = Math.round(CONFIG.enemies.boss_split.hp * sc.hpMult);
  const parent = stillEnemy(s, 'boss_split', parentHp);
  const hp0 = parent.hp;
  assert.equal(sim.castUltimate(parent), true);
  // one tick: < 10% removed
  advance(sim, s.config.towers.boss.ultimate.beam.tickMs + sim.config.timestepMs);
  assert.ok((hp0 - parent.hp) < hp0 * 0.10, 'a single tick removes < 10% of the parent');
  // whole beam: still alive
  advance(sim, s.config.towers.boss.ultimate.beam.durationMs + 500);
  assert.ok(parent.alive && parent.hp > 0, `one full beam leaves the parent ALIVE (${Math.round(parent.hp)} HP left)`);
});

test('beam is SINGLE-TARGET — only the aimed enemy is damaged (AoE contract deleted)', () => {
  const sim = mkSim(); const s = readyBoss(sim);
  const target = stillEnemy(s, 'strong', 1e9, 16, 8);
  const bystander = stillEnemy(s, 'strong', 1e9, 10, 7);
  const by0 = bystander.hp;
  assert.equal(sim.castUltimate(target), true);
  advance(sim, s.config.towers.boss.ultimate.beam.durationMs + 500);
  assert.ok(target.hp < 1e9, 'the aimed enemy took the beam');
  assert.equal(bystander.hp, by0, 'a bystander enemy is UNTOUCHED (single-target)');
});

test('beam pierces a shielded shard mid-shield', () => {
  const sim = mkSim(); const s = readyBoss(sim);
  const shard = stillEnemy(s, 'boss_splitling', 1e9);
  shard.bs.shieldActive = true; shard.bs.shieldEndsAt = s.clock + 1e9;
  const hp0 = shard.hp;
  assert.equal(sim.castUltimate(shard), true);
  advance(sim, s.config.towers.boss.ultimate.beam.tickMs * 2 + sim.config.timestepMs);
  assert.ok(shard.hp < hp0, 'the SHIELDED shard took beam damage (shield pierced)');
});

// ==========================================================================
// AIMING — arm/cancel/gridClick seams.
// ==========================================================================
test('aiming — armUltimate arms only when ready; an enemy tap fires + clears; empty cancels', () => {
  const sim = mkSim(); const s = sim.state;
  // not ready (no boss yet) -> arming fails, no aim
  assert.equal(sim.armUltimate(), false, 'not ready -> no arm');
  assert.equal(s.ultimateAiming, false);

  readyBoss(sim);
  const e = stillEnemy(s, 'strong', 1e9, 16, 8);
  assert.equal(sim.armUltimate(), true, 'ready -> arms');
  assert.equal(s.ultimateAiming, true, 'crosshair armed');

  // a tap on EMPTY space cancels the aim (no cast)
  sim.gridClick(1.5, 1.5);
  assert.equal(s.ultimateAiming, false, 'empty tap cancels aim');
  assert.equal(s.beams.length, 0, 'no cast from an empty tap');

  // re-arm, then tap the enemy -> fires + clears
  assert.equal(sim.armUltimate(), true);
  const res = sim.gridClick(e.x, e.y);
  assert.equal(res, 'ultimate', 'an enemy tap while aiming fires the beam');
  assert.equal(s.ultimateAiming, false, 'aim cleared after firing');
  assert.equal(s.beams.length, 1, 'one beam spawned');
});

// ==========================================================================
// BOSS BASIC BUFF — bigger, faster projectile (still a heavy plink).
// ==========================================================================
test('boss basic buff — projectile ~2x larger, fireRateMs faster yet >= 3000', () => {
  const b = CONFIG.towers.boss;
  assert.ok(b.projectile.size >= 24, `boss projectile is large (${b.projectile.size}px, ~2x the old 14)`);
  for (const lvl of b.levels) {
    assert.ok(lvl.fireRateMs >= 3000, `fireRateMs ${lvl.fireRateMs} stays >= 3000 (heavy plink)`);
  }
  assert.ok(b.levels[0].fireRateMs < 5000, 'L1 fire cadence is faster than the old 5000');
  assert.ok(b.levels[1].fireRateMs < 4500, 'L2 fire cadence is faster than the old 4500');
});
