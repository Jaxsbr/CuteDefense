# W10 — Freeze cap (floor on effective speed)

## Problem (player-facing, grounded in code)

Freeze is the single shared slow mechanism. Today it is one flat multiplicative
term in the ONE `effectiveSpeed` function:

- `v2/sim/systems/enemySystem.js:194-200` — `effectiveSpeed(state, e)`:
  ```js
  let v = e.baseSpeed;
  if (e.behavior?.type === 'speed' && e.bs.speedActive) v *= e.behavior.multiplier;
  if (state.clock < state.freeze.activeUntil) v *= state.config.freeze.slowMult; // 0.18
  if (state.clock < e.slowUntil) v *= e.slowFactor;                              // Froster 0.5
  return v;
  ```
- `v2/config/gameConfig.js:236` — `freeze.slowMult: 0.18`.
- `v2/config/gameConfig.js:225` — Froster fork `slow: { factor: 0.5, durationMs: 1200 }`.

Two issues with the current shape:

1. **Stacked slows compound to an absolute crawl.** Freeze (`0.18`) AND a Froster
   slow (`0.5`) both ride this same function multiplicatively →
   `0.18 * 0.5 = 0.09` of base speed. With a future boss-tower ultimate adding yet
   another slow, the product approaches a near-stun. There is no floor.
2. **No "keeps meaningful speed" guarantee for fast enemies.** The intent (Jaco):
   freeze should slow each enemy *by a capped percentage of its OWN speed* with a
   *floor on effective speed*, so a fast boss (e.g. `boss_split` speed `1.35`,
   `boss_speed` `2.7`, `boss_splitling` `1.5` — `v2/config/gameConfig.js:149,163,167`)
   keeps meaningful speed while frozen rather than being driven to the same crawl
   as the swarm. The floor must scale with the enemy's own base speed.

This matters for the V2.1 reversal: the split boss becomes winnable through skill
(the boss-tower ultimate is the offensive key). Freeze + Froster + ultimate must
remain a legible "strong slow with a dignity floor", not an unintended hard
stun-lock, and a fast boss frozen must stay recognisably fast.

## Concrete change (design-faithful)

Add a single FLOOR clamp at the tail of `effectiveSpeed`, expressed as a fraction
of the enemy's OWN base speed, gated on a slow actually being active so the
non-slowed fast path stays byte-for-byte identical (guards existing timing tests).
This keeps the "exactly ONE slow path" invariant — the floor lives in the same
function, not a new mechanism.

`v2/sim/systems/enemySystem.js` — `effectiveSpeed`:
```js
export function effectiveSpeed(state, e) {
  let v = e.baseSpeed;
  if (e.behavior?.type === 'speed' && e.bs.speedActive) v *= e.behavior.multiplier;
  const frozen = state.clock < state.freeze.activeUntil;
  const slowed = state.clock < e.slowUntil;
  if (frozen) v *= state.config.freeze.slowMult;       // P3 global field freeze
  if (slowed) v *= e.slowFactor;                        // P4 Froster per-enemy slow
  // W10 — capped slow: no stack of slows may drop an enemy below a fixed
  // PERCENTAGE of its OWN base speed. Floor scales with baseSpeed, so a fast
  // boss keeps meaningful speed while frozen; never an absolute crawl/stun-lock.
  if (frozen || slowed) {
    const floor = e.baseSpeed * state.config.freeze.minSpeedFraction;
    if (v < floor) v = floor;
  }
  return v;
}
```

`v2/config/gameConfig.js` — `freeze` block (after `slowMult`):
```js
slowMult: 0.18,             // speed multiplier while frozen (per-slow term)
minSpeedFraction: 0.15,     // W10 floor: no stack of slows drops an enemy below
                            // this fraction of its OWN base speed (capped slow,
                            // never an absolute crawl). Floor scales w/ baseSpeed
                            // so a fast boss keeps meaningful speed while frozen.
```

### Why `0.15` as the default

`minSpeedFraction = 0.15` sits just BELOW `slowMult = 0.18`, so a *single* freeze
is unchanged (`0.18 > 0.15` → not floored) and the locked balance ladder /
secret-boss measurement are NOT perturbed at merge. The floor only bites when
slows STACK (freeze × Froster = `0.09 < 0.15` → floored to `0.15`), which is
exactly the "absolute crawl" case. Because the floor is a fraction of `baseSpeed`,
a fast boss always retains proportionally more absolute speed than the swarm.

