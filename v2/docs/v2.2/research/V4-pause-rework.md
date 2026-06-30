# V2.2 Research — V4: "Plan" → "Pause" rework

**Branch:** `v2-depth-pass` · **Scope:** demote plan-mode (place-while-frozen) to a plain
**Pause** (freeze, *inspect-only*, no building). Keep the live tap-once tray. Keep the
standalone cast-freeze ability untouched (separate feature, out of scope).

---

## 1. What exists today (cited)

Plan-mode is a distinct frozen sub-state `status = 'planning'` that **freezes the sim AND
lets the kid build/upgrade/sell/fork with the board fully visible** — the exact
"place-while-frozen" mechanism this item removes. Plus an *auto-pause-on-popup* convenience
that silently enters plan-mode whenever a placement popup opens.

- **Sim freeze gate** — `v2/sim/Simulation.js:89-103` (`tick`): `if (s.status !== 'playing') return;` → planning = zero ticks.
- **Toggle** — `v2/sim/Simulation.js:65-69` `togglePlanning()` flips `playing <-> planning` only.
- **Auto-pause-on-popup** — `v2/sim/Simulation.js:184`: `if (s.config.plan.autoPauseOnPopup && s.status === 'playing') { s.status = 'planning'; s.autoPlanned = true; }` inside `gridClick`.
- **Resume plumbing** — `v2/sim/Simulation.js:193-196` `_resumeAutoPlan()`; called by `placementPlace` (`:203`), `placementClose` (`:214`), and the tray fast-path place (`:203` path).
- **Build-while-frozen is real today** — `gridClick` tray fast-path (`:176-180`) and popup path (`:181-185`) both run regardless of `planning`; `upgradeSelected`/`sellSelected`/`forkSelected` (`:216-234`) are explicitly status-agnostic.
- **State** — `v2/sim/state.js:28` status enum comment `menu | playing | planning | won | lost`; `:75` `autoPlanned: false`.
- **Config** — `v2/config/gameConfig.js:53-57` `plan: { autoPauseOnPopup: true, targetingToggleEnabled: false }`.
- **Input** — `v2/input/InputController.js:46` world clicks legal while `playing || planning`; `:64` `case 'plan': sim.togglePlanning()`; `:80` Escape toggles plan.
- **Renderer** — `v2/render/Renderer.js:76` draws `_planFrame` when planning; `:897-915` `_planFrame` border + "Planning — tap Play to start" + big Play; `:573` control-row button `state.status === 'planning' ? 'Play' : 'Plan'` (action `'plan'`); `:575` in-game restart shown while `playing || planning`.
- **Cast-freeze ability (KEEP)** — `castFreeze` (`:254-264`) already gates `status !== 'playing'`, and `freezeUiState` (`v2/render/abilityHud.js:32-34`) returns `'locked'` for any non-playing status. So a renamed `'paused'` keeps freeze locked-while-paused for free. **No change to the freeze feature.**

### The harness DOES build through the popup (but never toggles plan itself)
`tools/balance/harness.mjs:106-123` `place()` calls `gridClick` (which currently auto-enters
planning) then `placementCycle`/`placementPlace` (which auto-resume). Bots leave `trayType`
null, so they ride the popup INVARIANT path. **Bots never call `togglePlanning`** (confirmed:
no `togglePlanning` in `tools/balance/policies.mjs` or `measure-secret-boss.mjs`). After we
remove auto-pause, `gridClick` opens the popup while staying `'playing'`, and `placementPlace`
still fires — the ladder gets *simpler*, no deadlock risk.

---

## 2. Concrete change (design-faithful)

**Design decision — Pause is INSPECT-ONLY.** While paused: sim frozen, board fully visible,
you may *tap towers/enemies to read ranges/stats*, but you **cannot spend coins** — no place
(tray or popup), no upgrade, no sell, no fork. This is the coherent generalization of "remove
place-while-frozen": a pause that let you sell/upgrade/place risk-free is the same exploit.
(Literal-scope alternative = block placement only; rejected as incoherent — see §6.)

**Rename** `'planning'` → `'paused'` and `togglePlanning()` → `togglePause()` (the brief calls
for "pause semantics"; these are internal V2 symbols, all callers are ours).

