import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';

// A short straight map for fast, deterministic timing tests (real maps have
// ~100-tile paths that take ~95s to traverse — too slow for unit timing).
const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};

// Deep-clone CONFIG and apply shallow section overrides for fast scenarios.
function makeConfig(overrides = {}) {
  const c = structuredClone(CONFIG);
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'maps') { c.maps = v; continue; }
    c[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...c[k], ...v } : v;
  }
  return c;
}
function advance(sim, ms) {
  const dt = sim.config.timestepMs;
  for (let t = 0; t < ms; t += dt) sim.tick(dt);
}
function pathSet(sim) { return new Set(sim.state.map.path.map(p => `${p.x},${p.y}`)); }

// ----------------------------------------------------------------------------
test('Phase 3 gate: a trivial scripted wave runs end-to-end to a WIN', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 500, prepMs: 500, betweenWaveMs: 200,
      patterns: [{ enemies: [{ type: 'basic', count: 2, formation: 'single' }] }] },
    lives: { max: 10 },
  });
  const sim = new Simulation(cfg, { seed: 7, mapIndex: 0 });
  sim.startGame();
  advance(sim, 60000); // plenty of time for 2 enemies to walk the whole path
  assert.equal(sim.state.status, 'won', 'final wave cleared with lives remaining -> won');
  assert.equal(sim.state.stats.wavesCleared, 1);
  assert.ok(sim.state.lives < 10, 'enemies reached goal, so some lives were lost');
});

test('lose when lives hit zero', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 300, prepMs: 300, betweenWaveMs: 200,
      patterns: [{ enemies: [{ type: 'basic', count: 3, formation: 'single' }] }] },
    lives: { max: 1 },
  });
  const sim = new Simulation(cfg, { seed: 1, mapIndex: 0 });
  sim.startGame();
  advance(sim, 60000);
  assert.equal(sim.state.status, 'lost');
  assert.equal(sim.state.lives, 0);
});

test('towers kill enemies and credit coins directly to the wallet (no board coins)', () => {
  const cfg = makeConfig({
    waves: { ...CONFIG.waves, firstPrepMs: 300, prepMs: 300, betweenWaveMs: 200,
      patterns: [{ enemies: [{ type: 'basic', count: 4, formation: 'single' }] }] },
    economy: { ...CONFIG.economy, startingCoins: 1000 },
  });
  const sim = new Simulation(cfg, { seed: 3, mapIndex: 0 });
  sim.startGame();
  // Place towers on buildable tiles adjacent to the path.
  const { path, buildable } = sim.state.map;
  let placed = 0;
  for (const p of path) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = p.x + dx, y = p.y + dy;
      if (buildable[y]?.[x] && sim.canPlace(x, y)) {
        if (placeViaPopup(sim, x, y, 'basic')) placed++;
      }
      if (placed >= 6) break;
    }
    if (placed >= 6) break;
  }
  assert.ok(placed >= 3, `placed enough towers (${placed})`);
  const coinsBefore = sim.state.coins;
  advance(sim, 40000);
  assert.ok(sim.state.stats.enemiesKilled > 0, 'at least one enemy killed by towers');
  assert.equal(sim.state.coinsList.length, 0, 'no loose coins on the board');
  assert.ok(sim.state.coins > coinsBefore, 'kill rewards were credited directly to the wallet');
});

function placeViaPopup(sim, x, y, type) {
  sim.gridClick(x + 0.5, y + 0.5);
  if (sim.state.placement) {
    sim.state.placement.towerType = type;
    return sim.placementPlace();
  }
  return false;
}

