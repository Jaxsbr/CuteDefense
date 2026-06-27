/**
 * GameApp — browser glue. Owns the canvas, RAF loop, viewport fit, and wires the
 * sim + renderer + input + audio together. Also installs the V2 benchmark harness
 * (window.__bench) using the SAME steady-fixture protocol as V1's harness so the
 * comparison is apples-to-apples.
 */
import { CONFIG } from '../config/gameConfig.js';
import { Simulation } from '../sim/Simulation.js';
import { Renderer } from '../render/Renderer.js';
import { InputController } from '../input/InputController.js';
import { AudioBridge } from '../audio/AudioBridge.js';
import { cellCenter } from '../sim/state.js';
import { spawnEnemy } from '../sim/systems/enemySystem.js';
import { spawnCoin } from '../sim/systems/economySystem.js';
import { placeTower, upgradeTower } from '../sim/systems/towerSystem.js';

export class GameApp {
  constructor(canvas, { bench = false } = {}) {
    this.cfg = CONFIG;
    this.canvas = canvas;
    this.canvas.width = CONFIG.layout.canvasW;
    this.canvas.height = CONFIG.layout.canvasH;
    this.ctx = canvas.getContext('2d');

    const seed = (Math.floor(Math.random() * 0xffffffff)) >>> 0; // app-level seed (sim stays deterministic per seed)
    this.sim = new Simulation(CONFIG, { seed });
    this.renderer = new Renderer(this.ctx, CONFIG);
    this.audio = new AudioBridge(this.sim.bus, { muted: bench });
    this.input = new InputController(canvas, this.sim, this.renderer, this, this.audio);

    this._last = 0;
    this._raf = null;

    this._fit();
    window.addEventListener('resize', () => this._fit());
    window.addEventListener('orientationchange', () => this._fit());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this._fit());
      window.visualViewport.addEventListener('scroll', () => this._fit());
    }
    this._setupFullscreenButton();
  }

  startGame() { this.sim.startGame(); }
  restart() { this.sim.restart({ seed: (Math.floor(Math.random() * 0xffffffff)) >>> 0 }); }
  toggleSound() {
    const s = this.sim.state;
    s.soundEnabled = !s.soundEnabled;
    this.audio.setMuted(!s.soundEnabled);
  }

  start() {
    if (this._raf != null) return;
    const loop = (now) => {
      const dt = this._last ? now - this._last : 16.67;
      this._last = now;
      this.sim.step(Math.min(dt, 100));
      this.renderer.render(this.sim.state);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() { if (this._raf != null) { cancelAnimationFrame(this._raf); this._raf = null; } }

  // ---- viewport fit (mirrors V1: fixed backing store, CSS display scaled by visualViewport) ----
  _fit() {
    const L = this.cfg.layout;
    const aspect = L.canvasW / L.canvasH;
    const vv = window.visualViewport;
    const vw = vv && vv.width > 0 ? vv.width : window.innerWidth;
    const vh = vv && vv.height > 0 ? vv.height : window.innerHeight;
    let w = vw, h = w / aspect;
    if (h > vh) { h = vh; w = h * aspect; }
    document.documentElement.style.height = vh + 'px';
    document.body.style.width = vw + 'px';
    document.body.style.height = vh + 'px';
    this.canvas.style.width = Math.max(1, Math.floor(w)) + 'px';
    this.canvas.style.height = Math.max(1, Math.floor(h)) + 'px';
  }

  _setupFullscreenButton() {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;
    const sync = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      btn.style.display = isFs ? 'none' : 'block';
      this._fit();
    };
    btn.addEventListener('click', () => {
      const el = document.documentElement;
      const isFs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFs) (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      else (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    });
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
  }

  // ---- benchmark harness (window.__bench) ----
  installBench() {
    const app = this;
    async function run(frames = 300, warmup = 60) {
      app.stop();                 // bench fully controls stepping
      buildFixture(app);
      const dt = app.cfg.timestepMs;
      const step = () => {
        app.sim.tick(dt);
        app.renderer.render(app.sim.state);
        app.ctx.getImageData(0, 0, 1, 1); // force rasterization (headless defers it)
      };
      for (let i = 0; i < warmup; i++) step();
      const times = [];
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        step();
        times.push(performance.now() - t0);
      }
      const sorted = times.slice().sort((a, b) => a - b);
      const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
      const sum = times.reduce((a, b) => a + b, 0);
      const s = app.sim.state;
      return {
        version: 'v2', fixture: app.cfg.bench.fixture, frames,
        p50: pct(50), p95: pct(95), p99: pct(99), mean: sum / times.length,
        min: sorted[0], max: sorted[sorted.length - 1],
        counts: { enemies: s.enemies.length, towers: s.towers.length, coins: s.coinsList.length },
      };
    }
    window.__bench = { run, buildFixture: () => buildFixture(app) };
  }
}

// Build the locked steady-state fixture (40 enemies frozen on the path, 12 towers
// firing, 30 coins) — mirrors V1's BenchHarness so the comparison is fair.
function buildFixture(app) {
  const s = app.sim.state, cfg = app.cfg;
  const fx = cfg.bench.fixture;
  s.status = 'playing';
  s.wave.phase = 'idle';       // no spawning/win logic during the measured window
  s.soundEnabled = false; app.audio.setMuted(true);
  s.coins = 1e9;

  const path = s.map.path;
  const types = ['basic', 'fast', 'strong'];
  s.enemies = [];
  for (let i = 0; i < fx.enemies; i++) {
    const t = (i + 1) / (fx.enemies + 1);
    const idx = Math.max(0, Math.min(path.length - 2, Math.floor(t * (path.length - 1))));
    const e = spawnEnemy(s, { typeId: types[i % types.length], hp: 1e9, speed: 0, reward: 3 });
    e.maxHp = 1e9; e.pathIndex = idx; e.progress = 0; e.spawnClock = 9999;
    const c = cellCenter(path[idx]); e.x = c.x; e.y = c.y;
  }

  s.towers = [];
  const onPath = (x, y) => path.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) <= 2);
  const cells = [];
  for (let y = 0; y < s.map.rows; y++) for (let x = 0; x < s.map.cols; x++) if (s.map.buildable[y][x]) cells.push({ x, y });
  cells.sort((a, b) => (onPath(b.x, b.y) ? 1 : 0) - (onPath(a.x, a.y) ? 1 : 0));
  let placed = 0;
  for (const cell of cells) {
    if (placed >= fx.towers) break;
    const type = placed % 2 === 0 ? 'basic' : 'strong';
    const tower = placeTower(s, cell.x, cell.y, type);
    if (tower) { for (let u = 0; u < placed % 3; u++) upgradeTower(s, cell.x, cell.y); placed++; }
  }

  s.coinsList = [];
  for (let i = 0; i < fx.coins; i++) {
    const gx = (i % s.map.cols) + 0.5;
    const gy = (Math.floor(i / s.map.cols) % s.map.rows) + 0.5;
    spawnCoin(s, gx, gy, (i % 5) + 1);
  }
  s.coins = cfg.economy.startingCoins;
}

export default GameApp;
