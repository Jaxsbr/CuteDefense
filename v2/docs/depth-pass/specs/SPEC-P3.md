# SPEC-P3 — I have a job in the fight: kid-safe tower nap + one active Freeze (split-boss key)

**Status:** TDD implementation spec (write tests first)
**Source proposal:** `v2/docs/depth-pass/PROPOSALS.md` → "### P3 —" (+ Boss-Tower Verdict, Split-Boss Win Path)
**Hard constraints honored:** static GitHub Pages / plain ES modules / no build step; pure seeded headless sim; every constant in `gameConfig.js`; perf below V1 p95; charming + legible for ages 5–10.

---

## 1. Value proposition

Today towers are immortal and combat is a spectator sport: once a build is down the player can only watch a boss eat lives. P3 adds the two missing levers of agency, both kid-safe and both pure-timing (never dexterity):

1. **Recoverable tower "nap" (the risk axis).** A specific silly enemy (`disabler`) fires a telegraphed "sleepy beam" at its nearest tower, which briefly stops firing under a "zzz" bubble with a visible wake-up countdown, then auto-recovers. An **anti-stun-lock governor** (post-wake immunity) guarantees a tower can never be chain-napped, and a "never near a leak" path-fraction guard keeps the nap away from the goal. This makes *where* you place towers a real decision (placing safely out of the way is no longer free) while preserving the cozy "my towers can't be destroyed, they just nap" tone. "Kill the disabler first" is **discoverable, not load-bearing** — the game never requires a 5-year-old to learn it.

2. **One active ability — field FREEZE (the skill key).** A single precious-cooldown button: tap → all alive enemies slow to a crawl for ~2.5s, **no aim** (the safest one-tap for the youngest). It is dual-use — cast offensively to bunch enemies into an AoE kill-zone, or defensively to stop an imminent leak — so "when do I press it?" is a genuine judgment of the current board, not a scripted button. It is **the primary skill path** to the wave-16 split boss (pin all 3 shards in the kill-zone, then burst) — but it must **dent, not delete** the public bosses (waves 5/10/15), validated by re-running `measure-secret-boss.mjs` with a freeze-aware optimal bot *in this same change*.

