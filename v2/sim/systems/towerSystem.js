/**
 * Tower system — placement, targeting, firing, upgrade, and a real Sell
 * (V1 never implemented Sell). All stats come from config per level. Targeting
 * mirrors V1's score model (distance / low-health / type weights).
 */
import { EV } from '../events.js';
import { genId } from '../state.js';
import { spend, addCoins } from './economySystem.js';
import { aliveEnemies } from './enemySystem.js';
import { fire } from './projectileSystem.js';

export function levelStats(cfg, typeId, level) { return cfg.towers[typeId].levels[level - 1]; }

// The real placeable tower TYPE ids. The towers config block also carries scalar
// tuning keys (e.g. P5 footprintScaleCap/footprintMargin), so callers must filter
// to entries that actually define per-level stats rather than naively Object.keys.
export function towerTypeIds(cfg) {
  return Object.keys(cfg.towers).filter(k => Array.isArray(cfg.towers[k]?.levels));
}

// The fork arms a tower TYPE offers at L3 (ordered; picture-only in the UI).
export function forkArmsFor(cfg, typeId) {
  const f = cfg.towers[typeId].forks;
  return f ? Object.keys(f) : [];
}

// W3 — pure {name, blurb} for a fork arm so the card can show plain kid-words
// beside the picture icon (mobile has no hover). Mirrors forkArmsFor; returns null
// for an arm not valid for the type (same rejection contract as forkTower). Pure
// data (no canvas) so it is unit-testable headless.
export function forkLabel(cfg, typeId, arm) {
  const f = cfg.towers?.[typeId]?.forks?.[arm];
  return f ? { name: f.name, blurb: f.blurb } : null;
}

export function canFork(state, tower) { return !!tower && tower.level >= 3; }

// W8 — tiles-per-side of a tower type's footprint (default 1; the boss is 2 -> 2x2).
export function footprintOf(cfg, typeId) { return cfg.towers[typeId]?.footprint ?? 1; }

// The SINGLE source of a tower's live stats: base per-level stats merged with its
// chosen fork arm's multipliers/overrides. Returned as a fresh small object the
// targeting/firing code reads (range/fireRate/damage/bomb/aoe/crit/slow). Pure.
export function effectiveStats(state, tower) {
  const cfg = state.config;
  const def = cfg.towers[tower.typeId];
  const base = levelStats(cfg, tower.typeId, tower.level);
  // W8 — a fullMap tower (the boss) sees the WHOLE board: its range is the
  // board-spanning constant (cols+rows) computed at runtime, so the targeting loop
  // never misses a far enemy regardless of where the boss sits. Finite towers keep
  // their per-level range. The config level still carries the board-spanning value
  // so the headless bot's towerRange() agrees (no magic number).
  const range = def.fullMap ? (cfg.layout.cols + cfg.layout.rows) : base.range;
  const out = {
    range,
    fireRateMs: base.fireRateMs,
    damage: base.damage,
    bombDamage: base.bombDamage,
    aoeRadius: def.kind === 'aoe' ? def.aoe.radius : 0,
    critChance: cfg.combat.critChance,
    critMult: cfg.combat.critMult,
    slow: null,
  };
  const fork = tower.fork ? def.forks?.[tower.fork] : null;
  if (fork) {
    if (fork.rangeMult) out.range *= fork.rangeMult;
    if (fork.fireRateMult) out.fireRateMs *= fork.fireRateMult;
    if (fork.damageMult) out.damage *= fork.damageMult;
    if (fork.bombDamageMult) out.bombDamage *= fork.bombDamageMult;
    if (fork.aoeRadiusMult) out.aoeRadius *= fork.aoeRadiusMult;
    if (fork.critChance != null) out.critChance = fork.critChance;
    if (fork.critMult != null) out.critMult = fork.critMult;
    if (fork.slow) out.slow = fork.slow;
  }
  return out;
}

