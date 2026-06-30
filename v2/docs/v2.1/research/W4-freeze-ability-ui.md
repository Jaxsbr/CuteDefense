# W4 — Freeze ability UI: get it off the grid, make it read as an ABILITY

**Pass:** V2.1 polish/power (branch `v2-depth-pass`)
**Type:** Pure UI / input. **No sim balance change** (the freeze numbers in `freeze:` stay byte-for-byte).
**Owner files:** `v2/render/Renderer.js`, `v2/render/palette.js`, `v2/config/gameConfig.js`, (+ a tiny pure module `v2/render/abilityHud.js`). `v2/input/InputController.js` needs **no** logic change.

---

## 1. The problem (grounded in current code)

The active FREEZE ability (landed in the depth pass, P3) is drawn as a button that **floats on the play
grid**, bottom-right of the board, and is styled identically to the admin Plan/Sound buttons.

- `v2/render/Renderer.js:895-912` `_freezeButton(state)` positions itself in **board space**:
  ```js
  const x = this.L.gridOffsetX, boardW = this.L.canvasW - x;
  const bw = 220, bh = 76, bx = x + boardW - bw - 28, by = this.L.canvasH - bh - 28;
  ```
  `bx = gridOffsetX + boardW - bw - 28` puts it squarely **over the bottom-right tiles of the play grid**,
  exactly where a kid wants to plop towers near the path exit. It contends with placement.
- `v2/render/Renderer.js:74` calls it as a free-floating overlay (`this._freezeButton(state)`) outside the
  HUD dock, alongside `_readyValve` — both painted on the board.
- It is drawn with the generic `_button(...)` helper (`Renderer.js:720`) — the **same rounded candy chrome
  as the admin Plan/Sound row** (`Renderer.js:543-544`). Nothing signals "this is YOUR power", so it reads
  as another admin toggle.
- States today are only **two**: READY (bright `#4FB3E8`, label `❄ Freeze!`) vs not-ready (dim `#8FA3B3`,
  label `❄ …`) with a left-to-right cooldown sweep (`Renderer.js:898-911`). There is **no distinct
  "actively freezing right now" state** on the button — the only feedback that a freeze is live is the
  board frost scrim (`_freezeField`, `Renderer.js:882-891`), which is easy to miss.

Why the placement is a genuine hazard, not just ugly: a tap that lands on the freeze button is caught by the
hit registry first (`InputController.js:41-42`), but the button sits *on top of placeable tiles*. Any near-miss
(or a future layout nudge) falls through to `sim.gridClick` (`InputController.js:50-54`) and gets read as a
tower placement / selection on the cell beneath. Moving the control into the HUD gutter (`gx < 0`,
`InputController.js:53`) makes that whole class of mis-tap structurally impossible.

---

## 2. The concrete change (design-faithful to Jaco's intent)

**Relocate** the freeze control off the board into a dedicated **ABILITY slot in the left HUD dock**, and
**restyle** it as a player ability (ice identity, snowflake, an "ABILITY" eyebrow label) with **three
distinct visual states**: READY / ACTIVELY-FREEZING / COOLDOWN (plus a quiet LOCKED look while
planning / between waves, since `castFreeze` is illegal outside `status==='playing'`).

### 2a. New home: the HUD ability slot
The left dock (`_hud`, `Renderer.js:513-545`) has a clean vertical gap between the selection card
(ends ~y=520) and the build tray (`_tray`, top at `H-180 = 974`, `Renderer.js:809`). Park a full-width
ability slot there:

- `x = pad (24)`, `w = hudWidth - 2*pad = 352`
- `y = canvasH - ability.bottomOffset - ability.slotH` (e.g. bottomOffset=196, slotH=92 → y=866, bottom=958,
  16px above the tray top at 974). Fully inside the dock; never over a tile.
- Draw an **"ABILITY" eyebrow label** above it (small caps, dock text color) so it is visually grouped as a
  power, distinct from the admin Plan/Sound row at the very bottom (`Renderer.js:543-544`).

