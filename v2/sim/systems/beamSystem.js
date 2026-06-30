/**
 * beamSystem — V2.2 single-target boss BEAM damage-over-time.
 *
 * The boss-tower ULTIMATE is no longer a full-map AoE nuke; it is an AIMED beam
 * (Simulation.castUltimate(target)) that attaches a `beam` to state.beams and
 * applies DoT to ITS ONE target over `durationMs`. Each beam deals
 * `totalDamage * tickMs / durationMs` per tick (chunked on the `tickMs` cadence
 * so ENEMY_HIT/FX don't machine-gun), capped so cumulative `dealt` never exceeds
 * `totalDamage`. The total is enormous but < the hardest on-field boss HP, so one
 * cast can NEVER instant-kill it (it takes ~2 casts) — the never-instant-kill
 * invariant lives in the config (totalDamage) AND here (chunked, never the whole
 * total in one tick).
 *
 * A beam drops the instant its target dies / reaches the goal / is gone, when its
 * full total has been dealt, or when `age >= durationMs`. DoT does NOT transfer to
 * split children — a parent's death simply ends its beam.
 */
import { damageEnemy } from './enemySystem.js';

export function update(state, dt) {
  const beams = state.beams;
  if (!beams || beams.length === 0) return;
  for (const beam of beams) {
    beam.age += dt;
    const target = state.enemies.find(e => e.id === beam.targetId);
    if (!target || !target.alive || target.reachedGoal) { beam.dead = true; continue; }
    // streaming impact point (for the renderer)
    beam.tx = target.x; beam.ty = target.y;
    beam.tickAcc += dt;
    const perTick = beam.totalDamage * beam.tickMs / beam.durationMs;
    while (beam.tickAcc >= beam.tickMs && beam.dealt < beam.totalDamage) {
      beam.tickAcc -= beam.tickMs;
      let chunk = perTick;
      if (beam.dealt + chunk > beam.totalDamage) chunk = beam.totalDamage - beam.dealt;   // cap the final chunk
      damageEnemy(state, target, chunk, { ignoreShield: beam.piercesShield, sourceType: null });
      beam.dealt += chunk;
      if (!target.alive) break;                 // killed mid-window: stop dealing
    }
    if (beam.age >= beam.durationMs || beam.dealt >= beam.totalDamage || !target.alive) beam.dead = true;
  }
  state.beams = beams.filter(b => !b.dead);
}

export default { update };
