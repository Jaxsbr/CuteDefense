/**
 * Enemy system — spawning, movement, boss behaviors, death/split, and the
 * single-source lives ledger.
 *
 * Movement is EXACT per-segment linear interpolation between path-cell centers
 * (no low-pass smoothing), so an enemy is always on its path segment and never
 * cuts a corner onto an open tile (the structural fix for V1 Bug #2).
 *
 * livesCost is fixed on the entity at spawn and subtracted EXACTLY ONCE when the
 * enemy's reachedGoal flips false→true — no parallel counters, no cache-and-diff
 * (the structural fix for V1 Bug #1).
 */
import { EV } from '../events.js';
import { genId, cellCenter } from '../state.js';
import { creditCoins } from './economySystem.js';
import { clampFlags, composeTraits } from '../flags.js';

// Soft 2-way tower affinity (P2). Right tool -> strongMult, wrong tool ->
// weakMult, neutral/no-source -> neutralMult. NEVER 0x (see weakMult > 0). Pure.
export function affinityMult(cfg, sourceType, traits) {
  const aff = cfg.combat.affinity;
  if (!sourceType) return aff.neutralMult;
  const mine = aff.counters[sourceType] || [];
  const ts = traits || [];
  for (const t of ts) if (mine.includes(t)) return aff.strongMult;     // right tool
  // Wrong tool: only under-perform if SOME tower would have countered this enemy.
  for (const list of Object.values(aff.counters))
    for (const t of ts) if (list.includes(t)) return aff.weakMult;
  return aff.neutralMult;                                              // affinity-irrelevant
}

// Damage reduction from any alive `buffer`-flagged enemy in range ("umbrella
// monster"): nearby allies take buffMult damage until the buffer is popped.
function buffReduction(state, e) {
  const bdef = state.config.enemyFlags?.defs?.buffer?.behavior;
  if (!bdef) return 1;
  const r2 = bdef.buffRadius * bdef.buffRadius;
  for (const b of state.enemies) {
    if (b === e || !b.alive || b.dying) continue;
    if (!b.flags || !b.flags.includes('buffer')) continue;
    const dx = b.x - e.x, dy = b.y - e.y;
    if (dx * dx + dy * dy <= r2) return bdef.buffMult;   // single application
  }
  return 1;
}

export function spawnEnemy(state, item) {
  const cfg = state.config;
  const def = cfg.enemies[item.typeId];
  const path = state.map.path;
  const last = path.length - 1;
  const flags = clampFlags(cfg, item.flags);
  const traits = composeTraits(cfg, def.traits, flags);
  const reverse = item.entry === 'end';
  const startCell = reverse ? path[last] : path[0];
  const start = cellCenter(startCell);
  // Flag-driven behaviors (regen heal, buffer shield) compose on top of the base
  // (boss) behavior. All cheap; at most a couple per enemy (legibility cap).
  let flagBehaviors = null;
  for (const f of flags) {
    const b = cfg.enemyFlags.defs[f]?.behavior;
    if (b) (flagBehaviors ||= []).push({ ...b });
  }
  const enemy = {
    id: genId(state),
    typeId: item.typeId,
    isBoss: !!def.isBoss,
    shape: def.shape, color: def.color, border: def.border, glow: def.glow,
    size: def.size, animSpeed: def.animSpeed,
    hp: item.hp, maxHp: item.hp,
    baseSpeed: item.speed,
    reward: item.reward,
    livesCost: def.livesCost,
    flags, traits,                          // P2: composable flags + affinity traits
    dir: reverse ? -1 : 1,                  // P2: 1 = forward (path[0]->last), -1 = reverse
    pathIndex: reverse ? last : 0,
    progress: 0,
    x: start.x, y: start.y,
    reachedGoal: false,
    alive: true,
    slowUntil: 0, slowFactor: 1,            // P4 Froster: per-enemy slow, layered into the ONE shared effectiveSpeed term
    dying: false, deathMs: 0,
    spawnClock: 0,
    animTime: 0,
    hitFlashMs: 0,
    ouchMs: 0,             // display-only: drives the baked "ouch" face + recoil squash
    behavior: def.behavior ? { ...def.behavior } : null,
    flagBehaviors,
    bs: { shieldActive: false, nextShieldAt: 0, shieldEndsAt: 0, speedActive: false, nextSpeedAt: 0, speedEndsAt: 0, regenAccum: 0, napCdAt: 0, beamTowerId: null, beamFireAt: 0 },
  };
  // Stagger boss ability cooldowns off the game clock so they trigger mid-path.
  if (enemy.behavior?.type === 'shield') enemy.bs.nextShieldAt = state.clock + enemy.behavior.cooldownMs;
  if (enemy.behavior?.type === 'speed') enemy.bs.nextSpeedAt = state.clock + enemy.behavior.cooldownMs;
  if (enemy.behavior?.type === 'disabler') enemy.bs.napCdAt = state.clock + enemy.behavior.cooldownMs;
  state.enemies.push(enemy);
  state.bus.emit(EV.ENEMY_SPAWN, { id: enemy.id, isBoss: enemy.isBoss });
  state.frameEvents.push({ type: EV.ENEMY_SPAWN, id: enemy.id, isBoss: enemy.isBoss });
  return enemy;
}

