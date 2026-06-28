/**
 * Four deterministic player-policy bots — the difficulty ladder.
 *
 * Each factory takes a Bot (see harness.mjs) and returns { onDecision(bot) }.
 * Policies only ever act through the Bot's faithful command-API actions
 * (place / upgrade / sell) and read public state. They are deterministic: given
 * the same seed + map + config they produce identical games (no Math.random;
 * any tie-breaking is by stable tile ordering).
 *
 * Ladder intent:
 *   1. unfocused     -> barely interacts; loses early (~wave 3).
 *   2. spread        -> L1 towers whenever affordable, never upgrades; leaks mid-run.
 *   3. saveUpgrade   -> few towers, bank + upgrade; reaches final wave, loses close.
 *   4. optimal       -> chokepoints + continual placing + upgrades + repositioning; barely wins.
 */

// Best empty tile for a tower of `type`, by marginal new path coverage then by
// absolute coverage. Falls back to raw coverage (DPS stacking) when the path is
// already fully covered. Returns {gx,gy,gain,total} or null.
function bestTile(bot, type, { allowStack = false } = {}) {
  const ranked = bot.rankPlacements(type, { minGain: 1 });
  if (ranked.length && ranked[0].gain > 0) return ranked[0];
  if (!allowStack) return null;
  // Path saturated: place anywhere that still covers some path (adds raw DPS).
  const R = bot.towerRange(type, 1);
  let best = null;
  for (const { gx, gy } of bot.tiles) {
    if (bot.sim.towerAt(gx, gy)) continue;
    const total = bot.coverage(gx, gy, R).length;
    if (total === 0) continue;
    if (!best || total > best.total) best = { gx, gy, gain: 0, total };
  }
  return best;
}

