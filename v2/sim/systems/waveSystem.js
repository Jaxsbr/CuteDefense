/**
 * Wave system — the phase machine that paces the game.
 *   idle → prepare(countdown) → spawning → active → complete → (next | win)
 * All timing reads state.clock-derived phaseClock (pausable), never wall-clock.
 */
import { EV } from '../events.js';
import { spawnEnemy } from './enemySystem.js';
import { creditCoins } from './economySystem.js';

const FORMATION_FACTOR = { single: 1.0, line: 0.5, wedge: 0.5, phalanx: 0.4, swarm: 0.25 };

export function patternCount(state) { return state.config.waves.patterns.length; }

function computeScaling(cfg, index, isBossWave) {
  const s = cfg.waves.scaling;
  const eff = Math.min(index, s.capWave);
  const bossMult = isBossWave ? s.bossMult : 1;
  return {
    hpMult: Math.pow(s.hp, eff - 1) * bossMult,
    speedMult: Math.pow(s.speed, eff - 1),
    countMult: Math.pow(s.count, eff - 1),
    rewardMult: Math.pow(s.reward, eff - 1) * bossMult * Math.pow(s.coinReduction, index - 1),
    spawnInterval: cfg.waves.spawnIntervalMs * Math.pow(s.intervalReduction, eff - 1),
  };
}

function buildSpawnQueue(state, index) {
  const cfg = state.config;
  const pattern = cfg.waves.patterns[Math.min(index - 1, cfg.waves.patterns.length - 1)];
  const isBossWave = !!pattern.boss;
  const sc = computeScaling(cfg, index, isBossWave);
  const queue = [];

  for (const group of pattern.enemies) {
    const def = cfg.enemies[group.type];
    const isBossType = !!def.isBoss;
    const count = isBossType ? group.count : Math.max(1, Math.round(group.count * sc.countMult));
    const factor = FORMATION_FACTOR[group.formation] ?? 1.0;
    for (let i = 0; i < count; i++) {
      const gap = queue.length === 0 ? 0 : (i === 0 ? sc.spawnInterval : sc.spawnInterval * factor);
      queue.push({
        typeId: group.type,
        hp: Math.round(def.hp * sc.hpMult),
        speed: def.speed * sc.speedMult,
        reward: Math.max(1, Math.floor(def.reward * sc.rewardMult)),
        gapMs: gap,
      });
    }
  }
  return { queue, isBossWave };
}

export function startWaveSystem(state) {
  state.wave.index = 0;
  beginNextWave(state, /*first*/ true);
}

function beginNextWave(state, first = false) {
  const w = state.wave;
  w.index += 1;
  w.phase = 'prepare';
  w.phaseClock = 0;
  w.spawnQueue = [];
  w.spawnTimer = 0;
  w.spawnedCount = 0;
  w.totalCount = 0;
  w.earnings = 0;          // per-wave earnings reset; drives the end-of-wave bonus
  w.lastThudSec = null;
  const isBoss = !!state.config.waves.patterns[Math.min(w.index - 1, patternCount(state) - 1)].boss;
  w.isBossWave = isBoss;
  w.prepMs = first ? state.config.waves.firstPrepMs : state.config.waves.prepMs;
  w.announcement = { text: isBoss ? 'BOSS WAVE' : `Wave ${w.index}`, kind: isBoss ? 'boss' : 'prepare' };
  state.wavePopUntil = state.clock + 700;   // display-only: pops the HUD WAVE chip on advance
  state.bus.emit(EV.WAVE_PREPARE, { index: w.index, isBoss });
  state.frameEvents.push({ type: EV.WAVE_PREPARE, index: w.index, isBoss });
}

export function update(state, dt) {
  const w = state.wave;
  if (w.phase === 'idle') return;
  w.phaseClock += dt;

  switch (w.phase) {
    case 'prepare': updatePrepare(state, dt); break;
    case 'spawning': updateSpawning(state, dt); break;
    case 'active': updateActive(state); break;
    case 'complete': updateComplete(state); break;
  }
}

