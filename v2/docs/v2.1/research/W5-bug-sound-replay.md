# W5 — BUG: all sound disappears after losing and replaying

## Symptom
Play a game → lose (or win) → tap "Play Again" → the new game runs but is
completely silent. First playthrough has audio; every replay is mute. Toggling
the sound button does not bring it back.

## Root cause — the event bus is thrown away on restart, orphaning AudioBridge

The audio layer subscribes to the sim's event bus exactly **once**, at app
construction:

- `v2/app/GameApp.js:28` — `this.audio = new AudioBridge(this.sim.bus, { muted: bench });`
- `v2/audio/AudioBridge.js:44` — constructor calls `this._wire(bus)`, which runs
  ~20 `bus.on(...)` registrations against **that specific bus instance**
  (AudioBridge.js:67–85).

The bus is **not** a long-lived object owned by the Simulation — it lives inside
`state`:

- `v2/sim/state.js:24` — `bus: new EventBus()` (a fresh bus per `createInitialState`).
- `v2/sim/Simulation.js:29` — `get bus() { return this.state.bus; }` (delegates to
  the *current* state).

`restart()` rebuilds state from the pure factory and discards the old state —
including the bus AudioBridge is wired to:

```
v2/sim/Simulation.js:38  restart({ seed = this._seed + 1, mapIndex = this.state.mapIndex } = {}) {
v2/sim/Simulation.js:41    this.state = createInitialState(this.config, seed, mapIndex);  // <-- NEW bus
v2/sim/Simulation.js:44    this.startGame();
```

`v2/app/GameApp.js:45` — `restart()` just forwards to `this.sim.restart(...)` and
never re-points audio. Replay is triggered from `v2/input/InputController.js:61`
(`case 'playAgain': app.restart(); break;`).

After restart the sim emits every gameplay event on the **new** `state.bus`
(e.g. `s.bus.emit(...)` at Simulation.js:213/247/262, and all system emits),
while AudioBridge is still holding subscriptions on the **dead old bus**. No
handler ever fires → total silence. `toMenu()` (Simulation.js:47) has the same
defect (currently unused from JS, fixed defensively).

Note this is the *same* design the existing `replay-reset.test.mjs` celebrates —
"restart() throws away the old state ... so nothing can carry over." That is
correct for gameplay state, but the bus is **infrastructure / a coupling point**,
not per-play state. It must survive restart.

This is **not** an AudioContext / autoplay-unlock problem: `AudioBridge.unlocked`
already persists (the AudioBridge instance itself is never recreated). The unlock
gesture from the first play still holds. The only thing broken is the
subscriber→emitter wiring.

## Fix — preserve the event bus across state rebuilds (root-cause, sim-side)

Carry the existing bus into the freshly-built state in both `restart()` and
`toMenu()`. The bus carries no gameplay state (only external subscribers), so
preserving it keeps the "pristine fresh state" guarantee intact while keeping
AudioBridge (and any future bus subscriber) armed.

`v2/sim/Simulation.js` `restart()`:
```js
restart({ seed = this._seed + 1, mapIndex = this.state.mapIndex } = {}) {
  // Fresh gameplay state from the factory — nothing leaks across plays EXCEPT
  // the event bus. The bus is the durable coupling point for external
  // subscribers (AudioBridge wires once at construction, GameApp.js:28); a new
  // bus would orphan them and silence all audio on replay. The bus holds no
  // gameplay state, so carrying it forward preserves the pristine-restart guarantee.
  const bus = this.state.bus;
  this._seed = seed;
  this.state = createInitialState(this.config, seed, mapIndex);
  this.state.bus = bus;
  this.state.lastTowerType = 'basic';
  this._acc = 0;
  this.startGame();
}
```

Same one-line preservation in `toMenu()` (capture `this.state.bus` before
rebuild, reassign after).

### Why sim-side, not an app-side re-arm
An alternative is `AudioBridge.rearm(newBus)` + a call from `GameApp.restart()`.
Rejected as primary because:
- it requires AudioBridge to track/unsubscribe its ~20 handlers (more surface),
- it must be remembered at every restart entry point (`toMenu` too), and
- the real defect is that infrastructure is being discarded with gameplay state.
The bus-preservation fix is 2 lines per call site, fixes both paths, needs no
AudioBridge API change, and keeps the headless `state.bus` test contract.

No magic numbers introduced → **no `gameConfig.js` keys needed.**

## Failing-first regression tests

New file `tools/tests/audio-replay.test.mjs` (node:test). Two complementary
assertions; both FAIL on current code, PASS after the fix.

1. **Bus identity survives restart** (encodes the contract directly):
   - `const sim = new Simulation(CONFIG, { seed: 1, mapIndex: 0 }); sim.startGame();`
   - `const bus0 = sim.bus; sim.restart({ seed: 2, mapIndex: 0 });`
   - `assert.equal(sim.bus, bus0, 'event bus is preserved across restart')`.
   - Repeat for `toMenu()`.

2. **AudioBridge stays armed across replay** (true end-to-end regression using
   the real AudioBridge + real Simulation): construct
   `new AudioBridge(sim.bus, { muted: false })` (in node `new Audio()` throws and
   pools stay empty, which is fine), then **stub `audio.play`** with a counter.
   Drive the sim until at least one audible event fires (e.g. tick through wave
   prepare→start, or place a tower via the command API → `TOWER_PLACE`), assert
   the counter incremented. Then `sim.restart(...)`, reset the counter, drive
   again to the same milestone, and assert the counter increments **again**.
   Pre-fix: zero plays after restart (orphaned bus). Post-fix: > 0.

A lighter guard can also be added to `replay-reset.test.mjs`'s `assertPristine`
(`assert.ok(s.bus, 'bus present')`) but the dedicated file is the regression of
record.

## Balance impact
**None.** Pure wiring/lifecycle fix; no gameplay numbers, no RNG, no timing
changes. Determinism is unaffected (bus is not consulted by any system). Feeds
nothing into the post-merge rebalance.

## Captures (observable change)
Manual/Playwright: load app → place a tower (hear place SFX) → force a loss →
"Play Again" → place a tower again and confirm SFX now plays. Record before
(silent replay) and after (audible replay) console/audio-trigger logs. Headless
tests are the authoritative proof since SFX can't be asserted from pixels.

## Dependencies & parallelism
- **Depends on:** nothing.
- **Shares files with:** `v2/sim/Simulation.js` — the boss-tower manual-ultimate
  work and any other sim-command items also edit this file. The edit is confined
  to `restart()`/`toMenu()` (lifecycle), which those items are unlikely to touch,
  so conflicts should be trivial — but it must be **sequenced / merged carefully**
  with any item that rewrites Simulation lifecycle. The new test file is
  conflict-free.
- **Parallel-safe with:** all renderer-only, config-only, and audio-content items
  (it does not touch `AudioBridge.js`, `Renderer.js`, `gameConfig.js`, or
  `GameApp.js`).
