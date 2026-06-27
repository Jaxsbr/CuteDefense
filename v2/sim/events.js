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
  PROJECTILE_FIRE: 'projectile:fire',
  COIN_COLLECT: 'coin:collect',
  COIN_EXPIRE: 'coin:expire',
  WAVE_BONUS: 'wave:bonus',
  BUTTON_CLICK: 'ui:buttonClick',
  GAME_WON: 'game:won',
  GAME_LOST: 'game:lost',
};

export default EventBus;