function applyBehavior(state, e, b, dt) {
  const bs = e.bs;
  switch (b.type) {
    case 'shield':
      if (bs.shieldActive && state.clock >= bs.shieldEndsAt) {
        bs.shieldActive = false; bs.nextShieldAt = state.clock + b.cooldownMs;
      } else if (!bs.shieldActive && state.clock >= bs.nextShieldAt) {
        bs.shieldActive = true; bs.shieldEndsAt = state.clock + b.durationMs;
      }
      break;
    case 'speed':
      if (bs.speedActive && state.clock >= bs.speedEndsAt) {
        bs.speedActive = false; bs.nextSpeedAt = state.clock + b.cooldownMs;
      } else if (!bs.speedActive && state.clock >= bs.nextSpeedAt) {
        bs.speedActive = true; bs.speedEndsAt = state.clock + b.durationMs;
      }
      break;
    case 'regen':
      bs.regenAccum += b.hpPerSec * dt / 1000;
      while (bs.regenAccum >= 1 && e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + 1); bs.regenAccum -= 1; }
      break;
    case 'buff':
      // Passive — the radius damage reduction is applied in damageEnemy/buffReduction.
      break;
    case 'disabler':
      updateDisabler(state, e, b);
      break;
  }
}

// P3 — the recoverable tower-NAP state machine (telegraph -> nap). Two phases:
//   idle -> telegraph: when off cooldown, alive, and NOT past the leak guard, pick
//     the nearest eligible tower, start a visible sleepy-beam wind-up.
//   telegraph -> nap: at the fire time, re-confirm the tower is still eligible and
//     nap it (it skips firing), then arm post-wake immunity (anti-stun-lock) and
//     reset the disabler's cooldown.
function updateDisabler(state, e, b) {
  const cfg = state.config.nap;
  const bs = e.bs;
  // Phase 2: a pending beam reaches its fire time.
  if (bs.beamTowerId != null) {
    if (state.clock >= bs.beamFireAt) {
      const t = state.towers.find(tw => tw.id === bs.beamTowerId);
      if (t && state.clock >= (t.stunImmuneUntil || 0) && state.clock >= (t.stunnedUntil || 0)) {
        t.stunnedUntil = state.clock + cfg.durationMs;
        t.stunImmuneUntil = t.stunnedUntil + cfg.immunityMs;
        state.bus.emit(EV.TOWER_STUN, { towerId: t.id, untilClock: t.stunnedUntil, durationMs: cfg.durationMs });
        state.frameEvents.push({ type: EV.TOWER_STUN, towerId: t.id, untilClock: t.stunnedUntil, durationMs: cfg.durationMs });
      }
      bs.beamTowerId = null;
      bs.beamFireAt = 0;
      bs.napCdAt = state.clock + b.cooldownMs;
    }
    return;
  }
  // Phase 1: off cooldown -> try to start a telegraph (never near a leak).
  if (state.clock < bs.napCdAt) return;
  const path = state.map.path;
  const last = path.length - 1;
  const fraction = e.dir === -1 ? (last - e.pathIndex) / last : e.pathIndex / last;
  if (fraction > cfg.maxPathFraction) { bs.napCdAt = state.clock + b.cooldownMs; return; }
  const t = nearestEligibleTower(state, e);
  if (!t) { bs.napCdAt = state.clock + b.cooldownMs; return; }
  bs.beamTowerId = t.id;
  bs.beamFireAt = state.clock + cfg.telegraphMs;
  state.bus.emit(EV.DISABLER_BEAM, { enemyId: e.id, towerId: t.id, fireAtClock: bs.beamFireAt });
  state.frameEvents.push({ type: EV.DISABLER_BEAM, enemyId: e.id, towerId: t.id, fireAtClock: bs.beamFireAt });
}

