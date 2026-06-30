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

// The wave count the PLAYER is told about (the HUD "/N" denominator). Secret
// waves (e.g. the hidden wave-16 boss) are excluded, so a normal run reads
// "15/15" right up until the surprise wave makes it "16/15".
export function publicWaveCount(state) {
  return state.config.waves.patterns.filter(p => !p.secret).length;
}

export function computeScaling(cfg, index, isBossWave) {
  const s = cfg.waves.scaling;
  const eff = Math.min(index, s.capWave);
  const bossMult = isBossWave ? s.bossMult : 1;
  // W9 — convex LATE SURGE. Compounds ON TOP of the base geometric curve past
  // `fromWave`. The PUBLIC boss waves (5/10/15) are EXCLUDED: they already carry
  // hand-tuned life-drain, so the public nail-biters + ladder life budget stay exact.
  // The late NON-boss tail bends UP (those waves were the formality — the falling
  // curve the brief measured) AND the SECRET wave-16 boss IS surged (index > capWave):
  // the wall gets meaner (brief: "pushing the unbeatable wall even higher"), which the
  // boss-tower ultimate is tuned to overturn while the standard kit still cannot.
  // hp does the heavy lifting (the board can't one-shot late enemies); count is held
  // small and reward is NOT surged (late income does not re-flood -> no overbuild loop);
  // speed shortens time-in-range so survivors penetrate deeper. Inert when absent/1.0.
  const isPublicBoss = isBossWave && index <= s.capWave;
  const ls = (s.lateSurge && !isPublicBoss) ? s.lateSurge : null;
  const lateSteps = ls ? Math.max(0, eff - ls.fromWave) : 0;
  const lateHp = ls ? Math.pow(ls.hp, lateSteps) : 1;
  const lateCount = ls ? Math.pow(ls.count, lateSteps) : 1;
  const lateSpeed = ls ? Math.pow(ls.speed, lateSteps) : 1;
  // V2.2 — late-weighted income lift (the paired companion to the boss cost hike).
  // Compounds reward ONLY on non-public-boss waves past `fromWave` so the opening is
  // untouched but the endgame can fund the ~1250 boss. Inert when ls.reward absent/1.
  const lateReward = ls && ls.reward ? Math.pow(ls.reward, lateSteps) : 1;
  return {
    hpMult: Math.pow(s.hp, eff - 1) * bossMult * lateHp,
    speedMult: Math.pow(s.speed, eff - 1) * lateSpeed,
    countMult: Math.pow(s.count, eff - 1) * lateCount,
    rewardMult: Math.pow(s.reward, eff - 1) * bossMult * Math.pow(s.coinReduction, index - 1) * lateReward,
    spawnInterval: cfg.waves.spawnIntervalMs * Math.pow(s.intervalReduction, eff - 1),
  };
}

function buildSpawnQueue(state, index) {
  const cfg = state.config;
  const pattern = cfg.waves.patterns[Math.min(index - 1, cfg.waves.patterns.length - 1)];
  const isBossWave = !!pattern.boss;
  const entry = pattern.entry || 'start';   // P2: per-wave spawn direction
  const sc = computeScaling(cfg, index, isBossWave);
  const queue = [];

  for (const group of pattern.enemies) {
    const def = cfg.enemies[group.type];
    const isBossType = !!def.isBoss;
    // P3: the disabler is a single authored "lever", never wave-scaled in count.
    const noScale = isBossType || def.behavior?.type === 'disabler';
    const count = noScale ? group.count : Math.max(1, Math.round(group.count * sc.countMult));
    const factor = FORMATION_FACTOR[group.formation] ?? 1.0;
    const flags = group.flags || [];        // P2: composable enemy property flags
    for (let i = 0; i < count; i++) {
      const gap = queue.length === 0 ? 0 : (i === 0 ? sc.spawnInterval : sc.spawnInterval * factor);
      queue.push({
        typeId: group.type,
        hp: Math.round(def.hp * sc.hpMult),
        speed: def.speed * sc.speedMult,
        reward: Math.max(1, Math.floor(def.reward * sc.rewardMult)),
        gapMs: gap,
        flags,
        entry,
      });
    }
  }
  return { queue, isBossWave };
}

