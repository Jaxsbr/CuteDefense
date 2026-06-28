/**
 * Simulation — the headless game. Owns state, steps on a fixed timestep, exposes
 * a small command API for the input layer, and decides win/lose centrally.
 *
 * Pure: no DOM, no canvas, no wall-clock. Drive it with step(realDtMs) from the
 * browser RAF loop, or tick(dt) directly from headless tests/bench.
 */
import { createInitialState } from './state.js';
import { EV } from './events.js';
import * as waves from './systems/waveSystem.js';
import * as enemies from './systems/enemySystem.js';
import * as towers from './systems/towerSystem.js';
import * as projectiles from './systems/projectileSystem.js';
import * as economy from './systems/economySystem.js';

const MAX_STEPS_PER_FRAME = 5; // avoid spiral-of-death after a long stall/pause

export class Simulation {
  constructor(config, { seed = 1, mapIndex = null } = {}) {
    this.config = config;
    this._seed = seed;
    this.state = createInitialState(config, seed, mapIndex);
    this.state.lastTowerType = 'basic';
    this._acc = 0;
  }

  get bus() { return this.state.bus; }

  // ---- lifecycle ----
  startGame() {
    const s = this.state;
    s.status = 'playing';
    waves.startWaveSystem(s);
  }

  restart({ seed = this._seed + 1, mapIndex = this.state.mapIndex } = {}) {
    // Fresh state from the factory — nothing can leak across plays.
    this._seed = seed;
    this.state = createInitialState(this.config, seed, mapIndex);
    this.state.lastTowerType = 'basic';
    this._acc = 0;
    this.startGame();
  }

  toMenu() {
    this.state = createInitialState(this.config, this._seed, this.state.mapIndex);
    this.state.lastTowerType = 'basic';
    this._acc = 0;
  }

  togglePause() {
    const s = this.state;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
  }

  // ---- stepping ----
  step(realDtMs) {
    const dt = this.config.timestepMs;
    this._acc += Math.min(realDtMs, dt * MAX_STEPS_PER_FRAME);
    let n = 0;
    while (this._acc >= dt && n < MAX_STEPS_PER_FRAME) { this.tick(dt); this._acc -= dt; n++; }
  }

  tick(dt) {
    const s = this.state;
    s.frameEvents = [];
    if (s.status === 'menu') { s.menuClock += dt; return; } // cosmetic menu time only
    if (s.status !== 'playing') return;
    s.clock += dt;
    s.stats.elapsedMs += dt;
    waves.update(s, dt);
    enemies.update(s, dt);
    towers.update(s, dt);
    projectiles.update(s, dt);
    economy.update(s, dt);
    this._updateEffects(dt);
    this._checkWinLose();
  }

  _updateEffects(dt) {
    const s = this.state;
    for (const fx of s.effects) fx.age += dt;
    s.effects = s.effects.filter(fx => fx.age < fx.ttl);
  }

  _checkWinLose() {
    const s = this.state;
    if (s.lives <= 0) {
      s.lives = Math.max(0, s.lives);
      s.status = 'lost';
      s.bus.emit(EV.GAME_LOST, { stats: s.stats });
      s.frameEvents.push({ type: EV.GAME_LOST });
    } else if (waves.isFinalWaveComplete(s)) {
      s.status = 'won';
      s.bus.emit(EV.GAME_WON, { stats: s.stats });
      s.frameEvents.push({ type: EV.GAME_WON });
    }
  }

  // ---- queries ----
  enemyAt(gx, gy, radius = 0.6) {
    let best = null, bestD = radius * radius;
    for (const e of this.state.enemies) {
      if (!e.alive || e.reachedGoal) continue;
      const dx = e.x - gx, dy = e.y - gy, d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = e; }
    }
    return best;
  }
  towerAt(gx, gy) { return towers.towerAt(this.state, gx, gy); }
  canPlace(gx, gy) { return towers.canPlace(this.state, gx, gy); }
  selectedTower() {
    const s = this.state;
    return s.selected.kind === 'tower' ? s.towers.find(t => t.id === s.selected.id) : null;
  }
  selectedEnemy() {
    const s = this.state;
    return s.selected.kind === 'enemy' ? s.enemies.find(e => e.id === s.selected.id) : null;
  }

  // ---- commands ----
  // A grid click: tower → select; enemy → select; buildable empty → open popup.
  gridClick(gx, gy) {
    const s = this.state;
    const igx = Math.floor(gx), igy = Math.floor(gy);
    const t = this.towerAt(igx, igy);
    if (t) { s.selected = { kind: 'tower', id: t.id }; s.placement = null; return 'tower'; }
    const e = this.enemyAt(gx, gy);
    if (e) {
      if (s.selected.kind === 'enemy' && s.selected.id === e.id) s.selected = { kind: null, id: null };
      else s.selected = { kind: 'enemy', id: e.id };
      s.placement = null;
      return 'enemy';
    }
    s.selected = { kind: null, id: null };
    if (this.canPlace(igx, igy)) {
      s.placement = { gx: igx, gy: igy, towerType: s.lastTowerType || 'basic' };
      return 'placement';
    }
    s.placement = null;
    return 'empty';
  }

  placementPlace() {
    const s = this.state;
    if (!s.placement) return false;
    const type = s.placement.towerType;
    const t = towers.placeTower(s, s.placement.gx, s.placement.gy, type);
    if (t) { s.lastTowerType = type; s.selected = { kind: 'tower', id: t.id }; s.placement = null; return true; }
    return false;
  }
  placementCycle() {
    const s = this.state;
    if (!s.placement) return;
    const ids = Object.keys(s.config.towers);
    const i = ids.indexOf(s.placement.towerType);
    s.placement.towerType = ids[(i + 1) % ids.length];
    s.bus.emit(EV.BUTTON_CLICK, {});
  }
  placementClose() { this.state.placement = null; }

  upgradeSelected() {
    const t = this.selectedTower();
    if (!t) return false;
    return towers.upgradeTower(this.state, t.gx, t.gy);
  }
  sellSelected() {
    const t = this.selectedTower();
    if (!t) return false;
    return towers.sellTower(this.state, t.gx, t.gy);
  }
}

export default Simulation;
