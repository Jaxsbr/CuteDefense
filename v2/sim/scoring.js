/**
 * Quality-weighted star scoring (P5). Pure: takes primitives + config, returns 1-3.
 *
 * Weighted toward decision quality (fast clears, low coin-hoard) over pure leftover
 * lives, so the meta goal pulls toward sharp play, not turtling. Winning is the
 * floor: the result is always >= 1.
 */
export function computeStars({ lives, coins, elapsedMs }, config) {
  const c = config.waves.stars;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const livesFrac = clamp01(lives / c.livesRef);                    // survival (smallest weight)
  const speedFrac = clamp01(c.parClearMs / Math.max(1, elapsedMs)); // >=1 at/under par
  const wasteFrac = clamp01(1 - coins / c.coinWasteRef);            // low hoard -> high score
  const q = c.weights.lives * livesFrac
          + c.weights.speed * speedFrac
          + c.weights.waste * wasteFrac;
  let stars = 1;                                                    // winning is the floor: always >=1
  if (q >= c.twoStarScore) stars = 2;
  if (q >= c.threeStarScore) stars = 3;
  return stars;
}

export default computeStars;
