# SPEC-P1 — Plan, then watch: non-occluding plan-mode + tap-once tray + "I'm ready!" valve (+ auto-collect lock-in)

**Status:** Implementation spec (TDD). Source proposal: `v2/docs/depth-pass/PROPOSALS.md` "### P1".
**Rough cost:** M. **Risk:** burying the #1 charm under modes/trays — guarded by the first-placement INVARIANT test.

---

## 1. Value proposition

P1 is the **fairness substrate** for the whole depth pass. Today every placement happens *while the board moves* (#7), pause hard-blocks world taps and paints a full grey scrim (`InputController.js:44`, `Renderer.js:647-653`) — the opposite of plan-to-build — and each placement costs a per-tile Cycle tap (#6). P1:

1. **Plan-mode** — a distinct `planning` sub-state (NOT an overload of `paused`) that **freezes the sim (zero ticks — perf-positive)** while keeping the board fully visible behind a thin frame (no scrim). Place / inspect / upgrade / sell are legal while frozen; building still spends coins, so plan-mode buys *thinking time, not free power*.
2. **Auto-pause on the build popup** (`plan.autoPauseOnPopup`) — opening a popup enters plan-mode so the calm window comes to a kid who will never find a hotkey; placing or closing it resumes.
3. **Tap-once build tray** — pick a tower type once (`s.trayType`), then taps on buildable cells place that type directly, removing the per-tile Cycle. **Additive, never mandatory.**
4. **"I'm ready!" valve** — surfaces the existing `waves.prepMs` / `betweenWaveMs` as a visible countdown with one big button that starts the wave early. Reframed as **pure impatience** (default bonus = 0 coins) — no risk/reward sum a 5-7yo must weigh.
5. **Auto-collect coins** — already shipped (kills credit the wallet directly via `enemySystem.killEnemy → creditCoins`, see `economySystem.js:55-57`). P1 **locks it as an invariant** (no loose coins, no manual-collect command); no re-implementation.

**The protected invariant (#1 charm):** with no tray selected and no mode discovered, tapping an empty buildable cell opens the placement popup and `placementPlace()` builds — **identical to today**. An untrained kid still places a tower in the first 5 seconds without discovering plan-mode or the tray. Pause + tray are strictly additive.

**Honest accounting:** P1 adds *no depth and no power*. It removes a reaction-speed/click test so the spatial + economic puzzles of P2/P4 can be strictly harder without raising the click bar. The "I'm ready!" button is intentionally **not** credited as a strategic decision for this audience.

---

## 2. Files + changes (file:line)

### `v2/sim/Simulation.js`
- **Replace `togglePause()` (lines 51-55)** with `togglePlanning()`: `playing ↔ planning` only (never touches menu/won/lost). Keep semantics minimal.
- **Add `selectTray(towerType)`**: sets `s.trayType` to a valid `Object.keys(config.towers)` id, or `null` to clear. Idempotent toggle when the same type is tapped (tap selected tray → clears).
- **Add `readyNow()`**: when `wave.phase==='prepare'`, set `wave.phaseClock = wave.prepMs` (so the next `waveSystem.update` transitions to `spawning`); when `wave.phase==='complete'` and not the final wave, set `wave.phaseClock = config.waves.betweenWaveMs` (advances to the next wave). Credit `config.waves.readyBonusCoins` via `economySystem.creditCoins` (default 0). No-op in any other phase. Returns boolean (did it collapse).
- **Modify `gridClick()` (lines 124-143)** — the empty-buildable branch:
  - If `s.trayType` is set: call `towers.placeTower(s, igx, igy, s.trayType)`; on success set `lastTowerType`, select the new tower, `s.placement=null`, return `'placed'`; on failure return `'empty'` (no popup). **Do not toggle plan-mode** (tray = fast path).
  - Else (tray null — the INVARIANT path): set `s.placement = { gx, gy, towerType: s.lastTowerType || 'basic' }` exactly as today; if `config.plan.autoPauseOnPopup && s.status==='playing'`, set `s.status='planning'` and `s.autoPlanned=true`; return `'placement'`.
- **Modify `placementPlace()` (145-152)** and **`placementClose()` (161)**: after clearing `s.placement`, if `s.autoPlanned`, set `s.status='playing'` and `s.autoPlanned=false` (auto-pause resumes on resolve). This round-trip is what keeps the headless bot harness from deadlocking.

### `v2/sim/state.js`
- Line 28 status comment → `menu | playing | planning | won | lost`.
- Add `trayType: null` and `autoPlanned: false` to the returned state (near `selected` / `placement`, lines 61-63). Both reset by the factory, so nothing leaks across plays (consistent with the no-leak design).

### `v2/config/gameConfig.js`
- New top-level `plan` block (after `lives`): `{ autoPauseOnPopup: true, targetingToggleEnabled: false }`.
- Add `readyBonusCoins: 0` to the `waves` block (line ~49-54). Comment: "I'm ready! early-start bonus — 0 = pure impatience; any value >0 is a power change and MUST re-run balance-ladder + measure-secret-boss with a ready-aware optimal bot."

### `v2/input/InputController.js`
- Line 44: allow world interaction when `s.status==='playing' || s.status==='planning'` (so taps place/inspect/upgrade while frozen).
- `_dispatch` (55-68): rename `'pause' → 'plan' → sim.togglePlanning()`; add `'tray' → sim.selectTray(data)` (pass `hit.data` as the tower type) and `'ready' → sim.readyNow()`. Update `_dispatch` signature to forward `data`.
- Line 72: `Escape` → `togglePlanning()` (guard on `playing|planning`).

### `v2/render/Renderer.js`
- Render gate (line 68): `if (state.status==='planning') this._planFrame(state);` (replaces the `paused` branch).
- Replace `_pause()` (647-653) with **`_planFrame(state)`**: a thin candy border around the board (NO full-canvas scrim), a small "Planning — tap Play to start" label, and a big **Play** button (`addHit('plan', ...)`). The board stays fully visible.
- HUD button (line 491): label/action become the Plan/Play toggle (`state.status==='planning' ? 'Play' : 'Plan'`, action `'plan'`).
- **Tray:** render a 2-icon tray in the HUD dock (one per `Object.keys(cfg.towers)`); the selected `state.trayType` is highlighted; each emits `addHit('tray', x, y, w, h, towerType)`.
- **"I'm ready!" valve:** during `wave.phase==='prepare'|'complete'`, draw a countdown (`Math.ceil((wave.prepMs - wave.phaseClock)/1000)`) and a big **"I'm ready!"** button with `addHit('ready', ...)`. Use a two-tap confirm (renderer-local `_readyArmed` flag) so a stray tap can't trigger it mid-think. No sim state needed for confirm.

### `tools/balance/policies.mjs` (parity — see §6)
- No behavioural change to the four ladder bots (they must keep their tuned outcomes). Add a short comment that `place()` round-trips through `placementPlace`/`placementClose`, which auto-resume plan-mode, so `autoPauseOnPopup` cannot deadlock the harness. Optionally export a `readyAwareOptimal` variant used only by the focused ready-valve parity test.

---

## 3. New `gameConfig.js` keys

| Key | Default | Meaning |
|-----|---------|---------|
| `plan.autoPauseOnPopup` | `true` | Opening a build popup enters non-occluding plan-mode; resolving it resumes. |
| `plan.targetingToggleEnabled` | `false` | Optional set-once targeting toggle; OFF/hidden for young kids (no combat clicks). |
| `waves.readyBonusCoins` | `0` | "I'm ready!" early-start reward. 0 = pure impatience (balance-neutral). >0 ⇒ re-run balance gates. |

---

## 4. TDD plan — write these tests FIRST (they must fail before the code exists)

Primary new file: **`tools/tests/plan-mode.test.mjs`** (node:test, mirrors `sim.test.mjs` helpers: `SHORT_MAP`, `makeConfig`, `advance`). Parity additions go in **`tools/tests/balance-ladder.test.mjs`**.

1. **INVARIANT — first placement is unchanged & tray is additive** (`unit`, `plan-mode.test.mjs`)
   Fresh sim, `status==='playing'`, `trayType===null`. `gridClick(x+0.5, y+0.5)` on a buildable cell returns `'placement'`, sets `s.placement={gx,gy,towerType:'basic'}` (from `lastTowerType`). `placementPlace()` returns `true` and `towerAt(x,y)` exists. Assert no mode was required (`trayType` still null) — proves the #1 charm is reachable with zero discovery.

2. **Plan-mode freezes the sim (zero ticks)** (`sim`, `plan-mode.test.mjs`)
   Start a wave, let an enemy spawn, capture `clock`, the enemy's `progress`/`x`, and `wave.phaseClock`. `togglePlanning()` → `status==='planning'`. `advance(sim, 2000)` (many ticks). Assert `clock`, enemy `progress`/`x`, and `wave.phaseClock` are **unchanged** and `status` stays `'planning'`. Then `togglePlanning()` and `advance` → `clock` advances and the enemy moves (resume works).

3. **Commands legal in planning still spend coins (no free power)** (`unit`, `plan-mode.test.mjs`)
   Enter planning. With `trayType` set to `'basic'`, `gridClick` on a buildable cell places a tower and `coins` drops by `towers.basic.levels[0].cost`. Select it, `upgradeSelected()` decrements coins by the L2 cost; `sellSelected()` refunds `floor(invested*0.7)`. Assert each spend/refund occurred while frozen — plan-mode buys time, not power.

4. **`togglePlanning` is `playing ↔ planning` only** (`unit`, `plan-mode.test.mjs`)
   From `playing` → `planning` → `playing`. From `menu`, `won`, `lost`: `togglePlanning()` is a no-op (status unchanged).

5. **Auto-pause on popup, gated by config** (`sim`, `plan-mode.test.mjs`)
   With `plan.autoPauseOnPopup=true` and `trayType===null`: `gridClick` on a buildable cell sets `status==='planning'`, `s.autoPlanned===true`, and opens the popup. `placementPlace()` builds the tower AND restores `status==='playing'`, `autoPlanned===false`. Re-open and `placementClose()` → also restores `playing`. With `plan.autoPauseOnPopup=false`: `gridClick` leaves `status==='playing'` (popup opens, no freeze).

6. **Tap-once tray direct-places, respects affordability, no popup** (`unit`, `plan-mode.test.mjs`)
   `selectTray('strong')`; `gridClick` on a buildable cell returns `'placed'`, a `strong` tower exists, `coins` drops by the strong L1 cost, and `s.placement===null` (popup NOT opened). With coins below cost, `gridClick` returns `'empty'` and builds nothing. `selectTray(null)` restores the popup path (cross-checks the invariant).

7. **Auto-collect is locked (no loose coins, no manual collect)** (`sim`, `plan-mode.test.mjs`)
   Mirror the economy guarantee as a P1 invariant: spawn + `killEnemy` credits the wallet directly; across a full short-map wave `state.coinsList.length===0` every tick; assert `InputController` exposes no coin-collect command/action (the `_dispatch` switch has no coin case).

8. **"I'm ready!" valve collapses the timer and is balance-neutral** (`sim`, `plan-mode.test.mjs`)
   In `wave.phase==='prepare'` with `phaseClock < prepMs` and `waves.readyBonusCoins=0`: `readyNow()` returns true, sets `phaseClock>=prepMs`; the next `tick` transitions `phase` to `'spawning'`; `coins` is unchanged (pure impatience). In `'complete'` (non-final), `readyNow()` collapses `betweenWaveMs` so the next wave begins. In `'spawning'`/`'active'`, `readyNow()` is a no-op. Add a sub-case with `readyBonusCoins=5` asserting exactly +5 coins to prove the config lever.

9. **PARITY — plan-mode + auto-pause must not deadlock the headless bot ladder** (`balance`, `balance-ladder.test.mjs`)
   With default `CONFIG` (`autoPauseOnPopup=true`), `runGame(CONFIG, {optimal})` across the existing seeds×maps still yields `wavesCleared===15`, `finalWave===16`, `status==='lost'` — **identical to the pre-P1 ladder #4**. Proves the popup auto-pause round-trips (place/close resume) and the optimal bot never freezes itself. (This is the balance-parity deliverable; see §6.)

10. **RENDER — plan frame is non-occluding** (`render-capture`, via `tools/harness/visualCheck.mjs` / `captureAll.mjs`)
    Enter planning and capture: assert (sampled board pixels) the grass/path/enemies remain visible — i.e. the old full-canvas grey scrim is gone — and the Plan/Play button + thin frame are present. Pairs with the before/after captures in §8.

---

## 5. Completion criteria (the gate)

- **All node:tests green** via `npm test`: the new `plan-mode.test.mjs` plus every existing suite **unchanged** (`sim`, `economy`, `playthrough`, `balance-ladder`, `secret-wave`, `maps`, `cute-soul`, `replay-reset`). No existing assertion may be weakened.
- **Bench gate:** `npm run bench` → V2 p95 **< V1 p95** (and within the 15% self-regression margin). Plan-mode is perf-positive (frozen frame runs zero real systems); the tray, plan-frame and ready button are static blits on the existing locked fixture (`CONFIG.bench.fixture` 40/12/30). The fixture has no power-bearing lever to extend for P1, so it is unchanged.
- **Captures produced** (§8) and reviewed: plan-mode non-occlusion, tray, ready valve, and the first-placement before/after identity proof.
- **`MAX_STEPS_PER_FRAME` untouched** (the one perf-sensitive lever; fast-forward is explicitly cut per PROPOSALS discarded table).

---

## 6. Balance-harness parity deliverable

P1 changes **no power** when `waves.readyBonusCoins===0` (the default), so the 4-tier ladder and the `measure-secret-boss.mjs` ~7.2x margin are unaffected by design. The parity work is therefore *non-regression*, not re-tuning:

- **Deliverable:** test #9 above — the optimal bot, run through the **real** command API with `autoPauseOnPopup=true`, still clears 15 and reaches secret wave 16. This proves plan-mode/auto-pause/tray do not change the bot's reachable outcomes (the harness `place()` round-trips through `placementPlace`/`placementClose`, which resume the sim).
- **The optimal bot is NOT switched to call `readyNow()` in the ladder** — collapsing prep would steal its build time and shift outcomes. Instead the ready valve gets its own focused, balance-neutral test (#8).
- **Escalation rule (documented in config):** if `readyBonusCoins` is ever tuned `>0`, P1 becomes power-bearing → re-run `balance-ladder` and `measure-secret-boss.mjs` with a **ready-aware optimal bot** (`tools/balance/policies.mjs`) so the figures keep measuring the real game.

---

## 7. Dependencies on other specs

**P1 depends on nothing** — it is the substrate the other four stand on, and ships first. (Downstream: P2's unrushed-decision puzzles, P3's freeze timing, P4's fork choice, and P5's win flow all assume P1's calm plan window and zero-click coin economy. They depend on P1; P1 depends on none of them.)

---

## 8. Before / after captures (observable changes)

| Capture | Before | After |
|---------|--------|-------|
| Plan-mode occlusion | full grey scrim "Paused" (`Renderer._pause`) — board hidden | thin candy frame, board + enemies fully visible, "Play" button |
| Build tray | per-tile Cycle popup only | 2-icon tray in HUD; selected type highlighted |
| "I'm ready!" valve | silent prep countdown text only | visible countdown + big "I'm ready!" button (two-tap confirm) |
| First-placement identity | popup → place (existing) | **identical** popup → place with tray unselected (proves additive) |

Produce via `tools/harness/captureAll.mjs` (+ `visualCheck.mjs`); land under `v2/captures/before` and `v2/captures/after` (P1 subset).
