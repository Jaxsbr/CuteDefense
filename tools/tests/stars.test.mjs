/**
 * P5 — quality-weighted STARS.
 *
 * computeStars is pure: primitives + config -> 1..3. It is weighted toward
 * decision quality (fast clears, low coin-hoard) over pure leftover lives, so the
 * meta goal pulls toward sharp play, not turtling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { computeStars } from '../../v2/sim/scoring.js';

const C = CONFIG.waves.stars;

test('stars reward sharp play over turtling (lives is NOT the dominant axis)', () => {
  // Turtle: full lives, slow, hoarded coins.
  const turtle = computeStars({ lives: C.livesRef, coins: C.coinWasteRef, elapsedMs: 2 * C.parClearMs }, CONFIG);
  // Sharp: half lives, fast, spent it all.
  const sharp = computeStars({ lives: C.livesRef / 2, coins: 0, elapsedMs: 0.5 * C.parClearMs }, CONFIG);
  assert.ok(sharp > turtle, `sharp play (${sharp}*) must out-star turtling (${turtle}*)`);
});

test('stars are clamped to 1..3 and winning is the floor', () => {
  const worst = computeStars({ lives: 0, coins: 1e9, elapsedMs: 1e9 }, CONFIG);
  assert.equal(worst, 1, 'winning is always at least 1 star');

  const best = computeStars({ lives: C.livesRef, coins: 0, elapsedMs: 1 }, CONFIG);
  assert.equal(best, 3, 'a flawless sharp run is 3 stars');

  // An intermediate input lands on 2.
  const mid = computeStars({ lives: C.livesRef / 2, coins: C.coinWasteRef / 2, elapsedMs: C.parClearMs }, CONFIG);
  assert.equal(mid, 2, 'a middling run is 2 stars');

  // Integer + range across a spread.
  for (const lives of [0, 3, 6, 12]) {
    for (const coins of [0, 200, 400, 1000]) {
      for (const elapsedMs of [1, C.parClearMs, 3 * C.parClearMs]) {
        const st = computeStars({ lives, coins, elapsedMs }, CONFIG);
        assert.ok(Number.isInteger(st) && st >= 1 && st <= 3, `stars int in [1,3] for ${lives}/${coins}/${elapsedMs} -> ${st}`);
      }
    }
  }
});