This is the conservative, merge-safe default. The single post-merge rebalance can
raise it toward `0.25–0.30` if we want the *single*-freeze headline (every enemy
keeps ≥25% of its own speed under one freeze — a gentler, more kid-legible
slow-motion effect rather than a near-stun). Lever range: `0.12` (stack-only
protection) → `0.30` (gentle freeze).

## Config keys

- `freeze.minSpeedFraction` (new) — floor on effective speed as a fraction of an
  enemy's own `baseSpeed`, applied only when frozen or Froster-slowed.

## Failing-first tests (`tools/tests/freeze.test.mjs`)

All use exported `effectiveSpeed` from `v2/sim/systems/enemySystem.js` + a
Simulation, matching the existing freeze test harness.

1. **W10 #1 — high-speed enemy retains the floor under freeze.** Build a sim with a
   fast enemy, override `freeze.minSpeedFraction = 0.30` (above `slowMult` so the
   floor BITES), cast freeze, assert
   `effectiveSpeed(state, e) === e.baseSpeed * 0.30` (and strictly greater than the
   pre-W10 value `e.baseSpeed * slowMult`). Fails before the clamp exists (returns
   `baseSpeed * 0.18`).
2. **W10 #2 — stacked freeze + Froster never drops below the floor.** Apply freeze
   AND `applySlow(state, e, 0.5, …)` to a fast enemy; assert
   `effectiveSpeed >= e.baseSpeed * freeze.minSpeedFraction` (default `0.15`),
   whereas the raw product `baseSpeed * 0.18 * 0.5` is below it. Fails before clamp.
3. **W10 #3 — floor scales with own speed (fast boss > swarm while frozen).** Under
   the same high floor, assert a fast enemy's frozen effective speed is strictly
   greater than a slow enemy's frozen effective speed (proportional floor).
4. **W10 #4 — regression: non-slowed speed unchanged.** With no freeze and no
   Froster slow, assert `effectiveSpeed === e.baseSpeed` (and the `speed`-boss burst
   path `baseSpeed * multiplier` is untouched). Guards the locked timing path.

## Balance impact (feeds the single post-merge rebalance)

- Default `0.15` is below `slowMult 0.18`, so **single-freeze is unchanged** → the
  locked 4-tier ladder (`tools/tests/balance-ladder.test.mjs`) and
  `tools/balance/measure-secret-boss.mjs` should not shift at merge.
- The floor only raises STACKED-slow effective speed (freeze × Froster from `0.09`
  → `0.15` of base). Net: stacked crowd-control is *slightly weaker* — enemies
  under multiple slows leak marginally faster. This is intentional (anti-stun-lock,
  mirrors the `nap.immunityMs` governor philosophy at `v2/config/gameConfig.js:244`).
- Lever for rebalance: raising `minSpeedFraction` toward `0.25–0.30` weakens freeze
  as crowd control across the board (gentler slow), and conversely lowering toward
  `0.12` restricts the floor to stack-only protection. Re-run the ladder +
  secret-boss measurement after choosing the final value.
- Perf: a single multiply + compare added to `effectiveSpeed`; negligible. V2 p95
  stays well under V1.

## Captures (observable change)

- Frozen-enemy frost overlay already exists (`visual.anim.freezeTintMs`,
  `v2/config/gameConfig.js:303`); W10 changes movement *speed* under freeze when
  slows stack, not rendering. A before/after capture is only meaningful with the
  rebalanced (raised) value: record a short clip of a fast boss under freeze
  showing it still glides at a meaningful pace vs the pre-W10 crawl. Optional;
  primary proof is the unit tests above.

## Dependencies

- **None hard.** The clamp is self-contained in `effectiveSpeed` + one config key.
- Soft: the future **boss-tower ultimate** (the V2.1 offensive key) — if its
  ultimate applies a slow, it will ride this same floored term automatically. W10
  should land first so the ultimate's slow composes against a known floor.
- Soft: the **single post-merge rebalance** consumes `minSpeedFraction` as a lever
  and must re-run the ladder + secret-boss measurement.

## Parallel-safe vs must-sequence

- **Parallel-safe** with items that do not touch `v2/sim/systems/enemySystem.js`
  or the `freeze` block of `v2/config/gameConfig.js` — e.g. renderer/HUD work,
  Tactical Recon banner, fork-card UI, win/summit flow.
- **Must sequence (shares files)** with any other item editing `effectiveSpeed` /
  the slow path (e.g. Froster retune, boss-tower-ultimate slow), and any item
  editing the `freeze` config block. Also sequence ahead of the single post-merge
  rebalance (it reads the new key).