Both reuse exactly one slow mechanism in `effectiveSpeed()` (P4's Froster will share the same field), and reintroduce a "first-placement" novelty beat mid-run (pays down hook-decay).

---

## 2. Exact files + changes (with anchor lines)

### 2.1 `v2/sim/events.js` — new event names
Add to the `EV` object (after `TOWER_SELL`, line 33, and before `GAME_WON`):
```js
TOWER_STUN:   'tower:stun',      // disabler nap landed { towerId, untilClock, durationMs }
TOWER_WAKE:   'tower:wake',      // nap recovered { towerId }
DISABLER_BEAM:'enemy:disablerBeam', // telegraph wind-up started { enemyId, towerId, fireAtClock }
FREEZE_CAST:  'ability:freeze',  // freeze field cast { activeUntil, durationMs }
```
WHY: the headless tests assert on `state.frameEvents` (see `events.js:1-6` doc) and the browser audio/effect layers subscribe; no sim internals are reached.

### 2.2 `v2/sim/state.js` — freeze ability state + tower nap fields
`createInitialState` (factory at line 14). Add a top-level `freeze` block to the returned object (near `selected`/`placement`, line 61):
```js
freeze: {
  // first cast available after a fraction of the cooldown (clock starts at 0).
  readyAt: cfg.freeze.cooldownMs * cfg.freeze.initialReadyFraction,
  activeUntil: 0,
},
```
WHY: state must be reset by the pure factory so nothing leaks across plays/restarts (`state.js:1-9`); `restart()`/`toMenu()` already re-call the factory (`Simulation.js:36-49`).

Tower nap fields are initialized in `towerSystem.placeTower` (see 2.5), not here.

### 2.3 `v2/sim/systems/enemySystem.js` — disabler behavior + freeze-aware speed
- `spawnEnemy` (line 17): extend the `bs` scratch object (line 41) so disablers carry beam state:
  ```js
  bs: { /* …existing… */ , napCdAt: 0, beamTowerId: null, beamFireAt: 0 },
  ```
  and stagger the first nap off the clock like shield/speed (after line 45):
  ```js
  if (enemy.behavior?.type === 'disabler') enemy.bs.napCdAt = state.clock + enemy.behavior.cooldownMs;
  ```
- `updateBehavior` (line 52): add a `case 'disabler':` that runs the two-phase telegraph→nap state machine using `state.config.nap`:
  - **Idle→telegraph:** when `state.clock >= bs.napCdAt`, the enemy is alive, and it is **not past the leak guard** (`e.pathIndex <= last * cfg.nap.maxPathFraction`), call `nearestEligibleTower(state, e)`; if one is found set `bs.beamTowerId = t.id`, `bs.beamFireAt = state.clock + cfg.nap.telegraphMs`, emit `EV.DISABLER_BEAM`.
  - **Telegraph→nap:** when a beam is pending and `state.clock >= bs.beamFireAt`, re-find the tower; if it still exists and is eligible (`state.clock >= tower.stunImmuneUntil`), set `tower.stunnedUntil = state.clock + cfg.nap.durationMs`, `tower.stunImmuneUntil = tower.stunnedUntil + cfg.nap.immunityMs`, emit `EV.TOWER_STUN`. Then clear the beam and set `bs.napCdAt = state.clock + b.cooldownMs`.
- New module-private helper `nearestEligibleTower(state, e)`: iterate `state.towers`, pick the min-`dist2(e, tower)` tower with `state.clock >= (tower.stunImmuneUntil||0)` and `state.clock >= (tower.stunnedUntil||0)`; respect `cfg.nap.beamRange` (skip towers beyond `beamRange²`; `beamRange<=0` means whole-map nearest). O(towers) per disabler — cheap.
- `effectiveSpeed` (line 77): change signature to `effectiveSpeed(state, e)` and fold in the shared freeze field as a multiplicative term so P4's per-enemy slow can layer in later:
  ```js
  function effectiveSpeed(state, e) {
    let v = e.baseSpeed;
    if (e.behavior?.type === 'speed' && e.bs.speedActive) v *= e.behavior.multiplier;
    if (state.clock < state.freeze.activeUntil) v *= state.config.freeze.slowMult; // SHARED slow field (P4 Froster reuses)
    return v;
  }
  ```
  Update the one caller, line 97: `e.progress += effectiveSpeed(state, e) * dt / 1000;`

WHY: enemies have zero tower interaction today, so the disabler adds the new nearest-tower query + governor + telegraph state the proposal calls out; `effectiveSpeed` is the single redefinition of "all on-screen enemies" into sim-space (all alive enemies via a global flag), per the feasibility note.

### 2.4 `v2/sim/systems/towerSystem.js` — napping towers skip firing + wake
- `placeTower` (line 30): add nap fields to the tower object:
  ```js
  stunnedUntil: 0, stunImmuneUntil: 0, napWoken: true,
  ```
- `update` (line 107): inside the per-tower loop, after decrementing timers (after line 113) and before reading `levelStats`, handle wake + skip:
  ```js
  if (tower.stunnedUntil > state.clock) {            // napping: do not target/fire
    tower.napWoken = false;
    continue;
  }
  if (!tower.napWoken) {                              // first tick after recovery
    tower.napWoken = true;
    state.bus.emit(EV.TOWER_WAKE, { towerId: tower.id });
    state.frameEvents.push({ type: EV.TOWER_WAKE, towerId: tower.id });
  }
  ```
  `continue` skips targeting and the fire block (lines 117-129), so a napping tower lands zero projectiles. Its cooldown is frozen (not decremented) during the nap, so it does not dump a volley the instant it wakes.

WHY: `stunnedUntil` tick → skip firing is the exact mechanic in the proposal; emitting `TOWER_WAKE` once gives the renderer/audio the wake-up beat.

### 2.5 `v2/sim/Simulation.js` — castFreeze command
Add a command (after `sellSelected`, line 172):
```js
castFreeze() {
  const s = this.state;
  if (s.status !== 'playing') return false;          // illegal while paused/planning/menu/won/lost
  if (s.clock < s.freeze.readyAt) return false;      // on cooldown
  const f = this.config.freeze;
  s.freeze.activeUntil = s.clock + f.durationMs;
  s.freeze.readyAt = s.clock + f.cooldownMs;
  s.bus.emit(EV.FREEZE_CAST, { activeUntil: s.freeze.activeUntil, durationMs: f.durationMs });
  s.frameEvents.push({ type: EV.FREEZE_CAST, activeUntil: s.freeze.activeUntil });
  return true;
}
```
Import `EV` is already present (line 9). WHY: this is the public command the input layer (and the freeze-aware bot) drives, mirroring the existing status-gated command shape.

### 2.6 `v2/config/gameConfig.js` — new keys (see §3)

### 2.7 `tools/balance/harness.mjs` — Bot.freeze()
Add to `Bot` (after `sell`, line 129):
```js
freeze() { return this.sim.castFreeze(); }
freezeReady() { return this.sim.state.clock >= this.sim.state.freeze.readyAt; }
freezeActive() { return this.sim.state.clock < this.sim.state.freeze.activeUntil; }
aliveEnemies() { return this.sim.state.enemies.filter(e => e.alive && !e.reachedGoal); }
```
WHY: policies act only through the Bot's command-API actions (`harness.mjs:43-130`).

### 2.8 `tools/balance/policies.mjs` — freeze-aware optimal
Extend `optimal` (line 123) so `onDecision` *also* decides freeze deterministically (no `Math.random`): cast when `bot.freezeReady()` and EITHER (offensive) ≥ `cfg.freeze.botBunchCount` alive enemies sit within `cfg.freeze.botBunchRadius` tiles of any tower's kill-zone, OR (defensive) a boss/enemy is within the last `cfg.nap.maxPathFraction` of the path (imminent leak). The placement/upgrade logic is unchanged. Keep a `freeze` option default-on so `unfocused/spread/saveUpgrade` stay freeze-free (their tiers must not improve).

WHY: the proposal mandates the validation run with a *freeze-aware* optimal bot, "otherwise the 7.2x figure measures the old game."

### 2.9 `tools/balance/measure-secret-boss.mjs` — re-measure with freeze
Scenario A (line 60) already uses `POLICIES.optimal()`; once 2.8 lands it is freeze-aware automatically. Add a printed line for `freezeCasts` and assert in the summary that the boss is still unbeatable (margin > `nap`-independent threshold ≥ 5x). WHY: the parity deliverable — the re-measured margin must be recorded, not asserted.

### 2.10 Renderer (observable layer, perf-free) — out of pure-sim, captured not unit-tested
`v2/render/Renderer.js` + `SpriteCache.js`: draw the "zzz" bubble + integer wake countdown over a napping tower (`tower.stunnedUntil`), the disabler's sleepy-beam telegraph line during the wind-up (`bs.beamTowerId`/`bs.beamFireAt`), an ice/frost field tint while `clock < state.freeze.activeUntil`, and a freeze HUD button with a cooldown sweep from `state.freeze.readyAt`. These are validated by before/after captures (§8), not node tests.

---

## 3. New `gameConfig.js` keys

Add two top-level blocks (alongside `combat`, line 144) and one enemy + wave authoring:

```js
// --- Active ability: field Freeze (one slow mechanism; P4 Froster reuses it) ---
freeze: {
  durationMs: 2500,          // enemies crawl this long
  cooldownMs: 32000,         // precious cooldown
  initialReadyFraction: 0.33,// first cast ready after ~33% of a cooldown
  slowMult: 0.18,            // speed multiplier while frozen (slow, never 0 → never a hard stun-lock on enemies)
  botBunchCount: 4,          // freeze-aware bot: cast offensively when >= this many enemies cluster
  botBunchRadius: 1.5,       // tiles, clustering radius for the bot's offensive trigger
},
// --- Recoverable tower nap (disabler) + anti-stun-lock governor ---
nap: {
  durationMs: 2500,          // how long a tower naps
  immunityMs: 6000,          // post-wake immunity — the anti-stun-lock governor
  telegraphMs: 900,          // sleepy-beam wind-up before the nap lands (telegraph)
  maxPathFraction: 0.7,      // disabler won't nap once past 70% of the path ("never near a leak")
  beamRange: 4,              // tiles; nearest-tower query radius (<=0 = whole-map nearest)
},
```

`enemies` block (line 90): add the silly disabler (non-boss, gentle):
```js
disabler: { name: 'Sleepy', shape: 'circle', ...PALETTE.enemies.fast, speed: 1.0, hp: 70, size: 0.75, reward: 4, livesCost: 1, animSpeed: 1.1, behavior: { type: 'disabler', cooldownMs: 7000 } },
```
(Reuses an existing palette entry to avoid a new art dependency in sim; renderer gives it a sleepy-cap glyph.)

`waves.patterns` (line 61): author **one** disabler into a small number of mid waves (proposed: index 7 and 12) as an extra group, e.g. wave 7 gains `{ type: 'disabler', count: 1, formation: 'single' }`. This keeps `patterns.length === 16` and `publicWaveCount === 15` (secret-wave test stays green) but introduces the new lever — its presence forces the balance retune in §6.

`visual.anim` (line 167): light cosmetic timers (renderer only):
```js
napZzzMs: 2500,            // zzz bubble lifetime (mirrors nap.durationMs for the renderer)
freezeTintMs: 2500,        // frost overlay lifetime (mirrors freeze.durationMs)
```

`bench.fixture` (line 178): extend so the locked bench exercises the new per-tick work — add `disablers: 2` and a scripted freeze cast cadence (see §6). p95 must stay < V1.

---

## 4. Failing tests to write FIRST (names + precise assertions)

All use the existing patterns from `tools/tests/sim.test.mjs` (`SHORT_MAP`, `makeConfig`, `advance`, `placeViaPopup`). Write them RED before any sim change.

### 4.1 `tools/tests/tower-nap.test.mjs` (new) — kind: unit
1. **"disabler naps its NEAREST eligible tower, not a far one"** — On `SHORT_MAP`, place a basic tower adjacent to the path near the start and a second one farther along; spawn a single `disabler`; `advance` past `nap.telegraphMs` after its first `napCdAt`. Assert the nearer tower has `stunnedUntil > state.clock` and a `frameEvents`/bus `TOWER_STUN` fired with `towerId === near.id`; assert the far tower's `stunnedUntil === 0`.
2. **"a napping tower fires ZERO projectiles, then resumes after recovery"** — With an enemy walking in range of a stunned tower, capture `PROJECTILE_FIRE` events: assert **none** carry `towerId === napped.id` while `state.clock < stunnedUntil`; after advancing past `stunnedUntil`, assert a `TOWER_WAKE` fired once and subsequent `PROJECTILE_FIRE` from that tower resumes.
3. **"governor: a freshly-woken tower is immune for nap.immunityMs (no chain-nap)"** — After a nap recovers, assert `tower.stunImmuneUntil > state.clock`; drive a second disabler beam attempt inside the immunity window and assert the tower is NOT re-stunned (`stunnedUntil` unchanged, no new `TOWER_STUN` for it). After `immunityMs` elapses, a beam CAN re-nap it.
4. **"telegraph precedes the nap by nap.telegraphMs"** — Assert `DISABLER_BEAM` fires at `beamFireAt - telegraphMs` and that the targeted tower is still firing (not yet `stunnedUntil`) during the telegraph window; the stun lands only at/after `beamFireAt`.
5. **"never near a leak: a disabler past nap.maxPathFraction starts no beam"** — Force the disabler's `pathIndex` beyond `last * maxPathFraction`; advance a full cooldown; assert no `DISABLER_BEAM`/`TOWER_STUN` emitted and all towers keep `stunnedUntil === 0`.

### 4.2 `tools/tests/freeze.test.mjs` (new) — kind: unit + sim
6. **"castFreeze slows ALL alive enemies via effectiveSpeed"** — Two identical sims, seed-matched; one casts freeze at t0, one does not. Spawn an enemy; advance `freeze.durationMs`; assert the frozen sim's enemy advanced strictly less (its `pathIndex*1 + progress` smaller), within the ratio implied by `slowMult` (±1 step tolerance). Assert `FREEZE_CAST` emitted with `activeUntil === clock + durationMs`.
7. **"freeze respects cooldown and the ~33% initial ready"** — At `clock === 0`, `castFreeze()` returns `false` (initial ready is a fraction of cooldown, not immediate). Advance to `cooldownMs*initialReadyFraction`; `castFreeze()` returns `true`. Immediately re-cast → `false`. Advance `cooldownMs`; `castFreeze()` → `true`.
8. **"freeze is illegal unless playing"** — With `state.status` set to `'paused'` (and `'menu'`), `castFreeze()` returns `false` and `freeze.activeUntil` is unchanged. WHY: pins the P1 command-legality dependency.
9. **"freeze DENTS but does not DELETE a public boss"** — On a boss wave (`boss_shield`), cast freeze repeatedly whenever ready while the boss crosses a real map; assert the boss is never killed by freeze alone (freeze deals no damage), still reaches the goal, and still deducts its `livesCost` (slowed, not removed). This is the "must dent, not delete" guard.
10. **"freeze composes multiplicatively with a speed boss (single slow field)"** — A frozen `boss_speed` during its `speedActive` window moves slower than the same boss unfrozen during `speedActive` (proves the field is one shared multiplier in `effectiveSpeed`, the seam P4's Froster reuses).

### 4.3 `tools/tests/freeze-balance.test.mjs` (new) — kind: balance/sim
11. **"freeze-aware optimal still masters all 15 known waves with the disabler authored in"** — Run `POLICIES.optimal()` (now freeze-aware) across seeds [1,7] × maps [0,1] through `runGame`; assert `wavesCleared === 15` and `perWaveLives[15] > 0` (the disabler nap + freeze net out to a barely-win, not a regression). Mirrors `balance-ladder.test.mjs:74`.
12. **"freeze increases damage landed on the secret boss but does NOT kill it"** — Two instrumented runs to wave 16 (freeze-aware optimal vs a freeze-disabled optimal via `POLICIES.optimal({ freeze:false })`): assert the freeze-aware run lands **strictly more** damage on `boss_split` (`maxHp - minHp`), yet `bossKilled === false` and `status === 'lost'` in both — the margin shrinks but the boss stays unbeatable until P5 tunes the summit. WHY: this is the in-test form of the `measure-secret-boss.mjs` parity deliverable; keeps `secret-wave.test.mjs` honest.

### 4.4 Render capture — kind: render-capture
13. **"nap + freeze visuals render"** — A `tools/harness/visualCheck.mjs`/`captureAnim.mjs`-driven capture asserting a frame is produced showing (a) a zzz bubble + countdown over a napped tower, (b) the disabler beam telegraph, (c) the frost field during freeze. Output under `v2/captures/`. (Asserts capture produced + non-empty; visual correctness is human-reviewed via §8.)

---

## 5. Implementation outline (after tests are RED)

1. Add `EV.*` names (2.1) and `state.freeze` (2.2); run test 7/8 → still red on `castFreeze`.
2. Add `castFreeze` (2.5) + `freeze` config (3) → tests 6,7,8 green.
3. Thread freeze into `effectiveSpeed(state,e)` and its caller (2.3) → tests 6,10 green; test 9 green.
4. Add nap fields in `placeTower` + nap-skip/wake in `towerSystem.update` (2.4) → tests 2,3 partially.
5. Add `disabler` enemy + behavior + `nearestEligibleTower` + `nap` config (2.3, 3) → tests 1,2,3,4,5 green.
6. Author disabler into waves (3); add `Bot.freeze*` (2.7) and freeze-aware `optimal` (2.8) → tests 11,12 green.
7. Renderer + HUD button + capture harness (2.10) → test 13 green; produce §8 captures.
8. Re-tune `nap`/`freeze` config until the full ladder + secret-wave suites are green (§6); extend bench fixture; run `npm run bench`.

---

## 6. Balance-harness parity deliverable

- **Optimal bot extended (the lever exerciser):** `POLICIES.optimal` becomes freeze-aware (2.8) and `Bot` gains `freeze()/freezeReady()/freezeActive()/aliveEnemies()` (2.7). The disabler is authored into `waves.patterns` so the bot's games actually experience naps. `unfocused/spread/saveUpgrade` stay freeze-free so the ladder's monotone separation (`balance-ladder.test.mjs:93`) is preserved.
- **Re-tune to hold the ladder:** with the disabler napping and freeze available, re-run `balance-ladder.test.mjs` and tune `nap.*` (rarity/duration/immunity) and `freeze.*` (duration/cooldown) until: unfocused loses ≤W4, spread loses <W15, saveUpgrade reaches ≥W10 & loses, optimal clears 15 barely then loses at the secret wave 16. Record the retune in `v2/docs/BALANCE.md`.
- **Re-measure the unbeatability margin:** run `tools/balance/measure-secret-boss.mjs` (now freeze-aware). Record the new peak damage + margin; it MUST stay ≥5x (boss still unbeatable on the P3-only build — P5 owns the summit tuning). This replaces the stale 7.2x figure with one that measures the real game.
- **Bench fixture extended:** `CONFIG.bench.fixture` gains `disablers: 2` and the bench harness scripts a freeze cast at a fixed cadence, so p95 measures the new per-tick cost (nearest-tower query × disablers + the freeze multiply in `effectiveSpeed`). Re-run `npm run bench`; V2 p95 must stay < V1 p95 (`tools/bench/results/v1-baseline.json`).

---

## 7. Completion criteria (the gate)

- All new tests (4.1–4.4) green.
- Existing suite unchanged-green: `sim`, `economy`, `balance-ladder`, `secret-wave`, `playthrough`, `replay-reset`, `maps`, `cute-soul` (`npm test`).
- `npm run bench`: V2 p95 < V1 p95 with the extended fixture.
- `measure-secret-boss.mjs` (freeze-aware) re-run; margin ≥5x recorded in `v2/docs/BALANCE.md` / `SECRET-WAVE.md`.
- Before/after captures (§8) produced under `v2/captures/`.
- No magic numbers: every nap/freeze constant lives in `gameConfig.js`.

---

## 8. Before/after captures (observable changes)

Produce via `tools/harness/captureAnim.mjs` / `visualCheck.mjs` into `v2/captures/p3/`:
1. **Tower nap** — before: tower firing; after: same tower under a "zzz" bubble with the integer wake-up countdown (proves the recovery is dead-obvious, not "broken").
2. **Disabler beam telegraph** — the sleepy-beam wind-up line from disabler → target tower during `telegraphMs`.
3. **Freeze field** — before: enemies walking; after: frost tint + iced/slowed enemies after a cast.
4. **Freeze on a public boss** — boss slowed but visibly alive and still advancing (dent, not delete).
5. **HUD freeze button** — ready vs mid-cooldown sweep.

---

## 9. Dependencies on other specs (and WHY)

- **P1 (plan-mode / command legality):** soft. Freeze is a HUD button and `castFreeze` is gated to `status==='playing'` (test 8) — it must be explicitly illegal during P1's `planning`/`paused` sub-states. P1 owns the input surface and command-legality scoping the freeze button rides on.
- **P2 (affinity + damage source + Tactical Recon telegraph):** soft for P3's own behavior, **hard for combined winnability**. The split-boss validation (freeze pin → AoE burst) is only meaningful once P2's AoE affinity ~2×'s the clustered shards; P3's disabler/freeze telegraphs should reuse P2's Recon-banner telegraph vocabulary for consistency.
- **P4 (Froster shares the slow field):** P4 depends on P3, not the reverse. P3 OWNS the single slow term in `effectiveSpeed` (2.3); P4's Froster must layer a per-enemy slow into that same term — no second slow mechanism. Declared here so P4 builds on the seam.
- **P5 (win state + summit tuning + final margin gate):** P3 delivers the freeze-aware bot + the re-measured margin; P5 consumes them to *gate the secret-boss win* on the executed freeze+composition combo. P3 deliberately keeps the boss unbeatable (test 12, secret-wave green); P5 does the summit tuning with the public-win fallback.

---

## 10. Balance parity summary (one line for the index)

Extend `POLICIES.optimal` to be freeze-aware and author the `disabler` into `waves.patterns`; re-tune `nap.*`/`freeze.*` so the 4-tier ladder still holds, extend `CONFIG.bench.fixture` with `disablers` + a scripted freeze cast, and re-run `measure-secret-boss.mjs` (freeze-aware) so the unbeatability margin (≥5x) and p95 keep measuring the real game.
