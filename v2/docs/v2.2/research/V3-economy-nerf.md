# V2.2 Research — V3-economy-nerf

**Work item:** Boss tower is too cheap/strong. Raise its price so it is a deliberate
late-game investment (multiples viable only once coins genuinely pile up), and pull
overall boss power down — with the ultimate's damage/cooldown nerf belonging to the
V2 special-rework + the single post-merge rebalance, not this item.

**Targets (NOT final — tuned by the single rebalance, B6):**
- Boss **L1 buy: 250 -> ~750**
- Boss **L2 upgrade: 300 -> ~500**
- Total to L2 (ultimate unlocked): **550 -> ~1250 (~2.3x)**

Scope is almost entirely `v2/config/gameConfig.js`. This item is a **lever change that
FEEDS the single rebalance** — it cannot land in isolation without breaking the
winnable summit (see Balance Impact / Dependencies).

---

## Current code (cited)

### Boss tower costs — `v2/config/gameConfig.js:263-266`
```js
levels: [
  { damage: 30, range: 34, fireRateMs: 5000, cost: 250, sizeScale: 0.9 },                // L1 ultimate LOCKED
  { damage: 45, range: 34, fireRateMs: 4500, cost: 300, sizeScale: 1.0, ultimate: true }, // L2 ultimate UNLOCKED
],
```
The header comment `gameConfig.js:254-256` already declares the cost/fireRate are
"STARTING POINTS — the single post-merge rebalance (B6) tunes them" — so raising the
costs is design-sanctioned and the comment should be updated to name the new targets.

### Economy block — `v2/config/gameConfig.js:33-48`
```js
economy: {
  startingCoins: 60,
  sellRefundFraction: 0.7,
  firstForkCost: 0,
  reForkCost: 20,
  coin: { lifetimeMs: 15000, warningMs: 5000, collectRadius: 60, expireAnimMs: 800, collectAnimMs: 600 },
},
```

### Late-game income (the lever that gates affordability) — `v2/config/gameConfig.js:66-80`
```js
scaling: { hp: 1.12, speed: 1.03, count: 1.20, reward: 1.08, intervalReduction: 0.95, bossMult: 1.5, capWave: 15, coinReduction: 0.95,
  lateSurge: { fromWave: 9, hp: 1.22, count: 1.02, speed: 1.04 } },   // NOTE: lateSurge does NOT bump reward
```
Boss enemy rewards: `gameConfig.js:155-157` (25/20/30) and the split family
`gameConfig.js:170,178` (boss 15, shards 5).

### Cost is fully data-driven (no magic numbers downstream)
- Bot reads cost from config: `tools/balance/harness.mjs:65`
  `towerCost(type, level = 1) { return this.sim.config.towers[type].levels[level - 1].cost; }`
- Boss-aware reserve/build/upgrade uses `bot.towerCost('boss', ...)`:
  `tools/balance/policies.mjs:246` (place) and `:249` (upgrade) — reads live config, so
  changing the numbers needs **no policy edits for the cost itself**.
- `summitConqueror` = `optimal({ ultimate: true, buildFromWave: 7 })`
  (`tools/balance/policies.mjs:339-345`); the reserve-until-L2 logic is `:244-253`.

### Tests that touch boss cost
- `tools/tests/boss-tower.test.mjs:70` — `assert.ok(b.levels[0].cost >= 200, ...)`.
  A 750 L1 still passes; this floor is too weak to encode the nerf.
- `tools/tests/boss-tower-art.test.mjs:117-118` — hardcodes `cost: 250 / 300`, **but in a
  SYNTHETIC `bossConfig()` clone** (`:109-122`) used only to bake the sprite. It does NOT
  read the real config, so it will **not** break. It is stale duplication worth a note,
  not a blocker.
- `tools/tests/upgrade-curve.test.mjs` operates on `basic`/`strong` only — not the boss.

---

## Concrete change (design-faithful)

