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

    if (s.status !== 'playing') return; // only world interaction while playing

    // World: convert to grid and select/place. Coins are auto-collected now,
    // so there is no coin tap to handle.
    const L = this.renderer.L;
    const gx = (px - L.gridOffsetX) / L.tile;
    const gy = (py - L.gridOffsetY) / L.tile;
    if (gx < 0) return; // click was over the HUD gutter with no widget
    sim.gridClick(gx, gy);
  }

  _dispatch(action) {
    const sim = this.sim, app = this.app;
    switch (action) {
      case 'play': app.startGame(); break;
      case 'playAgain': app.restart(); break;
      case 'sound': app.toggleSound(); break;
      case 'pause': sim.togglePause(); break;
      case 'upgrade': sim.upgradeSelected(); break;
      case 'sell': sim.sellSelected(); break;
      case 'place': sim.placementPlace(); break;
      case 'cycle': sim.placementCycle(); break;
      case 'closePopup': sim.placementClose(); break;
    }
  }

  _onKey(e) {
    const sim = this.sim;
    if (e.key === 'Escape') { if (sim.state.status === 'playing' || sim.state.status === 'paused') sim.togglePause(); }
    else if (e.key === 'm' || e.key === 'M') this.app.toggleSound();
  }
}

export default InputController;
