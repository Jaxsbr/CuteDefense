# W1-planmode — Remove the skip-the-countdown valve; keep plan-mode usable during a wave

**Pass:** V2.1 polish/power · **Branch:** `v2-depth-pass` · **Status:** research

## Intent (Jaco)

Kill the "I'm ready!" / skip-countdown valve entirely (`readyNow` / `_readyValve` /
`waves.readyBonusCoins`). KEEP plan-mode (freeze-the-board) usable DURING a wave.
Confirm plan-during-wave already works or make it so. Identify what breaks if `readyNow`
is removed (tests, bot harness that calls it).

## Grounding — what exists today (depth pass P1)

The valve is a small, self-contained subsystem layered on top of plan-mode:

- **Sim command** `Simulation.readyNow()` — `v2/sim/Simulation.js:72-88`. Collapses the
  visible countdown: `prepare` → set `wave.phaseClock = wave.prepMs`; `complete` (non-final)
  → set `wave.phaseClock = config.waves.betweenWaveMs`; credits `cfg.waves.readyBonusCoins`
  (default 0). No-op in any other phase. Returns boolean.
- **Renderer valve UI** `Renderer._readyValve(state)` — `v2/render/Renderer.js:830-854`.
  Countdown chip + big two-tap "I'm ready!" button, `addHit('ready', …)`. Drawn from the
  render gate at `Renderer.js:74` for both `playing` and `planning`.
- **Two-tap confirm** `Renderer.confirmReady()` — `v2/render/Renderer.js:79-84`; renderer-local
  arm flag initialized at `Renderer.js:39` (`this._readyArmed = false`).
- **Input dispatch** `case 'ready'` — `v2/input/InputController.js:65`
  (`if (this.renderer.confirmReady()) sim.readyNow();`).
- **Config lever** `waves.readyBonusCoins: 0` + its escalation comment — `v2/config/gameConfig.js:63-66`.
- **Balance hook** `readyAwareOptimal()` policy + its `POLICIES` member —
  `tools/balance/policies.mjs:282-298` and `:300`. **Dead code:** grep confirms it is never
  consumed anywhere (no file iterates `POLICIES` generically; every consumer names
  `POLICIES.optimal|spread|saveUpgrade`). It exists only as the documented escalation hook
  for "if `readyBonusCoins` is ever tuned >0".

### Plan-during-wave: already works — no behavior change needed

- `Simulation.togglePlanning()` (`Simulation.js:56-60`) flips `playing <-> planning` from ANY
  wave phase; the frozen sub-state takes zero ticks (`tick` early-returns on non-`playing`,
  `Simulation.js:102`).
- The **Plan/Play toggle** button is always present in the HUD control row
  (`Renderer.js:543`) and via `Escape` (`InputController.js:79`) — reachable mid-wave.
- `tools/tests/plan-mode.test.mjs` **#2** (lines 85-109) already proves freeze-mid-wave with a
  live enemy on the path and clean resume.

So W1 is purely a **removal**; plan-during-wave is preserved untouched. (Optional copy nit:
`_planFrame` label "Planning — tap Play to start" at `Renderer.js:798` reads slightly off mid-wave;
could become "…tap Play to resume". Cosmetic, not required.)

## Concrete change

Pure deletion of the valve, leaving plan-mode and the freeze button intact.

1. **`v2/sim/Simulation.js`** — delete the `readyNow()` method + its doc comment (lines 72-88).
2. **`v2/render/Renderer.js`** —
   - delete `_readyValve(state)` (830-854);
   - delete `confirmReady()` (79-84) and the `this._readyArmed = false;` init (line 39);
   - line 74: drop the `_readyValve(state)` call, keep `_freezeButton(state)` →
     `if (state.status === 'playing' || state.status === 'planning') this._freezeButton(state);`
3. **`v2/input/InputController.js`** — delete `case 'ready':` (line 65).
4. **`v2/config/gameConfig.js`** — delete `readyBonusCoins: 0` and its 3-line escalation comment
   (lines 63-66).
5. **`tools/balance/policies.mjs`** — delete `readyAwareOptimal()` (282-298) and remove the
   `readyAwareOptimal` member from the `POLICIES` export (line 300).

## Config keys

- **Removed:** `waves.readyBonusCoins`. No new keys.

## What breaks (and the fix)

- **`tools/tests/plan-mode.test.mjs`** — test **#8** (lines 252-294) is entirely about the valve
  (`readyNow`, `readyBonusCoins`). DELETE it. Update the header doc comment (line 6) to drop
  `readyNow` from the listed command surface.
- **`tools/tests/balance-ladder.test.mjs:105`** — asserts `CONFIG.waves.readyBonusCoins === 0`.
  DELETE that assertion line (the surrounding ladder #6 parity test stays).
- **`tools/balance/policies.mjs`** — `readyAwareOptimal` removed; confirmed unused, so no
  consumer breaks (`measure-secret-boss.mjs` and all balance tests use `POLICIES.optimal`).
- No other references: bench, harness.mjs, and the other suites do not touch the valve.

## Failing-first tests (new) — `tools/tests/plan-mode.test.mjs` (or a small `w1-planmode.test.mjs`)

1. **valve sim API is gone** (unit) — `typeof new Simulation(cfg,{seed:1,mapIndex:0}).readyNow !== 'function'`.
2. **config lever is gone** (unit) — `CONFIG.waves.readyBonusCoins === undefined`.
3. **no 'ready' wiring** (unit, source-scan — mirrors the existing coin-case guard at
   `plan-mode.test.mjs:247-249`) — read `v2/input/InputController.js`, assert no `case 'ready'`;
   read `v2/render/Renderer.js`, assert no `_readyValve` / `confirmReady` symbols.
4. **plan-during-wave preserved** (sim) — advance into `spawning`/`active` with an enemy on the
   path, `togglePlanning()`, assert `status==='planning'` and the wave phase clock + enemy x are
   frozen across many ticks, then resume advances them (re-affirms #2 explicitly for a mid-wave phase).

These fail against current `main` (readyNow exists, config key present, dispatch case present) and
pass after the deletion.

## Balance impact

**None.** The valve was balance-neutral by construction (`readyBonusCoins=0`, pure impatience)
and the difficulty ladder deliberately never called `readyNow` (`readyAwareOptimal` was an unused
escalation hook). Removing it changes no on-field figures: the optimal-bot ladder, the
secret-boss measurement, and bench are all driven by `POLICIES.optimal` and are unaffected.
Feeds the single post-merge rebalance as a **no-op** line item.

## Captures (observable changes)

- Pre-wave (prepare) board screenshot: the "I'm ready!" button + "Next in N" chip are GONE;
  the auto countdown still runs and the wave starts on its own.
- Mid-wave screenshot with plan-mode toggled ON: the freeze field/Plan-frame still works,
  proving plan-during-wave survived the removal.

## Dependencies

- **Depends on:** nothing structural — self-contained removal on top of the landed P1 plan-mode.
- **Shares files (must sequence) with** any other V2.1 item that edits the same hot files:
  - `v2/render/Renderer.js` (HUD/freeze/fork/win-overlay items),
  - `v2/input/InputController.js` (any new input action),
  - `v2/config/gameConfig.js` (any item adding/removing config keys),
  - `tools/balance/policies.mjs` and `tools/tests/balance-ladder.test.mjs` (the boss-rebalance / new-tower items).
  These should be merged sequentially with W1 to avoid edit collisions.
- **Parallel-safe with** items touching disjoint files: pure `v2/sim/systems/*` enemy/wave/tower
  logic, audio, sprite/SpriteCache work, and map/parser changes.
