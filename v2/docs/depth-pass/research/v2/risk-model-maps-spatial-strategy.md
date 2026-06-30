# V2 Depth Pass — Risk Model, Maps & Spatial Strategy

Area owner: spatial layer — the two maps, the path/buildable model, tower placement
gating, and the (absent) risk model around towers. This is an honest audit of what
genuine spatial decisions the player makes today, and where the area is shallow versus
both the grownup feedback (esp. #11 "no risk to my towers" and #10 "every wave should
need a different layout/strategy") and versus the tower-defense genre.

---

## 1. Ground truth — how the spatial layer actually works

### 1.1 Two ASCII maps, parsed into one strict path

- `v2/config/maps/map1.js` ("Ribbon") and `v2/config/maps/map2.js` ("Comb") are
  22×12 ASCII grids. Legend: `S`/`E`/`#` = path, `.` = buildable.
- `v2/config/maps/index.js:5` exports `MAPS = [map1, map2]` and comments "one is chosen
  at random at game start (seeded)."
- `v2/sim/mapParser.js:13-77` strictly validates the path: exactly one `S`/`E`, S and E
  are degree-1, every interior path cell degree-2 — **no branches, no loops, no
  alternate routes by construction** (`mapParser.js:48-67`). It returns `path` (the
  ordered S→E cell list) and `buildable[y][x]` (true only for `.` cells,
  `mapParser.js:36`). This strictness is a deliberate structural fix for a V1
  open-tile-pathfinding bug, but it also forecloses the genre's biggest spatial lever
  (see §4).

Measured geometry (computed from the grids):

| Map | Grid | Path cells (incl S/E) | Buildable tiles | % buildable |
|-----|------|----------------------:|----------------:|------------:|
| Ribbon | 22×12 = 264 | 106 | 158 | **60%** |
| Comb | 22×12 = 264 | 59 | 205 | **78%** |

Ribbon is a long boustrophedon (serpentine) — a 106-cell path means enemies spend a
long time on-screen and in-range → easier. Comb is a short 59-cell path with vertical
"teeth" → enemies cross fast → harder. This matches the design intent (Ribbon
long/easy, Comb short/hard). But note both maps are **buildable-rich (60–78%)**:
open tiles are never scarce.

### 1.2 Placement gating — off-path only, no occupancy beyond one tile

- `v2/sim/systems/towerSystem.js:18-23` `canPlace`: in-bounds, `buildable[gy][gx]` is
  true, and no tower already on that cell. So towers sit **only on `.` tiles, exactly
  one per cell**. You cannot place on the path.
- `v2/sim/Simulation.js:124-143` `gridClick`: tower → select; enemy → select; empty
  buildable → open placement popup. Placement is the only spatial action.
- Range is shown to the player at placement time (`Renderer.js:319`,
  `this._rangeCircle(x, y, range * tile)`) and when a placed tower is selected
  (`Renderer.js:243`). So the player *can* preview a single tile's reach before
  committing — partial spatial feedback exists.

### 1.3 Ranges are now local, so "near the path" matters

- `v2/config/gameConfig.js:124-128` (basic range 2 / 2.5 / 3 tiles) and
  `:136-140` (strong range 1.5 / 2 / 2.5). The inline comment (`:121-123`) says ranges
  were tightened from V1's 5/6/7 specifically so "coverage is LOCAL… full path coverage
  now takes many towers." This is the one design choice that gives placement any teeth:
  a tile too far from the path covers nothing and is wasted, so the player must hug the
  path.

### 1.4 The map is RANDOM, not a choice; restart locks it

- `v2/sim/state.js:18` picks the map by `rng.int(0, maps.length - 1)` when no index is
  passed.
- `v2/app/GameApp.js:25-26` constructs the sim with a random seed and **never passes a
  mapIndex** → first map is luck of the seed.
- `v2/sim/Simulation.js:36` `restart` defaults `mapIndex = this.state.mapIndex` → "Play
  Again" keeps the same map (`GameApp.js:45`, `InputController.js:58-59` only wire
  play/playAgain). There is **no map-select UI**. "Which map" is not a player decision.

### 1.5 One fixed path for every wave; "formations" are temporal, not spatial

- Every enemy spawns at `path[0]` and walks the identical single path by exact segment
  lerp (`v2/sim/systems/enemySystem.js:18-21, 82-112`). No spawn-point variety, no
  alternate lane, no per-wave path change.
- The wave "formations" (single/line/wedge/swarm/phalanx,
  `gameConfig.js:61-85`) only scale the **spawn-time gap** between enemies
  (`waveSystem.js:45-53`, `FORMATION_FACTOR` × `spawnInterval`). They bunch or spread
  enemies in *time* down the same path; they create no spatial pattern on the board.
  Tighter swarms matter only because they feed the strong tower's AoE — a tower-choice
  nuance, not a layout one.

### 1.6 The risk model: there is none for the player's towers

- Grepping `v2/sim` and `v2/config` finds **no tower hp, no tower health, no
  tower-destroy, no enemy→tower targeting, no "attack," no maze/obstacle/wall/barricade**
  concept. Towers are immortal, untouchable turrets.
- The only loss vector is an enemy reaching the goal, which subtracts a fixed
  `livesCost` exactly once (`enemySystem.js:123-132`). Enemies never deviate toward,
  damage, or disable towers. There is no flying/burrowing bypass, no EMP/stun, no
  positional danger.
- Consequence: the dominant strategy the grownup described — "place towers safely out
  of the way" — is *literally optimal*. With 60–78% of tiles buildable and zero risk to
  the structure, the player just rings the path wherever convenient. Placement carries
  no survival tension; the only constraint is range overlap.

---

