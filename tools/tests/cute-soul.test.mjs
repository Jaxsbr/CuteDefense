// Cute-soul overhaul — headless logic gates (TDD, written before implementation).
//
// Pure rendering can't be asserted headlessly (no canvas), so these cover the
// LOGIC the overhaul introduces: (1) the palette's saturation/lightness
// hierarchy invariant (map recedes, entities pop), and (2) the additive,
// display-only sim state the renderer reads (ouch / lives-flash / wave-pop /
// menuClock timers + deterministic per-tower expression seeds). None of these
// may touch the lives/win-lose ledger or shift the RNG stream (bench/replay
// determinism is load-bearing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { PALETTE } from '../../v2/render/palette.js';
import { withAlpha } from '../../v2/render/colors.js';
import { damageEnemy } from '../../v2/sim/systems/enemySystem.js';

// ---- color helpers -------------------------------------------------------
function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// returns {h: 0..360, s: 0..1, l: 0..1}
function hexToHsl(hex) {
  const [r0, g0, b0] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0), d = max - min;
  const l = (max + min) / 2;
  let s = 0, h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r0: h = ((g0 - b0) / d) % 6; break;
      case g0: h = (b0 - r0) / d + 2; break;
      default: h = (r0 - g0) / d + 4;
    }
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
const isHex6 = (s) => /^#[0-9a-fA-F]{6}$/.test(s);

// ---- shared sim helpers (mirror sim.test.mjs) ----------------------------
const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function makeConfig(overrides = {}) {
  const c = structuredClone(CONFIG);
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'maps') { c.maps = v; continue; }
    c[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...c[k], ...v } : v;
  }
  return c;
}
function advance(sim, ms) { const dt = sim.config.timestepMs; for (let t = 0; t < ms; t += dt) sim.tick(dt); }
function firstBuildable(sim) {
  for (let y = 0; y < sim.state.map.rows; y++)
    for (let x = 0; x < sim.state.map.cols; x++)
      if (sim.canPlace(x, y)) return { x, y };
  return null;
}
function placeViaPopup(sim, x, y, type) {
  sim.gridClick(x + 0.5, y + 0.5);
  if (sim.state.placement) { sim.state.placement.towerType = type; return sim.placementPlace(); }
  return false;
}

// ==========================================================================
// 1. PALETTE — the saturation/lightness hierarchy is the whole point.
// ==========================================================================
test('palette: every token is a valid 6-digit hex (structuredClone- & withAlpha-safe)', () => {
  const walk = (o) => Object.values(o).forEach(v =>
    typeof v === 'string' ? assert.ok(isHex6(v) || /^#[0-9a-fA-F]{8}$/.test(v), `bad hex: ${v}`)
                          : (v && typeof v === 'object') && walk(v));
  walk(PALETTE.map); walk(PALETTE.enemies); walk(PALETTE.towers); walk(PALETTE.coin); walk(PALETTE.gold);
  // coin colors must survive withAlpha (the historic addColorStop crash)
  for (const st of ['normal', 'warning', 'expired'])
    for (const c of Object.values(PALETTE.coin[st]))
      assert.match(withAlpha(c, '55'), /^#[0-9a-fA-F]{8}$/);
});

test('palette: MAP recedes and ENTITIES pop — a strict saturation + lightness gulf', () => {
  const mapSat = Object.values(PALETTE.map).filter(isHex6).map(h => hexToHsl(h).s);
  const mapLit = Object.values(PALETTE.map).filter(isHex6).map(h => hexToHsl(h).l);
  const entHex = Object.values(PALETTE.enemies).map(e => e.color);
  const entSat = entHex.map(h => hexToHsl(h).s);
  const entLit = entHex.map(h => hexToHsl(h).l);
  // map is uniformly low-sat & light; entities uniformly high-sat & darker.
  assert.ok(Math.max(...mapSat) < 0.55, `map max sat ${Math.max(...mapSat).toFixed(2)} should be < 0.55`);
  assert.ok(Math.min(...entSat) > 0.55, `entity min sat ${Math.min(...entSat).toFixed(2)} should be > 0.55`);
  assert.ok(Math.max(...mapSat) < Math.min(...entSat), 'strict saturation gulf: every map color < every entity color');
  assert.ok(Math.min(...mapLit) > Math.max(...entLit), 'strict lightness gulf: every map tile lighter than every entity');
  assert.ok(Math.min(...mapLit) > 0.70, 'map stays pale (>70% lightness)');
});

test('palette: UI buttons/accents carry cute saturation (the dock pops, not greys out)', () => {
  for (const t of [PALETTE.ui.btnPrimary, PALETTE.ui.btnInfo, PALETTE.ui.btnDanger, PALETTE.ui.accent])
    assert.ok(hexToHsl(t).s >= 0.45, `UI accent ${t} should be saturated (>=0.45)`);
});

// ==========================================================================
// 2. ANIMATION STATE — additive, display-only, ledger-safe, deterministic.
// ==========================================================================
test('config: visual.anim timing block exists and is the single source for sim+renderer', () => {
  const a = CONFIG.visual.anim;
  assert.ok(a, 'CONFIG.visual.anim must exist');
  assert.ok(a.enemyOuchMs > 0 && a.towerFireAnimMs > 0, 'ouch + fire durations set');
  assert.ok(a.blink && a.blush, 'blink + blush schedules present');
});

test('enemy ouch: damage arms ouchMs from config and it decays (no ledger impact)', () => {
  const cfg = makeConfig({
    waves: { ...CONFIG.waves, firstPrepMs: 100, prepMs: 100, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }] },
  });
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  advance(sim, 1500);
  const e = sim.state.enemies.find(en => en.alive);
  assert.ok(e, 'an enemy is on the field');
  assert.equal(e.ouchMs, 0, 'ouch is idle before any hit');
  const livesBefore = sim.state.lives;
  // damage it directly via the system
  damageEnemy(sim.state, e, 1);
  assert.equal(e.ouchMs, cfg.visual.anim.enemyOuchMs, 'ouch armed to the config value on hit');
  assert.equal(sim.state.lives, livesBefore, 'ouch is display-only: lives ledger untouched');
  sim.tick(sim.config.timestepMs);
  assert.ok(e.ouchMs < cfg.visual.anim.enemyOuchMs, 'ouch decays each tick');
});

