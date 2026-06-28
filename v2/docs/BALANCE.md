# CuteDefense V2 — Game Balance

This document is the **source of truth for V2 balance tuning**. It explains how the
economy was retuned so that tower decisions matter continuously, how that tuning is
*proven* (not eyeballed) by a simulated difficulty ladder, the final tuned values
with rationale, the full results, the repeated-replay reset findings, and the
procedure to re-tune when new waves/enemies/towers/attacks are added.

All balance VALUES live in [`v2/config/gameConfig.js`](../config/gameConfig.js).
The simulation harness + bots live in [`tools/balance/`](../../tools/balance). The
acceptance tests are [`tools/tests/balance-ladder.test.mjs`](../../tools/tests/balance-ladder.test.mjs)
and [`tools/tests/replay-reset.test.mjs`](../../tools/tests/replay-reset.test.mjs).

---

## 1. The problem we fixed

Before tuning, a player could **spend out, plant ~8 towers, and coast** — there
were no further decisions. The numbers proved it: a *Save-and-upgrade* bot with
just **6 towers won every game untouched** (25/25 lives), and the old tower ranges
(basic L1–L3 = **5/6/7 tiles**) let a single tower blanket a third of the map.
Upgrading was also a *terrible* deal in raw DPS-per-coin (≈0.10 DPS/coin) versus
spreading L1 towers (≈0.88 DPS/coin), so "upgrade vs spread" was not a real choice.

The retune makes the economy demand **continuous investment** (you are always a
little short, placing/upgrading nearly every round through ~wave 13) and makes
**upgrade-vs-spread a live tradeoff** (pure Spread now under-performs
Save-and-upgrade, which under-performs Optimal).

---

## 2. Methodology — the difficulty ladder is the spec

We encode **four deterministic, seeded player-policy bots** that drive the real
`Simulation` command API (`gridClick → placementCycle → placementPlace`,
`upgradeSelected`, `sellSelected`) exactly as the input layer would, and play full
15-wave games. Each bot must hit its target outcome **robustly across multiple
seeds AND both maps** — not one cherry-picked seed.

- **Harness** ([`tools/balance/harness.mjs`](../../tools/balance/harness.mjs)) —
  a `Bot` wrapper that exposes faithful, command-API-only actions plus
  precomputed **path-coverage** helpers (which buildable tiles cover which path
  cells at a given range), and a `drive()`/`runGame()` loop that ticks the sim on
  a fixed timestep and calls the policy on a 500 ms decision cadence.
- **Determinism** — the sim never calls `Math.random`; all randomness flows
  through a seeded `Rng`. The bots use no randomness (ties break on stable tile
  order). So a given `(seed, mapIndex, policy)` produces an identical game every
  run, which is what makes the ladder a hard, reproducible gate.
- **Bots** ([`tools/balance/policies.mjs`](../../tools/balance/policies.mjs)) — see §3.

Re-run the ladder anytime with the committed test:

```bash
npm test                                   # whole suite
node --test tools/tests/balance-ladder.test.mjs   # just the ladder
```

---

## 3. The four player policies

| Bot | Heuristic | Target outcome |
|-----|-----------|----------------|
| **Unfocused** | Plonks **3 of the chunky AoE towers** in the opening on its best-coverage tiles, then goes idle — no upgrades, no further placement (a "set it and forget it" beginner). | Loses **early, ~wave 3**. |
| **Spread** | Places a **L1 tower whenever it can afford one**, always on the best *marginal-coverage* tile (covers the most as-yet-uncovered path); **never upgrades**; keeps stacking raw DPS once the path is covered. | Leaks and loses **mid-run**, before the final wave. |
| **Save-and-upgrade** | Lays a **small foundation (≈7 towers)** on the best chokepoints, then **stops placing and banks coins into upgrades**, pushing its towers toward L3. | Reaches the **final waves but loses** (close, no win). |
| **Optimal** | Chokepoint placement (AoE on multi-segment tiles, single-target elsewhere) + **continual placing** to full coverage + **strategic upgrades** + **selling/repositioning** redundant L1 towers + **spends its surplus** stacking firepower (never sits on a coin pile). | **Barely wins** all 15 with only a few lives left. |

The separation that makes the ladder hold is **coverage breadth**: Save-and-upgrade
is capped at a few towers (always leaves gaps), while Optimal builds many. Because
towers are now short-range, gaps leak — so few towers (however upgraded) cannot
hold the late waves, but a full-coverage build can.

---

## 4. Final tuned values (before → after) with rationale