// A single rising "power" scalar a child can watch grow on upgrade (raw DPS math is
// kid-hostile; this is one number, never a percentage). DPS x range, rounded.
function powerScalar(def, st) {
  const dmg = def.kind === 'aoe' ? st.bombDamage : st.damage;
  return Math.round(dmg * (1000 / st.fireRateMs) * st.range);
}

// Pure data the renderer consumes to show the before->after delta + Power number,
// or (at L3, no next level) the picture-only fork arms. No canvas, headless-testable.
export function upgradePreview(state, tower) {
  const cfg = state.config;
  const def = cfg.towers[tower.typeId];
  const cur = levelStats(cfg, tower.typeId, tower.level);
  const next = levelStats(cfg, tower.typeId, tower.level + 1);
  if (!next) {
    return { arms: forkArmsFor(cfg, tower.typeId), powerFrom: powerScalar(def, cur), powerTo: powerScalar(def, cur) };
  }
  const shape = (s) => ({ damage: s.bombDamage ?? s.damage, range: s.range, fireRateMs: s.fireRateMs });
  return { from: shape(cur), to: shape(next), powerFrom: powerScalar(def, cur), powerTo: powerScalar(def, next) };
}

// W6 — pure composition of the tower-card stat/power text the renderer draws.
// Numbers route through `fmt` (fmtStat) so a forked-L3 float like 4.800000000000001
// renders as "4.8" and never spills the card. Headless (no canvas) so the
// card-overflow test can measure these exact strings. Fire uses toFixed (fixed-time
// display) and is intentionally not fmt'd. `fmt` defaults to identity for callers
// that just want the raw composition.
export function towerCardLines(state, tower, fmt = (n) => String(n)) {
  const cfg = state.config;
  const def = cfg.towers[tower.typeId];
  const pv = upgradePreview(state, tower);
  const es = effectiveStats(state, tower);
  const statLines = [];
  if (pv.from && pv.to) {
    statLines.push(`Damage ${fmt(pv.from.damage)} → ${fmt(pv.to.damage)}`);
    statLines.push(`Range ${fmt(pv.from.range)} → ${fmt(pv.to.range)}   Fire ${(pv.from.fireRateMs / 1000).toFixed(1)}→${(pv.to.fireRateMs / 1000).toFixed(1)}s`);
  } else {
    statLines.push(`Damage ${fmt(es.bombDamage ?? es.damage)}   Range ${fmt(es.range)}`);
    statLines.push(`Fire ${(es.fireRateMs / 1000).toFixed(2)}s${def.kind === 'aoe' ? '   AoE' : ''}`);
  }
  const power = (pv.from && pv.to) ? `Power ${fmt(pv.powerFrom)} → ${fmt(pv.powerTo)}` : `Power ${fmt(pv.powerTo)}`;
  return { statLines, power };
}

// W8 — footprint-aware hit test: a tower "occupies" every cell of its fp x fp block
// anchored at its top-left (gx,gy). Tapping ANY of a boss's 4 cells selects it, and
// collision rejects an overlap with any cell. For 1-tile towers (fp=1) this is the
// original exact-cell match.
export function towerAt(state, gx, gy) {
  return state.towers.find(t => {
    const fp = footprintOf(state.config, t.typeId);
    return gx >= t.gx && gx < t.gx + fp && gy >= t.gy && gy < t.gy + fp;
  }) || null;
}

// W8 — `typeId` is optional: with no type the check keeps its original 1-cell meaning
// (the select-vs-popup decision in gridClick). With a type it validates ALL fp x fp
// cells of that type's footprint (in-bounds, buildable, unoccupied) so a 2x2 boss
// reserves four clear tiles. placeTower re-validates with the real type (the authority).
export function canPlace(state, gx, gy, typeId = null) {
  const { cols, rows } = state.map;
  const fp = typeId ? footprintOf(state.config, typeId) : 1;
  for (let dy = 0; dy < fp; dy++) {
    for (let dx = 0; dx < fp; dx++) {
      const cx = gx + dx, cy = gy + dy;
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
      if (!state.map.buildable[cy][cx]) return false;
      if (towerAt(state, cx, cy)) return false;
    }
  }
  return true;
}

