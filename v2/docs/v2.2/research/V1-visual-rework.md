# V2.2 — V1-visual-rework: Boss Tower SHAPE + COLOR rework

**Branch:** `v2-depth-pass` · **Scope:** PURE RENDER · **Parallel fork:** yes

## Problem (grounded in current code)

The boss tower today is a **dark obsidian / crimson fortress** — deliberately off-palette
to read "menacing villain". Jaco finds it off-palette + dorky. The whole game otherwise
lives in a SOFT candy palette; the boss is the one black/red object on the board.

Current implementation:

- **Palette** — `v2/render/palette.js:64-70` `PALETTE.towers.boss`:
  `body:'#241F38'` (obsidian, lightness 0.17), `projectile:'#FF3B47'`, `core:'#FF5630'`
  (ember), `rim:'#C81E2C'` (blood red), `eye:'#FF6E5C'`. Comment at `:61-63` literally
  says it "breaks the towers-pop-bright law to read MENACING".
- **Shape** — `v2/render/shapes.js:45-78` `fortress()`: a battlemented keep with two tall
  **SPIKED** corner turrets and a jagged crenellated top. Selected via `shape:'fortress'`
  at `v2/config/gameConfig.js:258`.
- **Bake** — `v2/render/SpriteCache.js:162-219` `_bakeBossBody()`: dread crimson halo,
  obsidian body, ember **furnace core** clipped to the silhouette, blood-red rim, **angry
  scowling eye-slits** (`:194-203`), a **jagged gate-grin** of teeth (`:205-210`), and an
  L2 step-up of two tiny **gold crown glints** on the turret spikes (`:212-218`).
- **Sizing** — footprint-aware: `SpriteCache.js:104-114` bakes the boss at `tile*(fp/2)*sizeScale`
  (a true 2x2 bake) and routes `fp>1` to `_bakeBossBody`.
- **Existing test that ENFORCES the villain look** — `tools/tests/boss-tower-art.test.mjs`
  asserts `boss.body` lightness `< 0.35` (`:140`), `isReddish(core||projectile)` (`:142`),
  and that the bake paints a reddish tone + a dark (`l<0.4`) tone (`:193-195`). **This test
  must be inverted first** (failing-first) or the rework cannot land.

Other towers for contrast: `basic` periwinkle `#5B9DF0` (hue ~217), `strong` blue-violet
`#8453E8` (hue ~258). Enemy hues already occupy red(358), turquoise(182), azure(201),
grape(278), emerald(147), tangerine(32). **Free, distinct, cute lane: orchid-magenta
(~307).**

## Concrete change (design-faithful)

Re-skin the boss as a **friendly-but-MIGHTY crowned monarch** that stays fully inside the
soft palette. It still reads "BOSS" — but through **size (the existing 2x2), a chunky royal
border, a gold CROWN, and a big confident FACE**, never through darkness. L2 visibly steps
up: a bigger/brighter crown gem, a stronger pulsing aura, extra sparkles, and a bolder face.

Three render files (shape id kept as `'fortress'` so `gameConfig.js` is **untouched** — this
is what keeps the fork pure-render and parallel-safe; only the silhouette geometry + comment
change). A 4th file, `faces.js`, optionally hosts the new boss face helper to match the face
architecture.

### 1. `v2/render/palette.js` — replace `PALETTE.towers.boss` (`:61-70`)

```js
// BOSS (W8 / reworked V2.2): the late-game CHAMPION tower — the player's KEY to the
// secret summit. V2.1 made it an off-palette obsidian/crimson villain; V2.2 brings it
// back INTO the soft candy palette as a friendly-but-MIGHTY crowned monarch. It reads
// "boss" through SIZE (2x2), a chunky royal BORDER, a gold CROWN, and a big confident
// FACE — never through darkness. Hue: orchid-magenta, a free lane distinct from the
// periwinkle (basic) and blue-violet (strong) towers. L2 brightens the crown gem + aura.
boss: {
  body:       '#D26FC8', // orchid-magenta royal keep (hsl ~307,52,63 — SOFT, not dark)
  projectile: '#F08CD0', // soft magenta-pink bolt (was crimson; now in-palette)
  crown:      '#FFD86B', // soft gold crown — the BOSS-rank tell
  gem:        '#7FE3FF', // sky crown gem (L1 calm cyan; L2 brightens to brilliant cyan)
  border:     '#A23F9C', // deep orchid chunky rim (boss-weight outline)
  glow:       '#F6BCEE', // pale orchid aura halo
},
```

