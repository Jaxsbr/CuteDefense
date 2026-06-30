/**
 * Projectile system — homing travel + impact. Single-target and AoE bombs both
 * resolve damage through ONE path (damageEnemy), so boss shields behave
 * consistently (V1's bombs bypassed shields — fixed here, see PARITY B4).
 */
import { genId, cellCenter } from '../state.js';
import { damageEnemy, affinityMult, applySlow } from './enemySystem.js';

export function fire(state, tower, target, st) {
  const cfg = state.config;
  const tdef = cfg.towers[tower.typeId];
  const isBomb = tdef.kind === 'aoe';
  const dmg = isBomb ? st.bombDamage : st.damage;
  state.projectiles.push({
    id: genId(state),
    x: tower.x, y: tower.y,
    speedTiles: tdef.projectile.speed / cfg.layout.tile, // px/s -> tiles/s
    damage: dmg,
    kind: isBomb ? 'bomb' : 'single',
    aoeRadius: isBomb ? (st.aoeRadius ?? tdef.aoe.radius) : 0,
    targetId: target.id,
    tx: target.x, ty: target.y,
    color: tdef.projectile.color,
    size: tdef.projectile.size,
    sourceType: tower.typeId,    // P2: drives soft affinity at impact (basic/strong)
    // P4: the FORK rides this same projectile-source plumbing (no second pathway):
    critChance: st.critChance ?? cfg.combat.critChance,   // Sniper override or global default
    critMult: st.critMult ?? cfg.combat.critMult,
    slow: st.slow ?? null,                                 // Froster slow ({factor,durationMs}) or null
    ttl: cfg.combat.projectileTtlMs,
    trail: [],
  });
}

function hitRadiusTiles(state, e) {
  return e.size / 2 + 8 / state.config.layout.tile; // V1 tolerance: +8px
}

export function update(state, dt) {
  const cfg = state.config;
  const alive = [];
  for (const p of state.projectiles) {
    p.ttl -= dt;
    if (p.ttl <= 0) continue;

    const target = state.enemies.find(e => e.id === p.targetId && e.alive && !e.reachedGoal);
    if (target) { p.tx = target.x; p.ty = target.y; }

    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const stepTiles = p.speedTiles * dt / 1000;

    // Trail for render feel (short, cheap).
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 5) p.trail.shift();

    if (stepTiles >= d || (target && d <= hitRadiusTiles(state, target))) {
      // Arrived / collided.
      p.x = p.tx; p.y = p.ty;
      impact(state, p, target);
      continue; // consumed
    }
    p.x += (dx / d) * stepTiles;
    p.y += (dy / d) * stepTiles;
    alive.push(p);
  }
  state.projectiles = alive;
}

// Classify the affinity tell for the primary target, so the renderer can splat
// (right tool) vs tink/bounce + sad puff (wrong tool). Pure read, no side effects.
function tellFor(state, p, target) {
  if (!target) return 'neutral';
  const m = affinityMult(state.config, p.sourceType, target.traits);
  return m > 1 ? 'strong' : (m < 1 ? 'weak' : 'neutral');
}

function impact(state, p, target) {
  const cfg = state.config;
  if (p.kind === 'bomb') {
    const r = p.aoeRadius;
    state.effects.push({ kind: 'explosion', x: p.x, y: p.y, radius: r, age: 0, ttl: 350, affinity: tellFor(state, p, target) });
    for (const e of state.enemies) {
      if (!e.alive || e.reachedGoal) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy <= r * r) {
        damageEnemy(state, e, p.damage, { fromBomb: true, sourceType: p.sourceType });
        if (p.slow) applySlow(state, e, p.slow.factor, p.slow.durationMs);   // P4 Froster
      }
    }
  } else if (target) {
    let dmg = p.damage;
    let crit = false;
    const cc = p.critChance ?? cfg.combat.critChance;     // P4 Sniper override or global default
    const cm = p.critMult ?? cfg.combat.critMult;
    if (state.rng.next() < cc) { dmg *= cm; crit = true; }
    state.effects.push({ kind: 'hit', x: p.x, y: p.y, age: 0, ttl: 220, crit, affinity: tellFor(state, p, target) });
    damageEnemy(state, target, dmg, { fromBomb: false, sourceType: p.sourceType });
    if (p.slow) applySlow(state, target, p.slow.factor, p.slow.durationMs);  // P4 Froster (single-target arms)
  }
}
