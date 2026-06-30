# V2.2 — V2-offense-redesign (the sequential spine)

**Goal:** Convert the boss-tower special from a no-aim **full-map AoE nuke** into an
**aimed, single-target, high-power BEAM** that applies **damage-over-time** for a few
seconds (enormous total, but *never* an instant kill on a hard boss). Add real
**aiming** (crosshair-arm → click an enemy → fire). Buff the boss tower's **basic
attack** (projectile ~2× larger + slightly faster fire). **Rename** "Boss Blast" to a
beam/laser theme. This deletes the current winnable-summit mechanic, so the winnable
path is **re-derived** for the aimed beam.

This is the **SEQUENTIAL SPINE** — it rewires `Simulation.castUltimate` (now needs a
target), adds a beam DoT system, and rebalances the secret-summit win. Other V2.2
items (boss sprite, etc.) must sequence around the files it touches.

---

## 1. Current state (cited)

- **Special = full-map AoE nuke.** `Simulation.castUltimate()`
  (`v2/sim/Simulation.js:288-306`) takes **no target**: it loops
  `enemies.aliveEnemies(s)` and `damageEnemy(... { ignoreShield, sourceType:null })`
  on **every** alive enemy with a flat `ult.damage = 180000`, pushes a board-wide
  `{kind:'ultimate'}` flash effect (`:302`), emits `EV.ULTIMATE_CAST {towerId,damage}`.
- **Config** `towers.boss.ultimate` (`v2/config/gameConfig.js:272-285`):
  `name:'Boss Blast'`, `damage:180000`, `cooldownMs:5000`, `initialReadyFraction:0.5`,
  `piercesShield:true`, `fxTtlMs:700`. Boss levels (`:265-266`):
  L1 `{damage:30,fireRateMs:5000,cost:250}`, L2 `{damage:45,fireRateMs:4500,cost:300,ultimate:true}`.
  Boss `projectile {speed:600,size:14}` (`:262`).
- **Readiness / gating.** `_readyUltimateTowers` (`:269-275`), `ultimateReady` (`:279`),
  per-tower `ultReadyAt/ultActiveUntil` seeded in `placeTower`
  (`v2/sim/systems/towerSystem.js:165,171-172`).
- **Input.** `'ultimate'` HUD action and key `u/U` both call bare `sim.castUltimate()`
  (`v2/input/InputController.js:73,83`). No aiming today.
- **Render.** `kind:'ultimate'` effect = full-board ember flash + expanding ring
  (`v2/render/Renderer.js:326-337`); HUD ability button (`_ultimateAbility`
  `:1039-1087`) with `label='Blast!'` (`:1072`); status pill prints `def.ultimate.name`
  (`:731`). Palette ramp `PALETTE.ui.ult*` (`v2/render/palette.js:146-149`); HUD slot
  state machine `ultimateUiState` (`v2/render/abilityHud.js:61-70`).
- **Damage pipe.** `damageEnemy(state,e,amount,{ignoreShield,sourceType})`
  (`v2/sim/systems/enemySystem.js:293-321`) already supports shield-piercing + neutral
  affinity; `aliveEnemies` (`:347`).
- **Tick order** (`v2/sim/Simulation.js:96-102`): waves → enemies → towers →
  projectiles → economy → `_updateEffects` → `_checkWinLose`. `timestepMs = 1/60`
  (`gameConfig.js:30`).
- **The win contract (what the AoE currently satisfies).**
  `secret-wave.test.mjs:141-156` requires `optimal({ultimate:true})` to **WIN the
  summit with lives>0** on maps [0,1] × seeds [1,7], while `optimal()` (no ultimate)
  **LOSES** (`:118-133`). `measure-secret-boss.mjs` Scenario C (`:124-161`) asserts the
  same WITH-win / WITHOUT-loss **separation** and `exit(1)` otherwise. The on-field
  parent wall is ~580k HP and it **splits into 3 shielded `boss_splitling` shards**
  (`childHp` flat, shielded) on death (`enemySystem.killEnemy:335-344`). The current
  full-map cast clears parent **and** all 3 shards in one button. **Single-target
  deletes that** → must be re-derived.