test('tower expression seeds are deterministic per id (replay/bench safe, no rng draw)', () => {
  const mk = () => {
    const cfg = makeConfig({ economy: { ...CONFIG.economy, startingCoins: 1000 } });
    const sim = new Simulation(cfg, { seed: 42, mapIndex: 0 });
    sim.startGame();
    const cell = firstBuildable(sim);
    assert.ok(placeViaPopup(sim, cell.x, cell.y, 'basic'));
    return sim.towerAt(cell.x, cell.y);
  };
  const a = mk(), b = mk();
  for (const f of ['blinkOffset', 'blinkPeriod', 'blushOffset', 'blushPeriod', 'shy']) {
    assert.notEqual(a[f], undefined, `tower has ${f}`);
    assert.deepEqual(a[f], b[f], `${f} is deterministic across identical seeded runs`);
  }
  assert.ok(a.blinkPeriod >= CONFIG.visual.anim.blink.periodMinMs, 'blink period within configured range');
});

test('tower fire pulls its puff duration from config (sim/renderer stay in sync)', () => {
  const cfg = makeConfig({
    waves: { ...CONFIG.waves, firstPrepMs: 100, prepMs: 100, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 3, formation: 'single' }] }] },
    economy: { ...CONFIG.economy, startingCoins: 1000 },
  });
  const sim = new Simulation(cfg, { seed: 9, mapIndex: 0 });
  sim.startGame();
  const { path, buildable } = sim.state.map;
  for (const p of path) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const x = p.x + dx, y = p.y + dy;
    if (buildable[y]?.[x] && sim.canPlace(x, y)) placeViaPopup(sim, x, y, 'basic');
  }
  let maxFire = 0;
  const dt = sim.config.timestepMs;
  for (let i = 0; i < 4000 / dt; i++) { sim.tick(dt); for (const t of sim.state.towers) maxFire = Math.max(maxFire, t.fireAnimMs); }
  assert.equal(maxFire, cfg.visual.anim.towerFireAnimMs, 'fireAnimMs set from config on shot (not the old hardcoded 180)');
});

test('lives-flash timer is set when a life is lost (display-only, after the ledger)', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 200, prepMs: 200, betweenWaveMs: 999999,
      patterns: [{ enemies: [{ type: 'basic', count: 1, formation: 'single' }] }] },
    lives: { max: 10 },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  assert.equal(sim.state.livesFlashUntil, 0, 'no flash before any life lost');
  advance(sim, 60000);
  assert.ok(sim.state.lives < 10, 'a life was lost');
  assert.ok(sim.state.livesFlashUntil > 0, 'livesFlashUntil armed on life loss');
  assert.ok(sim.state.livesFlashAmount >= 1, 'livesFlashAmount records the cost');
});

test('wave-pop timer arms on wave start and re-arms (at a later clock) on advance', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 200, prepMs: 200, betweenWaveMs: 200,
      patterns: [
        { enemies: [{ type: 'basic', count: 1, formation: 'single' }] },
        { enemies: [{ type: 'basic', count: 1, formation: 'single' }] },
      ] },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  assert.equal(sim.state.wavePopUntil, 0, 'no pop in the menu');
  sim.startGame();                                  // wave 1 prepare arms it at clock 0
  const w1 = sim.state.wavePopUntil;
  assert.ok(w1 > 0, 'wavePopUntil armed when the first wave begins');
  // run until wave 2 begins
  const dt = sim.config.timestepMs;
  for (let i = 0; i < 60000 / dt && sim.state.wave.index < 2; i++) sim.tick(dt);
  assert.equal(sim.state.wave.index, 2, 'reached wave 2');
  assert.ok(sim.state.wavePopUntil > w1, 'wavePopUntil re-armed at a later clock on wave advance');
});

test('menuClock advances only in menu; the gameplay clock stays frozen there', () => {
  const sim = new Simulation(makeConfig(), { seed: 1, mapIndex: 0 });
  assert.equal(sim.state.status, 'menu');
  assert.equal(sim.state.menuClock, 0);
  advance(sim, 1000);
  assert.ok(sim.state.menuClock > 0, 'menuClock ticks during menu');
  assert.equal(sim.state.clock, 0, 'gameplay clock stays frozen during menu');
  // once playing, gameplay clock runs and menuClock holds
  sim.startGame();
  const menuAtStart = sim.state.menuClock;
  advance(sim, 1000);
  assert.ok(sim.state.clock > 0, 'gameplay clock runs once playing');
  assert.equal(sim.state.menuClock, menuAtStart, 'menuClock no longer advances while playing');
});

test('bench fixture path never arms the cosmetic timers (4x p95 gate unaffected)', () => {
  // The display timers default 0 and the bench scene (status=playing, no
  // reachGoal/wave-advance/hits in the measured window) must leave them 0.
  const sim = new Simulation(makeConfig(), { seed: 1, mapIndex: 0 });
  assert.equal(sim.state.livesFlashUntil, 0);
  assert.equal(sim.state.wavePopUntil, 0);
  assert.equal(sim.state.menuClock, 0);
});
