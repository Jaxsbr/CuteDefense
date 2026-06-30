# Depth Pass — Towers, Upgrades & Projectiles (V2)

Scope: `v2/sim/systems/towerSystem.js`, `v2/sim/systems/projectileSystem.js`,
`CONFIG.towers` / `CONFIG.combat` in `v2/config/gameConfig.js`, plus the render
footprint in `v2/render/SpriteCache.js` and `v2/render/Renderer.js` that drives
the "squished" symptom.

---

## 1. What actually exists (ground truth)

### Two towers, three levels each
`gameConfig.js:116-142`. Stats are absolute per level.

| | basic (single) | strong (aoe) |
|---|---|---|
| kind | `single` (`gameConfig.js:119`) | `aoe`, radius 1.0 tile (`:132-134`) |
| dmg L1/2/3 | 8 / 12 / 18 | bombDamage 40 / 80 / 120 (`:137-139`) |
| range L1/2/3 | 2 / 2.5 / 3 | 1.5 / 2 / 2.5 |
| fireRateMs | 1800 / 1350 / 900 | 3000 / 2000 / 1500 |
| cost L1/2/3 | 5 / 50 / 100 | 15 / 60 / 120 |
| projectile speed | 800 px/s | 400 px/s |

### Lifecycle
- **Place**: `placeTower` (`towerSystem.js:25-51`) — one tower per buildable tile,
  single-cell footprint; `canPlace` (`:18-23`) only checks bounds, `buildable[gy][gx]`,
  and "no tower already here". Placement opens a popup that defaults to the
  last-used type and can be cycled through the 2 types (`Simulation.js:138, 153-160`).
- **Upgrade**: `upgradeTower` (`:58-69`) — linear, monotonic, no branches. Bumps
  `level` 1→3; pulls the next row from config; pays `next.cost`.
- **Sell**: `sellTower` (`:75-85`) — refund = `floor(invested * 0.7)`
  (`:71-73`, `economy.sellRefundFraction`).
- **Target**: `acquireTarget` (`:89-105`) — a single fixed weighted score
  `distScore*0.3 + healthScore*0.4 + typeScore*0.3` (`combat.targetWeights`,
  `gameConfig.js:150-151`). Re-acquired only when the current target dies or
  leaves range (`:117-120`). **The player has no control over this.**
- **Fire**: `update` (`:107-131`) — on cooldown elapse, spawn a projectile,
  set `cooldownMs = max(300, fireRateMs ± 50ms seeded jitter)` (`:125-126`).
- **Projectile**: `fire` + `update` + `impact` (`projectileSystem.js`) — homing
  (re-locks `tx/ty` to the live target each frame, `:42`), single-target or AoE
  bomb, both resolved through `damageEnemy` so shields apply consistently
  (`:73, :80`). Crit roll 1% × 2 on single-target only (`:78`, `combat.critChance/critMult`).

---

## 2. Genuine strategic decisions on offer (honest read)

These are the *real* levers a player has in this area today:

1. **basic vs strong at place-time.** A true choice, but binary and narrow: it is
   "single-target/long-range/fast" vs "small-AoE/short-range/slow". There is no
   third axis (no slow, no buff, no economy, no anti-this-enemy). See gap 9.
2. **Upgrade in place vs build another tower.** This is the most interesting
   decision in the system because the math is non-obvious — but see §3, the math
   is currently *miscalibrated against upgrading*, and the game never surfaces it.
3. **Sell to reposition.** Exists (V1 never had it), 0.7 refund. A real but rarely
   needed lever given towers can't die and money is abundant (feedback 4).

Everything else that *looks* like a decision is actually automated or inert:
- **Targeting is not a decision.** One hard-coded weighted score; the player cannot
  pick first/last/strongest/closest. Low click-load (good for kids) but it removes
  the single most common TD strategy lever and makes "why did my tower shoot *that*?"
  unanswerable.
