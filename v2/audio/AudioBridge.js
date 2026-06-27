/**
 * AudioBridge — ports V1's exact .ogg SFX, triggered by sim events. The sim
 * stays silent/headless; this is the only place audio is touched. High-frequency
 * sounds are lightly throttled to avoid overload (an improvement over V1, which
 * could fire enemy_hit dozens of times a frame).
 */
import { EV } from '../sim/events.js';

const BASE = 'assets/audio/';
const SOUNDS = {
  tower_place: 'sounds/tower_place.ogg',
  tower_upgrade: 'sounds/tower_upgrade.ogg',
  tower_upgrade_level2: 'sounds/tower_upgrade_level2.ogg',
  tower_upgrade_level3: 'sounds/tower_upgrade_level3.ogg',
  coin_collect: 'sounds/coin_collect.ogg',
  coin_expire: 'sounds/coin_expire.ogg',
  projectile_fire: 'sounds/projectile_fire.ogg',
  enemy_hit: 'sounds/enemy_hit.ogg',
  enemy_death: 'sounds/enemy_death.ogg',
  enemy_spawn: 'sounds/enemy_spawn.ogg',
  enemy_reach_end: 'sounds/enemy_reach_end.ogg',
  wave_start: 'sounds/wave_start.ogg',
  wave_complete: 'sounds/wave_complete.ogg',
  countdown_thud: 'sounds/countdown_thud.ogg',
  button_click: 'sounds/button_click.ogg',
};
const VOLUME = { _default: 0.7, enemy_death: 0.9, button_click: 0.5 };
const THROTTLE_MS = { projectile_fire: 60, enemy_hit: 50, enemy_spawn: 40 };

export class AudioBridge {
  constructor(bus, { muted = false } = {}) {
    this.muted = muted;
    this.pools = {};
    this.lastPlayed = {};
    this.unlocked = false;
    for (const [name, file] of Object.entries(SOUNDS)) {
      try {
        const a = new Audio(BASE + file);
        a.preload = 'auto';
        a.volume = VOLUME[name] ?? VOLUME._default;
        this.pools[name] = a;
      } catch { /* headless / load failure: ignore */ }
    }
    this._wire(bus);
  }

  play(name) {
    if (this.muted) return;
    const a = this.pools[name];
    if (!a) return;
    const now = performance.now();
    const gap = THROTTLE_MS[name];
    if (gap && this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return;
    this.lastPlayed[name] = now;
    try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ }
  }

  setMuted(m) { this.muted = m; }
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    // Touch one sound from the user gesture to satisfy autoplay policies.
    const a = this.pools.button_click;
    if (a) { const v = a.volume; a.volume = 0.01; a.play().then(() => { a.volume = v; }).catch(() => { a.volume = v; }); }
  }

  _wire(bus) {
    bus.on(EV.WAVE_COUNTDOWN_TICK, () => this.play('countdown_thud'));
    bus.on(EV.WAVE_START, () => this.play('wave_start'));
    bus.on(EV.WAVE_COMPLETE, () => this.play('wave_complete'));
    bus.on(EV.ENEMY_SPAWN, () => this.play('enemy_spawn'));
    bus.on(EV.ENEMY_HIT, () => this.play('enemy_hit'));
    bus.on(EV.ENEMY_DEATH, () => this.play('enemy_death'));
    bus.on(EV.ENEMY_REACH_END, () => this.play('enemy_reach_end'));
    bus.on(EV.TOWER_PLACE, () => this.play('tower_place'));
    bus.on(EV.TOWER_UPGRADE, ({ level }) => this.play(level === 2 ? 'tower_upgrade_level2' : level === 3 ? 'tower_upgrade_level3' : 'tower_upgrade'));
    bus.on(EV.TOWER_SELL, () => this.play('button_click'));
    bus.on(EV.PROJECTILE_FIRE, () => this.play('projectile_fire'));
    bus.on(EV.WAVE_BONUS, () => this.play('coin_collect')); // end-of-wave bonus jingle
    bus.on(EV.BUTTON_CLICK, () => this.play('button_click'));
  }
}

export default AudioBridge;
