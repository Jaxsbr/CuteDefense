/**
 * createInitialState — the single pure factory for a fresh game.
 *
 * Everything mutable lives in the returned object; the sim never keeps mutable
 * module-level state. New Game / Restart simply throws away the old state and
 * calls this again, so NOTHING can leak across plays (the structural fix for
 * V1's boss-wave instant-loss bug). The config is deep-cloned so the source
 * stays pristine.
 */
import { Rng } from './rng.js';
import { EventBus } from './events.js';
import { parseMap } from './mapParser.js';

export function createInitialState(config, seed = 1, mapIndex = null) {
  const cfg = structuredClone(config);
  const rng = new Rng(seed);
  const maps = cfg.maps;
  const idx = mapIndex == null ? rng.int(0, maps.length - 1) : mapIndex;
  const map = parseMap(maps[idx]);

  return {
    config: cfg,
    rng,
    bus: new EventBus(),
    mapIndex: idx,
    map,

    status: 'menu',          // menu | playing | paused | won | lost
    clock: 0,                // accumulated ms while playing (pausable)
    lives: cfg.lives.max,
    coins: cfg.economy.startingCoins,
    soundEnabled: true,

    wave: {
      index: 0,              // 0 = not started; becomes 1 on first wave
      phase: 'idle',         // idle | prepare | spawning | active | complete
      phaseClock: 0,
      spawnQueue: [],        // [{ typeId, def, gapMs }]
      spawnTimer: 0,
      spawnedCount: 0,
      totalCount: 0,
      isBossWave: false,
      earnings: 0,           // coins earned from kills this wave (for the 25% bonus)
      announcement: null,    // { text, kind }
      lastThudSec: null,
    },

    coinPulseEnd: 0,         // clock time until which the HUD coin total pulses
    bonusFloat: null,        // { amount, untilClock } floating "+N" near the coin total

    enemies: [],
    towers: [],
    projectiles: [],
    coinsList: [],
    effects: [],

    selected: { kind: null, id: null },   // 'tower' | 'enemy'
    placement: null,                       // { gx, gy, towerType }

    nextId: 1,
    frameEvents: [],

    stats: {
      wavesCleared: 0,
      towersBuilt: 0,
      enemiesKilled: 0,
      coinsEarned: 0,
      elapsedMs: 0,
    },
  };
}

export function genId(state) { return state.nextId++; }

// Continuous grid-space center of a tile cell.
export function cellCenter(cell) { return { x: cell.x + 0.5, y: cell.y + 0.5 }; }

export default createInitialState;