**Primary (this item):** in `v2/config/gameConfig.js:265-266` set boss `cost` 250 -> **750**
(L1) and 300 -> **500** (L2). Update the rationale comment at `:254-256` (and `:241-245`)
to state the new "deliberate late-game investment; multiples only once coins pile up"
intent and that B6 owns final tuning.

**REQUIRED companion (same rebalance, or the item is non-shippable):** raise late-game
coin income so a reserving bot can actually reach ~1250. Candidate levers, all in
`gameConfig.js`:
- `waves.scaling.reward` 1.08 -> ~1.12, and/or
- add a `reward` factor to `waves.scaling.lateSurge` (currently absent at `:80`), and/or
- bump public-boss rewards (`:155-157`) and/or split rewards (`:170,178`), and/or
- a modest `economy.startingCoins` / `bossMult`-on-reward nudge.

The "overall power nerf" half (ultimate `damage` 180000 / `cooldownMs` 5000 at
`gameConfig.js:280-281`) is owned by the V2 special-rework + B6 and is deliberately
**out of scope here** beyond flagging the interaction.

---

## Why the companion income bump is REQUIRED (empirical)

Probed the actual sim (seeds 1/7 x maps 0/1):

| Policy | peak coins held (whole run) | coins at summit start |
|---|---|---|
| `optimal` (public) | **845–907** | n/a (won @ W15, ~85 left) |
| `summitConqueror` (reserves + builds boss, casts 5x, **wins summit today**) | **840–857** | 80–97 |

Today's boss costs 550 to L2 and the summit is won with lives to spare (8–9 lives,
5 ultimate casts) — `measure-secret-boss.mjs` Scenario C passes.

**The bot never holds more than ~857 coins.** A 1250 total at the current income would
make the boss unaffordable to even a reserving optimal bot, so Scenario C's
WIN-with-ultimate / LOSE-without **separation would break** (the "WITH" run would no
longer win). Hence the price hike is **inseparable** from a late-game income lift in the
same rebalance. The probe script is at
`scratchpad/probe2.mjs` (transient) — reproduce with `summitConqueror`.

> Note: build is incremental (place at 750, later upgrade for 500), so the bot needs
> 750-at-once then accumulate 500 more — but with peak holdings ~857 and summit-start
> holdings ~90, the post-place accumulation window cannot find another 500 today.

---

## Failing-first tests

1. **`tools/tests/boss-tower.test.mjs` — tighten the cost floor (RED first).**
   Replace the weak `>= 200` (`:70`) with a band that encodes the nerf intent, e.g.
   `assert.ok(b.levels[0].cost >= 700, 'L1 boss is a deliberate late-game investment')`
   and add `assert.ok(b.levels[1].cost >= 450, 'L2 upgrade is a real second sink')` and
   `assert.ok(b.levels[0].cost + b.levels[1].cost >= 1100, 'total-to-ultimate ~1250')`.
   Fails on today's 250/300; passes after the config bump. (kind: unit)

2. **New `tools/tests/economy.test.mjs` case — affordability invariant (RED first).**
   Assert that under `summitConqueror`, the bot successfully reaches a **L2 boss tower**
   (its sole boss tower is at `levels.length`) before the secret wave resolves — proving
   the income economy can actually fund the raised price. Fails if costs rise without an
   income bump. (kind: sim)

3. **`measure-secret-boss.mjs` Scenario C remains the integration gate (must stay GREEN
   after the joint change).** It already asserts WIN-with-ultimate + LOSE-without on
   every map x seed (`:149-161,192-195`). After raising cost + income, re-run; it must
   still report `separates=true` everywhere and `ultCasts >= 1`. This is the canonical
   proof the nerf+income co-tune preserved the winnable summit. (kind: balance)

4. **`tools/tests/balance-ladder.test.mjs` / `balance-curve.test.mjs` — no public-game
   regression.** The boss-unaware ladder bots must still clear/relate as before; the
   income bump must not turn the public game into a cakewalk (anti-coast guard,
   `stars.coinWasteRef` at `:87`). (kind: balance)

