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
    // Cap at the type's REAL ceiling (basic/strong = 3, a 2-level type = 2) so a
    // boss-aware policy never asks for a non-existent next level. Ladder bots build
    // only basic/strong, so this is a no-op for them.
    const cap = Math.min(maxLevel, bot.sim.config.towers[t.typeId].levels.length);
    if (t.level >= cap) continue;
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

// P2 affinity-aware type choice: if the active/next wave is dominated by a threat
// one tower is the RIGHT counter for (basic->evasive, strong->armored/swarm), pick
// that tower so it lands the 2x. Mixed/neutral waves fall back to the coverage
// heuristic. Deterministic (only reads config + stable wave peek).
function affinityChooseType(bot, gx, gy) {
  const counters = bot.sim.config.combat.affinity.counters;
  const traits = bot.upcomingWaveFlags();
  const wantsBasic = counters.basic.some(t => traits.has(t));    // evasive
  const wantsStrong = counters.strong.some(t => traits.has(t));  // armored / swarm
  const nb = bot.towers.filter(t => t.typeId === 'basic').length;
  const ns = bot.towers.filter(t => t.typeId === 'strong').length;
  // The game ALWAYS mixes evasive (`fast`) and armored (`strong`) bodies, so a
  // competent player keeps a BALANCED two-tool build — never all-one-type (which a
  // myopic next-wave peek would do, then leak the other threat at 0.5x). Tilt by
  // one tower toward whichever threat the active/next telegraph emphasizes.
  if (wantsBasic && !wantsStrong && nb <= ns + 1) return 'basic';
  if (wantsStrong && !wantsBasic && ns <= nb + 1) return 'strong';
  if (nb < ns) return 'basic';
  if (ns < nb) return 'strong';
  return chooseType(bot, gx, gy);
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
export function saveUpgrade({ maxTowers = 18 } = {}) {
  return {
    onDecision(bot) {
      // A competent-but-limited mid player: covers the path with the AFFINITY-CORRECT
      // tool, banks into upgrades, and spends surplus on extra firepower. Two missing
      // levers keep it a tier below OPTIMAL: it NEVER reaches L3 (banks only to L2) and
      // NEVER repositions redundant towers. So it reaches the late waves (P2:
      // affinity-aware, no longer collapsing to a 0.5x wrong-tool) but loses short of
      // clearing all 15.
      let acted = true, guard = 0;
      while (acted && guard++ < 60) {
        acted = false;
        // (a) Cover the best uncovered chokepoint with the right tool.
        if (bot.towers.length < maxTowers) {
          const ranked = bot.rankPlacements('strong', { minGain: 1 });
          const pick = ranked.find(r => r.gain > 0);
          if (pick) {
            const type = affinityChooseType(bot, pick.gx, pick.gy);
            if (bot.coins >= bot.towerCost(type, 1) && bot.place(pick.gx, pick.gy, type)) { acted = true; continue; }
          }
        }
        // (b) Upgrade the highest-impact tower, but only toward L2 (never the L3 that
        // separates an optimal build).
        const up = bestUpgrade(bot, { maxLevel: 2 });
        if (up && bot.upgrade(up)) { acted = true; continue; }
        // (c) Spend surplus on raw firepower (still capped, and only to L2).
        if (bot.towers.length < maxTowers) {
          const stack = bestTile(bot, 'strong', { allowStack: true });
          if (stack && stack.total >= 1) {
            const type = affinityChooseType(bot, stack.gx, stack.gy);
            if (bot.coins >= bot.towerCost(type, 1) && bot.place(stack.gx, stack.gy, type)) { acted = true; continue; }
          }
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 4. OPTIMAL — chokepoint placement + continual placing + upgrades + selling.
// ---------------------------------------------------------------------------
// P3 — freeze-aware decision shared by the optimal bot. Deterministic (no RNG).
// Offensive: cast when >= botBunchCount alive enemies cluster within a tower's
// kill-zone (range + botBunchRadius). Defensive: cast when any enemy is within the
// last (1 - maxPathFraction) of the path (an imminent leak). Returns true if cast.
function maybeFreeze(bot) {
  if (!bot.freezeReady() || bot.freezeActive()) return false;
  const cfg = bot.sim.config;
  const alive = bot.aliveEnemies();
  if (alive.length === 0) return false;
  const last = bot.map.path.length - 1;
  // Defensive: imminent leak.
  for (const e of alive) {
    const frac = e.dir === -1 ? (last - e.pathIndex) / last : e.pathIndex / last;
    if (frac >= cfg.nap.maxPathFraction) return bot.freeze();
  }
  // Offensive: a fat bunch sits in a tower's kill-zone.
  const pad = cfg.freeze.botBunchRadius;
  for (const t of bot.towers) {
    const R = bot.towerRange(t.typeId, t.level) + pad;
    const R2 = R * R;
    let n = 0;
    for (const e of alive) { const dx = e.x - t.x, dy = e.y - t.y; if (dx * dx + dy * dy <= R2) n++; }
    if (n >= cfg.freeze.botBunchCount) return bot.freeze();
  }
  return false;
}

// P4 — the right L3 fork arm for a tower, keyed to the active/next telegraphed
// threat (a real player re-answers the fork per wave). Deterministic (reads config
// + the stable wave peek). basic -> Sniper(evasive/fast) | Gunner(swarm/default);
// strong -> Froster(swarm hold) | Bomber(clusters/default).
function forkChoice(bot, tower) {
  const cfg = bot.sim.config;
  const traits = bot.upcomingWaveFlags();
  if (tower.typeId === 'basic') {
    return traits.has('evasive') ? 'sniper' : 'gunner';
  }
  // strong
  return traits.has('swarm') ? 'froster' : 'bomber';
}

// Fork every L3 tower toward its threat-correct arm, and RE-fork (paying reForkCost)
// when the upcoming threat flips the right arm — draining flooded late coins through
// the sink, exactly as an alert player would. Only re-forks with surplus on hand.
function manageForks(bot) {
  const reCost = bot.sim.config.economy.reForkCost;
  for (const t of bot.towers) {
    if (t.level < 3) continue;
    const want = forkChoice(bot, t);
    if (t.fork == null) { bot.fork(t, want); continue; }          // first fork is free
    if (t.fork !== want && bot.coins >= reCost) bot.fork(t, want); // re-fork on a threat flip (paid sink)
  }
}

// W11 — the offensive KEY to the secret summit, mirroring maybeFreeze. Behind the
// `ultimate` flag so the public ladder is byte-for-byte unchanged. Two jobs:
//   (a) cast the ultimate the instant it is ready AND the split boss / a shard is on
//       the field (reserve every charge for wave 16 — never waste it on public waves);
//   (b) in the endgame, BUILD + upgrade the boss tower, PAUSING normal optimal spend
//       so the precious coin pile + a free 2x2 are reserved until the key is ready.
// Returns true when it "took over" the decision (caller skips the normal spend-down).
function maybeUltimate(bot, { buildFromWave = 7 } = {}) {
  const cfg = bot.sim.config;
  const bosses = bot.bossTowers();
  const max = cfg.towers.boss.levels.length;
  const bossReady = bosses.length > 0 && bosses.every(t => t.level >= max);

  // (a) The offensive key: AIM the single-target beam. Focus the PARENT (boss_split)
  // first so it dies EARLY (its shards then traverse the kill-zone for the towers);
  // once split, beam the MOST-ADVANCED shard. aliveEnemies excludes reached-goal.
  if (bot.ultimateReady()) {
    const alive = bot.aliveEnemies();
    const parent = alive.find(e => e.typeId === 'boss_split');
    const shards = alive.filter(e => e.typeId === 'boss_splitling');
    const target = parent || (shards.length ? shards.reduce((a, b) => (b.progress > a.progress ? b : a)) : null);
    if (target) bot.castUltimate(target.id);
  }

  // (b) From the late public game onward (and through the summit), save for + build
  // the boss BEFORE optimal floods the board to ~0 coins / no 2x2 gap. Defend with
  // freeze meanwhile. Once the boss is L2 (ultimate unlocked) we stop reserving and
  // let optimal resume so the public game still ends in a banked win.
  const endgame = bot.waveIndex >= buildFromWave || bot.s.publicWinBanked;
  if (endgame && !bossReady) {
    if (bosses.length === 0) {
      if (bot.coins >= bot.towerCost('boss', 1)) bot.placeBoss();
    } else {
      for (const t of bosses) {
        if (t.level < max && bot.coins >= bot.towerCost('boss', t.level + 1)) bot.upgrade(t);
      }
    }
    maybeFreeze(bot);
    return true;   // reserve coins + a free 2x2 until the key is ready
  }
  return false;
}

export function optimal({ reposition = true, freeze = true, ultimate = false, buildFromWave = 7 } = {}) {
  return {
    onDecision(bot) {
      if (freeze) maybeFreeze(bot);
      // W11 — when wielding the boss-tower ultimate, reserve the decision for it while
      // saving/building the key; default OFF keeps the ladder + public gates identical.
      if (ultimate && maybeUltimate(bot, { buildFromWave })) return;
      let acted = true;
      let guard = 0;
      // Spend down each decision: cover gaps first, then upgrade, then STACK raw
      // firepower with any surplus. Never sit on a pile of coins — late waves
      // demand continual reinvestment, so an optimal player keeps buying.
      while (acted && guard++ < 60) {
        acted = false;

        // (a) Keep a strong kill-zone: place on the best uncovered chokepoint,
        // with the AFFINITY-CORRECT tool for the active/next wave (P2).
        const ranked = bot.rankPlacements('strong', { minGain: 1 });
        const pick = ranked.find(r => r.gain > 0);
        if (pick) {
          const type = affinityChooseType(bot, pick.gx, pick.gy);
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
          const type = affinityChooseType(bot, stack.gx, stack.gy);
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

      // (e) P4 — fork/re-fork the L3 towers toward the upcoming threat (spends the
      // late-game surplus through the re-fork sink).
      manageForks(bot);
    },
  };
}

// ---------------------------------------------------------------------------
// 5. SUMMIT-CONQUEROR (W8) — the ONLY boss-aware policy. It plays the public game
// exactly like OPTIMAL (so it banks the public win), and ADDS the late-game boss
// tower + its manual ultimate — the offensive key to the secret summit. The four
// LADDER bots above stay boss-unaware on purpose: the public ladder + the
// secret-boss damage margins are therefore unchanged by W8.
//
// MECHANISM ONLY: this proves the boss tower + ultimate are reachable and used.
// The tuned values that make the summit actually WINNABLE (and keep the standard
// kit losing) are the single post-merge rebalance's job (B5/B6) — this policy does
// not assume a win.
// ---------------------------------------------------------------------------
export function summitConqueror({ buildFromWave = 7 } = {}) {
  // B5/B6 — now simply OPTIMAL wielding the boss-tower ultimate (the reusable
  // maybeUltimate key). It plays the public game like optimal (banking the win),
  // builds + upgrades the boss in the endgame, and times the shield-piercing nuke
  // against the split boss / its shards — the build that WINS the summit post-rebalance.
  return optimal({ ultimate: true, buildFromWave });
}

export const POLICIES = { unfocused, spread, saveUpgrade, optimal, summitConqueror };