- **Bot.** `policies.maybeUltimate` (`tools/balance/policies.mjs:227-256`) casts the
  no-target nuke when a `boss_split`/`boss_splitling` is alive; `summitConqueror` =
  `optimal({ultimate:true})` (`:339-345`). Harness `castUltimate()/ultimateReady()`
  (`tools/balance/harness.mjs:185-186`).

---

## 2. Concrete change (design-faithful)

### 2a. Single-target beam DoT (`castUltimate(target)`)
`Simulation.castUltimate(target)` now **requires** a live enemy target:

- `target` may be an enemy object or an enemy id; resolve to a live, non-reached enemy.
- **No target → no fire** (return `false`, no cooldown spent, no event). This is the
  core sim-testable guard.
- On fire: arm the most-ready boss tower's cooldown, push a **beam** onto a new
  `state.beams` array `{id, towerId, targetId, age:0, durationMs, totalDamage, tickMs,
  tickAcc:0, dealt:0}`, emit `EV.ULTIMATE_CAST {towerId, targetId}`.
- Keep `_readyUltimateTowers`/`ultimateReady` unchanged (a tower must still be L2 +
  off-cooldown).

### 2b. Beam system (new `v2/sim/systems/beamSystem.js`, wired in tick before economy)
Per beam, per tick:
- Resolve target; if gone/dead/reached → drop the beam (stop DoT).
- Accumulate `tickAcc += dt`; while `tickAcc >= tickMs`, apply one **chunk** =
  `totalDamage * tickMs / durationMs` via
  `damageEnemy(state,target, chunk, {ignoreShield:true, sourceType:null})` (pierces
  shields, neutral affinity — same as today). Cap the final chunk so cumulative
  `dealt` never exceeds `totalDamage`.
- `age += dt`; remove the beam when `age >= durationMs` or the target dies.

**Never-instant-kill invariant (two layers):**
1. **Per-tick** chunk (`totalDamage * tickMs/durationMs`, e.g. `~30k` for
   `totalDamage 300k / durationMs 2500 / tickMs 250` → 10 chunks) is **far** below a
   hard-boss HP (~580k), so a single tick can't delete it.
2. **Per-cast** `totalDamage < hardest on-field boss HP` — one full beam leaves a
   fresh wave-16 `boss_split` alive (it takes **~2 casts** to crack the parent).

Using `tickMs` cadence (not every `dt`) also throttles `ENEMY_HIT` spam so audio/FX
don't machine-gun.

### 2c. Aiming (pure-sim + input)
Add `state.ultimateAiming:false`. New sim seam:
- `Simulation.armUltimate()` → if `ultimateReady()` set `ultimateAiming=true`, return
  `true`; else `false`.
- `Simulation.cancelAiming()` → clears the flag.
- `gridClick(gx,gy)`: when `ultimateAiming`, an **enemy** click →
  `castUltimate(enemy); ultimateAiming=false; return 'ultimate'`; a non-enemy click →
  `cancelAiming()` (no accidental world action while armed). Clear the flag whenever a
  cast fires or the cast becomes illegal.

`InputController._dispatch('ultimate')` (`:73`):
- If an **enemy is already selected** (`s.selected.kind==='enemy'`, alive) **and**
  `ultimateReady()` → fire immediately: `sim.castUltimate(selectedEnemy)`.
- Else → `sim.armUltimate()` (arms the crosshair). Key `u/U` (`:83`) → `armUltimate()`.
This delivers "click the button arms a crosshair; fires only on an enemy click; if an
enemy is already selected, the button fires (no accidental casts)."