---

## Balance impact

- **Boss becomes a true late-game commitment:** 550 -> ~1250 (~2.3x). At today's income
  even a reserving optimal bot peaks at ~857 coins, so without an income lift the boss is
  unbuildable — the nerf is intentionally strong and MUST be paired.
- **Multiples viable once coins pile up:** the companion income bump is sized so ONE boss
  is reachable in the endgame and a SECOND becomes possible only with sustained surplus —
  matching "multiples viable once coins pile up."
- **Anti-coast preserved:** `stars.coinWasteRef = 400` (`:87`) keeps hoard pressure; the
  income bump should be late-weighted (lateSurge.reward) so the opening is unchanged and
  early waves don't flood.
- **Power-nerf interaction:** B6 simultaneously pulls ultimate damage/cooldown down
  (`:280-281`); the cost hike + damage nerf together re-derive the ~2 casts/wave +
  tower-support summit math from the parent brief. This item supplies the COST half.
- **Perf:** zero p95 impact (pure constants; no new objects/draws). V2 p95 < V1 p95
  unaffected.

---

## Files touched

| Path | Change |
|---|---|
| `v2/config/gameConfig.js:265-266` | Boss L1 cost 250->~750, L2 cost 300->~500 (TARGETS) |
| `v2/config/gameConfig.js:254-256, 241-245` | Update rationale comments to the new investment intent + B6 ownership |
| `v2/config/gameConfig.js:66-80` (companion, B6) | Late-game income lift: `scaling.reward` and/or new `lateSurge.reward` so ~1250 is reachable |
| `tools/tests/boss-tower.test.mjs:70` | Tighten cost floor to encode the nerf (failing-first) |
| `tools/tests/economy.test.mjs` | New affordability-invariant sim test (failing-first) |
| `tools/tests/boss-tower-art.test.mjs:117-118` | Optional: refresh stale hardcoded 250/300 in the synthetic clone (cosmetic; not load-bearing) |

## Config keys
- `towers.boss.levels[0].cost` (250 -> ~750)
- `towers.boss.levels[1].cost` (300 -> ~500)
- Companion (B6): `waves.scaling.reward`, `waves.scaling.lateSurge.reward` (new),
  optionally `enemies.boss_*.reward`, `economy.startingCoins`.

## Dependencies
- **Hard-coupled to the single post-merge rebalance (B6):** the cost hike is
  non-shippable alone — it must co-land with a late-game income lift or Scenario C's
  winnable-summit separation breaks (empirically, bot peaks at ~857 < 1250).
- **Coupled to V3-special-rework (single-target beam) + ultimate damage/cooldown nerf:**
  the summit win is re-derived from beam casts + tower support; the cost half here must be
  tuned jointly with those so WITH-ultimate still wins and WITHOUT still loses.
- The bot/policy needs **no cost-specific edits** (data-driven via `towerCost`), but the
  beam/single-target change to `maybeUltimate` + `measure-secret-boss` is a SEPARATE item.

## Parallel-safety
- **Config edits to `towers.boss.levels[*].cost`** conflict with any other item editing the
  same `boss` block (the V3-special-rework ultimate `damage`/`cooldownMs`, and any
  boss-fireRate/range pass) — those touch adjacent lines in the same object, so sequence
  them or hand-merge; treat the boss block as a single-writer region for the rebalance.
- **Income edits to `waves.scaling`** conflict with any wave-scaling/late-surge item.
- **Test files** (`boss-tower.test.mjs`, `economy.test.mjs`) are independent and
  parallel-safe against unrelated items.
- Net: this item is **safe to author in parallel** with non-boss, non-wave-scaling items,
  but **must serialize into the single rebalance** alongside the special-rework and the
  income bump (they all rewrite the boss block / scaling block).
