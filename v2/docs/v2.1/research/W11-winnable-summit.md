# W11 — Winnable Summit (the boss-tower ultimate overturns the unbeatable wall)

**Depends on:** W8 (boss tower + manual full-map ultimate).
**Owns:** the winnable-summit GATE — the tuning + terminal-state + tests that turn the
secret wave-16 split boss from a documented unbeatable wall into a *skill-gated* win,
cleanly separated by whether the player wields the W8 ultimate.

---

## 1. The problem (grounded in current code)

The secret wave-16 boss (`boss_split`, `v2/config/gameConfig.js:163`, on-field HP ≈ 176k
after wave-16 scaling) is an intentional **unbeatable wall**. The best conventional build
lands only ~32k while it crosses the map, so it always reaches the goal (`livesCost: 99`,
a one-shot game-ender) → loss. If it *is* force-killed it splits into 3 shards
(`boss_splitling`, `:167`, `childHp: 40000`, shielded) that finish the path → still loss.

The previous pass **tried and failed** to make this winnable through the FREEZE-pin-the-shards
path and fell back to the wall (documented in `v2/docs/SECRET-WAVE.md:102–169`). The failure
was **structural and map-dependent**:

- The win key was freeze's *dwell advantage* on clustered shards, but that advantage is
  realized through **tower coverage**, which differs wildly between the two maps.
- Map 0 "Ribbon" has so much coverage it kills shards **with or without** freeze (freeze
  never *necessary* → no separation). Map 1 "Comb" can only kill ~≤3k shards even perfectly
  pinned. The required shard-HP band (`>7k` so Ribbon-unpinned fails **and** `<3k` so
  Comb-pinned wins) is **empty** (`SECRET-WAVE.md:147–152`).

**The W11 reversal — the key insight in the brief:** the W8 boss-tower ultimate is a **flat,
full-map-range manual nuke**. Its damage is **map-agnostic** — it lands the *same* on Ribbon
and Comb because it does not flow through tower coverage. That is exactly the property the
freeze-pin lacked. A flat nuke makes the win band non-empty: the parent (and the shards) can
be tuned to die to `build + ultimate casts` on *both* maps, while `build alone` (no ultimate)
can't approach the parent's 176k anywhere → robust, map-independent separation.

A second gap: **clearing wave 16 currently produces no terminal WIN.** `_checkWinLose`
(`v2/sim/Simulation.js:120–136`) only banks the win at wave 15 and is guarded by
`!s.publicWinBanked`, which is already `true` on the summit. `waveSystem.updateComplete`
(`waveSystem.js:203–217`) just idles once `w.index >= patternCount`. So today a *cleared*
summit would hang in `playing`. W11 must add a real **summit-win terminal**.

---

## 2. The concrete change (design-faithful to Jaco's intent)

### 2a. Summit-win terminal state (Simulation + waveSystem) — W11 core

Add a distinct true ending so a *cleared* secret wave is a WIN, without disturbing the banked
public win or the existing summit-loss contract:

- `v2/sim/systems/waveSystem.js` — new export
  `isSummitComplete(state) = state.summitMode && state.wave.phase === 'complete' && state.wave.index >= patternCount(state)`.
- `v2/sim/Simulation.js` `_checkWinLose` (`:120`) — add a branch *after* the loss check and
  *parallel to* the public-win branch:
  ```js
  } else if (s.summitMode && !s.summitWon && waves.isSummitComplete(s)) {
    s.summitWon = true;
    s.status = 'won';                 // the TRUE ending (re-latched in summit only)
    s.bus.emit(EV.SUMMIT_WON, { stats: s.stats });
    s.frameEvents.push({ type: EV.SUMMIT_WON });
  }
  ```
  Critically this emits a **new `SUMMIT_WON` event, NOT `GAME_WON`** — `summit.test.mjs:84`
  asserts `GAME_WON` fires exactly once. The public win stays banked; the summit win is a
  separate, additive terminal.
- `v2/sim/state.js` — add `summitWon: false` beside `summitMode` (`:30`).
- `v2/sim/events.js` — add `SUMMIT_WON: 'summit:won'` beside `SUMMIT_START` (`:47`).

### 2b. Map-agnostic ultimate gate values (the tuning W11 owns)

W8 introduces the boss tower + `castUltimate()` + a `towers.boss.ultimate` config block and a
`bot.castUltimate()/ultimateReady()` helper pair (mirroring freeze: `Simulation.castFreeze`
`:255`, `harness.mjs:163–167`, `state.freeze` `state.js:66`). **W11 sets the gate numbers** in
that block plus the enemy-side levers so the separation holds:

| key | from | to (starting point — rebalance finalizes) | why |
|-----|------|------|-----|
| `towers.boss.ultimate.damage` (W8 block) | — | `60000` flat, **all enemies, full map, ignores shields** | map-agnostic killing blow; `build(~32k) + 3 casts > 176k` cracks the parent |
| `towers.boss.ultimate.cooldownMs` (W8 block) | — | `5000` | ~3 casts during the parent crossing + 1 in the shard phase |
| `towers.boss.ultimate.initialReadyFraction` (W8 block) | — | `1.0` | ready the instant the boss tower is built at the summit (the climax is "press the big button") |
| `enemies.boss_split.behavior.childHp` (`:163`) | `40000` | `22000` | one post-split nuke clears all 3 shards on *both* maps; still **> ~7k** (Ribbon's no-ultimate shard capacity) so the force-kill fail-safe still leaks |
| `enemies.boss_splitling.behavior` (`:167`) | `shield 1800/2600` | shorten to `durationMs: 600` (or have the ultimate ignore shields) | the shielded burst-immunity blocked the win-path nuke last pass (`SECRET-WAVE.md:124`) |

**Left UNCHANGED on purpose:** `boss_split.hp = 24000` (`:163`). The 176k on-field parent is
what makes `build alone` lose on every map — preserving the wall as the *no-ultimate* case and
keeping the existing `measure-secret-boss.mjs` ≥5× no-ultimate margin meaningful (now reframed:
it proves "loses without the ultimate", not "unbeatable forever").

Win path, map-agnostic: build chips the parent (~32k) → ultimate casts crack it (it dies →
splits) → one more full-map nuke (+ build) clears the 3 × 22k shards before any leaks → no leak
= all summit-entry lives intact = **win with lives to spare**. Because `livesCost` is a one-shot
ender (99 / 12 ≥ max lives 12), the outcome is binary: clean clear = win, any leak = instant
loss — an inherently sharp separation.

### 2c. Ultimate-aware optimal bot (policies + harness)

W8 adds `bot.castUltimate()/ultimateReady()` and exposes the boss tower as a placeable type.
W11 adds the policy that *wields* it on the summit, behind a flag so the 15-wave ladder is
untouched (the ultimate never fires on public waves):

- `tools/balance/policies.mjs` — add `maybeUltimate(bot)` (mirrors `maybeFreeze` `:166`):
  during summit mode, ensure the boss tower is built (spend the surplus coin pile), then cast
  the ultimate whenever it's ready and the split boss / any shard is alive on the field.
- Thread an `ultimate = false` option through `optimal({ ... })` (`:216`); call
  `if (ultimate) maybeUltimate(bot)` at the top of `onDecision`. Default `false` keeps
  `balance-ladder` / public gates byte-for-byte identical.

---

## 3. Failing-first tests (the re-flip)

### `tools/tests/secret-wave.test.mjs` — re-flip the wall test

The existing test *"a STRONG player … takes the SUMMIT and CANNOT kill the secret boss"*
(currently asserts `bossKilled === false`, `status === 'lost'`) is **split into two**:

1. **KEEP (no-ultimate still loses):** rename to *"a strong player WITHOUT the boss-tower
   ultimate loses the summit"* — `POLICIES.optimal()` (no ultimate), assert
   `bossReachedGoal === true`, `status === 'lost'`, `publicWinBanked === true`. The wall
   stands for anyone without the new weapon.
2. **NEW (the reversal):** *"a strong player WITH the boss-tower ultimate WINS the summit with
   lives to spare"* — `POLICIES.optimal({ ultimate: true })`, drive through the summit on
   **both maps × seeds [1,7]**, assert `status === 'won'`, a `SUMMIT_WON` event fired,
   `sim.state.summitWon === true`, `bossReachedGoal === false`, **`sim.state.lives > 0`**
   (lives to spare), and `publicWinBanked` still `true`.

The `affinity-neutral`, `splits into weaker shards`, `fork-only no-Freeze margin ≥ 3×`, and
`force-kill fail-safe` tests stay valid as-is (all run **no-ultimate** bots; childHp 22k stays
above the ~7k Ribbon no-ultimate shard capacity so the fail-safe still leaks).

### `tools/balance/measure-secret-boss.mjs` — add the separation scenario

Add **Scenario C — boss-tower ultimate (the win key)**: drive `optimal({ ultimate: true })`
through the summit on both maps × seeds; assert every run reaches `status === 'won'` with
`lives > 0`. Print the WITH-ultimate vs WITHOUT-ultimate outcomes side by side and **fail the
script unless every map/seed separates** (WITH = win, WITHOUT = loss). The existing Scenarios
A/A2/B (no-ultimate margins) stay, reframed in the summary as "the wall the player faces
*without* the ultimate".

### `tools/tests/summit.test.mjs` — unchanged (verify still green)

Its bots carry no ultimate, so `losing the summit keeps the win banked` (`:88`) and
`GAME_WON fires once` (`:84`) both still hold (the new terminal emits `SUMMIT_WON`, not
`GAME_WON`). Add one assertion: a `SUMMIT_WON`-equipped run does not re-emit `GAME_WON`.

---

## 4. Balance impact (feeds the single post-merge rebalance)

The levers `ultimate.damage / cooldownMs / initialReadyFraction` and `boss_split.behavior.childHp`
/ shard shield are the gate's tuning surface. The post-merge rebalance must land them so, on
**both maps × multiple seeds**: `optimal({ ultimate: true })` wins the summit with `lives > 0`,
AND `optimal()` (no ultimate) loses — with the public 15-wave ladder and the no-ultimate
≥5× / ≥3× margins unchanged. The map-agnostic flat nuke makes this band non-empty (the reason
last pass's coverage-driven freeze-pin couldn't close it). Re-run `npm test`, `npm run bench`
(p95 must stay < V1), and `measure-secret-boss.mjs`.

## 5. Captures (observable changes)

- Render-capture of the **SUMMIT CLEARED / true-ending** celebration (the new `SUMMIT_WON`
  state) — distinct from the green public win.
- Render-capture of the ultimate's full-map nuke flash landing on the boss (the VFX itself is
  W8's; the capture proves the win moment).

## 6. Dependencies & parallelism

- **Depends on W8** — needs the boss tower (placeable type the policy can build), `castUltimate()`,
  the `towers.boss.ultimate` config block, and `bot.castUltimate()/ultimateReady()`. W11 cannot
  start until W8's mechanic + helpers exist.
- **Must sequence after / share files with:** W8 and W10 (freeze-cap) both edit
  `gameConfig.js`, `policies.mjs`, `Simulation.js` — heavy overlap; W11 lands after them.
- **Parallel-safe with:** items touching only renderer/art/unrelated systems (e.g. flag-legend
  renderer, text-rounding) — no file overlap.