Keys `body` + `projectile` are preserved because `gameConfig.js:258,262` read them. The
old `core`/`rim`/`eye` keys are dropped (only `SpriteCache._bakeBossBody` + the art test
referenced them — both rewritten here). `crown`/`gem` are new.

### 2. `v2/render/shapes.js` — rework the `fortress()` geometry (`:41-78`)

Keep the function name + the `'fortress'` switch case (so config + shape API are stable).
Replace the spiked-turret/jagged-merlon silhouette with a **rounded royal keep + a 3-point
crown top**: a wide rounded body spanning ±`base`, a central **crown spire reaching the top
of the radius** (`minY ≈ cy − r`), flanked by two shorter rounded crown points. No jagged
spikes, no full-height side towers — softer, regal. Must remain a real multi-edge polygon
(`pathOps ≥ 12`), span ≥ `1.8r` wide, spire reach `≤ cy − 0.95r`, base reach `≥ cy + 0.95r`.

### 3. `v2/render/SpriteCache.js` — rewrite `_bakeBossBody()` (`:162-219`)

- Soft orchid **aura halo** from `B.glow` (was crimson dread halo).
- **Body**: orchid radial (`lighten(B.body,55) → B.body → darken(B.body,22)`) — same
  cheerful 3-stop volume the normal towers use, no obsidian.
- **Chunky royal border**: `B.border`, `lineWidth ≈ r*0.09` (boss-weight outline = the
  "this is bigger/tougher" tell).
- **Gold CROWN band** painted across the top of the keep in `B.crown` with a `B.gem` jewel
  centred on the spire (replaces the ember furnace core). This is the dominant boss signal.
- **Big confident FACE** via a new `drawBossFace(ctx,cx,cy,r,{level})` (in `faces.js`):
  big friendly eyes with white glints (reuse `towerEyesOpen` proportions), rosy cheeks, a
  bold determined smile. L1 = calm-confident; **L2 = bolder** (sparkle-glint eyes + a wide
  grin). No scowl, no fang-grin.
- **L2 step-up (the visible upgrade)**: brighter `B.gem` (e.g. `lighten(B.gem,30)`), a
  larger crown, an extra baked sparkle ring / corner sparkles, and the bolder face frame —
  so L2 paints strictly MORE bright styles than L1.

### 4. `v2/render/faces.js` — add `drawBossFace()` (optional but design-faithful)

`faces.js` is THE face module ("the recognisable charm — faces"). Add a `drawBossFace`
export beside `drawTowerFace`, reusing `towerEyesOpen`/`towerCheeks`. If kept inline in
`SpriteCache` instead, faces.js is untouched — caller's choice; brief lists it as touched.

### Optional renderer animation step-up (cite `Renderer.js:243`)

The idle "breathe" is `base = 1 + sin(animTime/1000*4)*0.04` for ALL towers
(`Renderer.js:243`). For the L2 boss only, a grander pulse reads as raw power. If desired,
gate a larger amplitude behind a new config key `visual.anim.bossL2BreatheAmp` (added to
the `anim` block at `gameConfig.js:372-381`) and use it when `t.typeId==='boss' && t.level>=2`.
This is the ONLY change that would touch a non-render file (one additive anim constant) and
the only one not strictly inside the 3 render files — list it as a stretch, default OFF to
keep the fork pure. The baked step-up (crown/gem/sparkle/face) already satisfies "visibly
step up boldness".

## Config keys

- **Replaced:** `PALETTE.towers.boss` block (palette.js) — new keys `body, projectile,
  crown, gem, border, glow`; removed `core, rim, eye`.
- **No sim/balance constants change.** `gameConfig.js` boss def, costs, ranges, fireRate,
  ultimate damage/cooldown — all untouched.
