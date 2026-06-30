# W9 — Balance Curve: invert the falling difficulty so late waves pressure

## Problem (grounded, measured)

Jaco's claim — "late-game is trivial (enemies die at spawn) while the opening is
hardest; player lacks an offensive ceiling" — is exactly what the sim ladder
shows. Driving `POLICIES.optimal()` (tools/balance/policies.mjs:216) and recording
the **deepest path fraction any enemy reached per wave** gives a *falling* curve:

```
map0 (Ribbon)  deepest enemy penetration, fraction of path (avg over seeds 1,2,3,7)
  W1 .53  W2 .35  W3 .57  W4 .46  W5 .99(boss)  W6 .20  W7 .26  W8 .12
  W9 .11  W10 .49(boss)  W11 .20  W12 .20  W13 .10  W14 .12  W15 .18
  lives lost: only +3 at the wave-5 boss; ZERO on every late wave.

map1 (Comb)    deepest enemy penetration
  W1 .84  W2 .83  W3 .98  W4 .65  W5 .98(boss)  W6 .28  W7 .29  W8 .22
  W9 .16  W10 .58(boss)  W11 .34  W12 .31  W13 .18  W14 .17  W15 .27
  lives lost: +1 W3, +3 at the wave-5 boss; ZERO W11–15.
```

Non-boss windows:

| window (non-boss waves) | map0 mean | map1 mean |
|---|---|---|
| early (W2–4) | 0.46 | 0.82 |
| late  (W11–14) | 0.155 | 0.25 |
| late / early | **0.34x** | **0.30x** |

So a saturated optimal board kills LATE enemies at ~1/3 the depth of the opening:
they die near spawn. The opening (few towers, low coins) is the only real fight;
every non-boss wave from ~W6 on is a formality, and the player has no offensive
button to *want* a harder late game.

### Why the curve falls

The board's effective DPS grows super-linearly across a run (more towers +
upgrades to L3 + P4 forks + freeze), while per-wave enemy **total HP** grows only
`count(1.20) x hp(1.12) ≈ 1.344x/wave` (waveSystem.js:21-32, gameConfig.js:70-74)
and the cap freezes scaling at wave 15. Income compounds in parallel
(`count x reward x coinReduction ≈ 1.23x/wave`), so the optimal board is
*overbuilt* well before the late waves arrive. DPS outruns HP → die-at-spawn.

## Concrete change (design-faithful)

Bend the curve **convex**: add an accelerating LATE-WAVE SURGE that compounds
HP/count/speed **only past a knee wave**, leaving the opening's tuned difficulty
untouched. This is the minimal, single-lever way to *raise the right tail without
punishing the early game* — exactly Jaco's intent ("late waves genuinely pressure
… without punishing the early game").

`v2/sim/systems/waveSystem.js` — `computeScaling()` (currently lines 21-32) gains a
late-surge term layered on top of the existing geometric scaling:

```js
const ls = s.lateSurge;
const lateSteps = ls ? Math.max(0, eff - ls.fromWave) : 0; // 0 until past the knee
const lateHp    = ls ? Math.pow(ls.hp,    lateSteps) : 1;
const lateCount = ls ? Math.pow(ls.count, lateSteps) : 1;
const lateSpeed = ls ? Math.pow(ls.speed, lateSteps) : 1;
// hpMult    *= lateHp;  countMult *= lateCount;  speedMult *= lateSpeed;
```