// Tactical Recon: the FULL set of incoming threat flags + entry direction for a
// pattern, so the announcement banner can warn the player WHICH tools and WHERE
// before the wave. Flags are gathered across all groups, deduped, ordered by
// enemyFlags.order (stable), and capped to enemyFlags.cap.max for legibility.
// `threat` (= threats[0]) is kept for backward compat with old consumers.
function reconFor(pattern, cfg) {
  const ef = cfg.enemyFlags;
  const seen = new Set();
  for (const g of pattern.enemies) { for (const f of (g.flags || [])) seen.add(f); }
  const threats = ef.order.filter(f => seen.has(f)).slice(0, ef.cap.max);
  return { threats, threat: threats[0] ?? null, entry: pattern.entry || 'start' };
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
  const pat = state.config.waves.patterns[Math.min(w.index - 1, patternCount(state) - 1)];
  const isBoss = !!pat.boss;
  w.isBossWave = isBoss;
  const recon = reconFor(pat, state.config); // P2/W2: { threats, threat, entry } for the Recon banner
  w.threats = recon.threats;
  w.threat = recon.threat;
  w.entry = recon.entry;
  w.prepMs = first ? state.config.waves.firstPrepMs : state.config.waves.prepMs;
  // Secret/boss waves may carry a custom `announce` banner; otherwise default.
  w.announcement = { text: pat.announce || (isBoss ? 'BOSS WAVE' : `Wave ${w.index}`), kind: isBoss ? 'boss' : 'prepare', threats: recon.threats, threat: recon.threat, entry: recon.entry };
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
    threats: w.threats, threat: w.threat, entry: w.entry,    // P2/W2: Tactical Recon (threat legend + entry arrow)
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

    // P5 — a distinct boss-defeated signal for the celebration banner on EACH
    // public boss wave (5/10/15). Display-only; the win is decided centrally.
    if (w.isBossWave) {
      const boss = state.config.waves.patterns[Math.min(w.index - 1, patternCount(state) - 1)].boss;
      state.bus.emit(EV.BOSS_DEFEATED, { index: w.index, boss });
      state.frameEvents.push({ type: EV.BOSS_DEFEATED, index: w.index, boss });
    }

    // End-of-wave bonus: 25% of what the player earned this wave, paid to the
    // wallet with a pulsing total + coin SFX (WAVE_BONUS -> coin_collect).
    const bonus = Math.floor(w.earnings * 0.25);
    if (bonus > 0) {
      creditCoins(state, bonus);
      state.stats.coinsEarned += bonus;
      state.bonusFloat = { amount: bonus, untilClock: state.clock + 1400 };
      state.bus.emit(EV.WAVE_BONUS, { index: w.index, amount: bonus });
      state.frameEvents.push({ type: EV.WAVE_BONUS, index: w.index, amount: bonus });
    }
    // P5 — a DISTINCT celebration banner for beating a boss (kind 'bossdown',
    // rendered in gold), separate from the ordinary green "Wave N Complete!".
    if (w.isBossWave) {
      w.announcement = { text: bonus > 0 ? `Boss down! 🎉  +${bonus}c bonus` : 'Boss down! 🎉', kind: 'bossdown' };
    } else if (bonus > 0) {
      w.announcement = { text: `Wave ${w.index} Complete!  +${bonus}c bonus`, kind: 'complete' };
    } else {
      w.announcement = { text: `Wave ${w.index} Complete!`, kind: 'complete' };
    }
  }
}

function updateComplete(state) {
  const w = state.wave;
  // P5 — stop at the public final wave (15); the win is decided centrally in
  // Simulation. ONLY in opt-in summit mode does the run advance into the secret
  // wave(s) up to the last authored pattern.
  if (!state.summitMode) {
    if (w.index >= publicWaveCount(state)) return;
  } else {
    if (w.index >= patternCount(state)) return;
  }
  if (w.phaseClock >= state.config.waves.betweenWaveMs) {
    w.announcement = null;
    beginNextWave(state, false);
  }
}

// P5 — the win now fires at the public final wave (15), not the secret wave 16.
export function isFinalWaveComplete(state) {
  return state.wave.phase === 'complete' && state.wave.index >= publicWaveCount(state);
}

// W11 — the TRUE summit ending: in summit mode, the LAST authored pattern (the
// secret wave 16) has been cleared. Distinct from isFinalWaveComplete (public win
// at wave 15); used by _checkWinLose to fire the separate SUMMIT_WON terminal.
export function isSummitComplete(state) {
  return state.summitMode && state.wave.phase === 'complete' && state.wave.index >= patternCount(state);
}
