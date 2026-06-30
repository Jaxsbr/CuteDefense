# W2 — Flag Legend on the pre-wave Recon banner

## Goal (Jaco's intent)
On the pre-wave countdown / Tactical Recon banner, surface **what each incoming
enemy FLAG means** — an **icon + plain-words effect** for every flag that is
about to appear (`armored` / `evasive` / `regen` / `swarm` / `buffer`). No
hover/tooltips (mobile). Reuse the existing flag glyphs and the existing Recon
banner. A kid should read, before the wave: *which* nasties are coming and *what
to do about each*, in pictures-first words.

## What already exists (depth pass — reconcile, don't reinvent)
- **Flag defs** live in `v2/config/gameConfig.js:273-284` (`enemyFlags`):
  `order: ['armored','evasive','regen','swarm','buffer']` and per-flag
  `{ trait, glyph, animated, behavior }`. There is currently **no human-readable
  `label`/effect text** on a def — only a draw glyph name.
- **Recon data is computed per wave** in `v2/sim/systems/waveSystem.js:68-72`
  `reconFor(pattern)`: it returns only the **first** flag found
  (`threat = g.flags[0]`) plus `entry`. It does **not** collect the full set of
  incoming flags — a wave with `armored` on one group and `evasive` on another
  only ever advertises `armored`.
- The single `threat` + `entry` are stamped onto the announcement in two places:
  `beginNextWave` (waveSystem.js:94-98) and the per-second countdown
  `updatePrepare` (waveSystem.js:122-126).
- **Renderer** `_announcement` (`v2/render/Renderer.js:736-757`) calls
  `_reconBanner` (Renderer.js:759-779), which draws **one** threat glyph
  (`drawFlagGlyph`, from `SpriteCache.js:303`) plus a reverse-entry arrow.
  **Pictures only — no words.** Glyphs exist for all five flags
  (`SpriteCache.js:309-351`: spikes/shimmer/leaf/cluster/umbrella).
- Test `spawn-direction.test.mjs:86-99` (5c.4) asserts the announcement carries
  `threat` (single) + `entry`. Must stay green (backward compat).

## The concrete change
Two-part, fully design-faithful, reuses glyphs + banner:

### 1. Collect the FULL incoming-flag set (sim, pure)
`waveSystem.js` `reconFor(pattern, cfg)`: gather every distinct flag across all
groups, ordered by `enemyFlags.order` (stable, deduped), capped to
`enemyFlags.cap.max`. Return `{ threats, threat: threats[0] ?? null, entry }`.
Keep `threat` (= `threats[0]`) for backward compat. Stamp `w.threats` and add
`threats` to both announcement objects (initial + countdown).

### 2. Words on the flags (config) + render the legend (renderer)
- **Config:** add to each `enemyFlags.defs.<flag>` a `label` (1 word) and a
  `legend` (plain-words effect). Renderer reads these — no strings hardcoded in
  the renderer. Also add an `enemyFlags.recon` style block (layout constants,
  so no magic numbers in the renderer) including an `entryLabel`.
- **Renderer:** `_reconBanner` becomes a small legend **stack**: one row per
  incoming flag = existing glyph disc + `label` + `legend` text; then (if
  `entry==='end'`) one entry row = existing arrow + `entryLabel`. Layout numbers
  come from `cfg.enemyFlags.recon`. Trigger condition broadens from
  `a.threat || a.entry==='end'` to `(a.threats?.length) || a.entry==='end'`,
  with a `[a.threat]` fallback so an older announcement still renders.

### Proposed copy (kid plain-words, mobile-short)
| flag | label | legend (effect) |
|------|-------|-----------------|
| armored | Tough | Hard shell — strong towers hit best |
| evasive | Quick | Slippery — basic towers catch it |
| regen | Healer | Heals up — pop it fast |
| swarm | Swarm | Comes in a big bunch |
| buffer | Helper | Shields its friends nearby |

(entry `end`: `entryLabel: 'Comes from behind!'`)

## Config keys (new)
- `enemyFlags.defs.<flag>.label` — string, per flag (5 entries)
- `enemyFlags.defs.<flag>.legend` — string, per flag (5 entries)
- `enemyFlags.recon` — `{ glyphR, rowGap, labelSize, legendSize, padY, entryLabel }`

## Files touched
- `v2/config/gameConfig.js` — add `label`/`legend` to each flag def; add
  `enemyFlags.recon` style block.
- `v2/sim/systems/waveSystem.js` — `reconFor` collects full ordered/capped flag
  set; stamp `w.threats` + `announcement.threats` in both code paths.
- `v2/render/Renderer.js` — `_reconBanner` renders the icon+words legend stack;
  broaden the `_announcement` trigger.
- `tools/tests/recon-legend.test.mjs` — new failing-first tests.
- `tools/harness/captureP2.mjs` — point the prepare snap at a multi-flag wave so
  the legend is observable.

## Failing-first tests (`tools/tests/recon-legend.test.mjs`)
1. **unit** — multi-flag wave: announcement `threats` includes BOTH flags from
   different groups, ordered by `enemyFlags.order`, deduped, capped to `cap.max`.
   (`flags:['evasive']` group + `flags:['armored']` group ⇒ `['armored','evasive']`.)
2. **unit** — backward compat: `announcement.threat === announcement.threats[0]`
   and existing single-flag `a.threat` still set.
3. **unit (config)** — every flag in `enemyFlags.order` has a non-empty string
   `label` AND `legend`, so the renderer always has words for whatever appears.
4. **unit** — `enemyFlags.recon` exists with numeric layout keys + a string
   `entryLabel` (renderer has no magic numbers / hardcoded copy).
5. **render-capture** — `captureP2.mjs` prepare snap on a multi-flag wave shows
   each glyph with its words (manual visual gate; PNG to `v2/captures/p2/`).

## Balance impact
Pure legibility/UI; **no sim numbers move** (HP, affinity, speed, rewards
untouched; RNG stream unchanged ⇒ bench/replay determinism preserved). Indirect:
clearer counter-telegraphing should let kids pick the right tower more often,
nudging effective difficulty *down* slightly. Feed to the single post-merge
rebalance: when re-tuning flagged waves, assume players now act on the legend
(counters land more) rather than guessing. p95: a few extra text draws during
**prepare only** (no enemies on field) — negligible, stays < V1 p95.

## Dependencies
- Builds directly on the depth-pass P2 Recon plumbing (announcement
  `threat`/`entry`, `drawFlagGlyph`, `enemyFlags.defs`). No new systems.
- No dependency on the boss-tower-ultimate reversal work.

## Parallel-safe vs must-sequence
- **Shares files / must sequence** with any item that also edits
  `enemyFlags` in `gameConfig.js`, `reconFor`/the announcement schema in
  `waveSystem.js`, or `_reconBanner`/`_announcement` in `Renderer.js`. (Distinct
  keys/methods mostly merge cleanly, but treat the announcement schema and
  `_reconBanner` as a single owner to avoid conflicts.)
- **Parallel-safe** with items touching unrelated renderer methods (freeze HUD
  button, fork card, tray, plan frame) and unrelated sim systems (boss tower /
  ultimate, economy, NAP/freeze), since those don't overlap the Recon banner,
  `reconFor`, or the `enemyFlags` config sub-tree.
