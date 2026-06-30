/**
 * CuteDefense V2 — central, injectable config.
 *
 * Every balance/visual/bench constant lives here. No magic numbers in logic.
 * The simulation deep-clones this at game start, so the source object is never
 * mutated and each game gets a pristine copy (part of why cross-play state
 * cannot leak — see V1-FINDINGS Bug #1).
 *
 * Numbers reproduce V1's intended balance (see PARITY-AND-DIVERGENCE.md). Tower
 * per-level stats are expressed as ABSOLUTE values (V1 stored them as a mix of
 * additive/absolute, which was misleading); ranges use V1's documented intent.
 */
import { MAPS } from './maps/index.js';
import { PALETTE } from '../render/palette.js';

export const CONFIG = Object.freeze({
  // --- Fixed coordinate model (identical to V1) ---
  layout: {
    canvasW: 2514,
    canvasH: 1154,
    cols: 22,
    rows: 12,
    tile: 96,
    hudWidth: 400,
    get gridOffsetX() { return this.hudWidth; }, // ONE transform, derived from HUD width
    gridOffsetY: 0,
  },

  // --- Timing ---
  timestepMs: 1000 / 60, // fixed sim step

  // --- Economy ---
  economy: {
    startingCoins: 60,        // V2 balance retune: enough to bootstrap an opening, not enough to coast (see v2/docs/BALANCE.md)
    sellRefundFraction: 0.7,
    // P4 — max-level identity FORK economy. Reaching L3 forks for FREE (the felt
    // upgrade reward); SWITCHING arms costs a small flat coin sink — the recurring
    // spend that drains flooded late-game money (#4) and lets a kid try both arms.
    firstForkCost: 0,
    reForkCost: 20,
    coin: {
      lifetimeMs: 15000,
      warningMs: 5000,      // warning state when remaining < this
      collectRadius: 60,    // screen px (radius, not V1's axis-box)
      expireAnimMs: 800,
      collectAnimMs: 600,
    },
  },

  // --- Lives ---
  lives: { max: 12 },         // V2 balance retune: opening leaks now matter; a finished build keeps only a few lives (see v2/docs/BALANCE.md)

  // --- Pause (freeze + inspect-only; NO building) ---
  plan: {
    targetingToggleEnabled: false, // optional set-once targeting toggle; OFF/hidden for young kids (no combat clicks)
  },

  // --- Waves ---
  waves: {
    prepMs: 8000,
    betweenWaveMs: 3000,
    spawnIntervalMs: 2000,
    countdownThudFromSec: 5,    // play countdown_thud in the last N seconds of prep
    firstPrepMs: 8000,
    scaling: {
      hp: 1.12, speed: 1.03, count: 1.20, reward: 1.08,   // count 1.15->1.20: late waves demand continual reinvestment, not a one-time wall
      intervalReduction: 0.95, bossMult: 1.5, capWave: 15,
      coinReduction: 0.95,
      // W9 — convex LATE SURGE: compounds ON TOP of the base curve for waves past
      // `fromWave` only, bending the endgame UP without touching the opening. Applied to
      // NON-boss late waves (W9-14, the formality the brief measured) AND the SECRET
      // wave-16 boss (raising the wall ~3.3x -> ~580k, which the ultimate overturns);
      // the PUBLIC boss waves (5/10/15) are EXCLUDED in computeScaling so their tuned
      // life-drain / ladder budget stay exact. hp does the heavy lifting (the board
      // can't one-shot late enemies); count is held small AND reward is NOT surged, so
      // late income does not re-flood (no overbuild loop -> keeps the no-ultimate wall
      // margin >=5x and the late curve RISING per balance-curve W9); speed shortens
      // time-in-range so survivors penetrate deeper. V2.2 NOTE: the boss cost hike
      // (550 -> 1250) is funded WITHOUT a reward surge — the RESERVING summitConqueror
      // hoards from wave 7 and reaches 1250 by accumulation (the old ~857 peak was an
      // artifact of the cheap 550 cost forcing an early resume-to-spend). The summit win
      // is re-derived through the BOSS-ONLY levers (beam + shards + boss basic), which
      // never touch the public ladder / W9 penetration. See v2/docs/SECRET-WAVE.md.
      lateSurge: { fromWave: 9, hp: 1.22, count: 1.02, speed: 1.04 },
    },
    // P5 — quality-weighted star scoring at the public win. Weighted toward decision
    // quality (fast clears, low coin-hoard) over leftover lives (the SMALLEST weight),
    // so the meta goal pulls toward sharp play, not turtling. See v2/sim/scoring.js.
    stars: {
      parClearMs: 240000,        // "par" total elapsed for a fast 15-wave clear; faster -> higher speed score
      coinWasteRef: 400,         // hoarded coins at/above this == max waste (0 score) — "spend it" pressure
      livesRef: 12,              // survival denominator (== lives.max)
      weights: { lives: 0.25, speed: 0.35, waste: 0.40 }, // lives is the SMALLEST -> anti-turtle, quality dominates
      twoStarScore: 0.45,
      threeStarScore: 0.75,
    },
    // P5 — opt-in SUMMIT: only AFTER the public win is banked, an explicit dare
    // resumes play into the secret wave 16 (continueToSummit). enabled=false leaves
    // the public win as the end (the summit never gates the public win).
    summit: {
      enabled: true,
      dareText: 'Try the SUPER boss?',
    },
    // 15 hand-authored patterns; bosses at 5/10/15 (V1 parity).
    // P2 authoring: optional `pattern.entry` ('start'|'end', default 'start') and
    // `group.flags` (composable enemy property flags, default []). Onboarded one
    // verb at a time, mid/late where the difficulty curve has slack:
    //   W3  -> evasive (basic-tower's job)   W6 -> armored (strong-tower's job)
    //   W8  -> swarm   (strong-tower's job)   W11 -> reverse entry
    //   W13 -> recombined armored+evasive (upper tier)
    patterns: [
      { enemies: [{ type: 'basic', count: 8, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'single' }, { type: 'fast', count: 2, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'line', flags: ['evasive'] }, { type: 'fast', count: 3, formation: 'single' }, { type: 'strong', count: 1, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'wedge' }, { type: 'fast', count: 4, formation: 'line' }, { type: 'strong', count: 2, formation: 'single' }] },
      { boss: 'boss_shield', enemies: [{ type: 'boss_shield', count: 1, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 10, formation: 'wedge', flags: ['armored'] }, { type: 'fast', count: 8, formation: 'line' }, { type: 'strong', count: 4, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'single' }, { type: 'fast', count: 12, formation: 'swarm' }, { type: 'strong', count: 2, formation: 'single' }, { type: 'disabler', count: 1, formation: 'single' }] }, // W7: first disabler (the new nap lever)
      { enemies: [{ type: 'basic', count: 12, formation: 'phalanx', flags: ['swarm'] }, { type: 'fast', count: 8, formation: 'swarm' }, { type: 'strong', count: 6, formation: 'line' }] },
      { enemies: [{ type: 'basic', count: 8, formation: 'single' }, { type: 'fast', count: 6, formation: 'line' }, { type: 'strong', count: 8, formation: 'phalanx' }] },
      { boss: 'boss_speed', enemies: [{ type: 'boss_speed', count: 1, formation: 'single' }] },
      { entry: 'end', enemies: [{ type: 'basic', count: 15, formation: 'phalanx' }, { type: 'fast', count: 12, formation: 'swarm' }, { type: 'strong', count: 8, formation: 'line' }] },
      { enemies: [{ type: 'basic', count: 10, formation: 'single' }, { type: 'fast', count: 18, formation: 'swarm' }, { type: 'strong', count: 6, formation: 'phalanx' }, { type: 'disabler', count: 1, formation: 'single' }] }, // W12: second disabler
      { enemies: [{ type: 'basic', count: 12, formation: 'wedge', flags: ['armored', 'evasive'] }, { type: 'fast', count: 10, formation: 'line' }, { type: 'strong', count: 12, formation: 'phalanx' }] },
      { enemies: [{ type: 'basic', count: 20, formation: 'phalanx' }, { type: 'fast', count: 15, formation: 'swarm' }, { type: 'strong', count: 10, formation: 'phalanx' }] },
      { boss: 'boss_regenerate', enemies: [{ type: 'boss_regenerate', count: 1, formation: 'single' }] },
      // --- SECRET WAVE 16 ---------------------------------------------------
      // Hidden: `secret: true` keeps it OUT of the public wave count, so the HUD
      // reads "16/15" only once the player has survived all 15 known waves and
      // this surprise boss appears. Nothing reveals it beforehand. The star is
      // unbeatable for now (see boss_split above); it is the hook for the future
      // boss-tower-upgrade feature. Win only fires after this wave is cleared —
      // which currently cannot happen, so the run can no longer be "won" yet.
      { secret: true, announce: 'SECRET BOSS', boss: 'boss_split', enemies: [{ type: 'boss_split', count: 1, formation: 'single' }] },
    ],
  },

  // --- Enemies (shape = type; faces/animation kept; rendered minimally) ---
  // Colours come from PALETTE.enemies (saturated, pop on the pale map); stats keep V1 intent.
  enemies: {
    // `traits` give a base body its natural affinity (P2): precision (basic tower)
    // counters the dodgy `fast`; boom (strong tower) counters the tanky `strong`.
    // `basic` stays neutral. Authored flags (enemyFlags) compose ON TOP of these.
    basic:  { name: 'Basic',  shape: 'circle',  ...PALETTE.enemies.basic,  speed: 1.1, hp: 100, size: 0.8, reward: 3, livesCost: 1, animSpeed: 1.0, traits: [] },
    fast:   { name: 'Fast',   shape: 'diamond', ...PALETTE.enemies.fast,   speed: 2.0, hp: 50,  size: 0.7, reward: 5, livesCost: 1, animSpeed: 1.5, traits: ['evasive'] },
    strong: { name: 'Strong', shape: 'square',  ...PALETTE.enemies.strong, speed: 0.7, hp: 200, size: 1.0, reward: 8, livesCost: 1, animSpeed: 0.7, traits: ['armored'] },
    // Boss retune (V2 balance): ~1.85x HP and 1.5x speed so each boss wave (5/10/15)
    // bleeds a few lives even off a completed build — the final boss is the nail-biter
    // that turns a perfect run into a "barely win". See v2/docs/BALANCE.md.
    // P2 NOTE (#3 reconciled): the spec proposed a livesCost retune (3->2/4->3/5->4),
    // but it is marked "Tunable" and the parity-gate suites (playthrough, sim) assert
    // the existing boss life-drain exactly. The §5d.3 balance test instead validates
    // that boss-wave life loss is already FAIR (bounded) under the affinity-aware bot,
    // so the levers ship without flipping the locked terminal/exact-cost behavior.
    // Boss `traits` are intentionally OMITTED (spec §3: "optional traits per fantasy"):
    // giving bosses an affinity weakness let the affinity-aware bot 2x them and a
    // perfect run stopped bleeding ANY lives on the easy map (breaking "barely win").
    // Neutral bosses keep their tuned life-drain so the nail-biter finish survives P2.
    boss_shield:     { name: 'Shield Boss', shape: 'hexagon', ...PALETTE.enemies.boss_shield,     speed: 1.2, hp: 925,  size: 1.3, reward: 25, livesCost: 3, animSpeed: 0.8, isBoss: true, traits: [], behavior: { type: 'shield', durationMs: 3000, cooldownMs: 8000 } },
    boss_speed:      { name: 'Speed Boss',  shape: 'diamond', ...PALETTE.enemies.boss_speed,      speed: 2.7, hp: 555,  size: 1.2, reward: 20, livesCost: 4, animSpeed: 2.0, isBoss: true, traits: [], behavior: { type: 'speed', multiplier: 2.0, durationMs: 4000, cooldownMs: 10000 } },
    boss_regenerate: { name: 'Regen Boss',  shape: 'octagon', ...PALETTE.enemies.boss_regenerate, speed: 0.9, hp: 1110, size: 1.4, reward: 30, livesCost: 5, animSpeed: 0.6, isBoss: true, traits: [], behavior: { type: 'regen', hpPerSec: 2 } },
    // SECRET WAVE 16 BOSS — the mean orange star from the menu. It is intentionally
    // UNBEATABLE with today's towers: defeating it needs the (out-of-scope) "boss
    // tower upgrades". So its HP is set far above the maximum damage any current
    // build can land while it crosses the map (measured by tools/balance/measure-secret-boss.mjs,
    // see v2/docs/SECRET-WAVE.md), and its livesCost is a one-shot game-ender. If a
    // future build ever DOES kill it, it splits into 3 weaker BOSS shards
    // (boss_splitling) that carry on to the goal — so the wave still cannot be cheesed.
    // hp here is the BASE; wave-16 scaling multiplies it (~7.3x) on the field.
    // P4 NOTE: base hp raised 20000 -> 24000. The fork-aware "alert player" (Sniper
    // crit / Bomber AoE) lands more on the boss, so the unbeatable margin needed
    // restoring (measure-secret-boss.mjs re-measures it >= 5x). Terminal behavior is
    // unchanged: it is still never killed and remains the P5-owned summit.
    boss_split:      { name: 'Split Boss',  shape: 'star',    ...PALETTE.enemies.boss_split,      speed: 1.35, hp: 24000, size: 1.4, reward: 15, livesCost: 99, animSpeed: 1.2, isBoss: true, behavior: { type: 'split', count: 3, childType: 'boss_splitling', childHp: 6000, childReward: 5 } },
    // Split child — a smaller, "weaker boss" shard of the star. Boss-flagged, shielded
    // (immune in bursts) and tanky enough to finish the path from wherever the parent
    // fell; a single shard reaching the goal ends the run (livesCost >= max lives).
    // NOTE: shards spawn with boss_split.behavior.childHp (the authoritative 6000, set
    // by killEnemy's split), so this `hp` field is the matching nominal value. V2.2:
    // childHp 22000 -> 6000 and shield uptime cut (durationMs 1800 -> 700, cooldownMs
    // 2600 -> 4300, ~14% uptime) so the buffed boss basic + freeze + leftover BEAM casts
    // clear the 3 shards once the parent dies EARLY — including on the short, fast Comb
    // map. These NEVER touch the no-ultimate wall: without the beam the 580k parent never
    // dies, so shards never spawn there (verified by measure-secret-boss Scenarios A/A2/B).
    boss_splitling:  { name: 'Star Shard', shape: 'star',    ...PALETTE.enemies.boss_splitling,  speed: 1.5,  hp: 6000, size: 0.85, reward: 5, livesCost: 12, animSpeed: 1.3, isBoss: true, behavior: { type: 'shield', durationMs: 700, cooldownMs: 4300 } },
    // P3 — the silly "Sleepy" disabler (non-boss, gentle). It fires a telegraphed
    // sleepy-beam at its NEAREST eligible tower, briefly napping it (recoverable,
    // never destroyed). Reuses the `fast` palette so no new art dependency lands in
    // the sim; the renderer gives it a sleepy-cap glyph. Count is NOT wave-scaled
    // (see buildSpawnQueue) so exactly one shows up where authored.
    disabler: { name: 'Sleepy', shape: 'circle', ...PALETTE.enemies.fast, speed: 1.0, hp: 70, size: 0.75, reward: 4, livesCost: 1, animSpeed: 1.1, traits: [], behavior: { type: 'disabler', cooldownMs: 7000 } },
  },

  // --- Towers (size + visual change per level; absolute per-level stats) ---
  towers: {
    // P5 (#8) — decouple VISUAL scale from grid footprint. The drawn body radius is
    // clamped to footprintScaleCap * tile so an L3 body (raw sizeScale 0.6 -> 115px in
    // a 96px tile, ~19px overlap) now fits inside its cell; level differentiation stays
    // expressed by rings/badge/glow/sparkles, not raw body size. Halo may still extend
    // past the cell (only the solid body is clamped). Pure renderer/bake change.
    footprintScaleCap: 0.46,     // max body radius as a fraction of a tile -> body diameter 0.92*tile, fits the 96px cell
    footprintMargin: 0.06,       // required clear gap (fraction of tile) the sprite-fit test enforces
    basic: {
      name: 'Basic', shape: 'circle', color: PALETTE.towers.basic.body,
      kind: 'single',
      projectile: { speed: 800, size: 9, color: PALETTE.towers.basic.projectile },
      // Ranges tightened (was 5/6/7) so coverage is LOCAL: one tower no longer
      // blankets a third of the map. Full path coverage now takes many towers,
      // which is what separates a spread/save build from an optimal one.
      levels: [
        { damage: 8,  range: 2,   fireRateMs: 1800, cost: 5,   sizeScale: 0.375 },
        { damage: 12, range: 2.5, fireRateMs: 1350, cost: 50,  sizeScale: 0.45 },
        { damage: 18, range: 3,   fireRateMs: 900,  cost: 100, sizeScale: 0.6 },
      ],
      // P4 — L3 reversible identity FORK arms (picture-only choice). Sniper reuses
      // combat.critChance/critMult; Gunner reuses fireRateMs. Stats only — no new logic.
      // W3 — each arm carries a kid plain-words `blurb` (<=16 chars) the card paints
      // beside the picture icon so a 5-10yo knows what the fork DOES before tapping.
      forks: {
        sniper: { name: 'Sniper', icon: 'scope', blurb: 'Far + big hits', rangeMult: 1.6, critChance: 0.6, critMult: 3 },
        gunner: { name: 'Gunner', icon: 'rapid', blurb: 'Shoots fast', fireRateMult: 0.55 },
      },
    },
    strong: {
      name: 'Strong', shape: 'square', color: PALETTE.towers.strong.body,
      kind: 'aoe',
      projectile: { speed: 400, size: 18, color: PALETTE.towers.strong.projectile },
      aoe: { radius: 1.0 }, // tiles — was 2.0; a tighter blast stops a single AoE tower from clearing a whole swarm, so volume late-game matters
      // Ranges tightened (was 2/3/4) to match the local-coverage model above.
      // P4 CURVE REBALANCE (#5): mid-tiers must not be strictly dominated by L1 spam.
      // The dominance metric is damage-per-second x COVERAGE (range grows 1.5->2->2.5),
      // so coin-efficiency rises with level (see upgrade-curve.test). The L2 step is
      // made a touch cheaper + harder-hitting (the "did upgrading help = felt YES" tier
      // players actually buy) while the L3 ceiling (120 bomb @ 1.5s) is UNCHANGED, so
      // the calibrated ladder and the secret-boss damage margin are both preserved.
      levels: [
        { damage: 20, range: 1.5, fireRateMs: 3000, cost: 15,  bombDamage: 40,  sizeScale: 0.375 },
        { damage: 35, range: 2,   fireRateMs: 2000, cost: 55,  bombDamage: 85,  sizeScale: 0.45 },
        { damage: 55, range: 2.5, fireRateMs: 1500, cost: 120, bombDamage: 120, sizeScale: 0.6 },
      ],
      // P4 — L3 reversible identity FORK arms. Bomber reuses aoe.radius; Froster adds
      // a slow that REUSES P3's single shared slow term in enemySystem.effectiveSpeed.
      forks: {
        bomber:  { name: 'Bomber',  icon: 'bigboom',   blurb: 'Bigger boom', aoeRadiusMult: 1.8, bombDamageMult: 1.15 },
        froster: { name: 'Froster', icon: 'snowflake', blurb: 'Freezes them', slow: { factor: 0.5, durationMs: 1200 } },
      },
    },
    // BOSS (W8) — the late-game 3rd tower type + the offensive KEY to the secret
    // summit. It is deliberately NOT a DPS workhorse: a 2x2 obsidian fortress that
    // is expensive, sees the WHOLE board (fullMap), and only plinks slowly on its
    // own. Its real value is the single upgrade (L1->L2) that unlocks a manual,
    // shield-piercing, full-map ULTIMATE on a precious per-tower cooldown.
    //   * footprint: 2  -> reserves & occupies a 2x2 block (towerSystem.canPlace /
    //                      towerAt / placeTower are footprint-aware).
    //   * fullMap: true -> effectiveStats.range = layout.cols+layout.rows at runtime
    //                      (the level `range` constant below is the board-spanning
    //                      value so the bot's towerRange() stays honest — no magic
    //                      number; the renderer SKIPS the finite range ring).
    //   * 2 levels only -> upgradeTower caps at def.levels.length; canFork gates on
    //                      L3 so the boss never forks.
    // V2.2 COMBAT KEYSTONE — the boss tower is now the WINNABLE KEY via an AIMED,
    // SINGLE-TARGET BEAM (not the old full-map nuke). It is a DELIBERATE late-game
    // investment: L1 750 + L2 500 = 1250 total (~2.3x the old 550), funded by the
    // RESERVING bot hoarding from wave 7 (no reward surge needed; multiples viable only
    // with sustained surplus). The single post-merge rebalance jointly tunes cost +
    // beam + shards + boss basic to a TWO-SIDED gate (still-winnable AND not-a-faceroll)
    // through BOSS-ONLY levers that never touch the public ladder. See SECRET-WAVE.md.
    boss: {
      name: 'Boss', shape: 'fortress', color: PALETTE.towers.boss.body,
      kind: 'boss',
      footprint: 2,            // tiles per side -> 2x2 multi-tile placement
      fullMap: true,           // full-board range (renderer skips the finite ring)
      // Boss basic = a HEAVY, faster plink (V2.2): projectile ~2x larger + a quicker
      // fire cadence (still >= 3000 -> never a DPS workhorse). It supports the kit
      // against the 3 shards while the beam cracks the parent.
      projectile: { speed: 600, size: 28, color: PALETTE.towers.boss.projectile },
      levels: [
        // range = board-spanning constant (cols 22 + rows 12 = 34); fullMap overrides at runtime.
        { damage: 90, range: 34, fireRateMs: 4000, cost: 750, sizeScale: 0.9 },                 // L1 ultimate LOCKED (deliberate late-game buy)
        { damage: 130, range: 34, fireRateMs: 3600, cost: 500, sizeScale: 1.0, ultimate: true }, // L2 ultimate UNLOCKED (real second sink; heavy plink supports shard-clearing)
      ],
      // The manual ULTIMATE ("Boss Beam"): an AIMED, SINGLE-TARGET, shield-piercing,
      // affinity-neutral BEAM that applies DAMAGE-OVER-TIME for durationMs (enormous
      // TOTAL, but NEVER an instant kill — totalDamage < the ~580k on-field parent, so
      // ~2 casts crack it). Requires a chosen ENEMY target (aim-confirm: no target ->
      // no fire) and rides a LONG per-tower cooldown (~2-3 casts/crossing, not 5).
      // Triggered like Freeze (HUD button + key) but arms a crosshair first.
      ultimate: {
        name: 'Boss Beam',
        cooldownMs: 7000,           // LONG (was 5000): ~2-3 casts crack the parent, leftover casts mop shards
        initialReadyFraction: 0.5,  // first cast ready a fraction into the cooldown (mirrors freeze)
        piercesShield: true,        // pierces shielded shards (sourceType null -> no 2x cheese)
        requireTarget: true,        // aim-confirm: a cast with no valid enemy target is rejected
        // single-target DoT: chunk per tick = totalDamage * tickMs / durationMs. With
        // 340000 / 2500 / 250 -> 10 ticks of 34000 (~5.9% of the 580k parent/tick: no
        // one-tick delete), full beam 340000 < 580k (no one-cast kill); ~2 casts crack
        // the parent EARLY so its 3 shards traverse the kill-zone for the towers/freeze.
        beam: {
          totalDamage: 340000,      // enormous TOTAL, < on-field parent HP (~580k): ~2 casts crack it
          durationMs: 2500,         // DoT window
          tickMs: 250,              // DoT cadence (10 chunks); also throttles ENEMY_HIT/FX spam
          widthPx: 12,              // streaming beam thickness (renderer)
          color: PALETTE.ui.ultReady,
        },
      },
    },
  },

  // --- Active ability: field Freeze (P3). ONE slow mechanism; P4's Froster reuses
  // this exact field (state.freeze + the multiply in enemySystem.effectiveSpeed). ---
  freeze: {
    durationMs: 2500,           // enemies crawl this long
    cooldownMs: 32000,          // precious cooldown
    initialReadyFraction: 0.33, // first cast ready after ~33% of a cooldown
    slowMult: 0.18,             // speed multiplier while frozen (slow, never 0 -> never a hard stun-lock)
    minSpeedFraction: 0.15,     // W10 floor: no stack of slows drops an enemy below this fraction of its
                                // OWN base speed (capped slow, never an absolute crawl). Floor scales with
                                // baseSpeed so a fast boss keeps meaningful speed while frozen. Sits just
                                // BELOW slowMult, so a SINGLE freeze is unchanged (0.18 > 0.15 -> not floored);
                                // the floor only bites when slows STACK (freeze x Froster = 0.09 -> floored).
    botBunchCount: 4,           // freeze-aware bot: cast offensively when >= this many enemies cluster near a tower
    botBunchRadius: 1.5,        // tiles, clustering radius added to a tower's kill-zone for the bot's offensive trigger
  },

  // --- Recoverable tower NAP (disabler) + anti-stun-lock governor (P3) ---
  nap: {
    durationMs: 2500,           // how long a tower naps
    immunityMs: 6000,           // post-wake immunity — the anti-stun-lock governor
    telegraphMs: 900,           // sleepy-beam wind-up before the nap lands (telegraph)
    maxPathFraction: 0.7,       // disabler won't nap once past 70% of the path ("never near a leak")
    beamRange: 4,               // tiles; nearest-tower query radius (<=0 = whole-map nearest)
  },

  // --- Combat ---
  combat: {
    critChance: 0.01,
    critMult: 2,
    projectileTtlMs: 10000,
    fireRateJitterMs: 50,           // ± jitter (seeded), V1 parity
    targetWeights: { dist: 0.3, health: 0.4, type: 0.3 },
    typeScore: { fast: 0.8, strong: 0.6, basic: 0.4 },
    // Soft 2-way tower affinity (P2): the right tool ~2x, the wrong tool ~0.5x.
    // NEVER 0x/immunity — two towers must not hard-leak an enemy.
    affinity: {
      strongMult: 2.0,
      weakMult: 0.5,
      neutralMult: 1.0,
      // tower typeId -> the enemy traits this tower is the RIGHT counter for.
      counters: { basic: ['evasive'], strong: ['armored', 'swarm'] },
    },
  },

  // --- Composable enemy property flags (P2) ---
  // Authored onto base bodies in the wave list (group.flags), NOT new enemy types.
  // Each flag carries a `trait` (drives affinity), a `glyph` (baked into the
  // SpriteCache by a stable flagmask), and an optional `behavior` composed at spawn.
  enemyFlags: {
    cap: { early: 2, max: 3 },   // legibility cap (enforced at spawn + by test)
    // stable order defines the SpriteCache flagmask bit order:
    order: ['armored', 'evasive', 'regen', 'swarm', 'buffer'],
    // `label` (1 word) + `legend` (plain-words effect) feed the pre-wave Recon
    // legend (W2). Kid-legible, mobile-short; the renderer reads these — no copy
    // is hardcoded in Renderer.js.
    defs: {
      armored: { trait: 'armored', glyph: 'spikes',   animated: false, label: 'Tough',  legend: 'Hard shell — strong towers hit best' },
      evasive: { trait: 'evasive', glyph: 'shimmer',  animated: true,  label: 'Quick',  legend: 'Slippery — basic towers catch it' }, // SOLE live-animated flag (p95 budget)
      regen:   { trait: 'regen',   glyph: 'leaf',     animated: false, label: 'Healer', legend: 'Heals up — pop it fast', behavior: { type: 'regen', hpPerSec: 3 } },
      swarm:   { trait: 'swarm',   glyph: 'cluster',  animated: false, label: 'Swarm',  legend: 'Comes in a big bunch' },
      buffer:  { trait: 'buffer',  glyph: 'umbrella', animated: false, label: 'Helper', legend: 'Shields its friends nearby', behavior: { type: 'buff', buffRadius: 1.5, buffMult: 0.5 } },
    },
    // Recon legend layout (W2): one row per incoming flag (glyph disc + label +
    // legend), then an entry row when the wave comes from behind. Numbers live
    // here so the renderer carries no magic numbers / hardcoded copy.
    recon: { glyphR: 18, rowGap: 44, labelSize: 20, legendSize: 16, padY: 6, entryLabel: 'Comes from behind!' },
  },

  // --- Visual / effects (all colour from the single PALETTE source of truth) ---
  visual: {
    ...PALETTE.map,            // grass, grassDark, path, pathDark, start, end (pale, recede)
    goal: PALETTE.goal,        // baked IN/OUT marker inks
    coin: PALETTE.gold.base,
    coinBorder: PALETTE.gold.deep,
    gold: PALETTE.gold,
    ui: PALETTE.ui,            // saturated candy chrome (dock, cards, buttons, popup, menu)
    fx: PALETTE.fx,            // hp bars, explosions, announcements, win/lose
    font: PALETTE.font,        // display / body / round / rugged stacks
    effectsEnabled: true,      // flipped off automatically if bench lacks headroom
    statDecimals: 2,           // W6: precision every displayed stat number rounds to (fmtStat)
    statMinFontPx: 13,         // W6: floor for the card stat-line auto-shrink (kid-legible)
    // V2.2 V5-bugs — build-tray cost layout (boss is the first 3-digit cost, 250).
    tray: {
      iconThumb: 40,           // tray icon size (was inline th-18=46; shrunk to free cost room)
      iconGap: 6,              // min gap between the icon's right edge and the cost text
      costInset: 12,           // cost text right inset within the cell
      costBaseFontPx: 22,      // start size (matches the prior inline 22px)
      costMinFontPx: 14,       // auto-shrink floor (kid-legible; sibling of statMinFontPx)
    },
    // V2.2 V5-bugs — placement-popup buy-button coin+cost group (measured, right-anchored).
    buyButton: {
      coinR: 16,               // gold coin radius (was inline)
      coinGap: 12,             // gap between coin right edge and cost left edge
      costInset: 16,           // cost group right inset within the button
      costFontPx: 30,          // cost size (matches the prior inline 30px)
    },
    // Cute-animation timing — SINGLE source for both the sim timers and the
    // renderer's progress math (they MUST read the same numbers or the curves break).
    anim: {
      enemyOuchMs: 220,        // ouch face + recoil-squash lifetime; re-armed on every hit
      towerFireAnimMs: 420,    // slow cute puff duration (was a hardcoded fast 180ms pop)
      napZzzMs: 2500,          // P3 renderer: zzz bubble lifetime (mirrors nap.durationMs)
      freezeTintMs: 2500,      // P3 renderer: frost overlay lifetime (mirrors freeze.durationMs)
      towerPuffX: 0.14,        // peak horizontal stretch on fire
      towerPuffY: 0.24,        // peak vertical stretch on fire (taller = "puffing up")
      blink: { periodMinMs: 3200, periodMaxMs: 6000, durationMs: 120, doubleGapMs: 170 },
      blush: { periodMinMs: 7000, periodMaxMs: 13000, durationMs: 900, shyChance: 0.5 },
    },
    // W4 — HUD ABILITY slot geometry (the reusable dock idiom; W8 slots a 2nd
    // ability here). The freeze control lives in the left dock gutter, OFF the
    // play grid, so it can never contend with tower placement.
    ability: {
      slotH: 92,          // ability slot height (px)
      bottomOffset: 196,  // slot bottom = canvasH - this (sits 16px above the tray top at H-180)
      pad: 24,            // matches the dock pad used throughout _hud
      labelGap: 26,       // "ABILITY" eyebrow baseline above the slot
      sweepAlpha: 0.30,   // COOLDOWN charge-fill opacity
      ringAlpha: 0.55,    // ACTIVELY-FREEZING depleting duration ring opacity
    },
  },

  // --- Benchmark fixture (locked; mirrors V1 harness) ---
  bench: { fixture: { enemies: 40, towers: 12, bossTowers: 1, coins: 30, disablers: 2, flags: ['armored', 'evasive', 'regen'] }, frames: 300, warmup: 60, throttle: 4 },

  // --- Maps (two human-editable ASCII maps) ---
  maps: MAPS,
});

export default CONFIG;
