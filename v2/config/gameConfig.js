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
    },
    // 15 hand-authored patterns; bosses at 5/10/15 (V1 parity).
    patterns: [
      { enemies: [{ type: 'basic', count: 8, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'single' }, { type: 'fast', count: 2, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'line' }, { type: 'fast', count: 3, formation: 'single' }, { type: 'strong', count: 1, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'wedge' }, { type: 'fast', count: 4, formation: 'line' }, { type: 'strong', count: 2, formation: 'single' }] },
      { boss: 'boss_shield', enemies: [{ type: 'boss_shield', count: 1, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 10, formation: 'wedge' }, { type: 'fast', count: 8, formation: 'line' }, { type: 'strong', count: 4, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 6, formation: 'single' }, { type: 'fast', count: 12, formation: 'swarm' }, { type: 'strong', count: 2, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 12, formation: 'phalanx' }, { type: 'fast', count: 8, formation: 'swarm' }, { type: 'strong', count: 6, formation: 'line' }] },
      { enemies: [{ type: 'basic', count: 8, formation: 'single' }, { type: 'fast', count: 6, formation: 'line' }, { type: 'strong', count: 8, formation: 'phalanx' }] },
      { boss: 'boss_speed', enemies: [{ type: 'boss_speed', count: 1, formation: 'single' }] },
      { enemies: [{ type: 'basic', count: 15, formation: 'phalanx' }, { type: 'fast', count: 12, formation: 'swarm' }, { type: 'strong', count: 8, formation: 'line' }] },
      { enemies: [{ type: 'basic', count: 10, formation: 'single' }, { type: 'fast', count: 18, formation: 'swarm' }, { type: 'strong', count: 6, formation: 'phalanx' }] },
      { enemies: [{ type: 'basic', count: 12, formation: 'wedge' }, { type: 'fast', count: 10, formation: 'line' }, { type: 'strong', count: 12, formation: 'phalanx' }] },
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
    basic:  { name: 'Basic',  shape: 'circle',  ...PALETTE.enemies.basic,  speed: 1.1, hp: 100, size: 0.8, reward: 3, livesCost: 1, animSpeed: 1.0 },
    fast:   { name: 'Fast',   shape: 'diamond', ...PALETTE.enemies.fast,   speed: 2.0, hp: 50,  size: 0.7, reward: 5, livesCost: 1, animSpeed: 1.5 },
    strong: { name: 'Strong', shape: 'square',  ...PALETTE.enemies.strong, speed: 0.7, hp: 200, size: 1.0, reward: 8, livesCost: 1, animSpeed: 0.7 },
    // Boss retune (V2 balance): ~1.85x HP and 1.5x speed so each boss wave (5/10/15)
    // bleeds a few lives even off a completed build — the final boss is the nail-biter
    // that turns a perfect run into a "barely win". See v2/docs/BALANCE.md.
    boss_shield:     { name: 'Shield Boss', shape: 'hexagon', ...PALETTE.enemies.boss_shield,     speed: 1.2, hp: 925,  size: 1.3, reward: 25, livesCost: 3, animSpeed: 0.8, isBoss: true, behavior: { type: 'shield', durationMs: 3000, cooldownMs: 8000 } },
    boss_speed:      { name: 'Speed Boss',  shape: 'diamond', ...PALETTE.enemies.boss_speed,      speed: 2.7, hp: 555,  size: 1.2, reward: 20, livesCost: 4, animSpeed: 2.0, isBoss: true, behavior: { type: 'speed', multiplier: 2.0, durationMs: 4000, cooldownMs: 10000 } },
    boss_regenerate: { name: 'Regen Boss',  shape: 'octagon', ...PALETTE.enemies.boss_regenerate, speed: 0.9, hp: 1110, size: 1.4, reward: 30, livesCost: 5, animSpeed: 0.6, isBoss: true, behavior: { type: 'regen', hpPerSec: 2 } },
    // SECRET WAVE 16 BOSS — the mean orange star from the menu. It is intentionally
    // UNBEATABLE with today's towers: defeating it needs the (out-of-scope) "boss
    // tower upgrades". So its HP is set far above the maximum damage any current
    // build can land while it crosses the map (measured by tools/balance/measure-secret-boss.mjs,
    // see v2/docs/SECRET-WAVE.md), and its livesCost is a one-shot game-ender. If a
    // future build ever DOES kill it, it splits into 3 weaker BOSS shards
    // (boss_splitling) that carry on to the goal — so the wave still cannot be cheesed.
    // hp here is the BASE; wave-16 scaling multiplies it (~7.3x) on the field.
    boss_split:      { name: 'Split Boss',  shape: 'star',    ...PALETTE.enemies.boss_split,      speed: 1.35, hp: 20000, size: 1.4, reward: 15, livesCost: 99, animSpeed: 1.2, isBoss: true, behavior: { type: 'split', count: 3, childType: 'boss_splitling', childHp: 40000, childReward: 5 } },
    // Split child — a smaller, "weaker boss" shard of the star. Boss-flagged, shielded
    // (immune in bursts) and tanky enough to finish the path from wherever the parent
    // fell; a single shard reaching the goal ends the run (livesCost >= max lives).
    boss_splitling:  { name: 'Star Shard', shape: 'star',    ...PALETTE.enemies.boss_splitling,  speed: 1.5,  hp: 40000, size: 0.85, reward: 5, livesCost: 12, animSpeed: 1.3, isBoss: true, behavior: { type: 'shield', durationMs: 1800, cooldownMs: 2600 } },
  },

  // --- Towers (size + visual change per level; absolute per-level stats) ---
  towers: {
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
    },
    strong: {
      name: 'Strong', shape: 'square', color: PALETTE.towers.strong.body,
      kind: 'aoe',
      projectile: { speed: 400, size: 18, color: PALETTE.towers.strong.projectile },
      aoe: { radius: 1.0 }, // tiles — was 2.0; a tighter blast stops a single AoE tower from clearing a whole swarm, so volume late-game matters
      // Ranges tightened (was 2/3/4) to match the local-coverage model above.
      levels: [
        { damage: 20, range: 1.5, fireRateMs: 3000, cost: 15,  bombDamage: 40,  sizeScale: 0.375 },
        { damage: 35, range: 2,   fireRateMs: 2000, cost: 60,  bombDamage: 80,  sizeScale: 0.45 },
        { damage: 55, range: 2.5, fireRateMs: 1500, cost: 120, bombDamage: 120, sizeScale: 0.6 },
      ],
    },
  },

  // --- Combat ---
  combat: {
    critChance: 0.01,
    critMult: 2,
    projectileTtlMs: 10000,
    fireRateJitterMs: 50,           // ± jitter (seeded), V1 parity
    targetWeights: { dist: 0.3, health: 0.4, type: 0.3 },
    typeScore: { fast: 0.8, strong: 0.6, basic: 0.4 },
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
    // Cute-animation timing — SINGLE source for both the sim timers and the
    // renderer's progress math (they MUST read the same numbers or the curves break).
    anim: {
      enemyOuchMs: 220,        // ouch face + recoil-squash lifetime; re-armed on every hit
      towerFireAnimMs: 420,    // slow cute puff duration (was a hardcoded fast 180ms pop)
      towerPuffX: 0.14,        // peak horizontal stretch on fire
      towerPuffY: 0.24,        // peak vertical stretch on fire (taller = "puffing up")
      blink: { periodMinMs: 3200, periodMaxMs: 6000, durationMs: 120, doubleGapMs: 170 },
      blush: { periodMinMs: 7000, periodMaxMs: 13000, durationMs: 900, shyChance: 0.5 },
    },
  },

  // --- Benchmark fixture (locked; mirrors V1 harness) ---
  bench: { fixture: { enemies: 40, towers: 12, coins: 30 }, frames: 300, warmup: 60, throttle: 4 },

  // --- Maps (two human-editable ASCII maps) ---
  maps: MAPS,
});

export default CONFIG;