Only VALUES in `gameConfig.js` changed; **no system logic, renderer, input, or V1
code** was touched, and the **locked bench fixture** (`{enemies:40, towers:12,
coins:30}`) is unchanged.

| Lever | Before | After | Why |
|-------|--------|-------|-----|
| `economy.startingCoins` | 40 | **60** | Bootstraps a viable opening without funding a runaway wall. The opening is bootstrap-fragile: too few starting coins and even Optimal can't establish an economy and dies at W3. |
| `lives.max` | 25 | **12** | The game is decided in the opening + boss waves; with 25 lives a finished build coasts. At 12, opening leaks matter and a perfect run still ends with only a few lives. |
| `waves.scaling.count` | 1.15 | **1.20** | Late waves grow in VOLUME so a static build can't simply absorb them — you must keep reinvesting. |
| `towers.basic.range` (L1/2/3) | 5 / 6 / 7 | **2 / 2.5 / 3** | The biggest single fix. Range 7 covered a third of the map, letting ~6 towers blanket everything. Local coverage means **full path coverage now takes many towers**, which is the whole upgrade-vs-spread vs optimal separation. |
| `towers.strong.range` (L1/2/3) | 2 / 3 / 4 | **1.5 / 2 / 2.5** | Same, for the AoE tower. |
| `towers.strong.aoe.radius` | 2.0 | **1.0** | A 2-tile blast let one AoE tower clear an entire swarm; a tighter blast means late-game volume actually matters. |
| Boss HP (`boss_*.hp`) | 500/300/600 | **≈1.85×** → 925/555/1110 | Bosses (waves 5/10/15) now bleed a few lives even off a completed build. The **final boss is the nail-biter** that turns a perfect run into a *barely* win. |
| Boss speed (`boss_*.speed`) | 0.8/1.8/0.6 | **1.5×** → 1.2/2.7/0.9 | Faster bosses have less time-on-target, so a fraction leaks → the map-symmetric pressure that makes Optimal's win tight on both maps. |

Tower per-coin economics after the retune still make spreading L1s the cheap raw
DPS, but **short range caps how much of the path any one tower defends**, so the
coin-efficient play is to cover the path *then* upgrade the chokepoints — exactly
the live tradeoff we wanted. (`boss_split` is tuned to match but is not used by the
15 shipped patterns.)

---

## 5. Results — the ladder holds on both maps, every seed

Seeds `1, 2, 3, 7`, both maps (the committed test asserts these; wider 30-seed
sweeps during tuning showed the same with zero exceptions).

**map0 — Ribbon** (106-cell path, long & slow — the *easy* map):

| Bot | seed 1 | seed 2 | seed 3 | seed 7 |
|-----|--------|--------|--------|--------|
| Unfocused | loss W3 | loss W3 | loss W3 | loss W3 |
| Spread | loss W11 | loss W11 | loss W11 | loss W11 |
| Save-and-upgrade | loss W14 | loss W15 | loss W15 | loss W14 |
| Optimal | **WIN 8 lv** | WIN 8 lv | WIN 8 lv | WIN 8 lv |

**map1 — Comb** (59-cell path, short & fast — the *hard* map):

| Bot | seed 1 | seed 2 | seed 3 | seed 7 |
|-----|--------|--------|--------|--------|
| Unfocused | loss W3 | loss W3 | loss W3 | loss W3 |
| Spread | loss W8 | loss W8 | loss W8 | loss W8 |
| Save-and-upgrade | loss W14 | loss W14 | loss W14 | loss W14 |
| Optimal | **WIN 5 lv** | WIN 4 lv | WIN 5 lv | WIN 5 lv |

The test also asserts a **monotone separation per seed & map**:
`unfocused < spread < save-and-upgrade < optimal`, which is the machine-checked
statement of "pure Spread under-performs Save-and-upgrade" and the full ladder.

### Honest finding — map asymmetry (not overfit, surfaced by design)

The two shipped maps are *structurally different games*, and a single global config
cannot make them identically hard:

- **Ribbon (map0)** is long, slow, and snakes back on itself, so a tower in a
  "between" row covers two path passes. It has ~76 multi-segment chokepoints and
  long time-on-target → it is the **easy** map. Optimal wins it with a steady **8
  lives**, and Save-and-upgrade dies a hair later (W14–15).
- **Comb (map1)** is short and fast with only ~10 real chokepoints → it is the
  **hard** map. Optimal wins it on a knife-edge (**4–5 lives**), and Spread folds
  earlier (W8).