- **Crit is not a decision and barely a mechanic.** 1% chance, single-target only;
  strong/AoE towers literally never crit (`projectileSystem.js:73` calls
  `damageEnemy` directly, bypassing the crit roll at `:78`). It is invisible flavor.
- **Projectile behaviour is not a decision.** Homing + generous hit radius
  (`hitRadiusTiles`, `:30-32`) means shots essentially never miss; no leading,
  no positioning skill, no splash placement.

Net: of the four feedback-relevant "depth" surfaces a TD usually has
(type variety, targeting control, upgrade branching, positioning skill), this
build offers a meaningful version of **none** and a thin version of one (type).

---

## 3. Gaps vs the grownup feedback

### Feedback 9 — "only 2 towers, is there even a difference / does it matter?"
- Only two types exist (`gameConfig.js:116-142`) and the distinction is a single
  axis (single vs small AoE). The cost/DPS curves make them *near-substitutes* at
  L1, so the "difference" is genuinely faint:
  - basic L1: 8 dmg / 1.8s = **4.44 dps** for 5c → **0.89 dps/coin**.
  - strong L1: 40 dmg / 3.0s = **13.3 dps** for 15c → **0.89 dps/coin** — identical
    per-coin, and strong also hits a group. So strong dominates basic against
    anything clumped, and basic only wins on range (2 vs 1.5) and retarget speed
    against lone fast movers/shield bosses. Nothing in the UI communicates this.
  - The tower card (`Renderer.js:577-589`) shows raw `Damage / Range / Fire` and an
    "AoE" tag, but no DPS, no "good vs groups / good vs single", no comparison. A
    child (or adult) cannot infer the role from these numbers.
- **Dead config compounds the confusion.** `strong.levels[].damage` (20/35/55) is
  **never used** — `projectileSystem.fire` reads `bombDamage` for `kind:'aoe'`
  (`:13`), so the single-target `damage` field on strong is inert. The brief's
  "dmg 20/35/55 + bomb" describes a number the sim never applies.

### Feedback 5 — "did upgrading actually help / where did my money go?"
- **Upgrades are numerically real but economically dominated by spamming L1.**
  - basic L1→L2 costs 50c to go 4.44→8.89 dps (+4.44). For the same 50c you can
    place **10 more L1 basics** = +44 dps. Upgrading is ~10× worse dps/coin than
    spreading early. L2→L3 (100c, +11.1 dps) is similarly beaten by 20 L1 towers.
  - The *only* things upgrades buy that spreading can't: **range** (2→3 tiles) and
    **tile consolidation** (fewer tiles used, relevant on the cramped Comb map).
    Both are real, both are invisible to the player. So the rational opening is
    "spam cheap towers," money piles up (feedback 4), and the upgrade button feels
    like a coin sink with no felt payoff (feedback 5).
- **No feedback loop proves the upgrade did anything.** There is no DPS readout,
  no before/after, no "this tower has dealt X damage," no kill counter per tower.
  `upgradeTower` just bumps a number and plays a 220ms grow-pop (`:65`). The render
  adds a halo/rings/badge (`SpriteCache.js:84-119`) — cosmetic, not informational.
- `invested` is tracked per tower (`:34, :64`) but only ever surfaced as the *sell*
  refund, never as "you have put 155c into this tower," so even the spend is opaque.

### Feedback 8 — "everything is getting squished / big towers overlap neighbours"
- **This is structurally true in the render path, not a perception issue.**
  Tile = 96px (`gameConfig.js:23`). Tower body radius `r = tile * sizeScale`
  (`SpriteCache.js:78`):
  - L1 `sizeScale 0.375` → r = 36px → body Ø 72px (fits, 12px margin/side).
  - L2 `0.45` → r = 43.2 → Ø 86.4 (fits, ~5px margin).
  - **L3 `0.6` → r = 57.6 → Ø 115.2px, which EXCEEDS the 96px tile by ~19px.**
    Two adjacent L3 towers overlap by ~19px of solid body; a `strong` (square)
    L3 is 115px across on a 96px cell.
