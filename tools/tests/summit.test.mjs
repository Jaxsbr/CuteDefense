/**
 * P5 — opt-in SUMMIT (the secret wave-16 dare).
 *
 * After the public win is banked, continueToSummit() resumes play into wave 16
 * WITHOUT relatching status='won' and WITHOUT ever revoking the banked victory.
 * Declining keeps the win; losing the summit keeps the win.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { EV } from '../../v2/sim/events.js';
import { Bot } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';

const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function fastConfig() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.waves.firstPrepMs = 200; c.waves.prepMs = 200; c.waves.betweenWaveMs = 100; c.waves.spawnIntervalMs = 250;
  c.economy.startingCoins = 100000;
  // Mechanics fixture (summit terminals), NOT a balance fixture: neutralize the W9
  // late-surge so the fixed heavy build clears the public game on the test line; the
  // summit-loss path (no boss tower -> no ultimate -> the wall stands) is unchanged.
  c.waves.scaling.lateSurge = { ...c.waves.scaling.lateSurge, hp: 1, count: 1, speed: 1 };
  return c;
}
function buildHeavy(sim) {
  for (const y of [5, 7]) {
    for (let x = 1; x <= 20; x++) {
      if (!sim.canPlace(x, y)) continue;
      const type = y === 5 ? 'strong' : 'basic';
      sim.state.placement = { gx: x, gy: y, towerType: type };
      if (sim.placementPlace()) {
        sim.state.selected = { kind: 'tower', id: sim.towerAt(x, y).id };
        sim.upgradeSelected(); sim.upgradeSelected();
      }
    }
  }
}
function winHeavy(sim, maxMs = 900000) {
  const dt = sim.config.timestepMs;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    if (sim.state.status === 'won' || sim.state.status === 'lost') return;
  }
}
function tickUntilTerminal(sim, maxMs = 2400000) {
  const dt = sim.config.timestepMs;
  for (let t = 0; t < maxMs; t += dt) {
    sim.tick(dt);
    if (sim.state.status === 'won' || sim.state.status === 'lost') return t;
  }
  return -1;
}

// ---------------------------------------------------------------------------
test('continueToSummit resumes into wave 16 without relatching won', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  buildHeavy(sim);
  winHeavy(sim);
  assert.equal(sim.state.status, 'won', 'public game won first');

  let wonCount = 0;
  sim.bus.on(EV.GAME_WON, () => wonCount++);

  assert.equal(sim.continueToSummit(), true, 'the dare is accepted');
  assert.equal(sim.state.status, 'playing', 'play resumes');
  assert.equal(sim.state.summitMode, true, 'summit mode engaged');
  assert.equal(sim.state.publicWinBanked, true, 'the win stays banked');

  let reached16 = false;
  const dt = sim.config.timestepMs;
  for (let t = 0; t < 2400000; t += dt) {
    sim.tick(dt);
    if (sim.state.wave.index === 16) reached16 = true;
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  assert.equal(reached16, true, 'the summit climbs into wave 16');
  assert.equal(wonCount, 0, 'GAME_WON does NOT fire a second time in summit mode');
});

// ---------------------------------------------------------------------------
test('losing the summit keeps the win banked', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  buildHeavy(sim);
  winHeavy(sim);
  assert.equal(sim.state.status, 'won');
  assert.equal(sim.continueToSummit(), true);

  const finishedAt = tickUntilTerminal(sim);
  assert.notEqual(finishedAt, -1, 'the summit terminates');
  assert.equal(sim.state.status, 'lost', 'the unbeatable wave-16 boss ends the summit in a loss');
  assert.equal(sim.state.publicWinBanked, true, 'the public victory is NEVER revoked');
});

// ---------------------------------------------------------------------------
test('summit is opt-in: a won run that never continues stays won at wave 15', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  buildHeavy(sim);
  winHeavy(sim);
  assert.equal(sim.state.status, 'won');

  const dt = sim.config.timestepMs;
  for (let t = 0; t < 30000; t += dt) sim.tick(dt); // 30s more of sim time
  assert.equal(sim.state.status, 'won', 'still won');
  assert.equal(sim.state.wave.index, 15, 'never advances past wave 15 without the dare');
  assert.equal(sim.state.summitMode, false, 'summit was never entered');
});

// ---------------------------------------------------------------------------
// W11 — a WON summit fires the SEPARATE SUMMIT_WON terminal, and GAME_WON STILL
// fires EXACTLY ONCE (the public win at wave 15). The true ending never re-emits
// GAME_WON, so the "fires once" contract is preserved even when the summit is beaten.
test('a WON summit fires SUMMIT_WON once and never re-fires GAME_WON', () => {
  const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = POLICIES.optimal({ ultimate: true });   // wields the boss-tower nuke
  const dt = sim.config.timestepMs;
  let gameWon = 0, summitWon = 0;
  sim.bus.on(EV.GAME_WON, () => gameWon++);
  sim.bus.on(EV.SUMMIT_WON, () => summitWon++);
  let acc = 0, summited = false;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
    if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    if (summited && (sim.state.status === 'won' || sim.state.status === 'lost')) break;
  }
  assert.equal(sim.state.summitWon, true, 'the summit was won');
  assert.equal(summitWon, 1, 'SUMMIT_WON fired exactly once');
  assert.equal(gameWon, 1, 'GAME_WON fired EXACTLY once (the public win) — never re-fired by the summit win');
});

// ---------------------------------------------------------------------------
test('continueToSummit is a no-op before the win is banked', () => {
  const cfg = fastConfig();
  const sim = new Simulation(cfg, { seed: 99, mapIndex: 0 });
  sim.startGame();
  assert.equal(sim.state.status, 'playing');
  assert.equal(sim.continueToSummit(), false, 'cannot summit before banking the win');
  assert.equal(sim.state.summitMode, false);
  assert.equal(sim.state.status, 'playing', 'status unchanged');
});
