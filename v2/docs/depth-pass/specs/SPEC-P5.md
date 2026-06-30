# SPEC-P5 — You won! real win state, quality stars, L3 sprite-fit, opt-in summit

**Status:** Draft (TDD spec)
**Proposal:** PROPOSALS.md → "### P5 — You won! real win state, stars, sprite-fit, and split-boss as an opt-in summit"
**Addresses:** #2 (no win state / no replay drive), #8 (L3 sprite overlap), G5, G7.
**Rough cost:** M — but split into two clearly separable halves:
- **Half A (true standalone S):** real public win at wave 15 + quality-weighted stars + L3 sprite-fit. Ships unconditionally. Depends on NOTHING in P2/P3/P4.
- **Half B (the added M):** opt-in "summit" continue-flow into the secret wave 16. Couples to player power and is tuned/validated against P2/P3/P4 — but the public win NEVER depends on that tuning succeeding (explicit fallback).

---

## 1. Value proposition

Today the game **cannot be won**. `Simulation._checkWinLose` (`v2/sim/Simulation.js:94`) gates the win on `waves.isFinalWaveComplete`, which counts **all 16 patterns** including the deliberately-unbeatable secret split boss (`v2/sim/systems/waveSystem.js:181-183` → `state.wave.index >= patternCount(state)`). So clearing the 15 public waves does not win — the run is force-fed into the wave-16 boss and **always loses**. `status === 'won'` is dead code; the single most important reward in the genre never fires. (Confirmed by the current expectations in `tools/tests/balance-ladder.test.mjs` #4, `tools/tests/secret-wave.test.mjs`, and `tools/tests/playthrough.test.mjs` — all assert `status === 'lost'` at `finalWave === 16`.)

P5:
1. **Turns the public win on** by flipping the last-wave gate from `patternCount` (16) to `publicWaveCount` (15). Clearing the wave-15 `boss_regenerate` now fires a permanent, banked celebration — *it's over, you won.*
2. **Scores 1-3 stars weighted toward decision quality** (fast clears, low coin-hoard, hearts kept — with leftover-lives as the *smallest* weight so the meta goal pulls toward sharp play, not turtling).
3. **Fixes the L3 overlap (#8):** L3 towers bake a 115px body into a 96px tile (`sizeScale: 0.6` → body radius `tile*0.6 = 57.6px` → 115px diameter, ~19px solid overlap). Decouple visual scale from grid footprint by clamping the body radius; express level via the existing rings/badge/glow, not raw body size.
4. **Reframes the secret boss as an opt-in summit:** only *after* the win is banked, an explicit "Try the SUPER boss?" dare resumes play into wave 16 via a new `continueToSummit()` command that **does NOT relatch `status='won'`**. Declining or losing the summit never robs the child of the banked victory.

---

## 2. Files touched + exact changes

### 2.1 `v2/sim/systems/waveSystem.js`
- **`isFinalWaveComplete` (lines 181-183):** change `state.wave.index >= patternCount(state)` → `state.wave.index >= publicWaveCount(state)`. The public win now fires at the last *public* wave (15).
- **`updateComplete` (lines 171-179):** the last-wave gate currently `if (w.index >= patternCount(state)) return;`. Split it by summit mode:
  ```js
  const lastPublic = publicWaveCount(state);
  if (!state.summitMode) { if (w.index >= lastPublic) return; }      // stop at public final; win decided centrally
  else { if (w.index >= patternCount(state)) return; }               // summit: run through the last pattern
  ```
- **`updateActive` (lines 145-169):** on a boss wave completing, emit a distinct boss-defeated signal. After the existing `WAVE_COMPLETE` emit, add:
  ```js
  if (w.isBossWave) {
    const boss = state.config.waves.patterns[Math.min(w.index - 1, patternCount(state) - 1)].boss;
    state.bus.emit(EV.BOSS_DEFEATED, { index: w.index, boss });
    state.frameEvents.push({ type: EV.BOSS_DEFEATED, index: w.index, boss });
  }
  ```
- **New pure export `computeStars`** (or a new `v2/sim/scoring.js`; see 2.6). Recommended: keep it as a standalone pure module to keep `waveSystem` focused.

### 2.2 `v2/sim/Simulation.js`
- **`_checkWinLose` (lines 87-99):** guard the win against the bank flag and compute stars:
  ```js
  } else if (!s.publicWinBanked && waves.isFinalWaveComplete(s)) {
    s.status = 'won';
    s.publicWinBanked = true;                 // permanent — never un-banked, even if the summit is later lost
    s.stars = computeStars({ lives: s.lives, coins: s.coins, elapsedMs: s.stats.elapsedMs }, s.config);
    s.bus.emit(EV.GAME_WON, { stats: s.stats, stars: s.stars });
    s.frameEvents.push({ type: EV.GAME_WON, stars: s.stars });
  }
  ```
  (The `!s.publicWinBanked` guard means the secret wave-16 completion can never re-fire the win in summit mode.)
- **New command `continueToSummit()`** (append to the commands section after `sellSelected`, ~line 172):
  ```js
  continueToSummit() {
    const s = this.state;
    if (!s.config.waves.summit?.enabled) return false;
    if (!s.publicWinBanked || s.summitMode) return false;
    if (waves.publicWaveCount(s) >= waves.patternCount(s)) return false; // no secret wave to climb to
    s.summitMode = true;
    s.status = 'playing';                      // resume; status='won' is NOT relatched, win stays banked
    s.bus.emit(EV.SUMMIT_START, {});
    return true;
  }
  ```
  After this, `updateComplete` (now summit-aware) advances wave 15 → 16 after `betweenWaveMs`.

### 2.3 `v2/sim/state.js`
- Add three fields to the returned state (near `status`, line 28):
  ```js
  publicWinBanked: false,   // set once when the public wave-15 win fires; never cleared mid-run
  summitMode: false,        // true after continueToSummit(); allows advancing into the secret wave(s)
  stars: 0,                 // 1-3 quality stars, set at win
  ```
  (`createInitialState` is the single reset path, so Restart/New-Game zero these automatically — no leak.)

### 2.4 `v2/sim/events.js`
- Add to `EV` (after `GAME_LOST`, line 40):
  ```js
  BOSS_DEFEATED: 'boss:defeated',
  SUMMIT_START: 'summit:start',
  ```

### 2.5 `v2/render/SpriteCache.js`
- **`tower()` (line 78):** clamp the body radius to the footprint cap so the drawn body fits its tile:
  ```js
  const cap = this.cfg.towers.footprintScaleCap;
  const r = this.tile * Math.min(st.sizeScale, cap);
  ```
  Pad/halo math (line 79) is unchanged (halo may extend past the cell — only the solid body is clamped). Level differentiation stays expressed by the existing L2/L3 rings (lines 100-103), rank badge (106-111), glow halo (84-90) and L3 sparkles (114-118). Pure renderer/bake change — zero sim, zero per-frame cost.

### 2.6 `v2/sim/scoring.js` (NEW, pure)
```js
// Quality-weighted star scoring. Weighted toward decision quality (fast clears,
// low coin-hoard) over pure leftover lives, so the meta goal pulls toward sharp
// play, not turtling. Pure: takes primitives + config, returns 1-3.
export function computeStars({ lives, coins, elapsedMs }, config) {
  const c = config.waves.stars;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const livesFrac = clamp01(lives / c.livesRef);              // survival (smallest weight)
  const speedFrac = clamp01(c.parClearMs / Math.max(1, elapsedMs)); // >=1 at/under par
  const wasteFrac = clamp01(1 - coins / c.coinWasteRef);      // low hoard -> high score
  const q = c.weights.lives * livesFrac
          + c.weights.speed * clamp01(speedFrac)
          + c.weights.waste * wasteFrac;
  let stars = 1;                                              // winning is the floor: always >=1
  if (q >= c.twoStarScore) stars = 2;
  if (q >= c.threeStarScore) stars = 3;
  return stars;
}
```

### 2.7 `v2/render/Renderer.js`
- **`_overlay` (lines 655-683):** on `won`, render `state.stars` as 1-3 star glyphs above the report card title, and full-confetti (reuse `effectsEnabled`/`FX`). When `state.publicWinBanked && state.config.waves.summit?.enabled && !state.summitMode`, add a **"Try the SUPER boss?"** secondary button via `addHit('continueSummit', …)` below "Play Again".
- When `status==='lost' && state.publicWinBanked`, soften the lose copy ("You won! …and gave the SUPER boss a great try") so a failed summit never reads as a loss of the banked win.
- `this.publicWaves` (line 29) is unchanged (still excludes secret) — HUD "/15" denominator stays correct.

### 2.8 `v2/input/InputController.js`
- **`_dispatch` (lines 55-68):** add `case 'continueSummit': sim.continueToSummit(); break;`

### 2.9 `v2/app/GameApp.js`
- Subscribe to `EV.BOSS_DEFEATED` / `EV.GAME_WON` for confetti/banner SFX if the audio bridge wants them (optional, additive). No sim coupling.

---

## 3. New `gameConfig.js` keys

Under `waves` (after `scaling`, ~line 59):
```js
stars: {
  parClearMs: 240000,        // "par" total elapsed for a fast 15-wave clear; faster -> higher speed score
  coinWasteRef: 400,         // hoarded coins at/above this == max waste (0 score) — "spend it" pressure
  livesRef: 12,              // survival denominator (== lives.max)
  weights: { lives: 0.25, speed: 0.35, waste: 0.40 }, // lives is the SMALLEST -> anti-turtle, quality dominates
  twoStarScore: 0.45,
  threeStarScore: 0.75,
},
summit: {
  enabled: true,             // master switch for the opt-in continue flow; false -> public win is the end
  dareText: 'Try the SUPER boss?',
},
```

Under `towers` (top-level of the towers block, ~line 116):
```js
footprintScaleCap: 0.46,     // max body radius as a fraction of a tile -> body diameter 0.92*tile, fits 96px cell
footprintMargin: 0.06,       // required clear gap (fraction of tile) the sprite-fit test enforces
```

---

## 4. TDD plan — the FAILING tests to write FIRST

Order: write these red, then implement §2/§3 to green. Behaviour → timing → logic → balance.

### NEW `tools/tests/win-state.test.mjs`
1. **`public win fires at wave 15, not wave 16`** *(sim)* — fast-config full game with a heavy L3 loadout (clone the `playthrough.test.mjs` SHORT_MAP/`fastConfig` loadout). Assert `status === 'won'`, `wave.index === 15`, `stats.wavesCleared === 15`, and the run NEVER reaches `wave.index === 16`. Before the fix this is `lost@16`.
2. **`GAME_WON fires exactly once and carries stars`** *(unit/sim)* — subscribe to `EV.GAME_WON`; tick a heavy run to terminal; assert the handler fired exactly once and the payload has integer `stars` in `[1,3]`, and `state.publicWinBanked === true`.
3. **`isFinalWaveComplete is keyed to publicWaveCount, not patternCount`** *(unit)* — construct a sim, force `wave.phase='complete'`, `wave.index = waves.publicWaveCount(state)` and assert `waves.isFinalWaveComplete(state) === true`; set `wave.index = publicWaveCount-1` and assert `false`. Guards against accidental re-coupling to `patternCount`.
4. **`BOSS_DEFEATED fires on every public boss wave (5/10/15)`** *(sim)* — collect `frameEvents` of type `EV.BOSS_DEFEATED` across a winning heavy run; assert the set of `index` values is exactly `{5,10,15}` and each carries the matching `boss` id (`boss_shield`/`boss_speed`/`boss_regenerate`).

### NEW `tools/tests/stars.test.mjs`
5. **`stars reward sharp play over turtling`** *(unit)* — call `computeStars` directly. A **turtle** run (`lives: 12`, slow `elapsedMs: 2*parClearMs`, hoarded `coins: coinWasteRef`) must score **strictly fewer** stars than a **sharp** run (`lives: 6`, fast `elapsedMs: 0.5*parClearMs`, low `coins: 0`) — proving lives is not the dominant axis.
6. **`stars are clamped to 1..3 and winning is the floor`** *(unit)* — worst legal inputs (`lives:0, coins:huge, elapsedMs:huge`) → `1`; best (`lives:livesRef, coins:0, elapsedMs:1`) → `3`; an intermediate input lands on `2`. Assert integer and range for a spread of inputs.

### NEW `tools/tests/summit.test.mjs`
7. **`continueToSummit resumes into wave 16 without relatching won`** *(sim)* — win a heavy run (status `won`, banked). Call `sim.continueToSummit()` → returns `true`; assert `status === 'playing'`, `summitMode === true`, `publicWinBanked` still `true`. Tick until terminal; assert the run reaches `wave.index === 16` and that `EV.GAME_WON` did NOT fire a second time (subscribe and count).
8. **`losing the summit keeps the win banked`** *(sim)* — after `continueToSummit`, let the unbeatable wave-16 boss reach the goal; assert final `status === 'lost'` but `publicWinBanked === true` (the victory is never revoked).
9. **`summit is opt-in: a won run that never continues stays won at wave 15`** *(sim)* — win, do NOT call `continueToSummit`, tick another 30s of sim time; assert `status` stays `won`, `wave.index` stays `15`, never advances. Proves the standalone win does not depend on the summit.
10. **`continueToSummit is a no-op before the win is banked`** *(unit)* — fresh playing sim → `continueToSummit()` returns `false`, `summitMode` stays `false`, `status` unchanged.

### NEW `tools/tests/sprite-fit.test.mjs`
11. **`every tower level body fits inside its tile`** *(unit)* — config-driven invariant (no canvas needed): for each `type` in `CONFIG.towers` and each level, `2 * Math.min(level.sizeScale, CONFIG.towers.footprintScaleCap) <= 1 - CONFIG.towers.footprintMargin`. Before the cap this fails for L3 (`2*0.6 = 1.2 > 0.94`).
12. **`the cap actually binds the L3 footprint`** *(unit)* — assert `CONFIG.towers.basic.levels[2].sizeScale > CONFIG.towers.footprintScaleCap` (the cap is doing real work, not vacuous).

### UPDATED existing tests (balance parity — see §6)
13. **`tools/tests/balance-ladder.test.mjs` #4** — flip OPTIMAL from `lost@16` to **won@15**: `status === 'won'`, `finalWave === 15`, `wavesCleared === 15`; keep the "barely / lost some lives" lives-at-15 assertions. Update `depth()` in #5 so a `won` outranks any loss (already encoded; verify optimal now scores via the win branch).
14. **`tools/tests/secret-wave.test.mjs`** — the "STRONG player reaches wave 16 and CANNOT kill the boss" test (lines 95-108) must now drive the summit: after the public win, call `continueToSummit()` (add a `summit:true` option to `strongRun`) so the run still reaches wave 16; assert `bossReachedGoal === true`, `status === 'lost'`, AND `publicWinBanked === true`. The hidden-count and split-failsafe tests are unchanged.
15. **`tools/tests/playthrough.test.mjs` DoD#2** (lines 33-64) — the heavy-loadout full game now asserts `status === 'won'`, `wave.index === 15`, `wavesCleared === 15` (was `lost@16`); add a separate assertion that with `continueToSummit()` the same build reaches wave 16 and loses (the secret boss stays unbeatable).

---

## 5. Implementation outline

1. **Red:** write tests 1-12 (new files) + flip expectations in tests 13-15. Run `npm test` — confirm the new/updated assertions fail for the documented reasons.
2. Add `EV.BOSS_DEFEATED` / `EV.SUMMIT_START` (`events.js`).
3. Add `publicWinBanked`/`summitMode`/`stars` to `state.js`.
4. Add `waves.stars` + `waves.summit` + `towers.footprintScaleCap`/`footprintMargin` to `gameConfig.js`.
5. Create `v2/sim/scoring.js` with `computeStars` → green tests 5-6.
6. Flip `isFinalWaveComplete` to `publicWaveCount`; make `updateComplete` summit-aware; emit `BOSS_DEFEATED` in `updateActive` → green tests 1,3,4.
7. Wire `_checkWinLose` (bank + stars + payload) and add `continueToSummit()` to `Simulation.js` → green tests 2,7,8,9,10 + 13-15.
8. Clamp body radius in `SpriteCache.tower()` → green tests 11-12.
9. Renderer: stars + confetti on the win card, summit dare button, softened post-summit-loss copy; InputController `continueSummit` dispatch.
10. **Balance parity:** add a `continueToSummit` option to `harness.mjs` `drive()`/`runGame` and update `measure-secret-boss.mjs` to opt into the summit (§6).
11. Run `npm test` (all green), `npm run bench` (p95 < V1), regenerate captures (§7).

---

## 6. Balance-harness parity deliverable

Turning the win on at wave 15 means a strong/optimal bot now **terminates with a win at wave 15 and never reaches wave 16** — which would silently break `measure-secret-boss.mjs` (it could no longer measure the wave-16 boss at all) and the 7.2x margin would stop measuring the real game. Required parity work, IN THIS CHANGE:

- **`tools/balance/harness.mjs` `drive()` (lines 140-172) + `runGame` (177-183):** add an option `continueToSummit: false`. In the loop, when `status` becomes `'won'` and the option is set, call `sim.continueToSummit()` once and keep driving (do not break on the win); otherwise terminate on win as today. Return `summitReached`/post-win wave in the summary.
- **`tools/balance/measure-secret-boss.mjs` (`runInstrumented`, lines 42-57):** opt into the summit (call `sim.continueToSummit()` on the win) so Scenario A still reaches and measures the wave-16 boss. Scenario B (synthetic huge-lives line) already never wins the public game in the normal sense — verify it still reaches wave 16; if the public win now short-circuits it, give it the same `continueToSummit()` call.
- **`tools/tests/balance-ladder.test.mjs`:** #4 expectation flips to won@15 (test 13). The 15-wave difficulty curve and config are **unchanged** — P5 changes no enemy/tower/economy numbers, so no rebalance is needed; only the terminal expectation moves. This keeps the ladder honestly measuring the same game.
- **Summit tuning (Half B) parity:** the actual re-measurement of the 7.2x margin with a **freeze-/fork-aware optimal bot** is owned by P3/P4 (they add the Freeze/fork levers + bot policy). P5 supplies the harness summit-drive path those measurements run through. **Fallback honored:** if the margin can't tune between "still a wall" and "buy-the-win," the public win still ships and the summit stays an aspirational endless hook — no config change to the public game.

---

## 7. Captures (before/after)

Run `tools/harness/captureAll.mjs` (and `captureAnim.mjs` where animated). Land under `v2/captures/after-p5/` with matching `before/` from current `main`:
- **Win screen:** before = forced `lost@16` overlay; after = full-confetti "You did it!" card with 1-3 stars rendered.
- **L3 sprite-fit:** before = three adjacent L3 towers showing ~19px overlap; after = same layout, bodies contained in their tiles, level still legible via rings/badge/glow.
- **Boss-defeated banner:** capture the distinct banner after clearing wave 5.
- **Summit dare + continue:** capture the "Try the SUPER boss?" button on the banked-win card, and the wave-16 board reached after tapping it (extend `v2/captures/secret-wave/`).

---

## 8. Completion criteria (the gate)

1. All new tests (1-12) green; updated tests (13-15) green; full `npm test` green.
2. `npm run bench` p95 < V1 p95 on the locked `CONFIG.bench.fixture` (P5 is sim-light + a pure renderer clamp; expect no regression).
3. Captures regenerated and committed (§7), before/after for every observable change.
4. `node tools/balance/measure-secret-boss.mjs` runs end-to-end via the summit path and still reports the wave-16 boss measurement (margin still measured on the real game).
5. The standalone win (Half A) is demonstrably independent of summit tuning: test 9 proves a won run never depends on `continueToSummit`, and `waves.summit.enabled === false` leaves the public win fully intact.

---

## 9. Dependencies on other specs

- **P2, P3, P4 — Half B ONLY (the summit tuning).** WHY: the boss-tower verdict and split-boss win path gate the wave-16 win on *skillful use* of P2 affinity + P3 Freeze + P4 fork. The re-measurement of the 7.2x margin with a freeze-/fork-aware bot cannot happen until those levers exist. **Half A (public win + stars + sprite-fit) depends on none of them** and ships first/standalone. The fallback (PROPOSALS.md Split-Boss Win Path) guarantees the public win never waits on P2/P3/P4.