Render it **from inside `_hud`** (so it's part of the always-drawn dock) and **delete the board-space call at
`Renderer.js:74`**. Rename `_freezeButton` → `_freezeAbility(state, x, y, w, h)` taking the HUD rect.

### 2b. Three states (ice identity, not admin chrome)
Classify state via a pure helper (see 2c). Each state gets its own fill/edge + glyph:

| State | When | Look | Tappable |
|---|---|---|---|
| **READY** | `status==='playing' && clock >= freeze.readyAt && clock >= activeUntil` | Bright ice `freezeReady`/`freezeReadyEdge`, crisp filled snowflake ❄, label `Freeze!`, gentle idle shimmer | yes → `action:'freeze'` |
| **ACTIVELY-FREEZING** | `clock < freeze.activeUntil` | Saturated icy-cyan `freezeActive`, snowflake spinning/pulsing, a **depleting duration ring/fill** mirroring `(activeUntil-clock)/freeze.durationMs`, label `Brrr!` | no |
| **COOLDOWN** | `status==='playing' && clock < freeze.readyAt` (and not active) | Desaturated `freezeCooldown`, dim snowflake, **left→right charge sweep** = `1-(readyAt-clock)/freeze.cooldownMs` (the existing sweep, kept), no label or a frost % | no |
| **LOCKED** | not playing (planning / prepare / won / lost) | Quiet slate, snowflake outline only, faint "zzz"/lock — the slot stays in place so the dock never jumps | no |

The existing cooldown sweep math (`Renderer.js:905-906`) and frost scrim (`_freezeField`) are reused as-is.
The new ACTIVELY-FREEZING state is the genuinely new feedback: the ability visibly "does its thing".

### 2c. Testable seam — pure helper module `v2/render/abilityHud.js`
Pure rendering can't be asserted headlessly (no canvas — see the note atop `tools/tests/cute-soul.test.mjs`).
So extract the two decisions the renderer makes into pure, canvas-free exports that tests can call directly:

```js
// v2/render/abilityHud.js
export function freezeSlotRect(layout, cfg) {        // HUD-space rect, no canvas
  const a = cfg.visual.ability, pad = a.pad;
  const w = layout.hudWidth - pad * 2;
  const h = a.slotH;
  const y = layout.canvasH - a.bottomOffset - h;
  return { x: pad, y, w, h };
}
export function freezeUiState(state, cfg) {           // 'ready'|'active'|'cooldown'|'locked'
  if (state.clock < state.freeze.activeUntil) return 'active';
  if (state.status !== 'playing') return 'locked';
  return state.clock >= state.freeze.readyAt ? 'ready' : 'cooldown';
}
export const freezeCastable = (s) => freezeUiState(s, null) === 'ready';
```

`_freezeAbility` imports both, computes the rect, switches styling on the state string, and registers the
`'freeze'` hit-rect **only** when state is `'ready'`. This keeps `castFreeze`'s legality (`Simulation.js:255-263`)
and the renderer's drawn affordance in lock-step, and gives tests a headless contract.

### 2d. Input — no change
`InputController._dispatch` already routes `case 'freeze': sim.castFreeze()` (`InputController.js:72`) and the
`f`/`F` key (`InputController.js:81`). The hit-rect is still registered through the renderer's `addHit`, so
hit-testing (`InputController.js:41-42`) keeps working from its new HUD location with zero input edits.

---

## 3. Config keys

**`v2/render/palette.js`** — extend the `ui` block (`palette.js:99-137`) with an ice ability ramp:
```js
// ability: field-freeze ice identity (distinct from admin btn* ramp)
freezeReady: '#5BC8F0',     freezeReadyEdge: '#2E7FB8',
freezeActive: '#7FE3FF',    freezeActiveEdge: '#3FA8D6',
freezeCooldown: '#8FA3B3',  freezeCooldownEdge: '#5A6B7A',
freezeLocked: '#A9B4C2',    freezeLockedEdge: '#7A8694',
freezeSweep: '#EAFBFF',     abilityLabel: '#CFE8FF',
```
(These are the colors currently hardcoded at `Renderer.js:900-908` — `#2E7FB8 #4FB3E8 #5A6B7A #8FA3B3 #EAFBFF`
— now named and promoted to the palette, satisfying the no-magic-numbers rule.)

**`v2/config/gameConfig.js`** — add a geometry block under `visual` (near `freezeTintMs`, line 303):
```js
ability: {
  slotH: 92,          // HUD ability slot height (px)
  bottomOffset: 196,  // slot bottom = canvasH - this (sits 16px above the tray top at H-180)
  pad: 24,            // matches the dock pad used throughout _hud
  labelGap: 26,       // "ABILITY" eyebrow baseline above the slot
  sweepAlpha: 0.30,   // cooldown charge fill opacity (was hardcoded 0.30, Renderer.js:908)
  ringAlpha: 0.55,    // ACTIVELY-FREEZING depleting duration ring opacity
},
```
No keys under `freeze:` change — balance is untouched.

---

## 4. Failing-first tests

New file `tools/tests/freeze-ui.test.mjs` (node:test), all headless via the pure `abilityHud.js` seam:

1. **`freeze slot is off the play grid`** *(unit)* — `freezeSlotRect(CONFIG.layout, CONFIG)` returns a rect
   with `r.x >= 0 && r.x + r.w <= CONFIG.layout.gridOffsetX`. Fails today (no function; the current geometry
   at `Renderer.js:897` puts `bx >= gridOffsetX`, on the board).
2. **`freeze slot clears the build tray`** *(unit)* — `r.y + r.h <= CONFIG.layout.canvasH - 180` (tray top)
   and `r.y > 0`. Guards the dock from overlap.
3. **`freezeUiState classifies all four states`** *(unit/sim)* — drive a `Simulation`: fresh playing state with
   `clock < readyAt` → `'cooldown'`; advance past `readyAt` → `'ready'`; call `castFreeze()` then check
   `clock < activeUntil` → `'active'`; enter planning (`togglePlanning`) → `'locked'`. Fails today (no helper;
   renderer only computes a single boolean `ready`).
4. **`castable only in ready`** *(unit)* — for each of the four states assert the hit-action the renderer would
   register (`state==='ready' ? 'freeze' : null`) matches `freezeUiState`; i.e. cooldown/active/locked register
   no `'freeze'` rect. Pins the affordance to `castFreeze`'s legality (`Simulation.js:258`).
5. **`freeze sim contract unchanged`** *(balance/regression)* — re-assert the existing P3 invariant (the same
   one `tools/tests/freeze.test.mjs` covers): one `castFreeze` slows all alive enemies and the freeze
   `durationMs`/`cooldownMs` are byte-identical to before. Proves this pass is UI-only.

---

## 5. Captures (observable change)

Regenerate the freeze shots in **`tools/harness/captureP3.mjs`** (it already drives the live app over CDP and
snaps the freeze field + freeze button, saving to `v2/captures/p3/`). Add three HUD-anchored frames:

- `freeze-ready.png` — ability slot in the dock, READY (bright ice).
- `freeze-active.png` — set `s.freeze.activeUntil = s.clock + 1500`, render → ACTIVELY-FREEZING with the
  depleting ring, board frost scrim visible.
- `freeze-cooldown.png` — set `s.freeze.readyAt = s.clock + 20000`, render → COOLDOWN sweep.

These prove (a) the control is in the dock, off the grid, and (b) the three states are visually distinct.
Also re-run `tools/harness/captureAll.mjs` so `02-gameplay.png` reflects the cleared board corner.

---

## 6. Balance impact (feeds the single post-merge rebalance)

**None.** No key under `freeze:` (`gameConfig.js:232-239`) changes; `castFreeze` (`Simulation.js:255-263`) and
`effectiveSpeed`'s single slow term (`enemySystem`) are untouched. The only *indirect* effect is ergonomic:
the ability becomes easier to find and harder to mis-tap, so real-play freeze uptime may rise slightly toward
the bot-optimal the harness already assumes — which is the intended legibility win, not a balance change. The
post-merge rebalance can treat freeze numbers as fixed. The harness freeze-aware policy (`tools/balance/policies.mjs`)
needs no change (it triggers on sim state, not pixels).

---

## 7. Dependencies & parallelism

**Depends on:** nothing in this pass — the P3 freeze sim seam already exists and is stable.

**Shares files with (must SEQUENCE):**
- **The boss-tower manual-ultimate UI item** (this pass's headline reversal). That item also adds a HUD
  *ability* affordance + an `InputController._dispatch` case + ability colors in palette/config. It and W4
  both edit `Renderer._hud` / the ability dock region, `palette.js ui`, and `gameConfig.js visual`. **Land W4
  first** (it establishes the reusable `abilityHud.js` slot/state pattern + the `ability` config block +
  ability color ramp); the boss-ultimate item then slots a second ability into the same dock idiom and adds
  its own `case 'ultimate':` to `_dispatch`. Doing them concurrently will collide in `_hud`, `palette.ui`, and
  `visual.ability`.
- Any other item touching `Renderer._hud` layout (e.g. economy/upgrade-card legibility tweaks) shares the dock
  and should sequence with W4.

**Parallel-safe with:** all pure-sim items (enemy flags, affinity, balance retune, secret-wave/boss HP, win/star
logic) — they don't touch `Renderer.js`, `palette.js`, or the `visual.ability` config. Sprite/asset items are
also safe (different files; `abilityHud.js` draws with primitives, no new sprites).