- It is worse once decoration + animation are added, none of which is clamped to
  the tile:
  - level rings extend to `r + 3 + i*4` (`SpriteCache.js:101`) → 68.6px radius at
    L3 (Ø ~137px), and the upgrade halo reaches `r + pad` where `pad = r*0.55 + 8`
    (`:79`) → ~97px radius (Ø ~194px, nearly two tiles of soft glow).
  - fire "puff" stretches the sprite to `1 + 0.24` vertical (`towerPuffY 0.24`,
    `Renderer.js:236`) on top of the idle breathe — an L3 firing tower is ~71px
    half-height (Ø ~143px), so vertically-adjacent towers visibly collide.
  - The grid draw (`Renderer.js:238-239`) blits the baked sprite centred on the
    tile with **no clamp to tile size**, so all of the above bleeds into neighbours.
- The sim allows neighbouring placement freely (`canPlace` only forbids the *same*
  cell, `:18-23`), so the game actively produces the overlapping clusters the
  grownup saw. Either the L3 footprint must shrink to ≤ tile, or placement must
  reserve breathing room, or the visual scale must be decoupled from a per-level
  `sizeScale` that exceeds 0.5.

---

## 4. Gaps vs the genre (TD conventions absent here)

These aren't in the feedback but are the standard depth a tower/upgrade system
provides; their absence is *why* the feedback exists:

- **No targeting modes.** First / Last / Strongest / Weakest / Closest is the
  canonical per-tower lever. Here it's one fixed weighted score (`:89-105`).
- **No branching upgrades.** Linear 1→2→3 only (`:58-69`). No "path A: range vs
  path B: rate," no specialisation, no terminal "ultimate." Upgrading is never a
  *choice*, only a *spend*.
- **No tower roles beyond damage.** No slow/stun, no DoT, no chain/pierce, no
  buff/support aura, no economy/generator tower, no wall/redirect. Both towers are
  "deal damage"; the only differentiator is single vs small AoE.
- **No status/elemental interplay** → so waves can't be designed to *demand* a
  specific tower (ties directly to feedback 10 in the wave system: every wave is
  beaten by the same "spam damage" answer).
- **Projectiles have no skill or counterplay.** Homing + near-guaranteed hit, no
  travel-time mattering (basic projectile 800px/s is near-instant over a 2-tile
  range), no overkill/wasted-shot consequence the player can manage (a single-shot
  fired at a dying enemy simply fizzles — `impact` with `target===null` does
  nothing, `:75-81`).
- **Crit is decorative, not a build lever** (1%, single-target only). A genre would
  either remove it or make it a tower/upgrade identity.
- **No per-tower performance data** (kills, damage dealt, uptime) — nothing for the
  player to learn from or optimise against.

---

## 5. Smallest high-leverage levers (for the depth pass to consider)

Ordered by payoff-vs-effort, all respecting "minimal + low click-load + no magic
numbers" (every value below would live in `CONFIG.towers`/`combat`):

1. **Make the two towers legibly different and re-tune so the choice matters**
   (feedback 9): give basic a clear "single-target sniper" identity (longer range,
   higher single-DPS) and strong a clear "crowd" identity (bigger/real AoE),
   and show role + DPS on the card. Delete the dead `strong.damage` field.
2. **Fix L3 footprint** (feedback 8): cap effective `sizeScale ≤ ~0.46` or clamp
   the grid blit to the tile, and pull rings/halo/puff inside the cell. One config
   change + a render clamp.
3. **Surface upgrade payoff** (feedback 5): show DPS (and DPS-after-upgrade) on the
   card, and re-tune L1 cost / upgrade cost so upgrading isn't strictly dominated
   by spamming 5c towers (this also drains the money glut, feedback 4).
4. **Add one cheap real lever**: a per-tower target mode toggle (1 tap, default
   sensible) restores the core TD decision without raising click-load much — or,
   if that's too much for the age band, a branching L3 ("range vs rapid") that
   turns the final upgrade into an actual choice.
