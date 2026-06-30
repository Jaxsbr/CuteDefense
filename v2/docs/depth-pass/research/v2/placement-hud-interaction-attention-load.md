# Depth Pass — Area Analysis: Placement & HUD Interaction / Attention Load

Scope: the *interaction layer* — how a player turns intent into action (place a
tower, switch type, upgrade, sell, inspect) and how the HUD presents state. The
question for a depth pass: what genuine decisions does this layer offer, and where
does it fail — both against the grownup feedback it owns (#6 too much to click,
#7 can't see the enemies, #8 squished/overlap) and against tower-defense genre
norms for input ergonomics.

Primary sources read:
- `v2/input/InputController.js` (pointer/keyboard → commands)
- `v2/sim/Simulation.js` (the command API: `gridClick`, `placement*`, `*Selected`)
- `v2/render/Renderer.js` (placement popup, HUD dock, selection card, hit registry)
- `v2/render/SpriteCache.js` (tower sprite geometry — the overlap math)
- `v2/sim/systems/towerSystem.js` (`canPlace` — placement rules)
- `v2/config/gameConfig.js` (`layout`, `towers[*].levels[*].sizeScale`, `visual.anim`)
- `v2/app/GameApp.js` (the RAF loop / time model)
- sibling: `economy-coin-collection.md` (the auto-collect change removed the coin-tap load)

---

## 0. The interaction model in one paragraph

There is exactly **one world gesture: a tap** (`pointerup`, drags >24 backing-px
are discarded — `InputController.js:32`). A tap is routed first through the
renderer's per-frame hit-rect registry (`hitTest`, `InputController.js:41`); if it
misses every widget it is converted to a grid cell and handed to
`sim.gridClick(gx,gy)` (`InputController.js:48-52`). `gridClick` is a priority
chain (`Simulation.js:124-143`): **tower under cell → select it; else enemy near
point (r=0.6 tile) → toggle-select it; else buildable+empty → open a placement
popup; else nothing.** Placing is therefore a **two-tap commit**: tap an empty
tile to open the popup, tap **Buy** to spend and place. Coins are now
auto-credited (see `economy-coin-collection.md` §0), so the only remaining
click-load is **placement, type-switching, and upgrading**.

---

## 1. Current mechanics (what actually runs)

### 1a. Placement (the two-tap popup)
- Tap empty buildable tile → `gridClick` sets
  `state.placement = { gx, gy, towerType: lastTowerType || 'basic' }`
  (`Simulation.js:137-139`). `canPlace` only checks: in-bounds, `buildable[gy][gx]`,
  and not already occupied (`towerSystem.js:18-23`) — **no spacing/adjacency rule**.
- The renderer draws an on-board "sticker" panel anchored to the tile
  (`Renderer.js:310-347`): a range circle, a translucent ghost tower, then three
  buttons inside a contained panel — **Buy** (`place`), **Cycle** (`cycle`),
  **Cancel** (`closePopup`).
- Panel size is fixed: content `CW=248`, panel `PW=272`, `PH=166`, nub `18`
  (`Renderer.js:328-329`). It clamps to stay on-screen and can flip below the tile
  (`Renderer.js:332-335`). It is **opaque** and roughly 1.7 tiles tall.
- **Buy** registers its hit-rect **only when affordable** (`Renderer.js:397`);
  Cycle/Cancel always register (`:423`, `:439`).
- Commit: `placementPlace()` spends, creates the tower, sets
  `lastTowerType = type`, and **auto-selects the new tower**
  (`Simulation.js:145-152`).
- Type choice lives *only inside the popup*: **Cycle** rotates
  `placement.towerType` through `Object.keys(cfg.towers)` (`Simulation.js:153-160`).
  The cycle button wears the *next* tower's body colour + a mini-thumbnail
  (`Renderer.js:400-424`) — a non-reader cue for "what you'll switch to," but it
  shows **no stats** (no range/AoE/DPS comparison).

### 1b. Management (select → dock card)
- Tap a placed tower → `selected = { kind:'tower', id }` (`Simulation.js:128`).
  The HUD dock then renders a **tower card** (`Renderer.js:577-596`) with sprite,
  `Name Ln`, `Damage / Range`, `Fire …s`, and two buttons: **Upgrade {cost}c** and
  **Sell +{refund}c**.
- Upgrade button registers a hit only when affordable (`enabled=!!canUp`,
  `Renderer.js:593`; `_button` skips `addHit` when disabled, `Renderer.js:624`).
  Sell always registers (`Renderer.js:595`).
- Max level 3; upgrade keeps the tower selected (`towerSystem.upgradeTower` does
  not touch `selected`), so an immediate place→upgrade→upgrade is possible without
  re-selecting.
- Tap an enemy → an **enemy card** (`Renderer.js:598-610`) shows `HP`, `Reward`,
  `Costs ♥`. Tapping the same enemy again deselects (`Simulation.js:131`).

### 1c. HUD chrome and controls
- Left **dock**, `hudWidth = 400` of a `2514×1154` canvas (~16%);
  `gridOffsetX = hudWidth` so the board begins at x=400 (`gameConfig.js:24-26`).
  Dock holds: wordmark, **Lives** hero card, **Wave|Coins** chips, the
  selection/empty card, and **Pause / Sound** buttons (`Renderer.js:464-493`).
- Empty-selection hint text: "Tap a spot to plop a buddy" / "tap a buddy to
  manage" (`Renderer.js:484-486`) — onboarding, but reading-dependent.
- Keyboard: only **Esc**=pause, **M**=mute (`InputController.js:70-74`). No
  placement/upgrade hotkeys.

---

## 2. What genuine strategic decisions this area offers (honest read)

The interaction layer is **almost pure executor** — its strategic content is
borrowed from the economy and spatial-placement areas, not generated here. The
decisions a player actually makes *through* this layer:

- **Which buildable tile** (the spatial decision). Real depth, but it is owned by
  the map/range model, not by the input layer; this layer just opens a popup
  wherever you tap.
- **Which of the 2 tower types**, via the in-popup Cycle. A genuine choice point —
  but it is poorly supported (colour/thumbnail only, no stat/role comparison), and
  it exists *only after* you've already tapped a tile, so type is never a
  legible up-front decision (feeds feedback #9).
- **When/whether to upgrade vs place another** (economy throttle) — surfaced here
  as the dock Upgrade button, but the value math lives in the economy area.
- **Inspect-to-decide** — tap a tower/enemy to read its card. Mildly useful, but
  it competes with placement intent (see §3).

What this layer adds *on its own*: a **two-tap confirm** that guards against
mis-spends (a small, legitimate kid-friendly value), and a **tap-to-inspect**
affordance. That is the entirety of its native depth. There is no targeting mode,
no build-order tooling, no time control, no batch operation — nothing that turns
*interaction itself* into a decision. So: **shallow**. Its real job is to make the
borrowed decisions cheap and legible, and on both counts it currently underperforms.

---

## 3. Gaps vs the grownup feedback

### Feedback #6 — "I can't keep up placing and upgrading — too much to click" (HIGH)

The click model is structurally tap-heavy and the layout makes each tap expensive:

- **Two-tap-minimum placement, no quick-place.** Every tower costs **tap-tile +
  tap-Buy** (2), or **tap-tile + tap-Cycle + tap-Buy** (3) for the other type
  (`Simulation.js:137-160`, `Renderer.js:342-346`). There is **no build tray /
  hotbar** to pre-select a type and **no paint/drag/multi-place** (drags are
  explicitly discarded — `InputController.js:32`). A full L3 tower is
  tile + Buy + Upgrade + Upgrade = **4 taps minimum**; a dozen towers across a run
  is on the order of 50–80 deliberate taps.
- **Type choice is buried per-tile.** Because type is chosen inside each popup
  (`Simulation.js:153-160`), you cannot say "I'm placing strong now" once and then
  tap several cells — every cell reopens a popup and re-requires a Buy. The
  genre-standard "select-in-tray → tap cells" loop (which amortises the choice) is
  absent.
- **Split locus of control = cross-screen travel.** Placement is **on-board**
  (popup near the tile, right side), but management is in the **dock** (Upgrade/
  Sell at far left, `Renderer.js:593-595`). The auto-select on place
  (`Simulation.js:150`) means the most common flow — place then immediately
  upgrade — forces the hand/eye to jump ~2000px from the on-board Buy to the dock
  Upgrade and back. Re-selecting a tower later means hitting a **small on-board
  sprite** (L1 body is only 72px on a 96px tile — §4) on a moving board, then
  travelling to the dock again.
- **No batch / no held-repeat.** No "upgrade all," no drag-select, no
  press-and-hold to repeat. Each upgrade is its own select+tap.
- **Silent dead taps.** Unaffordable Buy and Upgrade buttons register **no
  hit-rect** (`Renderer.js:397`, `:624`) and emit no sound or "not enough coins"
  message — a child taps a visible (greyed) button and *nothing happens*, which
  reads as "the game ignored me" and invites more frantic tapping.

### Feedback #7 — "I can't even see the enemies — too busy placing towers" (HIGH)

This is the conjoined twin of #6 and is **structurally enforced**:

- **No pause-to-plan, and placing while paused is impossible.** The RAF loop steps
  the sim every frame unconditionally (`GameApp.js:54-61`) — there is **no
  fast-forward, no slow-mo, no auto-pause**. You *can* hit Pause, but world taps
  are rejected while paused (`InputController.js:44` returns before `gridClick`),
  and the pause overlay is a **full-canvas scrim** drawn over everything
  (`Renderer.js:649`). So a kid literally **cannot stop the action to look and
  place** — all placing/upgrading must happen during live motion. This is exactly
  the genre's #1 prescribed fix (Defender's Quest "design for focus, not APM";
  scout Pick 2) and it is entirely missing.
- **The popup itself occludes the board.** The opaque ~272×166px panel + ghost +
  range circle sit on the play area while the enemies you're trying to watch keep
  moving underneath/around it (`Renderer.js:310-347`). The decision UI and the
  thing you must watch fight for the same pixels and the same eyes.
- **Attention is fragmented across four zones**: dock (left), board (center-right),
  on-board popup, and board-top announcements (`Renderer.js:628-644`). For ages
  5–10 that is a lot of simultaneous watch-targets, and the tower's *stats* live in
  the far dock while the tower lives on the board — information is spatially
  divorced from the entity it describes.

### Feedback #8 — "Everything is getting squished — big towers overlap the ones next to them" (HIGH)

This is real and **mathematical**, with two stacked causes:

- **Static geometry already exceeds the tile.** Tower sprite radius is
  `r = tile * sizeScale` (`SpriteCache.js:78`) with `sizeScale` = **0.375 / 0.45 /
  0.6** for L1/L2/L3 (`gameConfig.js:125-127,137-139`). On a 96px tile that is body
  **diameter 72 / 86.4 / 115.2px**. An **L3 body (115px) is 1.2× wider than its own
  96px tile** — radius 57.6 vs half-tile 48, so it bleeds **9.6px past every edge at
  rest**. Two adjacent L3 towers (centres 96px apart) overlap by
  `2×57.6 − 96 = 19.2px` of **solid body**, before any decoration. The baked
  upgrade **glow halo** reaches `r+pad` where `pad = r*0.55+8` → L3 halo radius
  ~97px (**~2 tiles wide**, `SpriteCache.js:79,84-90`); level rings, the rank badge
  (`cx + r*0.55`), and L3 corner sparkles (`cx ± r*0.9`) all spill further.
- **Animation pushes it further every frame.** On top of the baked size the
  renderer applies an idle **breathe** (×up to 1.04, `Renderer.js:227`), a
  place/upgrade **grow-in**, and a **fire-puff** that scales **+0.14 wide / +0.24
  tall** (`visual.anim.towerPuffX/Y`, `gameConfig.js:171-172`; applied
  `Renderer.js:231-237`). An L3 tower mid-fire is ~`115 × 1.14` wide and
  `115 × 1.24 ≈ 143px` tall — well into the cells above and below.
- **No placement spacing rule.** `canPlace` permits towers in directly adjacent
  buildable cells (`towerSystem.js:18-23`), and the tightened *local* ranges
  (basic 2/2.5/3, strong 1.5/2/2.5 — `gameConfig.js:124-139`) actively *encourage*
  clustering at chokepoints. So the game funnels players into exactly the adjacency
  where oversized L3 sprites collide. The squish is a design contradiction:
  "cluster for coverage" vs "sprites that don't fit their cells."

---

## 4. Gaps vs the genre (input ergonomics for TD)

- **No build tray / tower palette.** Standard TD (Kingdom Rush build-slots, Bloons
  drag-from-tray) lets you pick a tower *once* and then place by tapping cells. The
  per-tile popup here inverts that — it ties type choice to each placement and adds
  a confirm tap every time. Highest-leverage missing affordance for #6.
- **No pause-to-plan / time control.** Pause-to-place and variable speed
  (0.25×–4×) are near-universal and almost free to build (pure client-side, no perf
  cost). Absent, and pause currently *blocks* placement (§3, #7). Scout Pick 2.
- **No tower targeting controls.** First/Last/Strongest/Closest set-once modes are
  the genre's classic way to add depth that costs **zero combat clicks**
  (scout cat. 2). None exist — every tower uses the same fixed score model
  (`towerSystem.acquireTarget`, `:89-105`). A kid-sized 2–3-mode version would add
  decision depth while *reducing* the need to micro.
- **No drag / paint / multi-place** and a brittle **24px drag-cutoff**
  (`InputController.js:32`) that can drop legitimate touch taps on small screens
  (the threshold is in backing-store px) and forecloses any drag gesture.
- **No batch ops** (upgrade-all, sell-all, select-multiple) and **no hotkeys** for
  tower types (`InputController.js:70-74`).
- **Stats divorced from the entity.** The dock card shows a tower's stats ~2000px
  from the tower; genre norm is an on-tower/contextual radial or a tooltip at the
  unit. Combined with no upgrade *preview* (no `Damage 8→12`, no DPS, no new
  range-ring — see `economy-coin-collection.md` §3 #5), the management UI can't be
  read at a glance by a child.
- **No feedback on blocked actions.** Disabled buttons are inert and silent
  (§3 #6); the genre standard is a shake/buzz/"need more gold" cue.
- **Sprite-to-cell mismatch.** Most TDs size a tower to sit *inside* its footprint;
  here L3 exceeds the tile (§3 #8). The genre keeps the footprint legible so
  adjacency reads cleanly — directly the #8 fix.

---

## 5. Summary

As an *interaction layer* this area is **strategically shallow**: it executes
decisions made elsewhere and adds only a two-tap confirm and tap-to-inspect of its
own. Its actual job — make placement/upgrade **cheap to perform** and **easy to
read** — is where it falls down, and it owns all three of its named feedback
symptoms.

- **#6 (too much to click)** is structural: 2–3-tap placement with no build tray,
  no paint/multi-place, type choice buried per-tile, a split on-board-vs-dock locus
  that forces cross-screen travel, no batch ops, and silent dead taps.
- **#7 (can't see enemies)** is enforced by the absence of any time control —
  there is **no pause-to-plan** (and placement is actually *disabled* while paused),
  plus an opaque on-board popup and attention fragmented across four zones.
- **#8 (squished/overlap)** is mathematical: L3 tower bodies (115px) are larger
  than their 96px tile and overlap adjacent L3 bodies by ~19px before decoration,
  fire-puff animation adds up to +24% on top, and `canPlace` enforces no spacing
  while tight local ranges reward the very clustering that triggers the collision.

The genre's proven, low-click, static-host-friendly answers map cleanly onto all
three: a **build tray** + **paint/quick-place** and **disabled-action feedback**
for #6; **pause-to-plan + variable speed** (and letting placement happen while
paused) for #7; and **resizing L3 to fit its cell** (or a spacing rule / scaled
footprint) for #8 — with **set-once targeting modes** as the cheap depth multiplier
once the friction is removed.
