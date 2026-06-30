# W7 — In-game RESTART (V1 had it)

## Goal
V1 let a player restart the game at any time. V2 only exposes restart on the
**won/lost overlay** ("Play Again", `Renderer.js:955` → action `playAgain` →
`GameApp.restart()`). While *playing* or *planning* there is **no way out** — a
kid who wants to start over (wrong map, doomed run, just wants a redo) is stuck
until they win or die. This item adds an in-game RESTART entry point that lands
in a fresh, immediately-playable state, with audio intact.

## Current state (what already exists — don't reinvent)

The public command API for resetting already exists and is solid:

- `v2/sim/Simulation.js:38` — `restart({ seed, mapIndex })` rebuilds state from the
  pure factory (`createInitialState`) and calls `startGame()` → status `'playing'`.
  Heavily covered by `tools/tests/replay-reset.test.mjs` (12 back-to-back plays,
  pristine every time, deterministic by seed). This works from any status today.
- `v2/sim/Simulation.js:47` — `toMenu()` rebuilds state and leaves status `'menu'`.
  **Currently dead code** — never called from JS, never wired to a button.
- `v2/app/GameApp.js:45` — `restart()` forwards to `sim.restart(...)` with a fresh
  random seed. There is **no** `GameApp.toMenu()`.
- `v2/input/InputController.js:61` — `case 'playAgain': app.restart()`. The only
  restart trigger; only drawn on the won/lost overlay.
- The menu screen + its Play button already exist (`Renderer._startMenu`,
  `Renderer.js:1049` → action `'play'` → `GameApp.startGame()`), so a `toMenu()`
  landing is fully supported by existing render + input.

So the **sim/command layer is already done**. W7 is purely the missing **in-game
entry point** (HUD button + input wiring), plus tests pinning "restart from
playing/won/lost → fresh playable".

## The W5 tie (audio intact) — owned by W5, depended on here

Restart/toMenu rebuild `state`, and the event bus lives on `state`
(`state.js:24`, `Simulation.js:29 get bus()`). AudioBridge subscribes **once** to
the first state's bus (`GameApp.js:28`). So today every restart orphans the audio
wiring → silent replay. This is exactly **W5** (`W5-bug-sound-replay.md`), whose
fix is to preserve the bus across `restart()`/`toMenu()`.

**W7 does not re-implement that fix** — it would collide with W5 in the same
`restart()`/`toMenu()` bodies. W7 adds a *new* restart trigger that flows through
the same command API, so once W5's bus-preservation lands, every W7 restart path
is automatically audio-intact. W7 therefore **depends on W5** and must merge
after it (or both land together with one combined edit to `restart()`/`toMenu()`).
If W7 lands first, the new in-game restart inherits the existing silent-replay bug
until W5 lands — acceptable but not ideal, so prefer W5-first.

## Concrete change

### 1. HUD: add an in-game RESTART button (playing + planning only)
`v2/render/Renderer._hud` bottom control row (`Renderer.js:541-544`) currently
draws two half-width buttons (Plan/Play, Sound/Muted) at `y = H - 96`, `h = 64`,
`bw = (W - pad*2 - 16)/2`. Restructure to **three equal buttons**:

```
bw = (W - pad*2 - 16*2) / 3            // 400-wide HUD, pad 24 → ~106px each
Plan/Play | Sound/Muted | Restart
```

The third button is the restart. Use a compact glyph label `↻` (default) so it
fits the narrower cell regardless of font metrics (mirrors the `❄` freeze glyph
convention). Action: `'restart'`, drawn only while `status === 'playing' ||
'planning'` (the same gate the row already lives under).

### 2. Kid-safety: two-tap confirm (mirror the existing ready-valve pattern)
The renderer already has a renderer-local two-tap arm for "I'm ready!"
(`Renderer.confirmReady()`, `Renderer.js:80-84`, armed via `InputController.js:65`).
Mirror it as `Renderer.confirmRestart()` so a stray tap can't nuke a run:
- first tap arms — button repaints in a warn color with label `Sure?`,
- second tap fires.
InputController: `case 'restart': if (this.renderer.confirmRestart()) app.restart();`

This keeps the "immediately playable" intent (one confirm tap → fresh game) while
guarding the 5-10yo audience from accidental run loss. No hover/tooltip — pure
tap, mobile-safe.