// Nearest tower to enemy `e` that is currently nap-eligible (awake + not immune),
// within nap.beamRange tiles (<=0 = whole-map nearest). O(towers) — cheap.
function nearestEligibleTower(state, e) {
  const cfg = state.config.nap;
  const r2 = cfg.beamRange > 0 ? cfg.beamRange * cfg.beamRange : Infinity;
  let best = null, bestD = Infinity;
  for (const t of state.towers) {
    if (state.clock < (t.stunImmuneUntil || 0)) continue;
    if (state.clock < (t.stunnedUntil || 0)) continue;
    const dx = t.x - e.x, dy = t.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (d2 < bestD) { bestD = d2; best = t; }
  }
  return best;
}

function updateBehavior(state, e, dt) {
  if (e.behavior) applyBehavior(state, e, e.behavior, dt);          // base (boss) behavior
  if (e.flagBehaviors) for (const b of e.flagBehaviors) applyBehavior(state, e, b, dt); // P2 flag behaviors
}

// The single redefinition of an enemy's current speed. There is exactly ONE slow
// path here: the P3 field-Freeze (global) AND P4's Froster (per-enemy) are both
// multiplicative terms in THIS function — never a separate slow mechanism.
export function effectiveSpeed(state, e) {
  let v = e.baseSpeed;
  if (e.behavior?.type === 'speed' && e.bs.speedActive) v *= e.behavior.multiplier;
  const frozen = state.clock < state.freeze.activeUntil;
  const slowed = state.clock < e.slowUntil;
  if (frozen) v *= state.config.freeze.slowMult; // P3 global field freeze
  if (slowed) v *= e.slowFactor;                 // P4 Froster per-enemy slow
  // W10 — capped slow: no stack of slows may drop an enemy below a fixed PERCENTAGE
  // of its OWN base speed. The floor scales with baseSpeed, so a fast boss keeps
  // meaningful speed while frozen (never an absolute crawl / stun-lock). Gated on a
  // slow actually being active so the non-slowed fast path stays byte-for-byte equal.
  if (frozen || slowed) {
    const floor = e.baseSpeed * state.config.freeze.minSpeedFraction;
    if (v < floor) v = floor;
  }
  return v;
}

// P4 Froster — apply a per-enemy slow that rides the SAME effectiveSpeed term.
// Overlapping slows take the STRONGER factor (lower = slower) and the longer window.
export function applySlow(state, e, factor, durationMs) {
  if (!e.alive || e.reachedGoal) return;
  const until = state.clock + durationMs;
  if (state.clock >= e.slowUntil) { e.slowFactor = factor; e.slowUntil = until; }
  else { e.slowFactor = Math.min(e.slowFactor, factor); e.slowUntil = Math.max(e.slowUntil, until); }
}

export function update(state, dt) {
  const path = state.map.path;
  const last = path.length - 1;

  for (const e of state.enemies) {
    if (!e.alive) { if (e.dying) e.deathMs += dt; continue; }
    e.animTime += dt * e.animSpeed;
    e.spawnClock += dt;
    if (e.hitFlashMs > 0) e.hitFlashMs -= dt;
    if (e.ouchMs > 0) e.ouchMs -= dt;
    updateBehavior(state, e, dt);

    if (e.reachedGoal) continue;

    // Advance along the path by exact lerp. Forward (dir=1) walks path[0]->last;
    // reverse (dir=-1) is the exact mirror, path[last]->0. The forward branch is
    // byte-for-byte the original code path (guards the existing sim/timing tests).
    e.progress += effectiveSpeed(state, e) * dt / 1000;
    if (e.dir === -1) {
      while (e.progress >= 1 && e.pathIndex > 1) { e.progress -= 1; e.pathIndex -= 1; }
      if (e.pathIndex <= 1 && e.progress >= 1) {
        e.progress = 1; e.pathIndex = 1;
        const end = cellCenter(path[0]);
        e.x = end.x; e.y = end.y;
        reachGoal(state, e);
      } else {
        const a = cellCenter(path[e.pathIndex]);
        const b = cellCenter(path[Math.max(e.pathIndex - 1, 0)]);
        e.x = a.x + (b.x - a.x) * e.progress;
        e.y = a.y + (b.y - a.y) * e.progress;
      }
    } else {
      while (e.progress >= 1 && e.pathIndex < last - 1) { e.progress -= 1; e.pathIndex += 1; }
      if (e.pathIndex >= last - 1 && e.progress >= 1) {
        // Reached the end tile.
        e.progress = 1; e.pathIndex = last - 1;
        const end = cellCenter(path[last]);
        e.x = end.x; e.y = end.y;
        reachGoal(state, e);
      } else {
        const a = cellCenter(path[e.pathIndex]);
        const b = cellCenter(path[Math.min(e.pathIndex + 1, last)]);
        e.x = a.x + (b.x - a.x) * e.progress;
        e.y = a.y + (b.y - a.y) * e.progress;
      }
    }
  }

  // Reap fully dead/finished enemies. Dying enemies linger for the death anim.
  const DEATH_MS = 500;
  state.enemies = state.enemies.filter(e => {
    if (e.reachedGoal) return false;          // gone immediately on reaching goal
    if (e.dying && e.deathMs >= DEATH_MS) return false;
    return true;
  });
}