## 2. Genuine strategic decisions the player makes today (honest)

1. **"Is this tile close enough to the path to be useful?"** Because ranges are local
   (§1.3), placing on a far `.` tile wastes the tower. This is a real decision, and the
   placement range-preview supports it (`Renderer.js:319`).
2. **Emergent, unsignposted "valley" coverage.** Where the path doubles back near
   itself (the gaps between Ribbon's serpentine runs, or between Comb's teeth — e.g. the
   `.` columns at x≈8/12/16 in `map2.js`), a single tower can cover two path passes at
   once. A skilled player who notices this gets more value per coin. The game never
   teaches, highlights, or rewards it.
3. **AoE-vs-single placement near choke clusters.** A strong (AoE radius 1.0,
   `gameConfig.js:134`) tower wants to sit where enemies bunch; basic wants single-file
   stretches. This is a real interaction, but it's a *tower-type* choice that happens to
   have a spatial flavour, not a layout puzzle.

That is the whole list. Decisions 2–3 are emergent and hidden; decision 1 is the only
one the game actively supports. **Net: the spatial layer is shallow.** Because buildable
tiles are abundant, the map is not chosen, the path never changes, and towers face zero
risk, optimal play collapses to "surround the one path with enough towers." There is no
scarcity, no positional risk, and no reason to ever change the layout.

---

## 3. Gaps vs the grownup feedback

### Feedback #11 — "There's no risk to me; I place towers safely out of the way; enemies can't destroy my towers." (HIGH)

- **Confirmed in code.** No tower hp/attack/bypass model anywhere (§1.6). The safe
  back-corner placement is provably optimal, so the player feels no spatial stakes.
- The map's abundance of buildable tiles (§1.1) amplifies this: there is never a hard
  choice between a *safe* spot and a *strong* spot, because every strong spot is also
  perfectly safe.

### Feedback #10 — "Every wave should be a unique challenge needing different towers/layouts/strategy." (HIGH)

- **Spatially, every wave is identical.** One fixed path, one spawn point, formations
  that only change timing (§1.5). Nothing about wave N asks the player to *re-shape*
  their layout. Coverage built for wave 1 is the coverage for wave 15; you only add
  more of the same. There is no spatial adaptation loop.

### Feedback #8 — "Everything is squished; big towers overlap the ones next to them." (MEDIUM — spatial-adjacent)

- **Rooted in the size model.** A tower sprite's radius is `tile * sizeScale`
  (`v2/render/SpriteCache.js:78`). At level 3 `sizeScale = 0.6`
  (`gameConfig.js:127, :139`) → radius 0.6×96 = 57.6px → **~115px diameter inside a
  96px tile**, before idle-breathe (+4%, `Renderer.js:227`) and the fire puff
  (up to +24% vertical, `Renderer.js:235-237`). Upgraded neighbours visibly overlap.
- This is a render bug, but it has a spatial cost: it makes tile adjacency unreadable,
  so the one emergent depth lever (the "valley" double-coverage trick, §2.2) is hard to
  even perceive. Cells stop reading as discrete spatial units.

---

## 4. Gaps vs the tower-defense genre

The spatial/risk pillar is where V2 is thinnest relative to the genre. Missing levers,
roughly in order of impact:

1. **No mazing / path-building.** The defining spatial mechanic of a whole TD subgenre
   (place towers to *lengthen* the enemy route) is impossible — the path is fixed and
   off-path placement is forbidden by `canPlace` and the strict parser
   (`mapParser.js:48-67`). This was a deliberate anti-bug decision, but it removes the
   richest source of spatial decisions.
2. **No alternate / branching / multi-spawn paths.** One S, one E, one chain by
   construction. Genre staples like split lanes, multiple entrances, or a path that
   opens mid-run are structurally excluded.
3. **No bypass enemies** (flyers, burrowers, teleporters). Every enemy is bound to the
   same ground path, so there is never pressure to diversify *where* or *what* you build
   for a given segment.
4. **No risk to structures.** No tower hp, no enemies that attack/disable towers, no
   "creep" that corrupts tiles. So no front-line vs back-line positioning, no need to
   protect or repair, no defensive geometry.
5. **No special terrain.** Every buildable tile is interchangeable — no high ground
   (range/damage bonus), no slow/amplify tiles, no scarce premium build spots. Buildable
   abundance (60–78%) means placement is never a *scarcity* decision.
6. **Map is not a player choice and doesn't vary mid-run** (§1.4). Genre norm is at
   least picking the map (difficulty/route), often with terrain that shapes strategy.
7. **No coverage feedback.** No heatmap, no "this tile covers 2 path passes," no DPS-on-
   path readout. The emergent double-coverage value is invisible, so depth that *does*
   exist can't be learned.

---

## 5. Severity summary

| Gap | Maps to | Severity |
|-----|---------|----------|
| Towers face zero risk; safe placement is optimal | Feedback #11 | High |
| Every wave is spatially identical (one fixed path, timing-only formations) | Feedback #10 | High |
| No mazing/path-building (strict single path) | Genre | High |
| No alternate/branching/multi-spawn paths | Genre | Medium |
| No bypass enemies (flyers/burrowers) forcing spatial diversity | Genre / #10 | Medium |
| Map is random, not chosen; restart locks it; no map-select UI | Genre | Medium |
| Buildable tiles abundant (60–78%) → placement is never a scarcity choice | Genre / #11 | Medium |
| No special terrain (high ground, slow/amplify, premium tiles) | Genre / #10 | Medium |
| Level-3 tower sprite (~115px) overflows the 96px tile → overlap, unreadable adjacency | Feedback #8 | Medium |
| No coverage feedback/heatmap; emergent "valley" depth is invisible | Genre | Low |