export function placeTower(state, gx, gy, typeId) {
  const def = state.config.towers[typeId];
  const fp = footprintOf(state.config, typeId);
  if (!canPlace(state, gx, gy, typeId)) return null;   // authority: re-validate the FULL footprint
  const cost = levelStats(state.config, typeId, 1).cost;
  if (!spend(state, cost)) return null;
  // W8 — footprint-aware center: a 2x2 boss centers on the shared corner (anchor + 1.0);
  // a 1-tile tower stays at the cell center (anchor + 0.5), byte-identical to before.
  const cx = gx + fp / 2, cy = gy + fp / 2;
  const tower = {
    id: genId(state),
    typeId, level: 1, gx, gy, x: cx, y: cy,
    cooldownMs: 0, invested: cost, targetId: null,
    fork: null,                                        // P4: L3 identity fork arm (null until forked)
    ultReadyAt: 0, ultActiveUntil: 0,                  // W8: per-tower manual-ultimate state (boss only)
    fireAnimMs: 0, placeAnimMs: 280, animTime: 0,
    stunnedUntil: 0, stunImmuneUntil: 0, napWoken: true,   // P3 recoverable nap
  };
  // W8 — a boss's ultimate starts ready a fraction into its cooldown (mirrors freeze).
  // The ult is locked until L2, so this only matters once the player upgrades.
  if (def?.kind === 'boss' && def.ultimate) {
    tower.ultReadyAt = state.clock + def.ultimate.cooldownMs * (def.ultimate.initialReadyFraction ?? 0);
  }
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
  // W8 — cap at the type's real ceiling (basic/strong = 3, boss = 2) instead of a
  // hardcoded 3, so a 2-level type tops out correctly.
  if (!tower || tower.level >= state.config.towers[tower.typeId].levels.length) return false;
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

// P4 — fork (or RE-fork) a tower at L3 into one of its type's two arms. The first
// fork is free (firstForkCost 0, the felt L3 reward); switching arms charges
// reForkCost (the recurring coin sink). Same-arm and invalid-arm are no-ops.
export function forkTower(state, gx, gy, arm) {
  const tower = towerAt(state, gx, gy);
  if (!tower || tower.level < 3) return false;
  const def = state.config.towers[tower.typeId];
  if (!def.forks || !def.forks[arm]) return false;     // invalid arm for this type
  if (tower.fork === arm) return false;                // no-op: already this arm (no charge)
  const cost = tower.fork == null ? state.config.economy.firstForkCost : state.config.economy.reForkCost;
  if (cost > 0 && !spend(state, cost)) return false;   // unaffordable re-fork: unchanged
  tower.fork = arm;
  tower.placeAnimMs = 220;                              // a little pop on (re)fork
  state.bus.emit(EV.TOWER_FORK, { id: tower.id, arm });
  state.frameEvents.push({ type: EV.TOWER_FORK, id: tower.id, arm });
  return true;
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
    // P3 nap: a napping tower does not target or fire, and its cooldown FREEZES
    // (it won't dump a volley the instant it wakes). One TOWER_WAKE on recovery.
    if (tower.stunnedUntil > state.clock) { tower.napWoken = false; continue; }
    if (!tower.napWoken) {
      tower.napWoken = true;
      state.bus.emit(EV.TOWER_WAKE, { towerId: tower.id });
      state.frameEvents.push({ type: EV.TOWER_WAKE, towerId: tower.id });
    }
    if (tower.cooldownMs > 0) tower.cooldownMs -= dt;

    const st = effectiveStats(state, tower);   // P4: base level stats merged with the fork arm

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
