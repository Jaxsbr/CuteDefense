/**
 * Tower system — placement, targeting, firing, upgrade, and a real Sell
 * (V1 never implemented Sell). All stats come from config per level. Targeting
 * mirrors V1's score model (distance / low-health / type weights).
 */
import { EV } from '../events.js';
import { genId, cellCenter } from '../state.js';
import { spend, addCoins } from './economySystem.js';
import { aliveEnemies } from './enemySystem.js';
import { fire } from './projectileSystem.js';

export function levelStats(cfg, typeId, level) { return cfg.towers[typeId].levels[level - 1]; }

export function towerAt(state, gx, gy) {
  return state.towers.find(t => t.gx === gx && t.gy === gy) || null;
}

export function canPlace(state, gx, gy) {
  const { cols, rows } = state.map;
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
  if (!state.map.buildable[gy][gx]) return false;
  return !towerAt(state, gx, gy);
}

export function placeTower(state, gx, gy, typeId) {
  if (!canPlace(state, gx, gy)) return null;
  const cost = levelStats(state.config, typeId, 1).cost;
  if (!spend(state, cost)) return null;
  const c = cellCenter({ x: gx, y: gy });
  const tower = {
    id: genId(state),
    typeId, level: 1, gx, gy, x: c.x, y: c.y,
    cooldownMs: 0, invested: cost, targetId: null,
    fireAnimMs: 0, placeAnimMs: 280, animTime: 0,
  };
  // Deterministic per-tower expression schedule from an integer hash of the id —
  // NOT state.rng (that would shift the shared RNG stream and break bench/replays).
  // Gives each tower its own staggered blink/blush so they never sync up.
  const A = state.config.visual.anim;
  const h = (tower.id * 2654435761) >>> 0;
  tower.blinkOffset = h % A.blink.periodMaxMs;
  tower.blinkPeriod = A.blink.periodMinMs + (h >>> 8) % (A.blink.periodMaxMs - A.blink.periodMinMs);
  tower.shy         = ((h >>> 16) & 0xff) / 255 < A.blush.shyChance;
  tower.blushOffset = (h >>> 4) % A.blush.periodMaxMs;
  tower.blushPeriod = A.blush.periodMinMs + (h >>> 12) % (A.blush.periodMaxMs - A.blush.periodMinMs);
  state.towers.push(tower);
  state.stats.towersBuilt += 1;
  state.bus.emit(EV.TOWER_PLACE, { id: tower.id, typeId });
  state.frameEvents.push({ type: EV.TOWER_PLACE, id: tower.id, typeId });
  return tower;
}

export function upgradeCost(state, tower) {
  const next = levelStats(state.config, tower.typeId, tower.level + 1);
  return next ? next.cost : null;
}

export function upgradeTower(state, gx, gy) {
  const tower = towerAt(state, gx, gy);
  if (!tower || tower.level >= 3) return false;
  const cost = upgradeCost(state, tower);
  if (cost == null || !spend(state, cost)) return false;
  tower.level += 1;
  tower.invested += cost;
  tower.placeAnimMs = 220; // small grow pop on upgrade
  state.bus.emit(EV.TOWER_UPGRADE, { id: tower.id, level: tower.level });
  state.frameEvents.push({ type: EV.TOWER_UPGRADE, id: tower.id, level: tower.level });
  return tower.level;
}

export function sellRefund(state, tower) {
  return Math.floor(tower.invested * state.config.economy.sellRefundFraction);
}

export function sellTower(state, gx, gy) {
  const tower = towerAt(state, gx, gy);
  if (!tower) return false;
  const refund = sellRefund(state, tower);
  state.towers = state.towers.filter(t => t.id !== tower.id);
  addCoins(state, refund);
  if (state.selected.kind === 'tower' && state.selected.id === tower.id) state.selected = { kind: null, id: null };
  state.bus.emit(EV.TOWER_SELL, { id: tower.id, refund });
  state.frameEvents.push({ type: EV.TOWER_SELL, id: tower.id, refund });
  return refund;
}

function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

function acquireTarget(state, tower, st) {
  const cfg = state.config;
  const w = cfg.combat.targetWeights;
  const range = st.range;
  let best = null, bestScore = -Infinity;
  for (const e of aliveEnemies(state)) {
    const d2 = dist2(tower.x, tower.y, e.x, e.y);
    if (d2 > range * range) continue;
    const d = Math.sqrt(d2);
    const distScore = (range - d) / range;
    const healthScore = 1 - e.hp / e.maxHp;
    const typeScore = cfg.combat.typeScore[e.typeId] ?? 0.6;
    const score = distScore * w.dist + healthScore * w.health + typeScore * w.type;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

export function update(state, dt) {
  const cfg = state.config;
  for (const tower of state.towers) {
    tower.animTime += dt;
    if (tower.fireAnimMs > 0) tower.fireAnimMs -= dt;
    if (tower.placeAnimMs > 0) tower.placeAnimMs -= dt;
    if (tower.cooldownMs > 0) tower.cooldownMs -= dt;

    const st = levelStats(cfg, tower.typeId, tower.level);

    // Validate current target; re-acquire if gone or out of range.
    let target = tower.targetId != null ? state.enemies.find(e => e.id === tower.targetId && e.alive && !e.reachedGoal) : null;
    if (target && dist2(tower.x, tower.y, target.x, target.y) > st.range * st.range) target = null;
    if (!target) { target = acquireTarget(state, tower, st); tower.targetId = target ? target.id : null; }

    if (target && tower.cooldownMs <= 0) {
      fire(state, tower, target, st);
      tower.fireAnimMs = cfg.visual.anim.towerFireAnimMs; // slow cute puff (config-driven)
      const jitter = state.rng.range(-cfg.combat.fireRateJitterMs, cfg.combat.fireRateJitterMs);
      tower.cooldownMs = Math.max(300, st.fireRateMs + jitter);
      state.bus.emit(EV.PROJECTILE_FIRE, { towerId: tower.id, typeId: tower.typeId });
      state.frameEvents.push({ type: EV.PROJECTILE_FIRE, towerId: tower.id });
    }
  }
}
