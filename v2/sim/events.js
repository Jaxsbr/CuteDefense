/**
 * Tiny synchronous event bus. The pure sim emits gameplay events; the browser
 * layers (audio, effects, render feedback) subscribe. Keeping events as the
 * coupling point means audio/effects never reach into sim internals and the sim
 * stays headless. Events are also collected into state.frameEvents each step so
 * headless tests can assert on them without subscribing.
 */
export class EventBus {
  constructor() { this.handlers = new Map(); }
  on(type, cb) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(cb);
    return () => this.handlers.get(type)?.delete(cb);
  }
  emit(type, payload) {
    const set = this.handlers.get(type);
    if (set) for (const cb of set) cb(payload);
  }
}

// Canonical event names (one place, no stringly-typed drift).
export const EV = {
  WAVE_PREPARE: 'wave:prepare',
  WAVE_COUNTDOWN_TICK: 'wave:countdownTick',
  WAVE_START: 'wave:start',
  WAVE_COMPLETE: 'wave:complete',
  ENEMY_SPAWN: 'enemy:spawn',
  ENEMY_HIT: 'enemy:hit',
  ENEMY_DEATH: 'enemy:death',
  ENEMY_REACH_END: 'enemy:reachEnd',
  TOWER_PLACE: 'tower:place',
  TOWER_UPGRADE: 'tower:upgrade',
  TOWER_SELL: 'tower:sell',
  TOWER_FORK: 'tower:fork',                 // P4 max-level identity fork { id, arm }
  TOWER_STUN: 'tower:stun',                 // P3 disabler nap landed { towerId, untilClock, durationMs }
  TOWER_WAKE: 'tower:wake',                 // P3 nap recovered { towerId }
  DISABLER_BEAM: 'enemy:disablerBeam',      // P3 telegraph wind-up started { enemyId, towerId, fireAtClock }
  FREEZE_CAST: 'ability:freeze',            // P3 freeze field cast { activeUntil, durationMs }
  ULTIMATE_CAST: 'ability:ultimate',        // V2.2 boss-tower aimed BEAM cast { towerId, targetId }
  PROJECTILE_FIRE: 'projectile:fire',
  COIN_COLLECT: 'coin:collect',
  COIN_EXPIRE: 'coin:expire',
  WAVE_BONUS: 'wave:bonus',
  BUTTON_CLICK: 'ui:buttonClick',
  GAME_WON: 'game:won',
  GAME_LOST: 'game:lost',
  BOSS_DEFEATED: 'boss:defeated',          // P5 distinct banner per public boss wave (5/10/15)
  SUMMIT_START: 'summit:start',            // P5 opt-in continue into the secret wave 16
  SUMMIT_WON: 'summit:won',                // W11 the TRUE ending: the secret wave 16 is CLEARED (separate from GAME_WON)
};

export default EventBus;