function reachGoal(state, e) {
  if (e.reachedGoal) return;     // exactly once
  e.reachedGoal = true;
  e.alive = false;
  state.lives -= e.livesCost;    // single ledger, fixed cost, applied once
  state.livesFlashUntil = state.clock + 600;   // display-only HUD "ouch" reaction
  state.livesFlashAmount = e.livesCost;
  state.bus.emit(EV.ENEMY_REACH_END, { id: e.id, livesCost: e.livesCost });
  state.frameEvents.push({ type: EV.ENEMY_REACH_END, id: e.id, livesCost: e.livesCost });
}

// Apply damage; respects an active boss shield. The 4th arg is an options bag
// {fromBomb, sourceType} (P2) — `sourceType` is the firing tower's typeId, which
// drives soft affinity. A bare boolean is still accepted (legacy = fromBomb), so
// non-projectile callers passing 3 args stay correct. Returns true if this killed it.
export function damageEnemy(state, e, amount, opts = false) {
  if (!e.alive || e.dying) return false;
  if (typeof opts === 'boolean') opts = { fromBomb: opts };
  const fromBomb = !!opts.fromBomb;
  const sourceType = opts.sourceType ?? null;
  // W8 — the boss-tower ULTIMATE pierces shields: with ignoreShield the normal
  // shield short-circuit is skipped, so a shielded boss_splitling shard takes the
  // hit even mid-shield. Every other caller leaves it falsy -> shields behave as before.
  const ignoreShield = !!opts.ignoreShield;
  if (!ignoreShield && e.behavior?.type === 'shield' && e.bs.shieldActive) {
    e.shieldedHitMs = 250; // visual feedback timer
    state.bus.emit(EV.ENEMY_HIT, { id: e.id, shielded: true });
    state.frameEvents.push({ type: EV.ENEMY_HIT, id: e.id, shielded: true });
    return false;
  }
  const mult = affinityMult(state.config, sourceType, e.traits);
  const dealt = amount * mult * buffReduction(state, e);
  e.hp -= dealt;
  e.hitFlashMs = 150;
  e.ouchMs = state.config.visual.anim.enemyOuchMs;   // re-arm the cute "ouch" reaction
  // Non-numeric tell: right tool -> 'strong' (big splat), wrong tool -> 'weak'
  // (tink/bounce + sad puff), untagged/affinity-irrelevant -> 'neutral'.
  const affinity = !sourceType ? 'neutral' : (mult > 1 ? 'strong' : (mult < 1 ? 'weak' : 'neutral'));
  const payload = { id: e.id, amount, fromBomb, affinity, mult, dealt };
  state.bus.emit(EV.ENEMY_HIT, payload);
  state.frameEvents.push({ type: EV.ENEMY_HIT, ...payload });
  if (e.hp <= 0) { killEnemy(state, e); return true; }
  return false;
}

export function killEnemy(state, e) {
  if (!e.alive) return;
  e.alive = false; e.dying = true; e.deathMs = 0; e.hp = 0;
  state.stats.enemiesKilled += 1;
  state.bus.emit(EV.ENEMY_DEATH, { id: e.id, isBoss: e.isBoss });
  state.frameEvents.push({ type: EV.ENEMY_DEATH, id: e.id, isBoss: e.isBoss });
  // Reward goes STRAIGHT to the wallet (no coin dropped on the board); the amount
  // also accrues toward this wave's end-of-wave bonus.
  state.wave.earnings += e.reward;
  state.stats.coinsEarned += e.reward;
  creditCoins(state, e.reward);
  // Split behavior: spawn children at the same path point.
  if (e.behavior?.type === 'split') {
    const b = e.behavior;
    for (let i = 0; i < b.count; i++) {
      const child = spawnEnemy(state, { typeId: b.childType, hp: b.childHp, speed: state.config.enemies[b.childType].speed, reward: b.childReward });
      child.pathIndex = e.pathIndex;
      child.progress = Math.min(0.99, e.progress);
      child.x = e.x + (i - 1) * 0.15;
      child.y = e.y;
    }
  }
}

export function aliveEnemies(state) { return state.enemies.filter(e => e.alive && !e.reachedGoal); }
