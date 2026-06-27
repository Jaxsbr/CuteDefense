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
    startingCoins: 40,
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
  lives: { max: 25 },

  // --- Waves ---
  waves: {
    prepMs: 8000,
    betweenWaveMs: 3000,
    spawnIntervalMs: 2000,
    countdownThudFromSec: 5,    // play countdown_thud in the last N seconds of prep
    firstPrepMs: 8000,
    scaling: {
      hp: 1.12, speed: 1.03, count: 1.15, reward: 1.08,
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
    ],
  },

  // --- Enemies (shape = type; faces/animation kept; rendered minimally) ---
  enemies: {
    basic:  { name: 'Basic',  shape: 'circle',  color: '#FF6B6B', border: '#FF4444', glow: '#FFAAAA', speed: 1.1, hp: 100, size: 0.8, reward: 3, livesCost: 1, animSpeed: 1.0 },
    fast:   { name: 'Fast',   shape: 'diamond', color: '#4ECDC4', border: '#2E8B8B', glow: '#7EDDDD', speed: 2.0, hp: 50,  size: 0.7, reward: 5, livesCost: 1, animSpeed: 1.5 },
    strong: { name: 'Strong', shape: 'square',  color: '#45B7D1', border: '#2E5B7D', glow: '#7DB8D1', speed: 0.7, hp: 200, size: 1.0, reward: 8, livesCost: 1, animSpeed: 0.7 },
    boss_shield:     { name: 'Shield Boss', shape: 'hexagon', color: '#9B59B6', border: '#8E44AD', glow: '#BB8FCE', speed: 0.8, hp: 500, size: 1.3, reward: 25, livesCost: 3, animSpeed: 0.8, isBoss: true, behavior: { type: 'shield', durationMs: 3000, cooldownMs: 8000 } },
    boss_speed:      { name: 'Speed Boss',  shape: 'diamond', color: '#E74C3C', border: '#C0392B', glow: '#F1948A', speed: 1.8, hp: 300, size: 1.2, reward: 20, livesCost: 4, animSpeed: 2.0, isBoss: true, behavior: { type: 'speed', multiplier: 2.0, durationMs: 4000, cooldownMs: 10000 } },
    boss_regenerate: { name: 'Regen Boss',  shape: 'octagon', color: '#27AE60', border: '#1E8449', glow: '#82E0AA', speed: 0.6, hp: 600, size: 1.4, reward: 30, livesCost: 5, animSpeed: 0.6, isBoss: true, behavior: { type: 'regen', hpPerSec: 2 } },
    boss_split:      { name: 'Split Boss',  shape: 'star',    color: '#F39C12', border: '#D68910', glow: '#F7DC6F', speed: 0.9, hp: 400, size: 1.3, reward: 15, livesCost: 4, animSpeed: 1.2, isBoss: true, behavior: { type: 'split', count: 3, childType: 'basic', childHp: 50, childReward: 5 } },
  },

  // --- Towers (size + visual change per level; absolute per-level stats) ---
  towers: {
    basic: {
      name: 'Basic', shape: 'circle', color: '#4A90E2',
      kind: 'single',
      projectile: { speed: 800, size: 12, color: '#4A90E2' },
      levels: [
        { damage: 8,  range: 5, fireRateMs: 1800, cost: 5,   sizeScale: 0.375 },
        { damage: 12, range: 6, fireRateMs: 1350, cost: 50,  sizeScale: 0.45 },
        { damage: 18, range: 7, fireRateMs: 900,  cost: 100, sizeScale: 0.6 },
      ],
    },
    strong: {
      name: 'Strong', shape: 'square', color: '#8A2BE2',
      kind: 'aoe',
      projectile: { speed: 400, size: 18, color: '#FF4500' },
      aoe: { radius: 2.0 }, // tiles
      levels: [
        { damage: 20, range: 2, fireRateMs: 3000, cost: 15,  bombDamage: 40,  sizeScale: 0.375 },
        { damage: 35, range: 3, fireRateMs: 2000, cost: 60,  bombDamage: 80,  sizeScale: 0.45 },
        { damage: 55, range: 4, fireRateMs: 1500, cost: 120, bombDamage: 120, sizeScale: 0.6 },
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

  // --- Visual / effects (effects gated by bench headroom) ---
  visual: {
    grass: '#98FB98',
    grassDark: '#7CCD7C',
    path: '#C8A064',
    pathDark: '#A9854E',
    start: '#5BC85B',
    end: '#E25B5B',
    coin: '#FFD700',
    coinBorder: '#FFA500',
    effectsEnabled: true, // flipped off automatically if bench lacks headroom
  },

  // --- Benchmark fixture (locked; mirrors V1 harness) ---
  bench: { fixture: { enemies: 40, towers: 12, coins: 30 }, frames: 300, warmup: 60, throttle: 4 },

  // --- Maps (two human-editable ASCII maps) ---
  maps: MAPS,
});

export default CONFIG;
