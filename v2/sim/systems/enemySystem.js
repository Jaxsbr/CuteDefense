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

export function spawnEnemy(state, item) {
  const def = state.config.enemies[item.typeId];
  const start = cellCenter(state.map.path[0]);
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
    pathIndex: 0,
    progress: 0,
    x: start.x, y: start.y,
    reachedGoal: false,
    alive: true,
    dying: false, deathMs: 0,
    spawnClock: 0,
    animTime: 0,
    hitFlashMs: 0,
    behavior: def.behavior ? { ...def.behavior } : null,
    bs: { shieldActive: false, nextShieldAt: 0, shieldEndsAt: 0, speedActive: false, nextSpeedAt: 0, speedEndsAt: 0, regenAccum: 0 },
  };
  // Stagger boss ability cooldowns off the game clock so they trigger mid-path.
  if (enemy.behavior?.type === 'shield') enemy.bs.nextShieldAt = state.clock + enemy.behavior.cooldownMs;
  if (enemy.behavior?.type === 'speed') enemy.bs.nextSpeedAt = state.clock + enemy.behavior.cooldownMs;
  state.enemies.push(enemy);
  state.bus.emit(EV.ENEMY_SPAWN, { id: enemy.id, isBoss: enemy.isBoss });
  state.frameEvents.push({ type: EV.ENEMY_SPAWN, id: enemy.id, isBoss: enemy.isBoss });
  return enemy;
}

function updateBehavior(state, e, dt) {
  if (!e.behavior) return;
  const b = e.behavior, bs = e.bs;
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
  }
}

function effectiveSpeed(e) {
  if (e.behavior?.type === 'speed' && e.bs.speedActive) return e.baseSpeed * e.behavior.multiplier;
  return e.baseSpeed;
}

export function update(state, dt) {
  const path = state.map.path;
  const last = path.length - 1;

  for (const e of state.enemies) {
    if (!e.alive) { if (e.dying) e.deathMs += dt; continue; }
    e.animTime += dt * e.animSpeed;
    e.spawnClock += dt;
    if (e.hitFlashMs > 0) e.hitFlashMs -= dt;
    updateBehavior(state, e, dt);

    if (e.reachedGoal) continue;

    // Advance along the path by exact lerp.
    e.progress += effectiveSpeed(e) * dt / 1000;
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
  state.bus.emit(EV.ENEMY_REACH_END, { id: e.id, livesCost: e.livesCost });
  state.frameEvents.push({ type: EV.ENEMY_REACH_END, id: e.id, livesCost: e.livesCost });
}

// Apply damage; respects an active boss shield. Returns true if this killed it.
export function damageEnemy(state, e, amount, fromBomb = false) {
  if (!e.alive || e.dying) return false;
  if (e.behavior?.type === 'shield' && e.bs.shieldActive) {
    e.shieldedHitMs = 250; // visual feedback timer
    state.bus.emit(EV.ENEMY_HIT, { id: e.id, shielded: true });
    state.frameEvents.push({ type: EV.ENEMY_HIT, id: e.id, shielded: true });
    return false;
  }
  e.hp -= amount;
  e.hitFlashMs = 150;
  state.bus.emit(EV.ENEMY_HIT, { id: e.id, amount, fromBomb });
  state.frameEvents.push({ type: EV.ENEMY_HIT, id: e.id, amount, fromBomb });
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
