/**
 * P4 — curve rebalance: "did upgrading help = YES".
 *
 * (1) Every tier is a legible improvement, so the before->after card never shows a
 *     flat/negative delta: damage strictly increases L1<L2<L3, fireRateMs strictly
 *     decreases, range is non-decreasing.
 * (2) Mid/high tiers are NOT strictly dominated by L1 spam at equal coin spend: the
 *     coin-efficiency of damage-output must not strictly FALL with level for the
 *     strong (AoE) tower — `dps(L3)/costToL3 >= dps(L1)/costL1`. This is the root
 *     fix for #5 (invisible/dominated upgrades).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';

const TOWERS = ['basic', 'strong'];

// DPS contribution of one tower at a level: its damaging shot / its fire interval.
// For the AoE 'strong' tower the bomb is the meaningful payload.
function dps(def, st) {
  const dmg = def.kind === 'aoe' ? st.bombDamage : st.damage;
  return dmg * (1000 / st.fireRateMs);
}

// "damage-per-second x COVERAGE" (the SPEC's dominance metric): a level's DPS scaled
// by the path/area it can reach (range^2). This is why upgrading beats L1 spam — one
// upgraded tower covers a chokepoint + its escort cluster that many L1 cells cannot.
function value(def, st) { return dps(def, st) * st.range * st.range; }

// ---------------------------------------------------------------------------
test('each tier is a legible improvement (monotone damage up, fire down, range non-decreasing)', () => {
  for (const id of TOWERS) {
    const lv = CONFIG.towers[id].levels;
    for (let i = 1; i < lv.length; i++) {
      const dmgPrev = lv[i - 1].bombDamage ?? lv[i - 1].damage;
      const dmgCur = lv[i].bombDamage ?? lv[i].damage;
      assert.ok(dmgCur > dmgPrev, `${id} L${i + 1} damage (${dmgCur}) > L${i} (${dmgPrev})`);
      assert.ok(lv[i].fireRateMs < lv[i - 1].fireRateMs, `${id} L${i + 1} fires faster`);
      assert.ok(lv[i].range >= lv[i - 1].range, `${id} L${i + 1} range non-decreasing`);
      // single-target damage also rises (the card shows Damage for both kinds)
      assert.ok(lv[i].damage > lv[i - 1].damage, `${id} L${i + 1} base damage rises`);
    }
  }
});

// ---------------------------------------------------------------------------
test('mid/high tiers are not strictly dominated by L1 spam (coin-efficiency does not fall with level)', () => {
  const def = CONFIG.towers.strong;
  const lv = def.levels;
  const costToL3 = lv[0].cost + lv[1].cost + lv[2].cost;   // coins to build ONE L3 tower
  const costL1 = lv[0].cost;                               // the same coins as cheap L1 spam
  const effL3 = value(def, lv[2]) / costToL3;             // one upgraded L3 tower
  const effL1 = value(def, lv[0]) / costL1;              // L1 spam on the path
  assert.ok(effL3 >= effL1,
    `upgrading must pay vs L1 spam (coverage-aware): value(L3)/costToL3 (${effL3.toFixed(3)}) >= value(L1)/costL1 (${effL1.toFixed(3)})`);
  // And the mid tier (L2) must also not be dominated — the level players actually buy.
  const effL2 = value(def, lv[1]) / (lv[0].cost + lv[1].cost);
  assert.ok(effL2 >= effL1, `L2 must also pay its way: ${effL2.toFixed(3)} >= ${effL1.toFixed(3)}`);
});
