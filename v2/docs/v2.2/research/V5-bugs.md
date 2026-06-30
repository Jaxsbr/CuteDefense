# V2.2 Work Item — V5-bugs (boss-cost text overlaps)

Two render-layout overlaps introduced when the **boss** tower (a 3rd tower type at
the first-ever **3-digit cost, `250`**) joined the build surfaces:

- **(a) LEFT build/ability tray** — the cost `250` is drawn behind the tower icon,
  so the leading `2` is hidden and it reads as **`50`** (before-capture
  `v2/captures/v2.2/before/05-bug-tray-cost-overlap.png`).
- **(b) Tower-PLACEMENT popup buy button** — the `250` sits hard against the gold
  coin / right edge, a *slight* crowding (before-capture
  `v2/captures/v2.2/before/06-bug-placement-overlap.png`).

This is **pure render layout/format**. It touches no sim, no balance, no win
mechanic. It is a *parallel fork* relative to the boss-tower single-target /
sprite / rebalance work — same-file overlaps only (`Renderer.js`, `gameConfig.js`),
in **disjoint functions / config sections**.

---

## 1. Current state (cited)

### Root cause is a layout that was tuned for 2 tower types + ≤2-digit costs

`v2/config/gameConfig.js:18` `layout.hudWidth = 400`. The build tray divides this
width by **N tower types**. Before the boss there were 2 types
(`basic`, `strong`); now `towerTypeIds()` discovers **3**
(`v2/sim/systems/towerSystem.js:17` — filters config keys whose value has a
`levels` array, so `basic`, `strong`, `boss`). Adding a 3rd cell shrinks each
cell, and the boss is also the first **3-digit** cost
(`v2/config/gameConfig.js:265` — boss L1 `cost: 250`).

### Bug (a): `_tray` — cost right-aligned ON TOP of a fixed-width icon

`v2/render/Renderer.js:920` `_tray(state)`:

```
925   const W = ...hudWidth(400); pad = 24; gap = 16;
925   const ty = H-180, th = 64, bw = (W - pad*2 - gap*(n-1)) / n;   // n=3 -> bw ≈ 106.7
934-936 icon: drawn at x+12, thumb = th-18 = 46px (psc keeps max dim ≤ 46)
937   ctx.font = `bold 22px ${this.F.body}`;
938   ctx.textAlign = 'right';
939   ctx.fillText(`${cost}c`, x + bw - 14, ty + th/2);            // "250c"
```

Numerics (n=3, `bw ≈ 106.7`):
- icon right edge ≈ `x + 12 + 46 = x + 58`
- `"250c"` at bold 22px ≈ **48px** wide → right edge `x + 92.7`, **left edge `x + 44.7`**
- left edge `x+44.7` < icon right `x+58` → **~13px overlap**; the leftmost glyph
  (`2`, ~12px) sits fully behind the icon → reads **`50c`**. ✔ matches the bug.

There is **no shrink-to-fit** here (unlike the tower card, which has one) and the
cost is **not routed through `fmtStat`** (the W6 single formatter,
`v2/render/format.js:10`). Note `_tray` already carries inline geometry constants
(`pad 24`, `gap 16`, `ty H-180`, `th 64`) — the file's existing idiom.

### Bug (b): `_towerBuyButton` — coin+cost positioned with a fixed offset tuned for 2 digits

`v2/render/Renderer.js:432` `_towerBuyButton(x, y, w, h, …)`, popup button `w = 248`
(`Renderer.js:385` `CW = 248`):

```
440-443 tower thumbnail at x+14 (left)
445   const coinX = x + w - 86, coinY = y + h/2;     // FIXED 86px-from-right offset
446-448 gold coin (radius 16) at coinX
449   ctx.font = `bold 30px ${this.F.body}`;
450   ctx.textAlign = 'left';
451   ctx.fillText(String(cost), coinX + 24, coinY + 1);   // left-aligned "250"
```