We deliberately did **not** overfit one map at the other's expense. The thresholds
asserted by the tests (Unfocused ≤ W4; Spread loses W6–14; Save-and-upgrade loses
but reaches ≥ W10; Optimal wins with 1–10 lives) hold on **both** maps for every
tested seed. "Optimal barely wins with a few lives" is tightest on the hard map
(Comb, ~4–5 of 12) and a touch more comfortable on the easy map (Ribbon, 8 of 12) —
that residual gap is intrinsic to the map geometry, not a tuning defect.

One structural ceiling worth noting: once the path is fully covered with L3 towers,
there is nothing left to buy (3 levels, finite tiles), so a perfect Comb run *does*
accumulate surplus coins in the last 1–2 waves. The "always a little short" pressure
is real through ~wave 13; the final couple of waves on the easy map are a solved
wall. Closing that fully would require either more upgrade tiers or per-map tuning
(out of scope here).

---

## 6. Repeated-replay reset — findings

[`tools/tests/replay-reset.test.mjs`](../../tools/tests/replay-reset.test.mjs)
plays **12 full games back-to-back** through the `restart()` / Play-Again path and
asserts a pristine reset at the start of every play, plus seeded-RNG determinism.

**Findings: clean. No reset anomalies.** Every replay starts with
`lives = max`, `coins = starting`, empty `enemies / towers / projectiles /
coinsList / effects`, `wave.index = 1` / `phase = 'prepare'` / empty spawn queue,
all `stats` zeroed, cleared `selected` + `placement`, and `nextId = 1`. A replay
with the **same seed reproduces the game byte-for-byte** (asserted via a full-game
signature, including the per-wave lives trace); a replay with a **new seed yields a
genuinely different game** (no inheritance). This is structural: `restart()` throws
away the old state and rebuilds it from the pure `createInitialState` factory with a
fresh seeded `Rng` and a deep-cloned config, so nothing *can* leak across plays.

---

## 7. Re-tune procedure (when waves/enemies/towers/attacks change)

When new content is added, **start from this doc** and re-run the ladder rather than
eyeballing:

1. **Add the content** (new wave pattern / enemy / tower / attack) in
   `gameConfig.js`. If it adds a new tower type or enemy, sanity-check the bots in
   `tools/balance/policies.mjs` still make sensible choices (the coverage helpers
   are generic, but e.g. a brand-new tower `kind` may want a `chooseType` rule).
2. **Run the ladder** and read where each archetype lands:
   ```bash
   node --test tools/tests/balance-ladder.test.mjs
   ```
   For faster iteration, drive the harness directly across many seeds/maps with a
   throwaway script that imports `CONFIG`, `runGame`, and `POLICIES` (see the
   tables above for the shape of output you want).
3. **Tune in this priority order** (each lever's job, learned here):
   - **Tower range** sets *how local* coverage is → how many towers a full defense
     needs → the spread/save/optimal separation. Tune first.
   - **`lives.max`** sets how punishing leaks are → compresses or widens every
     margin together; it is the master "how forgiving" dial.
   - **`scaling.count`** (and `scaling.hp`) set late-wave demand → whether a
     finished build is threatened late.
   - **Boss HP/speed** bleed lives at waves 5/10/15 → make the win "barely" in a
     **map-symmetric** way (bosses are single enemies, so they don't depend on path
     length the way swarms do — prefer this lever for tightening Optimal's margin).
   - **`startingCoins` / rewards** gate the opening + the income snowball. Beware:
     the opening is bootstrap-fragile — raising L1 *cost* without raising starting
     coins can make even Optimal die at W3.
4. **Targets to re-hit** (what the committed tests assert):
   - Unfocused → lost, `finalWave ≤ 4`.
   - Spread → lost, `6 ≤ finalWave < 15`.
   - Save-and-upgrade → **not a win**, `finalWave ≥ 10`.
   - Optimal → **won all 15**, `0 < lives ≤ 10` and `lives < lives.max`.
   - Monotone: `unfocused < spread < save < optimal` per seed & map.
5. **Keep the guardrails green**: the two reliability gates (boss-wave instant-loss
   across replays; no open-tile wandering) and the repeated-replay reset test must
   pass on their own merit — never weaken them to make a balance test pass. The
   bench fixture counts `{40,12,30}` stay locked so the perf comparison stays
   apples-to-apples (tuning entity *stats* is fine).
6. **Update this doc** (the values table, the results, and any new lever notes) so
   the next person starts from the current reality.
