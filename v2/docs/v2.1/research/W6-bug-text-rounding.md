# W6 — BUG: unrounded stat numbers + card text overflow

## Problem (grounded in current code)

The tower management card prints raw floats. The documented spill `Range 4.8000000000000001`
comes straight from the **Sniper fork** at L3:

- `v2/config/gameConfig.js:195` — basic L3 `range: 3`
- `v2/config/gameConfig.js:200` — `sniper: { ... rangeMult: 1.6 }`
- `v2/sim/systems/towerSystem.js:48` — `out.range *= fork.rangeMult` → `3 * 1.6 = 4.800000000000001` (confirmed in node)
- `v2/render/Renderer.js:649` — `ctx.fillText(\`Damage ${es.bombDamage ?? es.damage}   Range ${es.range}\`, ...)`
  renders that raw float. This is the **forked-L3 branch** (`pv.from`/`pv.to` are absent once a
  tower is at max level), which is exactly when a fork multiplier has been applied — so the bug
  is reachable in normal play, not a corner case.

Card geometry: `hudWidth: 400` (`gameConfig.js`), `pad = 24` (`Renderer.js:515`), so the card is
`352px` wide; stat text starts at `x + 110` (`Renderer.js:649`), leaving ~`232px` of budget. The
17px line `Damage 138   Range 4.800000000000001` is ~50 chars and blows well past that budget,
spilling outside the card border drawn by `_card()` at `Renderer.js:631`.

Other displayed numerics audited:
- `Renderer.js:645-646` preview deltas (`pv.from/to.damage|range`): sourced from `levelStats`
  config literals (`2, 2.5, 3, …`) — clean today, but unguarded if a future curve introduces a
  fraction. Format them too for safety.
- `Renderer.js:654` Power: already `Math.round`ed in `powerScalar` (`towerSystem.js:64`) — wrap for
  consistency, no behavior change.
- `Renderer.js:650` Fire uses `toFixed(2)` (intentional fixed-time display) — leave as-is.
- Costs (`Renderer.js:444,661,694,824`), enemy HP/reward (`Renderer.js:716-717`): integers from
  config / `Math.ceil` — already safe.

So the **only live overflow** is the forked-stat line; `120 * 1.15 = 138` (Bomber) happens to be
exact, so Sniper range is the single reproducing case — but the fix must be general.

## Concrete change (design-faithful)

Jaco's intent: "round/format every displayed numeric, fix overlap." Two pieces:

1. **One pure formatter** — new file `v2/render/format.js`:
   ```js
   export function fmtStat(n, decimals = 2) {
     if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
     const f = 10 ** decimals;
     return String(Math.round(n * f) / f); // 4.800000000000001 -> "4.8"; 138 -> "138"; 2.5 -> "2.5"
   }
   ```
   `String(Number)` drops trailing zeros for free, so no `2.50`/`2.500` noise. Pure, no canvas →
   clean unit test.

2. **Config constant** (no magic number in renderer): add `statDecimals: 2` to the `visual` block
   in `gameConfig.js` (alongside `effectsEnabled`/`anim`, ~`gameConfig.js:289`). Renderer reads
   `this.cfg.visual.statDecimals`.

3. **Apply in `_towerCard`** (`Renderer.js:645-655`): route every range/damage/power through the
   formatter, e.g. `const F = (n) => fmtStat(n, this.cfg.visual.statDecimals)`:
   - `Damage ${F(pv.from.damage)} → ${F(pv.to.damage)}`
   - `Range ${F(pv.from.range)} → ${F(pv.to.range)}   Fire …`
   - `Damage ${F(es.bombDamage ?? es.damage)}   Range ${F(es.range)}`
   - `Power ${F(pv.powerFrom)} → ${F(pv.powerTo)}`

4. **Overlap guard (layout)**: rounding alone fixes the documented spill, but the combined
   `Range … → …   Fire …→…s` line is the longest and stays tight (~224px of ~232px budget). Add a
   small measure-and-shrink helper so no stat line can ever exceed the card, now or under future
   tuning:
   ```js
   _statLine(text, x, y, maxW, basePx) {
     const ctx = this.ctx; let px = basePx;
     ctx.font = `${px}px ${this.F.body}`;
     while (px > this.cfg.visual.statMinFontPx && ctx.measureText(text).width > maxW) {
       px -= 1; ctx.font = `${px}px ${this.F.body}`;
     }
     ctx.fillText(text, x, y);
   }
   ```
   with `maxW = w - 110 - 16` and new config `visual.statMinFontPx: 13`. Stat lines at
   `Renderer.js:645-650` draw through `_statLine`. Kid-legibility preserved: shrink only triggers
   on genuine overflow and floors at 13px.

To make the overlap testable without instantiating the canvas-bound `Renderer`/`SpriteCache`,
extract the line composition into a pure helper in `towerSystem.js`:
`towerCardLines(state, tower, fmt) -> { statLines: string[], power: string }`, consumed by both
`_towerCard` and the render-capture test.

## Config changes

- `visual.statDecimals: 2`
- `visual.statMinFontPx: 13`

## Files touched

- `v2/render/format.js` (new) — `fmtStat`.
- `v2/config/gameConfig.js` — `visual.statDecimals`, `visual.statMinFontPx`.
- `v2/sim/systems/towerSystem.js` — pure `towerCardLines(state, tower, fmt)` helper.
- `v2/render/Renderer.js` — import `fmtStat`; format stat/power lines (645-655); add `_statLine`
  measure-and-shrink; render via `towerCardLines`.

## Tests (failing-first)

1. **unit** `tools/tests/text-format.test.mjs` — `fmtStat(3*1.6) === '4.8'`,
   `fmtStat(120*1.15) === '138'`, `fmtStat(2.5) === '2.5'`, `fmtStat(18) === '18'`; and an
   integration assertion: build basic → fork `sniper` at L3, `fmtStat(effectiveStats(...).range)`
   yields no `/\d\.\d{4,}/` and equals `'4.8'`.
2. **render-capture** `tools/tests/card-overflow.test.mjs` — drive real `Simulation` to a
   forked-Sniper L3 tower, get `towerCardLines(...)`, run each line through a stub
   `measureText (s) => ({ width: s.length * AVG })` at `visual.statDecimals` precision, assert
   every line width ≤ card text budget (`352 - 110 - 16`). Fails today because the raw-float line
   is ~50 chars.

## Balance impact

None — display-only formatting and font auto-shrink. No sim/economy/combat constant changes; the
`visual.*` additions are render-only. Feeds the post-merge rebalance as a no-op.

## Dependencies & parallelism

- **No hard dependency** on other items.
- **Shares `Renderer.js` and `gameConfig.js`** with every other UI/card item — notably the
  **boss-tower ultimate HUD/card** work and any item that adds new stat lines (those should route
  their numbers through `fmtStat` too). Must **sequence** (or carefully merge) with anything else
  editing `_towerCard`, the `visual` config block, or `towerSystem.js` stat helpers.
- **Parallel-safe** with pure-sim / balance / boss-HP items that don't touch `Renderer.js`,
  `format.js`, or the `visual` config block (e.g. enemy-flag, freeze-balance, wave-tuning work).
- Recommended ordering: land this **early** so later card/HUD items inherit `fmtStat` and the
  overflow guard rather than re-introducing raw-float prints.