### Simulation (`v2/sim/Simulation.js`)
1. `togglePlanning()` → `togglePause()`: `playing <-> paused` (`:65-69`). Update the doc comment (frozen, inspect-only, no building).
2. Add a private predicate `_canBuild()` → `this.state.status === 'playing'`.
3. `gridClick` (`:160-189`): keep tower/enemy **selection** branches (inspection legal while paused). Guard the **`canPlace` branch** behind `_canBuild()` — when paused, an empty buildable tap deselects and returns `'empty'` (no tray-place, no popup). **Delete** the auto-pause block at `:184`.
4. `placementPlace` (`:198-205`), `placementCycle` (`:206-213`): early-return if `!_canBuild()` (defensive — covers "open popup while playing, then pause, then place").
5. `upgradeSelected`/`sellSelected`/`forkSelected` (`:216-234`): early-return `false`/`null` if `!_canBuild()`.
6. **Delete** `_resumeAutoPlan()` (`:193-196`) and its three call-sites (`:203`, `:214`, tray path). With auto-pause gone, `autoPlanned` is dead.

### State (`v2/sim/state.js`)
7. `:28` enum comment → `menu | playing | paused | won | lost`. Remove `autoPlanned` (`:75`).

### Config (`v2/config/gameConfig.js`)
8. `:53-57` remove `autoPauseOnPopup`. Rename the block comment `Plan-mode` → `Pause`. Keep `targetingToggleEnabled` (dormant, unrelated). Pause has no tunables, so no new keys.

### Input (`v2/input/InputController.js`)
9. `:46` world-click gate `'planning'` → `'paused'` (keep paused clicks for inspection).
10. `:64` `case 'plan'` → `case 'pause': sim.togglePause()`.
11. `:80` Escape: `togglePause()`, status check `'paused'`.

### Renderer (`v2/render/Renderer.js`)
12. `:76` `=== 'planning'` → `=== 'paused'`; rename `_planFrame` → `_pauseFrame`.
13. `_pauseFrame` (`:897-915`): label `'Planning — tap Play to start'` → `'Paused — tap Play to resume'`. The frame already shows **no** build affordance, so "remove plan-place affordance" = the behavioral block + relabel. (Optional: dim board / no placement ghost — none exists today.)
14. `:573` button: `state.status === 'paused' ? 'Play' : 'Pause'`, action `'pause'`.
15. `:575` in-game restart visibility: include `'paused'`.
16. Comments at `:547`, `:568` ("Plan/Sound row" / "Plan/Play").

### Harness / tests (see §3, §4)
17. `harness.mjs:106-111` comment: drop the auto-pause round-trip note; bots place while playing.

---

## 3. Tests touched (existing, must be updated)

| File | Change |
|------|--------|
| `tools/tests/plan-mode.test.mjs` | Core rewrite (rename → `pause-mode`). #3 **inverts**: building while paused is now BLOCKED. #4 `togglePause`/`'paused'`. #5 (auto-pause) **deleted/replaced**: opening a popup stays `'playing'` and `autoPlanned` no longer exists. #2/#6 rename + add paused-block assertions. |
| `tools/tests/w1-planmode.test.mjs` | `togglePlanning`→`togglePause`, `'planning'`→`'paused'`. Sim-freeze-while-paused preserved (unchanged behavior). |
| `tools/tests/balance-ladder.test.mjs` | ladder #6 (`:103-111`): **delete** `assert.equal(CONFIG.plan.autoPauseOnPopup, true)` (`:104`); keep the win-parity assertions (bot still clears 15 / wins — it never paused). Rename the comment. |
| `tools/tests/freeze.test.mjs` | `:82` status list `['paused','planning',...]` → `['paused','menu','won','lost']`. |
| `tools/tests/freeze-ui.test.mjs` | `:77-78`, `:97` `togglePlanning`→`togglePause`, `'planning'`→`'paused'`. |
| `tools/tests/boss-tower.test.mjs` | `:203-204` `togglePause`/`'paused'`. |
| `tools/tests/restart.test.mjs` | `:161-163` `togglePause`/`'paused'` (restart still present while paused). |

