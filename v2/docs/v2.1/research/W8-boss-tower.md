# W8 — Boss Tower (the 3rd tower type + its ultimate)

**Status:** research / design-faithful spec. Largest item of the V2.1 pass.
**The big reversal it enables:** the secret wave-16 split boss — today a documented
*unbeatable wall* — becomes **winnable through skill**, where the boss tower's manual
ultimate is the offensive key. The wall stays standing for the *standard kit* (basic +
strong + freeze + fork); only the boss tower overturns it.

---

## 1. Player-facing goal

A menacing, expensive, late-game **3rd tower type** ("boss"):

- occupies **4 tiles (2×2)**, not 1 — placement, footprint, selection and collision are
  all multi-tile;
- **full-map range** (it sees the whole board);
- **slow fire rate** (a heavy, occasional shot — not a DPS workhorse);
- has a **single upgrade** (L1→L2) that **unlocks a manual high-impact ULTIMATE**,
  triggered exactly like the existing Freeze ability (HUD button + key), on a precious
  per-tower cooldown.

The fantasy: you can only afford it in the end-game, it takes a 2×2 bite out of your build
real estate, it plinks rarely on its own — but once upgraded its ultimate is the nuke that
finally cracks the SUPER boss.

---

## 2. What already exists (reconcile, do not reinvent)

- **Tower model.** `v2/config/gameConfig.js:177-228` defines towers as `cfg.towers[id]` with
  a `levels[]` array (3 levels each), `kind` (`single`/`aoe`), `projectile`, optional `aoe`,
  optional `forks`. `towerTypeIds(cfg)` (`towerSystem.js:17-19`) auto-discovers any key with a
  `levels` array — **a boss type with `levels` is auto-included in the tray & cycle**.
- **1-tile placement.** `canPlace(state, gx, gy)` (`towerSystem.js:85-90`) checks one cell:
  in-bounds, `map.buildable[gy][gx]`, and `!towerAt`. `towerAt` (`:81-83`) matches `t.gx===gx
  && t.gy===gy`. `placeTower` (`:92-120`) anchors `tower.x/y` at `cellCenter` (anchor + 0.5).
  **All single-tile-assuming — the core change.**
- **Targeting/firing.** `update`→`acquireTarget` (`towerSystem.js:176-226`) scans
  `aliveEnemies` within `st.range`; `effectiveStats` (`:32-58`) merges level + fork into the
  one stat object the loop reads. Range circle drawn in `_towers` (`Renderer.js:277-281`).
- **Manual ability precedent = Freeze.** `Simulation.castFreeze` (`Simulation.js:255-265`):
  status-gated (`playing` only), cooldown via `state.freeze.readyAt`, emits `FREEZE_CAST`,
  pushes a frameEvent. HUD button `_freezeButton` (`Renderer.js:895-912`) bottom-right of the
  board with a cooldown sweep; wired `freeze`→`castFreeze` in `InputController.js:72` plus
  the `'f'` key (`:81`). State seeded in `state.js:64-69`. **The ultimate copies this shape.**
- **Upgrade/fork plumbing.** `upgradeTower` caps at `level >= 3` (`towerSystem.js:127-138`);
  fork arms surface at L3 when there is no next level (`_towerCard`→`_forkRow`,
  `Renderer.js:657-704`). Boss has **2 levels and no forks**, so this needs a soft touch.
- **Damage path.** `damageEnemy` (`enemySystem.js:283-307`) is the single resolve point;
  shields short-circuit it (`:288-293`). `killEnemy` (`:309-331`) runs `split` behavior.
- **The wall.** `boss_split` base hp 24000 × wave-16 scaling ≈ **175,936** on-field, splits
  into 3 × `boss_splitling` (40000 hp, shielded 1.8/2.6s, livesCost 12). Today's executed
  combo lands ~32k → unbeatable. Gated by `tools/balance/measure-secret-boss.mjs` (margin
  ≥5× freeze+fork, ≥3× fork-only) and asserted unbeatable by `secret-wave.test.mjs` &
  `summit.test.mjs`. **See §7 for how these stay green vs. which must flip.**
- **Bot/harness.** `Bot.place/upgrade/sell/fork/freeze` (`harness.mjs:111-167`) and the
  4-tier ladder + freeze/fork-aware optimal (`policies.mjs`). `rankPlacements`/coverage assume
  1-tile towers. `towerRange(type,level)` reads `config.towers[type].levels[l-1].range`.

---

## 3. Concrete design

### 3a. Multi-tile (2×2) placement model