// ----------------------------------------------------------------------------
// RELIABILITY REGRESSION GATE #2 — open-tile pathfinding.
test('regression: enemy floor position is ALWAYS on a path tile (no open-tile wandering)', () => {
  for (const mapIndex of [0, 1]) {
    const cfg = makeConfig({
      waves: { ...CONFIG.waves, firstPrepMs: 0, prepMs: 0, betweenWaveMs: 999999,
        patterns: [{ enemies: [{ type: 'fast', count: 1, formation: 'single' }] }] },
    });
    const sim = new Simulation(cfg, { seed: 5, mapIndex });
    sim.startGame();
    const set = pathSet(sim);
    let steps = 0, sawEnemy = false;
    const dt = sim.config.timestepMs;
    while (steps < 60000 / dt) {
      sim.tick(dt);
      for (const e of sim.state.enemies) {
        if (!e.alive) continue;
        sawEnemy = true;
        const key = `${Math.floor(e.x)},${Math.floor(e.y)}`;
        assert.ok(set.has(key), `map ${mapIndex}: enemy at floor ${key} must be on the path`);
      }
      if (sawEnemy && sim.state.enemies.length === 0) break; // reached goal & removed
      steps++;
    }
    assert.ok(sawEnemy, `map ${mapIndex}: enemy existed`);
  }
});

// ----------------------------------------------------------------------------
// RELIABILITY REGRESSION GATE #1 — boss-wave instant-loss on repeat plays.
test('regression: boss waves do NOT deduct lives for a boss still on the path, across 5 replays', () => {
  const cfg = makeConfig({
    maps: [SHORT_MAP],
    waves: { ...CONFIG.waves, firstPrepMs: 200, prepMs: 200, betweenWaveMs: 999999,
      patterns: [{ boss: 'boss_shield', enemies: [{ type: 'boss_shield', count: 1, formation: 'single' }] }] },
    lives: { max: 25 },
    // make the boss slow enough that it stays on the path during our window
    enemies: { ...CONFIG.enemies, boss_shield: { ...CONFIG.enemies.boss_shield, speed: 0.05 } },
  });
  let sim = new Simulation(cfg, { seed: 11, mapIndex: 0 });
  sim.startGame();

  for (let game = 0; game < 5; game++) {
    // Reach the boss wave's spawn and let the boss walk a little (NOT to the goal).
    advance(sim, 2000);
    const boss = sim.state.enemies.find(e => e.isBoss);
    assert.ok(boss, `game ${game}: a boss spawned`);
    assert.ok(!boss.reachedGoal, `game ${game}: boss is still on the path`);
    assert.equal(sim.state.lives, 25, `game ${game}: NO lives deducted while the boss is on the path`);
    assert.equal(sim.state.status, 'playing', `game ${game}: game still playing (no instant loss)`);

    // Now let the boss reach the goal -> exactly its livesCost (3) deducted, once.
    sim.config.enemies.boss_shield.speed = 5; // speed it to the end
    // bump the existing boss too
    boss.baseSpeed = 5;
    advance(sim, 20000);
    assert.equal(sim.state.lives, 22, `game ${game}: exactly livesCost (3) deducted when boss reaches goal`);

    // Restart — fresh state, must NOT carry the prior boss-goal over.
    sim.config.enemies.boss_shield.speed = 0.05;
    sim.restart({ seed: 11, mapIndex: 0 });
  }
});

test('sell refunds 70% of investment and removes the tower; upgrade respects coins', () => {
  const cfg = makeConfig({ economy: { ...CONFIG.economy, startingCoins: 5 } });
  const sim = new Simulation(cfg, { seed: 2, mapIndex: 0 });
  sim.startGame();
  // find a buildable tile
  let cell = null;
  outer: for (let y = 0; y < sim.state.map.rows; y++)
    for (let x = 0; x < sim.state.map.cols; x++)
      if (sim.canPlace(x, y)) { cell = { x, y }; break outer; }
  assert.ok(cell);
  // place basic (cost 5) -> coins 0
  assert.ok(placeViaPopup(sim, cell.x, cell.y, 'basic'));
  assert.equal(sim.state.coins, 0);
  // cannot upgrade with 0 coins
  sim.state.selected = { kind: 'tower', id: sim.towerAt(cell.x, cell.y).id };
  assert.equal(sim.upgradeSelected(), false, 'no upgrade without coins');
  // sell -> refund floor(5 * 0.7) = 3, tower gone
  const refund = sim.sellSelected();
  assert.equal(refund, 3);
  assert.equal(sim.towerAt(cell.x, cell.y), null, 'tower removed after sell');
  assert.equal(sim.state.coins, 3);
});