- **(Stretch only)** `visual.anim.bossL2BreatheAmp` if the renderer animation step-up is taken.

## Failing-first tests

Rewrite `tools/tests/boss-tower-art.test.mjs` so the SOFT/royal contract is asserted
BEFORE implementing (these fail against today's obsidian code):

1. **palette SOFT**: `boss.body` valid hex with lightness ∈ [0.45, 0.85] (NOT obsidian);
   `boss.body` NOT red-dominant; `boss.projectile` valid + NOT red-dominant; new `boss.crown`
   is a warm gold (hue ∈ [30,60]); assert **no** boss key has lightness < 0.35 (no obsidian
   survives). (Inverts current `:140,:142`.)
2. **shape**: `fortress` is multi-edge (`pathOps ≥ 12`), spans ≥ `1.8r`, central spire
   reaches `minY ≤ cy − 0.95r`, base reaches `maxY ≥ cy + 0.95r`. (Reuses current `:150-162`,
   relaxing the two-side-spikes assumption to one central spire.)
3. **bake keyed + footprint 2x**: unchanged (`:167-186`).
4. **bake reads SOFT & ROYAL** (replaces `:188-196`): styles include a warm-gold crown tone
   (hue 30-60); include a soft body tone (lightness 0.45-0.9); paint **no** near-black
   (`l < 0.30`) and **no** pure-red tone (`isReddish`).
5. **face present + L2 step-up** (NEW): bake paints white eye highlights (`#fff`/`#ffffff`)
   proving a FACE; and `cache.tower('boss',2).styles.length > cache.tower('boss',1).styles.length`
   (L2 paints strictly more — the visible upgrade), or L2 contains a brighter-gem tone absent
   in L1.

Existing `tools/tests/boss-tower.test.mjs` (sim behaviour) and all balance tests stay GREEN
untouched — this fork changes no numbers.

## Render captures (before / after, L1 + L2)

The live harness `tools/harness/captureV21.mjs` already shoots the boss at L1 (`01 boss-
tower-placed`) and L2 (`02 boss-tower-upgraded`). Procedure:

1. **BEFORE** (current obsidian code, run first): `node tools/harness/captureV21.mjs`,
   copy `01`/`02` → `v2/captures/v2.2/boss-l1-before.png`, `boss-l2-before.png`.
2. Implement the rework.
3. **AFTER**: re-run, copy → `v2/captures/v2.2/boss-l1-after.png`, `boss-l2-after.png`.

(Optionally add a tiny `tools/harness/captureBossRework.mjs` that places + upgrades a boss
and snaps just the two frames into `v2/captures/v2.2/` for a focused side-by-side.)

## Balance impact

**Zero.** No sim constant, no ultimate value, no cost/range/fireRate, no enemy HP changes.
Single-target-beam rework, bot/policy, and measure-secret-boss are NOT touched by this item.
The winnable-summit contract is unaffected by this fork.

## Bench / perf

All boss art is baked once (footprint-aware 2x bake, `SpriteCache.js:112`) and blitted.
The new shape has a comparable path-op count; crown/face are baked, not per-frame. p95
unchanged → **V2 p95 < V1 p95 holds**. (If the stretch L2-breathe amp is taken, it's one
extra multiply per boss per frame — negligible.)

## Dependencies

- **None upstream.** Pure render; reads existing `PALETTE`/`shapes`/`SpriteCache` plumbing.
- Independent of the V2.2 single-target-beam, bot/policy, and measure-secret-boss items
  (those are sim/balance files).

## Parallel safety

- **Touches:** `v2/render/palette.js`, `v2/render/shapes.js`, `v2/render/SpriteCache.js`,
  `tools/tests/boss-tower-art.test.mjs`, (opt) `v2/render/faces.js`, (opt) a capture harness.
- **Does NOT touch:** `gameConfig.js` (shape id kept `'fortress'`), any `v2/sim/*`, any
  `tools/balance/*`. → **Fully parallel-safe** with every non-render V2.2 item (beam sim,
  bot/policy, measure-secret-boss).
- **Conflicts ONLY** with another render fork that edits the same three render files; sequence
  against those.
