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
    publicWinBanked: false,  // P5: set once when the public wave-15 win fires; never cleared mid-run
    summitMode: false,       // P5: true after continueToSummit(); allows advancing into the secret wave(s)
    summitWon: false,        // W11: set once when the secret wave 16 is CLEARED (the true SUMMIT_WON ending)
    stars: 0,                // P5: 1-3 quality stars, set at the public win
    clock: 0,                // accumulated ms while playing (pausable)
    menuClock: 0,            // deterministic cosmetic clock; advances ONLY in 'menu'
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
    livesFlashUntil: 0,      // clock deadline for the lives-lost "ouch" HUD reaction (display-only)
    livesFlashAmount: 0,     // how many lives the last hit cost (1 normal, 3-5 boss)
    wavePopUntil: 0,         // clock deadline for the WAVE chip pop on wave advance

    enemies: [],
    towers: [],
    projectiles: [],
    coinsList: [],
    effects: [],
    beams: [],               // V2.2 — active single-target boss BEAMs (DoT), drawn by the renderer
    ultimateAiming: false,   // V2.2 — aim-confirm: true while the crosshair is armed for the boss beam

    // P3 — field Freeze ability (the single shared slow field; P4 Froster reuses it).
    // First cast becomes available after a fraction of the cooldown (clock starts at 0).
    freeze: {
      readyAt: cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction,
      activeUntil: 0,
    },

    selected: { kind: null, id: null },   // 'tower' | 'enemy'
    placement: null,                       // { gx, gy, towerType }
    trayType: null,                        // tap-once build tray: selected tower type id, or null

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