- **hp** does the heavy lifting (more HP-per-enemy = the board can't one-shot late).
- **count** adds modest volume (kept small so total income doesn't re-flood — the
  flood is what causes the overbuild loop; see W10 coupling).
- **speed** shortens time-in-range, so survivors *penetrate deeper* toward the goal
  — the felt "they're getting through!" tension. `rewardMult` is deliberately NOT
  surged: late difficulty rises while income does not keep pace.

`eff` is the existing `min(index, capWave=15)`, so the surge ramps W(fromWave+1)…W15
and applies once at the secret wave 16 (eff=15) — which is intentional (see coupling).

### Config (gameConfig.js, in `waves.scaling`, ~line 70)

```js
scaling: {
  hp: 1.12, speed: 1.03, count: 1.20, reward: 1.08,
  intervalReduction: 0.95, bossMult: 1.5, capWave: 15, coinReduction: 0.95,
  // W9 — convex late surge. Compounds ON TOP of the base curve for waves > fromWave
  // only; bends the endgame UP without touching the opening. SHIPS INERT (1.0s) so
  // W9 merges without breaking ladder #4; the single post-merge rebalance sets the
  // real values jointly with the offensive ceiling (boss-tower ultimate).
  lateSurge: { fromWave: 9, hp: 1.0, count: 1.0, speed: 1.0 },
},
```

**Ships inert.** The new balance-curve test is therefore RED at merge (curve still
falls). The single post-merge rebalance activates it — recommended starting dials,
to be tuned against the W8 offensive ceiling so ladder #4/#8 stay green:
`{ fromWave: 9, hp: 1.12, count: 1.05, speed: 1.015 }`
(→ at W15: hp x1.76, count x1.28, speed x1.08 on top of base ⇒ ~2.25x late total HP).

## Failing-first tests (new file — `tools/tests/balance-curve.test.mjs`)

Self-contained (imports Simulation + Bot + POLICIES, runs its own tick loop like
measure-secret-boss.mjs) so it touches **no shared file** → parallel-safe. Probes
per-wave deepest penetration under `optimal()` across seeds {1,2,3,7} x maps {0,1}.

1. **`curve rises — late penetration ≥ early`**: `mean(deepest[W11..W14]) ≥
   mean(deepest[W2..W4])` on every seed x map. RED today (late ≈ 0.30–0.34x early).
2. **`late waves threaten the goal`**: `max(deepest[W11..W15]) ≥ 0.6` on the hard
   map (Comb). RED today (max late ≈ 0.34).
3. **`late waves bleed lives under optimal`**: lives lost across W11–15 `> 0`. RED
   today (zero late-wave leaks; only the wave-5 boss costs lives).

All three flip GREEN when the rebalance activates `lateSurge` alongside the
offensive ceiling. The existing `ladder #4` (optimal still WINS all 15) and
`ladder #8` (boss life-drain stays ≥4 lives, fair) remain the guardrails the
rebalance must NOT break — that's the joint-tuning constraint.

## Balance impact (feeds the single post-merge rebalance)

- Inverts the difficulty curve: late non-boss waves go from ~0.15–0.25 penetration
  to a *rising* tail approaching the goal; optimal will now bleed lives in W11–15,
  not just at boss waves. The rebalance must keep optimal's `livesAt[15]` in the
  ladder band (`≥4`, `<max`, `≤10`) — so the offensive ceiling (W8) is *required*
  to absorb the new pressure.
- `lateSurge` also raises the **secret wave-16 on-field HP** (eff=15 ⇒ x1.76 hp at
  the recommended dial), pushing the "unbeatable wall" even higher — re-run
  `tools/balance/measure-secret-boss.mjs` after the rebalance. This is *aligned*
  with the pass's big reversal: the wall gets meaner, and the new boss-tower
  ultimate is what overturns it.
- Income: `count` surge is held to ~1.05 precisely so late income creep stays mild
  (the overbuild/flood loop is the falling-curve cause); pairs with W10 economy.

## Dependencies & couplings

- **Depends on W8 (offensive ceiling — boss-tower ultimate).** The raised late
  curve makes the game *unwinnable for optimal* on its own; the rebalance can only
  re-green ladder #4 once the offensive lever exists to spend the new pressure
  against. W9's RED tests + W8's offensive lever are tuned together in the ONE
  post-merge rebalance. This is the intended reversal: harder late game ⇄ new
  offensive button.
- **Couples with W10 (economy / income).** The surge intentionally does not surge
  reward; if W10 retunes income, the joint rebalance must re-check that late waves
  still pressure (no re-flood → re-overbuild → die-at-spawn regression).
- **Touches `measure-secret-boss.mjs` margin indirectly** (wave-16 HP rises). No
  code change there, but its ≥5x / ≥3x guards must be re-measured post-rebalance.

## Parallel-safety

- **Parallel-safe with:** any item that does NOT edit `waveSystem.js` or the
  `waves.scaling` block of `gameConfig.js`. The new test file is brand-new and
  imports only stable public APIs → no test-file collision.
- **Must sequence with:** any sibling that edits `computeScaling()` /
  `waves.scaling` (wave-pacing/spawn items) — shared lines. And it is *logically*
  gated behind W8 for the rebalance (values can't be finalized until the offensive
  ceiling exists). The `gameConfig.js` edit is a small additive block; if multiple
  items append to `waves.scaling`, merge them in one config pass.