- **Anchor = top-left tile.** A boss tower stores `gx,gy` as its top-left cell and occupies
  `gx..gx+1, gy..gy+1`. Its center is `tower.x = gx + fp/2`, `tower.y = gy + fp/2` (so for
  `fp=2`, the center sits on the shared corner: anchor + 1.0).
- **Footprint helper.** Add `footprintOf(cfg, typeId)` → `cfg.towers[typeId].footprint ?? 1`.
- **`towerAt(state, gx, gy)`** becomes footprint-aware: a tower matches if `(gx,gy)` lies in
  its `fp×fp` block (so tapping *any* of the 4 cells selects it — selection + collision).
- **`canPlace(state, gx, gy, typeId='basic')`** gains an optional `typeId`; for `fp>1` it
  validates **all** `fp×fp` cells (in-bounds, buildable, unoccupied). `placeTower` is the
  authority and re-validates the full footprint with the real type.
- **`gridClick`** (`Simulation.js:161-190`): when `trayType==='boss'`, validate/place via the
  footprint-aware path; the generic `canPlace(igx,igy)` (no type) keeps its 1-cell meaning
  for the select-vs-popup decision. The popup default-type path also routes through the
  footprint check before opening.

### 3b. Full-map range

- New `fullMap: true` on the boss def. `effectiveStats` sets
  `out.range = def.fullMap ? (cfg.layout.cols + cfg.layout.rows) : base.range`
  (board-spanning; `cfg.layout` is reachable via `state.config`). Config levels still carry a
  documented board-spanning `range` constant so the bot's `towerRange` stays correct (no magic
  number — it's a named gameConfig value).
- Renderer **skips the finite range ring** for `fullMap` towers (a whole-board circle is
  noise); selection instead shows a soft full-board tint or just the selection card.

### 3c. Slow fire rate + expensive + single upgrade

- `kind: 'boss'`, `footprint: 2`, `fullMap: true`, **2 levels only**:
  - L1: heavy slow plink, ultimate **locked**, `cost` high (late-game).
  - L2 (`ultimate: true`): faster plink + **ultimate unlocked**.
- `upgradeTower` cap changed from the hardcoded `>= 3` to `>= def.levels.length` (correct for a
  2-level type; behavior for basic/strong unchanged). `canFork` already gates on L3 → boss
  never forks; `forkArmsFor(boss)` → `[]`.
- `_towerCard`: when there is no next level AND no fork arms but `def.ultimate`, render an
  "ULTIMATE READY/locked" row instead of the empty fork row.

### 3d. The manual ULTIMATE (triggered like Freeze)

- **`Simulation.castUltimate()`** — mirrors `castFreeze`: legal only while `playing`; finds an
  eligible boss tower (L2 / `ultimate` unlocked, off its own cooldown); applies the effect;
  sets that tower's `ultReadyAt`/`ultActiveUntil`; emits `ULTIMATE_CAST`; pushes a frameEvent.
  Per-tower cooldown (multiple boss towers allowed); the button casts the most-ready one.
- **Effect = "Boss Blast":** a full-map devastating strike — `damageEnemy(state, e,
  cfg.towers.boss.ultimate.damage, { ignoreShield: true, sourceType: null })` over **all**
  alive enemies. Affinity-neutral (sourceType null → no 2× cheese, consistent with the
  affinity-neutral split boss). **Pierces shields** (`damageEnemy` gains an `ignoreShield`
  opt) — this is what lets it crack the shielded `boss_splitling` shards and is the structural
  lever that overturns the wall.