For `"250"` at bold 30px (~50px): text spans `x+186 → x+236`, coin spans
`x+146 → x+178`. It does not collide with another glyph, but the **`86`/`+24`
offsets were sized for ≤2-digit costs**: a 3-digit number runs to `x+236`,
**12px from the 248px button edge** (inside the 3px stroke + inner gloss at
`Renderer.js:438`), reading as the "slight overlap." Cost is `String(cost)` (also
not `fmtStat`), and a hypothetical 4-digit cost would clip. The fix makes the
coin+cost a **measured right-anchored group** so any digit count sits clean.

### Existing reusable seam (W6) to lean on

`Renderer._statLine` (`Renderer.js:680`) already shrinks a font from a base size
down to `cfg.visual.statMinFontPx` (`gameConfig.js:369`, `13`) on genuine
overflow. The fix **extracts that loop into a pure `fitFontPx`** in `format.js` and
reuses it in `_tray`, `_towerBuyButton`, and `_statLine`.

### Before-state evidence already exists

`tools/harness/captureV22before.mjs:205-241` already snaps both surfaces
(`05-bug-tray-cost-overlap.png`, `06-bug-placement-overlap.png`) and asserts the
preconditions (`boss in tray`, `bossCost === 250`). The after-capture mirrors it.

---

## 2. Concrete change (design-faithful)

### 2.1 `v2/render/format.js` — add pure `fitFontPx` (extract the W6 shrink loop)

```js
// Pure: shrink from basePx down to minPx until widthAt(px) fits maxW.
// widthAt(px) measures the text at that px (renderer passes a ctx-measure closure;
// tests pass a synthetic avg-glyph model). The SINGLE auto-fit primitive — _statLine,
// the tray cost, and the buy-button cost all route through it (no forked loops).
export function fitFontPx(widthAt, basePx, minPx, maxW) {
  let px = basePx;
  while (px > minPx && widthAt(px) > maxW) px -= 1;
  return px;
}
```

### 2.2 `v2/config/gameConfig.js` — add `visual.tray` + `visual.buyButton` (no magic numbers)

Inside the `visual:` block (after `statMinFontPx`, `gameConfig.js:369`):

```js
// V2.2 V5-bugs — build-tray cost layout (boss is the first 3-digit cost).
tray: {
  iconThumb: 40,       // tray icon size (was inline th-18=46; shrunk to free cost room)
  iconGap: 6,          // min gap between the icon's right edge and the cost text
  costInset: 12,       // cost text right inset within the cell
  costBaseFontPx: 22,  // start size (matches the prior inline 22px)
  costMinFontPx: 14,   // auto-shrink floor (kid-legible; sibling of statMinFontPx)
},
// V2.2 V5-bugs — placement-popup buy-button coin+cost group (measured, right-anchored).
buyButton: {
  coinR: 16,           // gold coin radius (was inline)
  coinGap: 12,         // gap between coin right edge and cost left edge
  costInset: 16,       // cost group right inset within the button
  costFontPx: 30,      // cost size (matches the prior inline 30px)
},
```

> Budget check with the new tray block (n=3, `bw≈106.7`): icon right `x+52`,
> cost right `x+94.7`, budget `= 94.7 − (52+6) ≈ 36.7px`. `"250c"` shrinks via
> `fitFontPx` from 22px to ~16px (≈35px) → **fits, no overlap**, stays ≥ the 14px
> floor. 2-digit `"50c"`/`"55c"` stay at the full 22px. (If a future 4th type makes
> 36.7px too tight even at 14px, the floor clamps and the text right-aligns inside
> the budget — still no icon overlap, just smaller.)

### 2.3 `v2/render/Renderer.js` `_tray` (lines 934-939) — budget + auto-fit + fmtStat

Replace the icon-size constant and the cost block:

```js
import { fitFontPx, fmtStat } from './format.js';        // (fmtStat already imported, line 17)
// ...
const T = this.cfg.visual.tray;
const thumb = T.iconThumb, psc = thumb / Math.max(sp.canvas.width, sp.canvas.height);
ctx.drawImage(sp.canvas, x + 12, ty + (th - sp.canvas.height * psc) / 2,
              sp.canvas.width * psc, sp.canvas.height * psc);

const costTxt = `${fmtStat(cost, 0)}c`;                  // W6 formatter; 0 dp (cost is integer)
const iconRight = x + 12 + sp.canvas.width * psc;
const costRight = x + bw - T.costInset;
const budget = costRight - (iconRight + T.iconGap);
ctx.fillStyle = sel ? '#fff' : u.textOnCard;
const px = fitFontPx(
  (p) => { ctx.font = `bold ${p}px ${this.F.body}`; return ctx.measureText(costTxt).width; },
  T.costBaseFontPx, T.costMinFontPx, budget);
ctx.font = `bold ${px}px ${this.F.body}`;
ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
ctx.fillText(costTxt, costRight, ty + th / 2);
```

### 2.4 `v2/render/Renderer.js` `_towerBuyButton` (lines 444-451) — measured right-anchored group

```js
// gold coin + cost (right) — measured group so any digit count clears the edge.
const BB = this.cfg.visual.buyButton;
const costTxt = fmtStat(cost, 0);
ctx.font = `bold ${BB.costFontPx}px ${this.F.body}`;
const cw = ctx.measureText(costTxt).width;
const costRight = x + w - BB.costInset;
const coinX = costRight - cw - BB.coinGap - BB.coinR;
const coinY = y + h / 2;
ctx.fillStyle = this.G.base; ctx.beginPath(); ctx.arc(coinX, coinY, BB.coinR, 0, Math.PI*2); ctx.fill();
ctx.strokeStyle = this.G.deep; ctx.lineWidth = 3; ctx.stroke();
ctx.fillStyle = '#FFFDE7'; ctx.beginPath(); ctx.arc(coinX - 5, coinY - 5, 5, 0, Math.PI*2); ctx.fill();
ctx.fillStyle = afford ? '#FFFFFF' : '#FFD6D6';
ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
ctx.fillText(costTxt, costRight, coinY + 1);
```

