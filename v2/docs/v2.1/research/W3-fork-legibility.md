# W3 — Fork legibility (Sniper / Gunner / Bomber / Froster)

## Problem (grounded in current code)

At L3 a tower forks into one of two arms. The choice is made on the tower card's
fork row, which is **picture-only by deliberate P4 design**:

- `v2/render/Renderer.js:670-704` `_forkRow` draws ONLY the procedural fork icon
  (`drawForkIcon`, `Renderer.js:690`) plus a `✓` (chosen) or `+20c` (re-fork)
  badge. No words. The comment at `Renderer.js:670-672` says "picture-only fork
  buttons … no role words".
- The arm's human name (`Sniper`/`Gunner`/`Bomber`/`Froster`) is only painted in
  the card TITLE, and only AFTER the arm is already chosen
  (`Renderer.js:636-638`, `forkDef.name`). So at the moment of the decision the
  kid sees two abstract glyphs (scope-ring vs three pips; starburst vs snowflake —
  `SpriteCache.js:365-419`) and nothing telling them what each DOES.
- Config already carries `name` + a sprite `icon` per arm but no plain-words
  description: `gameConfig.js:199-202` (basic → sniper/gunner) and
  `gameConfig.js:223-226` (strong → bomber/froster).

There is no hover/tooltip (mobile constraint), so the only place a 5-10yo can
learn the difference is on the card itself. Today it teaches nothing pre-choice.

## Chosen option: inline plain-words on the fork card (rejected: a separate legend)

Two candidates were considered:

1. **Plan-time "what-is-what" legend** — a global panel listing the four arms.
   Rejected: forks are a per-tower, contextual decision that can happen mid-run,
   not only in plan mode; a separate legend forces cross-referencing and adds a
   whole new HUD surface. More renderer, less legible.
2. **Inline plain-words on the fork buttons (CHOSEN).** Put the arm name +
   a short kid-words blurb right next to each fork icon, visible BEFORE the tap.
   It reuses the existing card, is mobile-safe (no hover), reuses the existing
   `name`, and puts the explanation exactly where the decision is made.

This is the FOCUS's own first example and is the clearest option. It intentionally
overturns the P4 "no role words" micro-decision for this one surface — the
explicit goal of this pass is legibility for kids.

## Concrete change

1. **Config — add a kid plain-words `blurb` to each fork arm** (no magic strings
   in the renderer; all four live in `gameConfig.js` beside the existing `name`):
   - `towers.basic.forks.sniper.blurb`  = `'Far + big hits'`
   - `towers.basic.forks.gunner.blurb`  = `'Shoots fast'`
   - `towers.strong.forks.bomber.blurb` = `'Bigger boom'`
   - `towers.strong.forks.froster.blurb`= `'Freezes them'`

2. **towerSystem — a pure, testable label helper** (mirrors `forkArmsFor`,
   `towerSystem.js:22`):
   ```js
   export function forkLabel(cfg, typeId, arm) {
     const f = cfg.towers[typeId]?.forks?.[arm];
     return f ? { name: f.name, blurb: f.blurb } : null;
   }
   ```
   Renderer imports it alongside `forkArmsFor`/`effectiveStats`
   (`Renderer.js:16`). This keeps the strings pure-data and unit-testable headless
   (the canvas itself is not).

3. **Renderer `_forkRow` — show icon + name + blurb per button.** Lay each button
   as: icon on the left (kept, `drawForkIcon` at `bx + h*0.5`), then two stacked
   text lines to its right — `name` (bold display font) over `blurb` (small body
   font, the existing muted `#7C6A95`). Move the `+20c` / `✓` affordance to a
   small top-right corner badge so it no longer occupies the word column
   (`Renderer.js:691-699`). Bump the fork-button height from 44 → 58 and the
   tower-card height from 250 → 270 (`Renderer.js:631`), shifting the Sell button
   from `y+190` → `y+212` so nothing overlaps. The fork hit-rect
   (`addHit('fork', …)`, `Renderer.js:702`) follows the new button geometry — the
   two-rect contract from `captureP4.mjs` (b) is preserved.

No sim/balance logic changes; `effectiveStats`, `forkSelected`, the fork economy
and the secret-boss margin are all untouched.

## Config keys

- `towers.basic.forks.sniper.blurb`
- `towers.basic.forks.gunner.blurb`
- `towers.strong.forks.bomber.blurb`
- `towers.strong.forks.froster.blurb`

(Optionally a UI constant `ui.forkButtonH = 58` / card height if you want to keep
the renderer free of literals; current renderer already hard-codes 44/250 inline,
so matching that style is acceptable.)

## Tests (failing-first)

1. `tools/tests/fork-legibility.test.mjs` (unit) — `forkLabel` returns
   `{name, blurb}` for every arm of every tower type; each `blurb` is a non-empty
   string, distinct from `name`, and short (≤ ~16 chars so it fits the button).
   Fails first because `blurb` and `forkLabel` don't exist yet.
2. Same file (unit) — `forkLabel(cfg, 'basic', 'bomber')` and
   `forkLabel(cfg, 'strong', 'sniper')` return `null` (arm not valid for type),
   mirroring the rejection test at `fork.test.mjs:167-175`.
3. `tools/harness/captureP4.mjs` (render-capture) — extend the existing fork-card
   snap to assert the card pixels now contain the blurb text (e.g. region
   non-empty / differs from the icon-only baseline), and save an after-capture
   showing words beside both fork icons.

## Balance impact

None — pure presentation + config strings. No change to stats, economy, the
4-tier ladder, or the secret-boss margin. Feeds the single post-merge rebalance:
nothing.

## Captures

- `v2/captures/p4/fork-card.png` (regenerated): the L3 fork choice card now shows
  `Sniper / Far + big hits` and `Gunner / Shoots fast` (and the strong-tower
  pair) beside their icons.

## Dependencies & parallelism

- **dependsOn:** none functionally. The fork `name`/`forks` config and
  `forkArmsFor`/`drawForkIcon` already exist (P4); this is purely additive.
- **Shares files (must sequence) with any other V2.1 item that edits:**
  - `v2/render/Renderer.js` — the most-contended file (every depth-pass spec
    touched it; see `DEPENDENCY-GRAPH.md:38`). In particular the **boss-tower
    ultimate** item (HUD button + likely card work) and any item retouching
    `_towerCard`/`_forkRow` must serialize with this one.
  - `v2/config/gameConfig.js` — any item adding tower/fork config keys.
  - `v2/sim/systems/towerSystem.js` — additive `forkLabel`; conflicts only with
    an item editing the same export region.
- **parallelSafe with:** items that don't touch those three files — e.g. pure
  enemy/wave/sim-only balance work, audio, map data, or freeze/nap-only tuning
  that stays out of `_forkRow` and the fork config block.