function updatePrepare(state, dt) {
  const w = state.wave;
  const cfg = state.config;
  const remainingMs = Math.max(0, w.prepMs - w.phaseClock);
  const remainingSec = Math.ceil(remainingMs / 1000);
  w.announcement = {
    text: `${w.isBossWave ? 'BOSS in' : 'Next in'}: ${remainingSec}`,
    kind: w.isBossWave ? 'boss' : 'countdown',
  };
  // Countdown thuds once per second in the last N seconds.
  if (remainingSec <= cfg.waves.countdownThudFromSec && remainingSec > 0 && w.lastThudSec !== remainingSec) {
    w.lastThudSec = remainingSec;
    state.bus.emit(EV.WAVE_COUNTDOWN_TICK, { sec: remainingSec });
    state.frameEvents.push({ type: EV.WAVE_COUNTDOWN_TICK, sec: remainingSec });
  }
  if (w.phaseClock >= w.prepMs) {
    const { queue, isBossWave } = buildSpawnQueue(state, w.index);
    w.spawnQueue = queue;
    w.totalCount = queue.length;
    w.isBossWave = isBossWave;
    w.phase = 'spawning';
    w.phaseClock = 0;
    w.spawnTimer = 0;
    w.announcement = null;
    state.bus.emit(EV.WAVE_START, { index: w.index, isBoss: isBossWave, total: queue.length });
    state.frameEvents.push({ type: EV.WAVE_START, index: w.index, isBoss: isBossWave });
  }
}

function updateSpawning(state, dt) {
  const w = state.wave;
  w.spawnTimer += dt;
  // Spawn as many queued enemies as the elapsed gap allows this step.
  while (w.spawnQueue.length > 0 && w.spawnTimer >= w.spawnQueue[0].gapMs) {
    const item = w.spawnQueue.shift();
    w.spawnTimer -= item.gapMs;
    spawnEnemy(state, item);
    w.spawnedCount += 1;
  }
  if (w.spawnQueue.length === 0) {
    w.phase = 'active';
    w.phaseClock = 0;
  }
}

function updateActive(state) {
  const w = state.wave;
  const anyAlive = state.enemies.some(e => e.alive && !e.reachedGoal);
  if (!anyAlive) {
    w.phase = 'complete';
    w.phaseClock = 0;
    state.stats.wavesCleared += 1;
    state.bus.emit(EV.WAVE_COMPLETE, { index: w.index });
    state.frameEvents.push({ type: EV.WAVE_COMPLETE, index: w.index });

    // End-of-wave bonus: 25% of what the player earned this wave, paid to the
    // wallet with a pulsing total + coin SFX (WAVE_BONUS -> coin_collect).
    const bonus = Math.floor(w.earnings * 0.25);
    if (bonus > 0) {
      creditCoins(state, bonus);
      state.stats.coinsEarned += bonus;
      state.bonusFloat = { amount: bonus, untilClock: state.clock + 1400 };
      state.bus.emit(EV.WAVE_BONUS, { index: w.index, amount: bonus });
      state.frameEvents.push({ type: EV.WAVE_BONUS, index: w.index, amount: bonus });
      w.announcement = { text: `Wave ${w.index} Complete!  +${bonus}c bonus`, kind: 'complete' };
    } else {
      w.announcement = { text: `Wave ${w.index} Complete!`, kind: 'complete' };
    }
  }
}

function updateComplete(state) {
  const w = state.wave;
  // Last wave complete → win is decided centrally in Simulation.
  if (w.index >= patternCount(state)) return;
  if (w.phaseClock >= state.config.waves.betweenWaveMs) {
    w.announcement = null;
    beginNextWave(state, false);
  }
}

export function isFinalWaveComplete(state) {
  return state.wave.phase === 'complete' && state.wave.index >= patternCount(state);
}