// Tower most worth upgrading: highest coverage, lowest level, that we can afford
// the NEXT level for. Returns the tower or null.
function bestUpgrade(bot, { maxLevel = 3 } = {}) {
  let best = null, bestScore = -Infinity;
  for (const t of bot.towers) {
    if (t.level >= maxLevel) continue;
    const cost = bot.towerCost(t.typeId, t.level + 1);
    if (bot.coins < cost) continue;
    const R = bot.towerRange(t.typeId, t.level + 1);
    const cov = bot.coverage(t.gx, t.gy, R).length;
    // Prefer high coverage and lower current level (push foundations to L3).
    const score = cov * (maxLevel - t.level + 1);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// Choose a tower type for a tile: AoE 'strong' where the path clusters near the
// tile (multi-segment chokepoint), else single-target 'basic'.
function chooseType(bot, gx, gy) {
  const strongCov = bot.coverage(gx, gy, bot.towerRange('strong', 1)).length;
  return strongCov >= 4 ? 'strong' : 'basic';
}

// ---------------------------------------------------------------------------
// 1. UNFOCUSED — plonks a few towers in the opening and otherwise ignores the
// game (no upgrades, no further placement). A casual "set it and forget it"
// player. Picks the chunky AoE tower (what a beginner reaches for) on its best
// tile, then goes idle — and gets overrun once the waves ramp.
// ---------------------------------------------------------------------------
export function unfocused({ maxTowers = 3, type = 'strong' } = {}) {
  let placed = 0;
  return {
    onDecision(bot) {
      if (placed >= maxTowers) return;
      // Only acts during the very first prep / early game, then goes idle.
      if (bot.waveIndex > 2) return;
      if (bot.coins < bot.towerCost(type, 1)) return;
      const tile = bestTile(bot, type, { allowStack: true });
      if (tile && bot.place(tile.gx, tile.gy, type)) placed++;
    },
  };
}

// ---------------------------------------------------------------------------
// 2. SPREAD — places a L1 tower whenever it can afford one; NEVER upgrades.
// ---------------------------------------------------------------------------
export function spread({ type = 'basic' } = {}) {
  return {
    onDecision(bot) {
      let guard = 0;
      while (bot.coins >= bot.towerCost(type, 1) && guard++ < 40) {
        const tile = bestTile(bot, type, { allowStack: true });
        if (!tile) break;                     // no buildable tile near the path left
        if (!bot.place(tile.gx, tile.gy, type)) break;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 3. SAVE-AND-UPGRADE — a few chokepoint towers, then bank + upgrade them.
// ---------------------------------------------------------------------------
export function saveUpgrade({ maxTowers = 7 } = {}) {
  return {
    onDecision(bot) {
      // Lay the foundation: a few high-coverage towers, prioritising AoE
      // chokepoints. After that, stop placing and sink everything into upgrades.
      if (bot.towers.length < maxTowers) {
        const ranked = bot.rankPlacements('strong', { minGain: 1 });
        const pick = ranked[0];
        if (pick) {
          const type = chooseType(bot, pick.gx, pick.gy);
          const cost = bot.towerCost(type, 1);
          if (bot.coins >= cost) { bot.place(pick.gx, pick.gy, type); return; }
        }
      }
      // Upgrade the highest-value tower we can afford toward L3.
      const up = bestUpgrade(bot);
      if (up) bot.upgrade(up);
    },
  };
}

// ---------------------------------------------------------------------------
// 4. OPTIMAL — chokepoint placement + continual placing + upgrades + selling.
// ---------------------------------------------------------------------------
export function optimal({ reposition = true } = {}) {
  return {
    onDecision(bot) {
      let acted = true;
      let guard = 0;
      // Spend down each decision: cover gaps first, then upgrade, then STACK raw
      // firepower with any surplus. Never sit on a pile of coins — late waves
      // demand continual reinvestment, so an optimal player keeps buying.
      while (acted && guard++ < 60) {
        acted = false;

        // (a) Keep a strong kill-zone: place on the best uncovered chokepoint.
        const ranked = bot.rankPlacements('strong', { minGain: 1 });
        const pick = ranked.find(r => r.gain > 0);
        if (pick) {
          const type = chooseType(bot, pick.gx, pick.gy);
          const cost = bot.towerCost(type, 1);
          if (bot.coins >= cost) { if (bot.place(pick.gx, pick.gy, type)) { acted = true; continue; } }
        }

        // (b) Upgrade the highest-impact tower toward L3.
        const up = bestUpgrade(bot);
        if (up) { if (bot.upgrade(up)) { acted = true; continue; } }

        // (c) Stack extra firepower on the best remaining tile (raw DPS) once the
        // path is covered — this is how surplus coins keep buying defense.
        const stack = bestTile(bot, 'strong', { allowStack: true });
        if (stack && stack.total >= 1) {
          const type = chooseType(bot, stack.gx, stack.gy);
          const cost = bot.towerCost(type, 1);
          if (bot.coins >= cost) { if (bot.place(stack.gx, stack.gy, type)) { acted = true; continue; } }
        }
      }

      // (d) Reposition: sell a redundant, low-level tower that adds no marginal
      // coverage when a clearly better uncovered chokepoint exists.
      if (reposition && bot.waveIndex >= 4) {
        const ranked = bot.rankPlacements('strong', { minGain: 3 });
        const target = ranked[0];
        if (target && target.gain >= 3) {
          // find a L1 tower whose cells are fully redundant with the rest
          for (const t of bot.towers) {
            if (t.level > 1) continue;
            const R = bot.towerRange(t.typeId, t.level);
            const mine = bot.coverage(t.gx, t.gy, R);
            // coverage from all OTHER towers
            const others = new Set();
            for (const o of bot.towers) {
              if (o.id === t.id) continue;
              for (const i of bot.coverage(o.gx, o.gy, bot.towerRange(o.typeId, o.level))) others.add(i);
            }
            const redundant = mine.every(i => others.has(i));
            if (redundant) { bot.sell(t); break; }
          }
        }
      }
    },
  };
}

export const POLICIES = { unfocused, spread, saveUpgrade, optimal };
