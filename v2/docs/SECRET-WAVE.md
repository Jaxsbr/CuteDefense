# Secret Wave 16 — the Split Boss

The mean orange **star** that has always sat at the centre of the start menu finally
appears in the game — but only as a *hidden* 16th wave, and only once the player has
survived all 15 known waves. It is intentionally **unbeatable** with today's towers:
defeating it is meant to require the future, out-of-scope **boss tower upgrades**.

## How it stays secret

- The split boss is appended to `waves.patterns` as a **16th entry flagged `secret: true`**.
- `publicWaveCount()` (the HUD `/N` denominator) counts only non-secret patterns, so the
  player sees `… / 15` throughout — and only when the surprise wave begins does the chip
  read **`16/15`**.
- Nothing reveals it beforehand: the enemy catalog, the menu, and the wave schedule all
  still show 15 waves. (The catalog deliberately still lists the star as "menu-only / never
  spawns" to preserve the surprise.)
- Because truncated test configs *replace* `waves.patterns` wholesale, the secret wave never
  leaks into unit-test scenarios — only full-game runs (the balance ladder, the playthrough)
  ever reach it.

## Win semantics change

Win now fires only after the **final** pattern (wave 16) is cleared. The boss cannot be
killed yet, so it walks to the goal and ends the run. **The game therefore has no winnable
state until boss tower upgrades ship** — that is the intended hook. The 15-wave balance curve
is unchanged; "optimal" still masters all 15 known waves (with only a few lives left), then
meets the wall at wave 16.

## The boss — and why it can't be beaten

`boss_split` (config `v2/config/gameConfig.js`):

| field | value | why |
|------|------|-----|
| `hp` (base) | **20000** | wave-16 scaling (`1.12^14 × 1.5 ≈ 7.33×`) makes the on-field HP **≈ 146,613** |
| `speed` | 1.35 | on-field ≈ 2.04 tiles/s after scaling — reaches the goal promptly |
| `size` | 1.4 | the biggest baddie |
| `livesCost` | **99** | a one-shot game-ender: reaching the goal instantly drains the 12-life pool |
| `behavior` | `split → boss_splitling ×3` | if ever killed, it splits into weaker **boss** shards |

### Value tweaks — measured, not guessed

`tools/balance/measure-secret-boss.mjs` drives strong-player games to wave 16 and records the
**maximum damage any current build lands on the boss** while it crosses the map:

| scenario | damage landed on the boss | boss killed? | reaches goal? |
|---------|--------------------------|--------------|---------------|
| OPTIMAL bot, Ribbon (map 0), 4 seeds | ~19,800 – **20,366** (peak) | no | yes |
| OPTIMAL bot, Comb (map 1), 4 seeds | ~7,700 – 8,066 | no | yes |
| Saturated 40×L3 towers, straight line | 5,940 | no | yes |

On-field HP **146,613** sits at **~7.2× the worst damage observed (20,366)** — comfortably
unbeatable, with margin for seed/strategy variance, without resorting to an arbitrary giant
number. (Raising HP does not change damage-taken; damage is bounded by time-on-map × DPS, so
the 7× margin holds regardless.)

## The split shards — the fail-safe

If a future build ever *does* kill the boss, it must not be cheesable, so it splits into
**3 weaker boss shards** (`boss_splitling`) that carry on to the goal:

| field | value | why |
|------|------|-----|
| `childType` | `boss_splitling` | **boss-type, never basic** (the requirement) |
| `childHp` | **40000** | survives the full path even if the parent is killed at the very start under an optimal build |
| `boss_splitling.speed` | 1.5 | brisk; children spawn unscaled and still finish the path |
| `boss_splitling.behavior` | `shield 1.8s / 2.6s` | immune in bursts → very hard to stop |
| `boss_splitling.livesCost` | 12 | a single shard reaching the goal also ends the run |
| `boss_splitling.size` | 0.85 | a smaller "shard" of the star — visibly weaker than the parent |

Child-survival was measured by force-killing the boss the instant it appears (near the start,
worst case) on both maps under an optimal build:

| `childHp` | Ribbon (map 0) | Comb (map 1) |
|----------|----------------|--------------|
| 2,000 | killed (0/3 reach goal) | killed (0/3) |
| 12,000 | killed (0/3) | survive (3/3) |
| 30,000 | survive (3/3) | survive (3/3) |
| **40,000** | **survive (3/3, ≥20k HP to spare across seeds)** | **survive (3/3)** |

## Verification

- `tools/tests/secret-wave.test.mjs` — hidden-count math (`16/15`), shards are weaker bosses
  (not basics), a strong player reaches wave 16 and **cannot kill the boss** (it reaches the
  goal → loss), and the **split fail-safe** (force-killed boss → shards still reach the goal).
- `tools/tests/balance-ladder.test.mjs` (#4/#5) and `tools/tests/playthrough.test.mjs` updated
  to the new contract: optimal masters all 15 known waves, then the secret boss ends the run.
- Captures: `v2/captures/secret-wave/01-secret-reveal-16of15.png`,
  `02-boss-on-board-16of15.png`.
- `npm test` → 40/40 pass. `npm run bench` → V2 beats V1 (gate PASS).
