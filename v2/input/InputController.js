/**
 * InputController — pointer + keyboard → game commands.
 *
 * Clicks fire on release (pointerup) for better touch feel. All UI hit-testing
 * goes through the renderer's hit-rect registry (no guessed geometry). The first
 * pointer interaction unlocks audio.
 */
export class InputController {
  constructor(canvas, sim, renderer, app, audio) {
    this.canvas = canvas; this.sim = sim; this.renderer = renderer; this.app = app; this.audio = audio;
    this._down = null;
    canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    canvas.addEventListener('pointerup', (e) => this._onUp(e));
    canvas.addEventListener('pointercancel', () => { this._down = null; });
    // V2.2 — track the pointer so the renderer can draw the aim crosshair at it while
    // the boss beam is armed (desktop hover; mobile shows per-enemy crosshairs instead).
    canvas.addEventListener('pointermove', (e) => { const p = this._canvasPos(e); this.renderer.pointer = p; });
    window.addEventListener('keydown', (e) => this._onKey(e));
  }

  _canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
    };
  }

  _onDown(e) { this._down = this._canvasPos(e); }

  _onUp(e) {
    const up = this._canvasPos(e);
    const down = this._down; this._down = null;
    // ignore drags
    if (down && (Math.abs(up.x - down.x) > 24 || Math.abs(up.y - down.y) > 24)) return;
    this.audio?.unlock();
    this._handleClick(up.x, up.y);
  }

  _handleClick(px, py) {
    const sim = this.sim, s = sim.state;

    // UI hit registry first (menus, overlays, HUD, popups).
    const hit = this.renderer.hitTest(px, py);
    if (hit) { this._dispatch(hit.action, hit.data); return; }

    // World interaction is legal while playing OR paused (paused is inspect-only:
    // taps select towers/enemies to read ranges/stats, but build commands are
    // blocked in the sim — see Simulation._canBuild).
    if (s.status !== 'playing' && s.status !== 'paused') return;

    // World: convert to grid and select/place. Coins are auto-collected now,
    // so there is no coin tap to handle.
    const L = this.renderer.L;
    const gx = (px - L.gridOffsetX) / L.tile;
    const gy = (py - L.gridOffsetY) / L.tile;
    if (gx < 0) return; // click was over the HUD gutter with no widget
    sim.gridClick(gx, gy);
  }

  _dispatch(action, data) {
    const sim = this.sim, app = this.app;
    switch (action) {
      case 'play': app.startGame(); break;
      case 'playAgain': app.restart(); break;
      case 'restart': if (this.renderer.confirmRestart()) app.restart(); break;   // W7 in-game restart (two-tap confirm)
      case 'sound': app.toggleSound(); break;
      case 'pause': sim.togglePause(); break;
      case 'tray': sim.selectTray(data); break;
      case 'upgrade': sim.upgradeSelected(); break;
      case 'fork': sim.forkSelected(data); break;   // P4 picture-only L3 identity fork (data = arm id)
      case 'sell': sim.sellSelected(); break;
      case 'place': sim.placementPlace(); break;
      case 'cycle': sim.placementCycle(); break;
      case 'closePopup': sim.placementClose(); break;
      case 'freeze': sim.castFreeze(); break;   // P3 no-aim field freeze
      case 'ultimate': {                        // V2.2 aimed boss BEAM
        // If an enemy is already selected, the button fires straight at it (no extra
        // tap). Otherwise it arms the crosshair — the next enemy tap fires (no blind cast).
        const sel = sim.selectedEnemy();
        if (sel && sel.alive && !sel.reachedGoal && sim.ultimateReady()) sim.castUltimate(sel);
        else sim.armUltimate();
        break;
      }
      case 'continueSummit': sim.continueToSummit(); break;   // P5 opt-in dare into the secret wave 16
    }
  }

  _onKey(e) {
    const sim = this.sim;
    if (e.key === 'Escape') { if (sim.state.status === 'playing' || sim.state.status === 'paused') sim.togglePause(); }
    else if (e.key === 'm' || e.key === 'M') this.app.toggleSound();
    else if (e.key === 'f' || e.key === 'F') sim.castFreeze();   // P3 no-aim field freeze
    else if (e.key === 'u' || e.key === 'U') sim.armUltimate();  // V2.2 arm the boss-beam crosshair
  }
}

export default InputController;