- **Cooldown** long enough that across the boss's map crossing a skilled player lands a few
  casts (the exact `damage`/`cooldownMs` are the single post-merge rebalance's job, §6).
- Tower state seeded in `placeTower`: `ultReadyAt: 0, ultActiveUntil: 0` (and the upgrade does
  not reset cooldown — like freeze it starts ready a fraction in, optional
  `ultimate.initialReadyFraction`).

### 3e. Render — **procedural 4-tile sprite (recommended)**

Bake a `tile*2`-sized menacing sprite in `SpriteCache` (a new `bossTower`/extended `tower`
branch that respects `footprint`), drawn from anchor top-left. Reasons to stay **procedural**
(not pixellab):

- Hard constraint: minimal renderer, static GitHub Pages, **no asset/build pipeline** —
  every other tower/enemy is procedural via `SpriteCache`; a baked PNG dependency breaks that.
- Consistent expression system (blink/blush/shock + place-pop) already drives towers; the
  boss reuses it on a 2× canvas.
- A dark "fortress/obelisk" look (obsidian body, crimson core, spiked silhouette) reads as
  menacing yet stays in the kid-legible candy palette. New `PALETTE.towers.boss` entry +
  optional new `shape` (e.g. a `fortress`/`crown` path in `shapes.js`).

pixellab is *possible* (one static 4-tile sprite) but rejected here for the no-pipeline /
consistency reasons. Note it as a future art-polish option only.

The ultimate cast gets a cheap full-board FX (flat tinted flash + expanding ring, like
`_freezeField`/explosion effects — no per-frame blur/gradient).

### 3f. HUD / input

- A second board-bottom ability button next to Freeze (`_ultimateButton`), shown only when a
  boss tower exists; ready = bright, charging = cooldown sweep (copy `_freezeButton`).
- `InputController`: `case 'ultimate': sim.castUltimate()`; key `'u'` (or `'b'`). Coordinate
  the bottom-bar layout with the freeze button real estate (shared geometry → sequencing).

---

## 4. Config shape (gameConfig.js `towers` block + palette)

```js
boss: {
  name: 'Boss', shape: 'fortress', color: PALETTE.towers.boss.body,
  kind: 'boss',
  footprint: 2,            // tiles per side -> 2x2
  fullMap: true,           // full-board range (renderer skips the finite ring)
  projectile: { speed: 600, size: 14, color: PALETTE.towers.boss.projectile },
  levels: [
    // range = board-spanning constant (cols+rows); fullMap overrides at runtime
    { damage: 30, range: 34, fireRateMs: 5000, cost: 250, sizeScale: 0.9 },               // L1 ultimate LOCKED
    { damage: 45, range: 34, fireRateMs: 4500, cost: 300, sizeScale: 1.0, ultimate: true }, // L2 ultimate UNLOCKED
  ],
  ultimate: {
    name: 'Boss Blast',
    damage: 60000,               // TUNED in the single post-merge rebalance (§6)
    cooldownMs: 14000,
    initialReadyFraction: 0.5,
    piercesShield: true,
    fxTtlMs: 700,
  },
},
```

Plus `PALETTE.towers.boss: { body: <obsidian>, projectile: <crimson>, core: <ember> }` and
(optional) a `fortress` case in `shapes.js`. All numbers above are **starting points** for the
single rebalance, not final.

---

## 5. Exact files + changes

| File | Change |
|------|--------|
| `v2/config/gameConfig.js` | add `towers.boss` block (kind/footprint/fullMap/levels/ultimate); add `PALETTE.towers.boss` |
| `v2/render/palette.js` | add `towers.boss` colors |
| `v2/sim/systems/towerSystem.js` | `footprintOf()`; footprint-aware `towerAt` + `canPlace(…, typeId)`; `placeTower` anchors center by footprint, validates 4 cells, seeds `ultReadyAt/ultActiveUntil`; `effectiveStats` full-map range; `upgradeTower` cap → `def.levels.length` |
| `v2/sim/Simulation.js` | `castUltimate()` (freeze-shaped); `canPlace`/`gridClick` pass tray typeId for footprint placement |
| `v2/sim/systems/enemySystem.js` | `damageEnemy` accepts `{ ignoreShield }` (ultimate bypasses shields) |
| `v2/sim/events.js` | `EV.ULTIMATE_CAST` |
| `v2/sim/state.js` | (towers carry ult state on the tower object; no new top-level field needed) |
| `v2/render/SpriteCache.js` | footprint-aware `tower()` bake (2× canvas) / new boss-tower bake; menacing procedural art |
| `v2/render/Renderer.js` | draw boss at 2×2 (top-left anchor); skip finite range ring for `fullMap`; `_ultimateButton`; full-board cast FX; dynamic N-column `_tray`; ultimate row in `_towerCard` |
| `v2/input/InputController.js` | `case 'ultimate'`; `'u'` key |
| `tools/balance/harness.mjs` | `Bot.placeBoss` (find a free 2×2), `castUltimate`/`ultimateReady`; footprint-aware coverage helpers |
| `tools/balance/policies.mjs` | NEW `summitConqueror` policy (builds+upgrades the boss tower, times the ultimate) — ladder bots 1-4 stay boss-unaware |
| `tools/balance/measure-secret-boss.mjs` | NEW scenario C: boss-tower ultimate build that DOES kill the split boss (proves winnability); scenarios A/B keep their ≥5×/≥3× no-boss-tower guards |

---

## 6. Balance impact (feeds the single post-merge rebalance)

This is the dominant balance change of the pass. The joint constraints the rebalance must
satisfy:

1. **Winnable with skill + the boss tower:** an end-game build (boss tower placed + upgraded,
   ultimate timed well, plus freeze/forks) CAN kill `boss_split` and clear its 3 shards before
   they leak → the summit becomes beatable. `ultimate.damage`, `ultimate.cooldownMs`, boss
   `cost`/`fireRateMs`, and possibly `boss_split.hp`/`boss_splitling.hp` are tuned together.
2. **Wall still stands for the standard kit:** without the boss tower, the optimal/freeze/fork
   bots STILL cannot kill the split boss — so `secret-wave.test.mjs` & `summit.test.mjs`
   (driven by boss-unaware bots) keep passing, and `measure-secret-boss.mjs` scenarios A/B keep
   margin ≥5× (freeze+fork) / ≥3× (fork-only). Achieved by keeping the ladder bots from ever
   building the boss tower.
3. **Not "buy the win":** one ult cast alone must NOT clear ~176k boss + 120k shards; it takes
   the tower + the upgrade + multiple well-timed casts (skill), not a single button.
4. **Perf:** full-map targeting is O(enemies) per boss tower per tick — same order as every
   tower already pays; the ult is O(enemies) once per cast. Add a boss tower to the bench
   fixture so the V2 p95 < V1 p95 gate stays honest.

---

## 7. Failing-first tests

**New `tools/tests/boss-tower.test.mjs`** (unit/sim):
- *footprint placement* — placing boss occupies 2×2; `canPlace` false if any of the 4 cells is
  out-of-bounds/non-buildable/occupied; `towerAt` returns the boss for all 4 cells; center at
  anchor + 1.0.
- *full-map range* — boss in one corner fires at / damages an enemy in the far corner.
- *slow fire rate* — only one shot per `fireRateMs` (>= the configured slow interval).
- *single upgrade caps at L2* — `upgradeTower` succeeds L1→L2, fails past L2; no fork arms.
- *ultimate gating* — `castUltimate` false at L1 (locked) / when not `playing` / on cooldown;
  true at L2 off-cooldown; emits `ULTIMATE_CAST`.
- *ultimate effect* — one cast applies `ultimate.damage` to all alive enemies and **pierces
  shields** (a shielded `boss_splitling` takes damage during its shield window).

**Reversal test (new, sim/balance)** — `summitConqueror` builds+upgrades the boss tower, times
the ultimate, and the summit run ends with the split boss + shards killed and `status`
remaining `won` (or a dedicated "summit cleared" signal). Exact numbers come from the rebalance,
so this test lands with §6.

**Existing — must stay green (boss-unaware bots):** `secret-wave.test.mjs`,
`summit.test.mjs`, `measure-secret-boss.mjs` A/B. Guard: the ladder bots never build the boss
tower. **Existing — may need a tolerance touch only if shared HUD/tray geometry shifts:**
`sprite-fit.test.mjs` (boss sprite is intentionally 2×2 → it must be EXCLUDED from the 1-tile
footprint-fit assertion or given a 2-tile cap), `plan-mode.test.mjs`/render-capture locks.

**Captures (observable changes):** render-capture of a placed L2 boss tower (2×2 menacing
sprite, no finite range ring), the ultimate button on the bottom bar, and a mid-cast
full-board FX frame.

---

## 8. Dependencies & parallelism

**Depends on:**
- The **single post-merge rebalance** for the ultimate/boss/secret-boss numbers (§6). This
  item ships the *mechanism*; the rebalance ships the *tuned values* that make the reversal
  real while preserving the standard-kit wall.

**This is the largest, most file-sharing item.** It touches `gameConfig.js` (towers),
`towerSystem.js`, `enemySystem.js`, `Simulation.js`, `Renderer.js`, `SpriteCache.js`,
`InputController.js`, `events.js`, `harness.mjs`, `policies.mjs`, `measure-secret-boss.mjs`.

- **Must sequence (shared files) with:** any item editing the towers config block, tower
  targeting/upgrade/fork, the Simulation ability/command API, the freeze HUD button geometry
  (shared bottom-bar layout), the tray layout, the bot ladder/harness, or the secret-boss
  measurement. In particular, anything else that changes the secret boss or adds an ability
  must come after / merge-coordinate with W8.
- **Parallel-safe with:** items that don't touch those files — e.g. audio-only (`AudioBridge`),
  map authoring (`config/maps/*`), pure enemy-flag/cosmetic tweaks that don't touch
  `enemySystem.damageEnemy`, or copy/menu polish in isolated renderer methods.
