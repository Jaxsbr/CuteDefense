/**
 * P3 — balance parity for the freeze ability + authored disabler.
 *
 * The freeze-aware OPTIMAL bot must still master all 15 known waves (with the
 * disabler authored into the wave list) and still LOSE to the secret wave-16
 * split boss. Freeze increases the damage landed on that boss (it lingers in the
 * kill-zone longer) but, dealing no damage itself, must never kill it — the boss
 * stays unbeatable here; P5 owns the summit win.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { runGame, Bot } from '../balance/harness.mjs';
import { POLICIES } from '../balance/policies.mjs';
import { EV } from '../../v2/sim/events.js';

const SECRET_INDEX = CONFIG.waves.patterns.length; // 16

// ---------------------------------------------------------------------------
test('P3 balance #11 — freeze-aware optimal still masters all 15 waves with the disabler authored in', () => {
  for (const mapIndex of [0, 1]) {
    for (const seed of [1, 7]) {
      const r = runGame(CONFIG, { seed, mapIndex, makePolicy: () => POLICIES.optimal() });
      const where = `map${mapIndex} seed${seed}`;
      assert.equal(r.wavesCleared, 15, `${where}: optimal clears all 15 known waves (cleared ${r.wavesCleared})`);
      assert.ok(r.perWaveLives[15] > 0, `${where}: still has lives entering the secret wave (${r.perWaveLives[15]})`);
    }
  }
});

// Instrumented run to the secret boss; tracks the lowest HP the boss ever hit.
function bossRun(makePolicy, { seed = 1, mapIndex = 0 } = {}) {
  const sim = new Simulation(CONFIG, { seed, mapIndex });
  sim.startGame();
  const bot = new Bot(sim);
  const policy = makePolicy(bot);
  const dt = sim.config.timestepMs;
  const bossIds = new Set();
  const rec = { maxHp: 0, minHp: Infinity, bossKilled: false, freezeCasts: 0 };
  sim.bus.on(EV.ENEMY_SPAWN, ({ id }) => {
    const e = sim.state.enemies.find(x => x.id === id);
    if (e && e.typeId === 'boss_split') { bossIds.add(id); rec.maxHp = Math.max(rec.maxHp, e.maxHp); }
  });
  sim.bus.on(EV.ENEMY_DEATH, ({ id }) => { if (bossIds.has(id)) rec.bossKilled = true; });
  sim.bus.on(EV.FREEZE_CAST, () => rec.freezeCasts++);
  let acc = 0, summited = false;
  for (let t = 0; t < 40 * 60 * 1000; t += dt) {
    sim.tick(dt);
    for (const e of sim.state.enemies) if (bossIds.has(e.id) && e.alive) rec.minHp = Math.min(rec.minHp, e.hp);
    acc += dt;
    if (acc >= 500) { acc = 0; if (sim.state.status === 'playing') policy.onDecision(bot); }
    // P5 — take the opt-in summit after the public win so the run still reaches wave 16.
    if (sim.state.status === 'won' && !summited) { if (sim.continueToSummit()) { summited = true; continue; } }
    if (sim.state.status === 'won' || sim.state.status === 'lost') break;
  }
  rec.status = sim.state.status;
  rec.damage = rec.minHp === Infinity ? 0 : rec.maxHp - rec.minHp;
  return rec;
}

test('P3 balance #12 — freeze lands MORE damage on the secret boss but does NOT kill it', () => {
  const withFreeze = bossRun((bot) => POLICIES.optimal(), { seed: 1, mapIndex: 0 });
  const noFreeze = bossRun((bot) => POLICIES.optimal({ freeze: false }), { seed: 1, mapIndex: 0 });

  assert.ok(withFreeze.freezeCasts > 0, 'the freeze-aware run actually cast freeze');
  assert.equal(noFreeze.freezeCasts, 0, 'the freeze-disabled run never cast freeze');
  assert.ok(withFreeze.damage > noFreeze.damage,
    `freeze increases damage landed on the boss (${Math.round(withFreeze.damage)} > ${Math.round(noFreeze.damage)})`);
  // ...yet the boss stays unbeatable in BOTH runs.
  assert.equal(withFreeze.bossKilled, false, 'freeze-aware: boss NOT killed');
  assert.equal(noFreeze.bossKilled, false, 'freeze-disabled: boss NOT killed');
  assert.equal(withFreeze.status, 'lost', 'freeze-aware run still LOST to the secret boss');
  assert.equal(noFreeze.status, 'lost', 'freeze-disabled run still LOST to the secret boss');
});