(`coinX` for `"250"`: `costRight=x+232`, `cw≈50`, `coinX = x+232−50−12−16 = x+154`;
coin left edge `x+138` clears the thumbnail's right edge `≈x+72`. Clean for 1–4 digits.)

### 2.5 (Optional, recommended) refactor `_statLine` to call `fitFontPx`

`_statLine` (`Renderer.js:680-688`) keeps its own copy of the loop; point it at
`fitFontPx` so there is exactly one auto-fit primitive. Behavior-identical;
`card-overflow.test.mjs` / `text-format.test.mjs` (165-test baseline) guard it.

---

## 3. Tests (failing-first)

### 3.1 `tools/tests/tray-cost-fit.test.mjs` — NEW (render-capture, modeled measure)

Mirrors `card-overflow.test.mjs`: re-models the renderer's tray/button geometry
from `CONFIG`, uses an avg-glyph stub measure, and imports the **real**
`fitFontPx` + `fmtStat`. Fails on today's build (overlap), passes after the fix.

- **unit**: `fitFontPx((p)=>p, 22, 14, 10)` returns `10` (shrinks to first px whose
  width ≤ maxW); `fitFontPx((p)=>5, 22, 14, 100)` returns `22` (no shrink);
  never returns below `minPx`.
- **render-capture (the bug)**: with n=3 and boss `cost=250`, compute
  `iconRight`, `costRight`, `budget`, then the fitted `px` and the rendered cost
  width (avg-glyph). Assert **`costLeftEdge ≥ iconRight`** (no overlap) AND
  `px ≥ cfg.visual.tray.costMinFontPx`. *This assertion fails against the current
  fixed-22px / x+bw-14 math (left edge ≈ x+44.7 < icon right x+58).*
- **render-capture (buy button)**: model `_towerBuyButton` group for boss `250`:
  assert `coinRightEdge + coinGap ≤ costLeftEdge` AND `costRight ≤ buttonRight`
  AND coin left edge ≥ thumbnail right edge. Fails against the fixed `x+w-86`
  offset only for the boundary 4-digit case today, but pins the invariant so the
  group layout can't regress.
- **format**: `fmtStat(250, 0) === '250'`, `fmtStat(55, 0) === '55'` (cost routes
  through W6).

> Fail-first binding to shipped code: extract the tray/button geometry into a tiny
> pure helper the test imports (e.g. `trayCostLayout(cfg, n, sp)` /
> `buyCostLayout(cfg, w, cw)` co-located in `Renderer.js` export or a new
> `v2/render/trayLayout.js`), land it FIRST as a faithful copy of the **current
> broken** math so the new test genuinely fails, then apply the §2 fix to the
> helper so it passes. (Same pattern card-overflow used with `towerCardLines`.)

### 3.2 Regression guard

`npm test` — the full suite (boss-tower, card-overflow, text-format, freeze-ui,
sprite-fit, …) must stay green; §2.5 touches the shared `_statLine` loop.

### 3.3 Render-capture (visual evidence)

Add `tools/harness/captureV22V5after.mjs` (clone of the relevant blocks in
`captureV22before.mjs:205-241`) writing to `v2/captures/v2.2/after/` —
`05-bug-tray-cost-overlap.png` → now legible `250`, and
`06-bug-placement-overlap.png` → coin+`250` clear of the edge. Before/after pair
is the human-facing proof.

---

## 4. Balance impact

**None.** Pure render layout/format: no sim, no economy, no wave/boss tuning, no
win mechanic. The single-target ultimate rework and the winnable-summit re-derivation
are untouched by this item. `measure-secret-boss.mjs` / the bot policies are not
involved. `npm run bench` p95 is unaffected — `fitFontPx` adds at most a few
`measureText` calls per HUD frame (already the norm in `_statLine`), well inside the
V2 ~23ms budget; the new constants are static config reads.

---

## 5. Config keys touched

- **Added**: `visual.tray.{iconThumb, iconGap, costInset, costBaseFontPx, costMinFontPx}`,
  `visual.buyButton.{coinR, coinGap, costInset, costFontPx}` (`gameConfig.js`, inside
  the `visual:` block ~line 369).
- **Read**: `layout.hudWidth` (400), `visual.statMinFontPx` (sibling reference),
  `visual.font.body`, `towers.boss.levels[0].cost` (250).

---

## 6. Dependencies & parallel-safety

- **Depends on**: nothing functional. The boss must exist as a tray type (it
  already does, `towers.boss` in config) — true on this branch regardless of the
  single-target rework. Can land **independently and first**.
- **Files shared with other V2.2 forks**:
  - `v2/render/Renderer.js` — this item edits `_tray` (~934-939) and
    `_towerBuyButton` (~444-451); the boss-sprite / ultimate-button forks edit
    different functions (`_freezeAbility`/`_ultimateButton` ~1036+, boss draw).
    **Disjoint line ranges → trivial merge**, but same file ⇒ not strictly
    isolated; sequence or expect a clean auto-merge.
  - `v2/config/gameConfig.js` — this item adds to the `visual:` block (~369); the
    boss rework edits `towers.boss` (~257-287) and `waves`/balance. **Different
    sections → trivial merge.**
- **Exclusive (fully parallel-safe)**: `v2/render/format.js` (new export),
  `tools/tests/tray-cost-fit.test.mjs` (new), `tools/harness/captureV22V5after.mjs`
  (new), `v2/captures/v2.2/after/*` (new).
- **Parallel-safe with**: every other V2.2 item (V1 visual, V3 economy, V4 pause,
  V6 catalog) — no logical coupling. Only the two shared files above force a
  cosmetic sequencing if run truly concurrently.