### 3. (No new button needed for menu) — keep `toMenu()` as tested API
The in-game button does a **direct restart** (`app.restart()`) to honor "fresh
state, immediately playable" (V1-faithful, no menu detour). `toMenu()` stays in
the command API and is pinned by tests (the work item's "menu/fresh playable
state" phrasing), but is not given its own button this pass to keep HUD surface
minimal. (A future "Quit to menu" can reuse it trivially.)

### Files touched
- `v2/render/Renderer.js` — `_hud` control row 2→3 buttons; add the `restart`
  button (glyph `↻` / armed `Sure?`); add `confirmRestart()` next to
  `confirmReady()`.
- `v2/input/InputController.js` — add `case 'restart'` to `_dispatch` (two-tap
  confirmed → `app.restart()`).
- `v2/app/GameApp.js` — no change required (already has `restart()`); optionally
  add `toMenu() { this.sim.toMenu(); }` for symmetry + to wire the tested path.

### Config keys
**None.** Button geometry derives from existing `layout.pad`/`hudWidth`; labels
are inline strings exactly like the existing Plan/Sound/Play-Again buttons. No
magic numbers introduced. (If a label-string-in-config convention is later
adopted, the `↻`/`Sure?`/`Restart` strings would move there, but no existing
button does this, so we match the prevailing style.)

## Failing-first tests

New file `tools/tests/restart.test.mjs` (node:test), plus a renderer hit-registry
check.

1. **unit — restart from each status → fresh playable** (`restart.test.mjs`):
   drive a sim to `'playing'`, to `'won'`, and to `'lost'` (reuse `drive` +
   `POLICIES` from the balance harness like `replay-reset.test.mjs`); from each,
   call `sim.restart({ seed, mapIndex })` and assert: `status === 'playing'`,
   `lives === CONFIG.lives.max`, `coins === startingCoins`, `clock === 0`,
   `wave.index === 1`, `enemies/towers === 0`, `nextId === 1`. (The 'won'/'lost'
   origins are the new coverage vs. `replay-reset` which only restarts from
   terminal-after-play.)
2. **unit — toMenu from each status → menu, then playable**: from playing/won/lost
   call `sim.toMenu()`, assert `status === 'menu'` and pristine; then
   `sim.startGame()` and assert `status === 'playing'`. Fails today only if a
   regression breaks `toMenu` (guards the now-wired-by-tests path).
3. **render — in-game restart button is reachable** (`restart.test.mjs`,
   render-capture/hit-registry, no DOM): construct a `Renderer` with a stub 2D ctx
   (the project's existing test ctx pattern), `render(state)` with
   `status === 'playing'`, and assert `renderer.hits` contains an entry with
   `action === 'restart'`. **Fails first** (no such button exists today). Repeat
   with `status === 'planning'` (present) and `status === 'menu'`/`'won'` (absent —
   the in-game button must not double up with the menu/overlay flows).
4. **unit — two-tap confirm gating**: `renderer.confirmRestart()` returns `false`
   then `true` on consecutive calls (mirrors the `confirmReady` test if one
   exists). **Fails first** (method doesn't exist).
5. **integration — dispatch wiring**: feed `_dispatch('restart')` with a stub
   `app`; assert `app.restart` is **not** called on the first (arming) tap and
   **is** called on the second. **Fails first** (no `case 'restart'`).
6. **audio-intact cross-check (owned by W5, referenced here)**: after the in-game
   restart, a bus subscriber registered before restart still fires. This is W5's
   regression (`audio-replay.test.mjs`); W7 relies on it rather than duplicating.

## Balance impact
**None.** Pure UI/lifecycle entry point. No gameplay numbers, RNG, or timing
changes; `restart()`/`toMenu()` semantics are unchanged. Feeds nothing into the
post-merge rebalance. (Indirect: easier mid-run restart means the bot ladder /
balance harness is unaffected — it drives the sim directly, not the HUD.)

## Captures (observable change)
- Render-capture: HUD during `playing` showing the three-button control row with
  the new `↻` restart button (before: two buttons; after: three).
- Render-capture: armed state — button repainted as `Sure?` after first tap.
- Manual/Playwright (with W5 merged): start a run → tap `↻` → `Sure?` → confirm →
  fresh playable game **with audio** (place a tower, hear the place SFX). Proves
  the W5 tie end-to-end. Headless tests are authoritative for audio.

## Dependencies & parallelism
- **Depends on:** **W5** (bus-preservation) for "audio intact" across the new
  restart. W7's button flows through the same `restart()` the W5 fix repairs.
- **Shares files / must sequence with:**
  - `v2/render/Renderer.js` — `_hud` control row is also where any other HUD-chrome
    item (e.g. the boss-tower manual-ultimate HUD button) draws. The 2→3 button
    restructure changes the row geometry, so it **must sequence** with any item
    editing the bottom control row. Conflict-prone; coordinate.
  - `v2/input/InputController.js` `_dispatch` switch — additive `case`, mergeable
    but sequence with other items adding actions (boss ultimate, etc.).
  - `v2/sim/Simulation.js` (`restart`/`toMenu`) — **W5 edits the same bodies.**
    W7 should not touch them; if it does (the optional `GameApp.toMenu()` wiring is
    in `GameApp.js`, not `Simulation.js`, so this is avoidable), sequence after W5.
- **Parallel-safe with:** all config-only items, balance/policy items, and
  sim-systems items that don't touch `Renderer._hud` / `InputController._dispatch`
  / `Simulation.restart`. The new test file is conflict-free.