## 4. Failing-first NEW test — `tools/tests/pause-rework.test.mjs`

RED against current code, GREEN after the change. Drives the public command API only.

1. **Pause blocks the popup path** — paused, `gridClick` on a buildable cell returns `'empty'`, `state.placement === null`, coins unchanged.
2. **Pause blocks the tray fast-path** — `selectTray('basic')`, pause, `gridClick` buildable → returns `'empty'`, no tower, coins unchanged.
3. **Pause blocks placementPlace/upgrade/sell/fork** — open popup while playing, then pause: `placementPlace()===false`; selected tower `upgradeSelected()===false`, `sellSelected()===false`, `forkSelected()===false`; coins unchanged.
4. **Inspection still works while paused** — tapping an existing tower returns `'tower'` and selects it.
5. **`togglePause` is `playing<->paused` only** — no-op from menu/won/lost.
6. **Sim still freezes while paused** — clock + enemy progress frozen across ticks, resume advances (port of plan #2).
7. **Cast-freeze still locked while paused** (regression guard for the KEPT ability) — `castFreeze()===false` while paused, `true` once playing.
8. **Auto-pause mechanism is gone** (source scans): `Simulation.js` has no `autoPauseOnPopup`/`autoPlanned`/`_resumeAutoPlan`/`togglePlanning`; `gameConfig.js` has no `autoPauseOnPopup`; `InputController.js` has no `case 'plan'`/`togglePlanning`; opening a popup while playing keeps `status==='playing'`.

## 5. Balance impact

**Net easier-to-reason, slightly harder-to-exploit, no curve retune.** The removed
build-while-frozen path was a (mild) difficulty relief — the kid could assemble/upgrade a
defense with the clock stopped. Removing it means all economy decisions happen under the live
clock again. Bots **never used** plan-mode, so the **balance ladder outcome is unchanged**
(optimal still clears 15 / wins) — `bench` p95 is untouched (pause still zero-ticks; if
anything fewer status transitions). Run `npm test` + `npm run bench` to confirm V2 p95 < V1 p95
holds. No `measure-secret-boss` / `summitConqueror` change (that path is the boss-tower item).

## 6. Open decision (flagged)

**Inspect-only pause (chosen) vs. placement-only block (literal brief).** The brief names
"placement" explicitly and scopes freeze out. I recommend **inspect-only** (also block
upgrade/sell/fork) because a pause that still lets you sell/upgrade risk-free re-introduces the
same "act while frozen" exploit under a different verb, and is confusing for a 5-10yo ("why can
I upgrade but not place?"). If Jaco wants the strict literal scope, drop changes #4-#5 and
test-#3's upgrade/sell/fork clauses; everything else stands.

## 7. Captures (after implementation)

- `v2/captures/v2.2/pause-frame.png` — paused board, "Paused — tap Play to resume", Pause→Play button.
- `v2/captures/v2.2/pause-no-build.png` — paused + tray selected + tap on buildable → nothing placed (affordance shows pause blocks building).
- `v2/captures/v2.2/live-tray-place.png` — live tap-once tray still places in one tap (regression).

## 8. Dependencies & parallel-safety

- **Self-contained.** Files: `Simulation.js`, `state.js`, `gameConfig.js`, `InputController.js`, `Renderer.js`, `harness.mjs` + 7 existing test files + 1 new test.
- **Independent of the boss-tower/ultimate rework** — disjoint code (boss = `castUltimate`/`abilityHud` ultimate slot/`shapes.fortress`; pause never touches those). The only shared file is `gameConfig.js` (boss edits `towers.boss`, pause edits the `plan`→`pause` block — different keys) and the shared *test files* `boss-tower.test.mjs` (one rename hunk) and `balance-ladder.test.mjs`.
- **Parallel-safe with** any V2.2 item that does NOT edit `Simulation.js` placement/status code or those two shared test files. **Forces sequencing with** the boss-tower item only at the merge of `gameConfig.js` + `boss-tower.test.mjs` (trivial, non-overlapping hunks). Renderer edits are in the control-row/`_pauseFrame` region, away from the boss ultimate slot.
