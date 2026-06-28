/**
 * Balance simulation harness — drives a headless V2 Simulation with a
 * "player-policy bot" and plays a full game, returning a result summary.
 *
 * This is the engine behind the difficulty-ladder acceptance tests. It does NOT
 * touch sim logic; it only drives the public command API
 * (gridClick / placementCycle / placementPlace / upgradeSelected / sellSelected)
 * exactly as the input layer would, and reads public state for decisions.
 *
 * A "policy" is an object exposing `onDecision(bot)`, called on a fixed sim-time
 * cadence. The Bot wrapper gives the policy faithful, command-API-only actions
 * plus precomputed path-coverage helpers so policies can reason about
 * chokepoints without re-implementing geometry.
 */
import { Simulation } from '../../v2/sim/Simulation.js';

// ---- geometry / coverage --------------------------------------------------

function tileCenter(gx, gy) { return { x: gx + 0.5, y: gy + 0.5 }; }

// Path cells (their integer coords) within Euclidean range R of a tile center.
function pathCellsInRange(map, gx, gy, R) {
  const c = tileCenter(gx, gy);
  const R2 = R * R;
  const hits = [];
  for (let i = 0; i < map.path.length; i++) {
    const p = map.path[i];
    const dx = (p.x + 0.5) - c.x, dy = (p.y + 0.5) - c.y;
    if (dx * dx + dy * dy <= R2) hits.push(i);
  }
  return hits;
}

// All buildable, in-bounds tiles for a map.
function buildableTiles(map) {
  const out = [];
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++)
      if (map.buildable[y]?.[x]) out.push({ gx: x, gy: y });
  return out;
}

// ---- Bot: a faithful, command-API-only player wrapper ---------------------

export class Bot {
  constructor(sim) {
    this.sim = sim;
    this.map = sim.state.map;
    this.tiles = buildableTiles(this.map);
    // Cache coverage per (tile, range) lazily; ranges are small integers.
    this._covCache = new Map();
    // Track tiles this bot has tried and failed to use (e.g. zero coverage) so
    // it doesn't loop. Keyed "gx,gy".
    this.tried = new Set();
  }

  get s() { return this.sim.state; }
  get coins() { return this.sim.state.coins; }
  get lives() { return this.sim.state.lives; }
  get towers() { return this.sim.state.towers; }
  get waveIndex() { return this.sim.state.wave.index; }
  get phase() { return this.sim.state.wave.phase; }

  towerCost(type, level = 1) { return this.sim.config.towers[type].levels[level - 1].cost; }
  towerRange(type, level) { return this.sim.config.towers[type].levels[level - 1].range; }

  coverage(gx, gy, R) {
    const key = `${gx},${gy},${R}`;
    let v = this._covCache.get(key);
    if (!v) { v = pathCellsInRange(this.map, gx, gy, R); this._covCache.set(key, v); }
    return v;
  }

  // Set of path-cell indices already covered by existing towers (at their
  // current level's range). Used for marginal-coverage placement.
  coveredPathSet() {
    const covered = new Set();
    for (const t of this.towers) {
      const R = this.towerRange(t.typeId, t.level);
      for (const i of this.coverage(t.gx, t.gy, R)) covered.add(i);
    }
    return covered;
  }

  // Rank empty buildable tiles by MARGINAL new path coverage for a tower of
  // `type` placed at L1. Returns [{gx,gy,gain,total}] sorted desc by gain.
  rankPlacements(type, { minGain = 1 } = {}) {
    const R = this.towerRange(type, 1);
    const covered = this.coveredPathSet();
    const out = [];
    for (const { gx, gy } of this.tiles) {
      if (this.sim.towerAt(gx, gy)) continue;
      const cells = this.coverage(gx, gy, R);
      if (cells.length === 0) continue;
      let gain = 0;
      for (const i of cells) if (!covered.has(i)) gain++;
      if (gain < minGain) continue;
      out.push({ gx, gy, gain, total: cells.length });
    }
    // Prefer high marginal gain, then high absolute coverage (good chokepoint).
    out.sort((a, b) => (b.gain - a.gain) || (b.total - a.total));
    return out;
  }

  // ---- faithful command-API actions ----
  place(gx, gy, type) {
    const sim = this.sim;
    sim.gridClick(gx + 0.5, gy + 0.5);
    if (!sim.state.placement || sim.state.placement.gx !== gx || sim.state.placement.gy !== gy) {
      sim.placementClose();
      return false;
    }
    let guard = 0;
    while (sim.state.placement.towerType !== type && guard++ < 8) sim.placementCycle();
    if (sim.state.placement.towerType !== type) { sim.placementClose(); return false; }
    return sim.placementPlace();
  }

  selectTower(t) { this.sim.gridClick(t.gx + 0.5, t.gy + 0.5); }

  upgrade(t) {
    this.selectTower(t);
    return this.sim.upgradeSelected();
  }

  sell(t) {
    this.selectTower(t);
    return this.sim.sellSelected();
  }
}

// ---- runner ---------------------------------------------------------------

/**
 * Drive an ALREADY-STARTED Simulation with a policy until it terminates (win/lose)
 * or the time budget runs out. Used both by runGame (fresh instance) and by the
 * repeated-replay reset test (which drives the same instance across restart()).
 * @returns {object} result summary including a per-wave lives trace.
 */
export function drive(sim, makePolicy, { decisionIntervalMs = 500, maxMs = 30 * 60 * 1000 } = {}) {
  const bot = new Bot(sim);
  const policy = makePolicy(bot);
  const dt = sim.config.timestepMs;
  let acc = 0;
  const perWaveLives = {};   // wave index -> lives at that wave's completion

  let terminated = false;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    acc += dt;
    if (acc >= decisionIntervalMs) {
      acc = 0;
      if (sim.state.status === 'playing' && policy.onDecision) policy.onDecision(bot);
    }
    if (sim.state.wave.phase === 'complete') perWaveLives[sim.state.wave.index] = sim.state.lives;
    if (sim.state.status === 'won' || sim.state.status === 'lost') { terminated = true; break; }
  }

  return {
    terminated,
    status: sim.state.status,
    finalWave: sim.state.wave.index,
    wavesCleared: sim.state.stats.wavesCleared,
    lives: sim.state.lives,
    coins: sim.state.coins,
    towersBuilt: sim.state.stats.towersBuilt,
    towersStanding: sim.state.towers.length,
    enemiesKilled: sim.state.stats.enemiesKilled,
    perWaveLives,
    mapIndex: sim.state.mapIndex,
  };
}

/**
 * Play one full game on a FRESH Simulation instance.
 */
export function runGame(config, { seed = 1, mapIndex = 0, makePolicy, decisionIntervalMs = 500, maxMs = 30 * 60 * 1000 } = {}) {
  const sim = new Simulation(config, { seed, mapIndex });
  sim.startGame();
  const r = drive(sim, makePolicy, { decisionIntervalMs, maxMs });
  r.seed = seed;
  return r;
}

export { pathCellsInRange, buildableTiles, Simulation };