### 2d. Boss basic attack buff (`gameConfig.js`)
- `towers.boss.projectile.size 14 → 28` (≈2×, cosmetic/feel; px, not tile-clamped).
- `towers.boss.levels[].fireRateMs` faster but **still ≥3000** (boss-tower.test:71):
  e.g. L1 `5000→4000`, L2 `4500→3600`. (Final numbers are the rebalance's to tune.)
- Add a config note that boss projectile is the "heavy, faster plink".

### 2e. Rename + visuals
- Config `name:'Boss Blast' → 'Boss Beam'`; comments at `gameConfig.js:268-272`,
  `Simulation.js:283-287`, `palette.js:142`, `SECRET-WAVE.md:178` retitled to the beam.
- Renderer: replace the `kind:'ultimate'` full-board flash (`Renderer.js:326-337`)
  with a **beam draw from `state.beams`** — a thick streaming crimson/ember line
  (reuse `PALETTE.ui.ultReady/ultActive`) tower→target with slight per-frame jitter +
  a small impact glow on the target; keep it cheap (a couple of `stroke()`s, no blur).
  Add a contrasting **crosshair cursor** at the pointer / over enemies while
  `state.ultimateAiming`. HUD button `label='Blast!' → 'Beam!'` (`:1072`); status pill
  auto-picks up the new `def.ultimate.name` (`:731`).

### 2f. Config keys (new/changed under `towers.boss.ultimate`)
Replace `damage`/`fxTtlMs` with a beam sub-block (all named, no magic numbers):
```
ultimate: {
  name: 'Boss Beam',
  cooldownMs: <tune>,            // allow ~2 casts to land during the parent crossing
  initialReadyFraction: 0.5,
  piercesShield: true,
  beam: {
    totalDamage: <tune, < on-field parent HP>,  // enormous total, NOT an instakill
    durationMs: 2500,            // DoT window
    tickMs: 250,                 // DoT cadence (chunk = totalDamage*tickMs/durationMs)
    widthPx: 10, color: '<ember>'
  },
}
```

---

## 3. Re-derived winnable summit (the hard part)

Single-target removes the "one button clears parent + 3 shards". New intended line
(to be locked by the joint rebalance, same shape as V2.1's W9/W11 keystone):

1. **Parent (~580k):** ~2 aimed beams (each `totalDamage ~300k`) crack it during its
   crossing. `cooldownMs` + `initialReadyFraction` tuned so 2 casts fit the crossing.
2. **3 shards** (shielded, `childHp` flat): boss beam pierces shields; with the boss
   tower's buffed basic + FREEZE pinning them, the player beams the highest-HP shard
   and the standard kit/boss-plink + a possible 3rd cast finishes the rest.

**Levers for the joint rebalance (all in `gameConfig.js`):**
`towers.boss.ultimate.beam.totalDamage`, `.durationMs`, `towers.boss.ultimate.cooldownMs`,
`towers.boss.ultimate.initialReadyFraction`, `towers.boss.levels[].fireRateMs/damage`
(buffed basic), `enemies.boss_split.behavior.childHp`, `boss_splitling` shield timing,
`waves.scaling.lateSurge`, `freeze.minSpeedFraction`. Tune until: secret-wave WITH-win
(lives>0) + WITHOUT-loss on maps [0,1]×seeds [1,7]; Scenario C separation; the
no-ultimate margins (≥5x freeze+fork, ≥3x fork-only) **unchanged**; full suite green;
bench V2 p95 < V1 p95.

---

## 4. Files touched

| File | Change |
|---|---|
| `v2/config/gameConfig.js` (257-286, 262, 265-266) | rename → Boss Beam; `ultimate.beam{totalDamage,durationMs,tickMs,widthPx,color}` replaces `damage/fxTtlMs`; boss `projectile.size 14→28`; boss `fireRateMs` faster (≥3000). |
| `v2/sim/state.js` (59-74) | add `beams:[]`, `ultimateAiming:false`. |
| `v2/sim/Simulation.js` (96-102, 283-306) | `castUltimate(target)` requires target → spawns beam; `armUltimate()/cancelAiming()`; `gridClick` aiming branch; wire `beams.update` into tick. |
| `v2/sim/systems/beamSystem.js` (new) | DoT update: chunked `damageEnemy(ignoreShield,sourceType:null)`, drop on target loss / `age>=durationMs`, cap at `totalDamage`. |
| `v2/sim/events.js` (39) | `ULTIMATE_CAST` payload `{towerId,targetId}` (drop `damage`). |
| `v2/input/InputController.js` (73, 83) | `'ultimate'`/`u` → fire-on-selected-enemy or `armUltimate()`. |
| `v2/render/Renderer.js` (326-337, 1072) | beam render from `state.beams`; crosshair cursor when aiming; `'Blast!'→'Beam!'`. |
| `v2/render/palette.js` (142) | comment retitle (colors reused). |
| `tools/balance/policies.mjs` (227-256) | `maybeUltimate` picks a target (parent `boss_split` first, else a `boss_splitling`) and `castUltimate(target)`. |
| `tools/balance/harness.mjs` (185-186) | `castUltimate(target)`; `ultimateTarget()` helper. |
| `tools/balance/measure-secret-boss.mjs` (124-196) | unchanged structure; re-verify Scenario C separation after rebalance. |
| `v2/docs/SECRET-WAVE.md` (178…) | record the single-target-beam win contract + final margins. |

---

## 5. Failing-first tests

New `tools/tests/offense-beam.test.mjs` (drives the real Simulation headlessly):
- **target required:** at L2/off-cooldown, `castUltimate()` (no target) → `false`, no
  beam pushed, no `ULTIMATE_CAST`; `castUltimate(enemy)` → `true`, one beam, one event.
- **DoT over N seconds:** after one `tickMs` the target lost ≈one chunk (a small
  fraction); full `beam.totalDamage` only after `durationMs`; cumulative dealt ==
  `totalDamage` (capped, not over).
- **never instant-kills a hard boss:** spawn a wave-16-scaled `boss_split`, fire one
  full beam, assert `hp > 0` (per-cast `totalDamage < onFieldHp`) and that a single
  tick removes `< 10%` HP.
- **pierces shields:** a shielded `boss_splitling` takes beam DoT (mirrors current
  `boss-tower.test:208-228` but single-target).
- **aiming:** `armUltimate()` sets `ultimateAiming` only when ready; `gridClick` on an
  enemy while aiming fires + clears flag; `gridClick` on empty cancels; not-ready →
  `armUltimate()` false.
- **boss basic buff:** `towers.boss.projectile.size >= 2×` prior + `fireRateMs` faster
  yet `>= 3000` (extends boss-tower.test §0).

Update existing: `boss-tower.test.mjs:189-228` (target arg; AoE→single-target — the
"damages ALL alive enemies" assertion **re-flips** to "damages only the targeted enemy
over time"); `boss-tower.test.mjs:62-78` (`u.damage` → `u.beam.totalDamage`).
Keep as gates (must still pass post-rebalance): `secret-wave.test.mjs:118-156`,
`summit.test.mjs:129-147`, `measure-secret-boss.mjs` Scenario C.

---

## 6. Balance impact
The single-target beam **removes the AoE win**; the joint rebalance (§3 levers) must
restore WITH-win / WITHOUT-loss separation with ~2 casts on the parent + support for
the 3 shards, keep the no-ultimate wall (≥5x / ≥3x margins) intact, keep public win@15
banked and `GAME_WON` firing exactly once, and bench V2 p95 < V1 p95 (beam DoT is a
small per-frame array; cheaper than the old full-board damage loop).

## 7. Captures
- Render-capture: beam streaming tower→target + crosshair cursor while aiming
  (extend `tools/harness/captureV21.mjs`, which already arms the boss ultimate at
  `:138,171`). Before/after of the HUD button label ("Blast!"→"Beam!").

## 8. Dependencies & parallel-safety
- **Spine.** The §3 joint rebalance depends on this mechanic landing first; treat as
  one item (mechanic + re-derivation) or a strict follow-on.
- **Conflicts:** touches core sim (`Simulation`, `state`, `events`, new `beamSystem`),
  `InputController`, `Renderer`, and balance tools (`policies`, `harness`,
  `measure-secret-boss`) — overlaps any item editing those; **sequence** balance items.
- **Parallel-safe with:** the boss **sprite** rework (`shapes.js`/`SpriteCache.js`/
  palette **colors**) — disjoint except `palette.js:142` comment + `Renderer.js`
  (mild; coordinate the rename hunk). Pure-config tweaks elsewhere are fine.
