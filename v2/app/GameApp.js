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
import { placeTower, upgradeTower, forkTower, canPlace } from '../sim/systems/towerSystem.js';

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
  toMenu() { this.sim.toMenu(); }   // W7 — symmetry with restart(); flows through the W5 bus-preserving path
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
  // P2: round-robin the locked fixture's flags across the 40 enemies (incl. the
  // single live-animated `evasive` shimmer) so p95 measures the real game cost —
  // flag-glyph blits + the one per-frame animated overlay.
  const fxFlags = fx.flags || [];
  s.enemies = [];
  for (let i = 0; i < fx.enemies; i++) {
    const t = (i + 1) / (fx.enemies + 1);
    const idx = Math.max(0, Math.min(path.length - 2, Math.floor(t * (path.length - 1))));
    const flags = fxFlags.length ? [fxFlags[i % fxFlags.length]] : [];
    const e = spawnEnemy(s, { typeId: types[i % types.length], hp: 1e9, speed: 0, reward: 3, flags });
    e.maxHp = 1e9; e.pathIndex = idx; e.progress = 0; e.spawnClock = 9999;
    const c = cellCenter(path[idx]); e.x = c.x; e.y = c.y;
  }

  // P3: extra disablers exercise the new per-tick disabler branch + nearest-tower
  // path. Their nap is held off (napCdAt = Infinity) so the locked render scene
  // stays stable/fair across the measured window (they never silence a tower).
  for (let i = 0; i < (fx.disablers || 0); i++) {
    const idx = Math.max(0, Math.min(path.length - 2, Math.floor((i + 1) / (fx.disablers + 1) * (path.length - 1))));
    const e = spawnEnemy(s, { typeId: 'disabler', hp: 1e9, speed: 0, reward: 4 });
    e.maxHp = 1e9; e.pathIndex = idx; e.progress = 0; e.spawnClock = 9999; e.bs.napCdAt = Infinity;
    const c = cellCenter(path[idx]); e.x = c.x; e.y = c.y;
  }
  // P3: scripted freeze — keep the shared slow field active so p95 measures the
  // effectiveSpeed() freeze multiply across the whole fixture every frame.
  s.freeze.activeUntil = Infinity;

  s.towers = [];
  // W8 — a BOSS tower in the locked fixture (built first so it claims a clean 2x2),
  // upgraded to L2 so the full-map O(enemies) targeting + the menacing 2x bake are
  // both measured every frame — keeps the V2 p95 < V1 gate honest with the new type.
  for (let i = 0, made = 0; i < s.map.rows - 1 && made < (fx.bossTowers || 0); i++) {
    for (let j = 0; j < s.map.cols - 1 && made < (fx.bossTowers || 0); j++) {
      if (!canPlace(s, j, i, 'boss')) continue;
      const bt = placeTower(s, j, i, 'boss');
      if (bt) { upgradeTower(s, j, i); made++; }   // L2 = ultimate unlocked
    }
  }
  const onPath = (x, y) => path.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) <= 2);
  const cells = [];
  for (let y = 0; y < s.map.rows; y++) for (let x = 0; x < s.map.cols; x++) if (s.map.buildable[y][x]) cells.push({ x, y });
  cells.sort((a, b) => (onPath(b.x, b.y) ? 1 : 0) - (onPath(a.x, a.y) ? 1 : 0));
  // P4: deterministically cycle the 4 fork arms across the fixture's L3 towers so
  // the LOCKED bench scene exercises every fork sprite AND the Froster per-enemy slow
  // path (effectiveSpeed's per-enemy term) every frame. Counts stay locked (40/12/30).
  const ARMS = { basic: ['sniper', 'gunner'], strong: ['bomber', 'froster'] };
  let placed = 0, forked = 0;
  for (const cell of cells) {
    if (placed >= fx.towers) break;
    const type = placed % 2 === 0 ? 'basic' : 'strong';
    const tower = placeTower(s, cell.x, cell.y, type);
    if (tower) {
      for (let u = 0; u < placed % 3; u++) upgradeTower(s, cell.x, cell.y);
      if (tower.level >= 3) { const arms = ARMS[type]; forkTower(s, cell.x, cell.y, arms[forked++ % arms.length]); }
      placed++;
    }
  }

  s.coinsList = [];
  for (let i = 0; i < fx.coins; i++) {
    const gx = (i % s.map.cols) + 0.5;
    const gy = (Math.floor(i / s.map.cols) % s.map.rows) + 0.5;
    spawnCoin(s, gx, gy, (i % 5) + 1);
  }

  // V2.2 — a scripted, PERSISTENT boss BEAM so the locked bench measures the new
  // beam-render + per-frame DoT-tick path every frame (durationMs/totalDamage are huge
  // so it neither expires nor kills its 1e9-HP target across the measured window).
  s.beams = [];
  const bossTower = s.towers.find(t => cfg.towers[t.typeId]?.kind === 'boss');
  if (bossTower && s.enemies[0]) {
    const beamCfg = cfg.towers.boss.ultimate.beam;
    const target = s.enemies[0];
    s.beams.push({
      id: s.nextId++, towerId: bossTower.id, targetId: target.id,
      x: bossTower.x, y: bossTower.y, tx: target.x, ty: target.y,
      age: 0, durationMs: 1e12, tickMs: beamCfg.tickMs, tickAcc: 0,
      totalDamage: 1e15, dealt: 0, piercesShield: true,
      widthPx: beamCfg.widthPx, color: beamCfg.color,
    });
  }
  // and arm the aim crosshair so the per-enemy crosshair render path is measured too.
  s.ultimateAiming = true;

  s.coins = cfg.economy.startingCoins;
}

export default GameApp;
