/**
 * Simulation — the headless game. Owns state, steps on a fixed timestep, exposes
 * a small command API for the input layer, and decides win/lose centrally.
 *
 * Pure: no DOM, no canvas, no wall-clock. Drive it with step(realDtMs) from the
 * browser RAF loop, or tick(dt) directly from headless tests/bench.
 */
import { createInitialState } from './state.js';
import { EV } from './events.js';
import { computeStars } from './scoring.js';
import * as waves from './systems/waveSystem.js';
import * as enemies from './systems/enemySystem.js';
import * as towers from './systems/towerSystem.js';
import * as projectiles from './systems/projectileSystem.js';
import * as beams from './systems/beamSystem.js';
import * as economy from './systems/economySystem.js';
import { towerTypeIds } from './systems/towerSystem.js';

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
    // Fresh gameplay state from the factory — nothing leaks across plays EXCEPT
    // the event bus. The bus is the durable coupling point for external
    // subscribers (AudioBridge wires its ~20 bus.on(...) once at construction,
    // GameApp.js:28). Minting a new bus here would orphan them and silence ALL
    // audio on replay (W5). The bus holds no gameplay state, so carrying it
    // forward preserves the pristine-restart guarantee while keeping audio armed.
    const bus = this.state.bus;
    this._seed = seed;
    this.state = createInitialState(this.config, seed, mapIndex);
    this.state.bus = bus;
    this.state.lastTowerType = 'basic';
    this._acc = 0;
    this.startGame();
  }

  toMenu() {
    const bus = this.state.bus;                 // preserve bus across rebuild (see restart())
    this.state = createInitialState(this.config, this._seed, this.state.mapIndex);
    this.state.bus = bus;
    this.state.lastTowerType = 'basic';
    this._acc = 0;
  }

  // Pause: a plain frozen, INSPECT-ONLY sub-state. Toggles playing <-> paused
  // ONLY; never touches menu/won/lost. Frozen = zero ticks (perf-positive), board
  // fully visible, taps select/inspect — but NO building (place/upgrade/sell/fork
  // all illegal while paused; see _canBuild). No risk-free spending of coins.
  togglePause() {
    const s = this.state;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
  }

  // Spending coins (place/upgrade/sell/fork) is legal ONLY under the live clock.
  _canBuild() { return this.state.status === 'playing'; }

  // Tap-once build tray. Selects a valid tower type so subsequent grid taps place
  // it directly (no per-tile Cycle). Idempotent toggle: tapping the active tray
  // clears it. null clears. Additive — never mandatory (see gridClick invariant).
  selectTray(towerType) {
    const s = this.state;
    if (towerType == null) { s.trayType = null; return; }
    if (!towerTypeIds(s.config).includes(towerType)) return; // ignore invalid ids (incl. scalar tuning keys)
    s.trayType = (s.trayType === towerType) ? null : towerType;
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
    beams.update(s, dt);          // V2.2 — single-target boss-beam DoT (before economy: a kill credits this tick)
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
    } else if (!s.publicWinBanked && waves.isFinalWaveComplete(s)) {
      // P5 — the real, permanent public win at wave 15. Banked once and NEVER
      // un-banked, so a later summit (wave 16) loss can never revoke the victory.
      s.status = 'won';
      s.publicWinBanked = true;
      s.stars = computeStars({ lives: s.lives, coins: s.coins, elapsedMs: s.stats.elapsedMs }, s.config);
      s.bus.emit(EV.GAME_WON, { stats: s.stats, stars: s.stars });
      s.frameEvents.push({ type: EV.GAME_WON, stars: s.stars });
    } else if (s.summitMode && !s.summitWon && waves.isSummitComplete(s)) {
      // W11 — the TRUE ending: a CLEARED secret wave 16. Emits a SEPARATE terminal
      // (SUMMIT_WON, never GAME_WON — the public win already fired exactly once and
      // stays banked). status re-latches to 'won' so the run terminates as a victory.
      s.summitWon = true;
      s.status = 'won';
      s.bus.emit(EV.SUMMIT_WON, { stats: s.stats });
      s.frameEvents.push({ type: EV.SUMMIT_WON });
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
    // V2.2 — aim-confirm: while the beam crosshair is armed, a tap on an ENEMY fires
    // the beam at it; a tap on anything else just cancels the aim (no world action,
    // no accidental cast). The crosshair is cleared the instant a cast resolves.
    if (s.ultimateAiming) {
      const target = this.enemyAt(gx, gy);
      if (target) { this.castUltimate(target); s.ultimateAiming = false; return 'ultimate'; }
      this.cancelAiming();
      return 'empty';
    }
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
    // Building is illegal while paused — an empty buildable tap just deselects.
    if (this._canBuild() && this.canPlace(igx, igy)) {
      // Tray fast path: a tower type is pre-selected — place it directly, no popup.
      // Additive over the invariant path below.
      if (s.trayType) {
        const tw = towers.placeTower(s, igx, igy, s.trayType);
        if (tw) { s.lastTowerType = s.trayType; s.selected = { kind: 'tower', id: tw.id }; s.placement = null; return 'placed'; }
        return 'empty';                                       // unaffordable / blocked: build nothing
      }
      // INVARIANT path: open the placement popup exactly as today.
      s.placement = { gx: igx, gy: igy, towerType: s.lastTowerType || 'basic' };
      return 'placement';
    }
    s.placement = null;
    return 'empty';
  }

  placementPlace() {
    const s = this.state;
    if (!this._canBuild()) return false;                      // illegal while paused
    if (!s.placement) return false;
    const type = s.placement.towerType;
    const t = towers.placeTower(s, s.placement.gx, s.placement.gy, type);
    if (t) { s.lastTowerType = type; s.selected = { kind: 'tower', id: t.id }; s.placement = null; return true; }
    return false;
  }
  placementCycle() {
    const s = this.state;
    if (!this._canBuild()) return;                            // illegal while paused
    if (!s.placement) return;
    const ids = towerTypeIds(s.config);
    const i = ids.indexOf(s.placement.towerType);
    s.placement.towerType = ids[(i + 1) % ids.length];
    s.bus.emit(EV.BUTTON_CLICK, {});
  }
  placementClose() { this.state.placement = null; }

  upgradeSelected() {
    if (!this._canBuild()) return false;                      // illegal while paused
    const t = this.selectedTower();
    if (!t) return false;
    return towers.upgradeTower(this.state, t.gx, t.gy);
  }
  sellSelected() {
    if (!this._canBuild()) return false;                      // illegal while paused
    const t = this.selectedTower();
    if (!t) return false;
    return towers.sellTower(this.state, t.gx, t.gy);
  }

  // P4 — fork (or re-fork) the selected L3 tower into one of its type's arms. Like
  // upgrade/sell this spends coins, so it is illegal while paused (the renderer only
  // surfaces the picture choice while playing). First fork is free; switching arms costs reForkCost.
  forkSelected(arm) {
    if (!this._canBuild()) return false;                      // illegal while paused
    const t = this.selectedTower();
    if (!t) return false;
    return towers.forkTower(this.state, t.gx, t.gy, arm);
  }

  // P5 — opt-in SUMMIT: ONLY after the public win is banked, resume play into the
  // secret wave 16. Does NOT relatch status='won' (the win stays banked); declining
  // or losing the summit can never revoke the banked victory. Returns whether it engaged.
  continueToSummit() {
    const s = this.state;
    if (!s.config.waves.summit?.enabled) return false;
    if (!s.publicWinBanked || s.summitMode) return false;
    if (waves.publicWaveCount(s) >= waves.patternCount(s)) return false; // no secret wave to climb to
    s.summitMode = true;
    s.status = 'playing';                       // resume; status='won' is NOT relatched, win stays banked
    s.bus.emit(EV.SUMMIT_START, {});
    s.frameEvents.push({ type: EV.SUMMIT_START });
    return true;
  }

  // P3 — field FREEZE: no-aim, slows ALL alive enemies for freeze.durationMs on a
  // precious cooldown. Legal ONLY while playing (illegal during paused/
  // menu/won/lost — the P1 command-legality dependency). Deals no damage.
  castFreeze() {
    const s = this.state;
    if (s.status !== 'playing') return false;          // illegal while paused/menu/won/lost
    if (s.clock < s.freeze.readyAt) return false;      // on cooldown
    const f = this.config.freeze;
    s.freeze.activeUntil = s.clock + f.durationMs;
    s.freeze.readyAt = s.clock + f.cooldownMs;
    s.bus.emit(EV.FREEZE_CAST, { activeUntil: s.freeze.activeUntil, durationMs: f.durationMs });
    s.frameEvents.push({ type: EV.FREEZE_CAST, activeUntil: s.freeze.activeUntil });
    return true;
  }

  // W8 — boss towers whose UPGRADE has unlocked the ultimate AND are off their own
  // (per-tower) cooldown. Per-tower so multiple boss towers each carry a charge; the
  // button casts the most-ready one (the lowest ultReadyAt). Pure read.
  _readyUltimateTowers() {
    const s = this.state, cfg = this.config;
    return s.towers.filter(t => {
      const def = cfg.towers[t.typeId];
      return def?.kind === 'boss' && def.levels[t.level - 1]?.ultimate && s.clock >= (t.ultReadyAt || 0);
    });
  }

  // Mirrors freezeReady on the bot side: true only while playing with at least one
  // boss tower whose ultimate is unlocked and off cooldown.
  ultimateReady() {
    return this.state.status === 'playing' && this._readyUltimateTowers().length > 0;
  }

  // V2.2 — arm the aim crosshair for the boss BEAM. Mirrors freeze readiness: only
  // arms while playing with an eligible boss tower off cooldown. The actual cast
  // fires from gridClick (tap an enemy) or InputController (an enemy already selected).
  armUltimate() {
    if (!this.ultimateReady()) { this.state.ultimateAiming = false; return false; }
    this.state.ultimateAiming = true;
    return true;
  }
  cancelAiming() { this.state.ultimateAiming = false; }

  // V2.2 — the manual ULTIMATE ("Boss Beam"): an AIMED, SINGLE-TARGET, shield-piercing
  // DoT beam. REQUIRES a live enemy target (aim-confirm: no target -> no fire, no
  // cooldown spent, no event). On fire it arms the most-ready boss tower's cooldown and
  // pushes a beam onto state.beams (beamSystem applies the DoT over durationMs). The
  // total is < the on-field parent HP, so a single cast can never instant-kill it.
  // `target` may be an enemy object or an enemy id. Returns whether it fired.
  castUltimate(target) {
    const s = this.state, cfg = this.config;
    if (s.status !== 'playing') return false;          // illegal while paused/menu/won/lost
    const ready = this._readyUltimateTowers();
    if (ready.length === 0) return false;              // none unlocked / all on cooldown
    // resolve the target to a live, non-reached enemy (aim-confirm)
    const id = (target && typeof target === 'object') ? target.id : target;
    const enemy = enemies.aliveEnemies(s).find(e => e.id === id);
    if (!enemy) return false;                          // no valid target -> no cast
    ready.sort((a, b) => (a.ultReadyAt || 0) - (b.ultReadyAt || 0));
    const tower = ready[0];                            // cast the most-ready tower
    const ult = cfg.towers[tower.typeId].ultimate, beam = ult.beam;
    tower.ultReadyAt = s.clock + ult.cooldownMs;
    tower.ultActiveUntil = s.clock + beam.durationMs; // button reads "active" while the beam streams
    s.beams.push({
      id: s.nextId++, towerId: tower.id, targetId: enemy.id,
      x: tower.x, y: tower.y, tx: enemy.x, ty: enemy.y,
      age: 0, durationMs: beam.durationMs, tickMs: beam.tickMs, tickAcc: 0,
      totalDamage: beam.totalDamage, dealt: 0, piercesShield: !!ult.piercesShield,
      widthPx: beam.widthPx, color: beam.color,
    });
    s.ultimateAiming = false;
    s.bus.emit(EV.ULTIMATE_CAST, { towerId: tower.id, targetId: enemy.id });
    s.frameEvents.push({ type: EV.ULTIMATE_CAST, towerId: tower.id, targetId: enemy.id });
    return true;
  }
}

export default Simulation;
