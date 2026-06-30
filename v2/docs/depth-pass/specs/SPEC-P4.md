# SPEC-P4 — Did upgrading help? Economy legibility + reversible max-level identity fork

**Status:** Draft (TDD spec, failing-test-first)
**Proposal:** PROPOSALS.md → "### P4 — Did upgrading help? economy legibility + reversible max-level identity fork"
**Addresses:** #4 (flooded, unspendable late money), #5 (invisible/dominated upgrades), #9 (tower role identity), G6.
**Boss-Tower Verdict:** this spec IS the ADAPT of the rejected literal level-4 boss-tower stat-bump.

---

## 1. Value proposition

Three coupled changes, smallest-blast-radius first:

1. **Pure-UI legibility (zero sim cost, ships regardless).** The upgrade button shows a real before→after delta (`Damage 8 → 12`, a range-ring preview) and one single rising **Power** scalar a child can watch grow. We never surface "+25%"; the wave bonus keeps arriving as visibly bigger coins (`waveSystem.updateActive` already does this silently).
2. **Max-level identity fork (the adapted boss-tower).** At L3 each tower forks ONCE into one of two arms — `basic → Sniper | Gunner`, `strong → Bomber | Froster`. Picture-only choice, no role words. Stats live in config; only **Froster** needs new logic, and it **REUSES P3's single shared slow field** (no second slow mechanic).
3. **Cheap, reversible re-forking = the recurring coin sink #4 was missing.** First fork is free (the natural L3 reward → felt "YES, upgrading helped"); switching arms costs a small `economy.reForkCost`, draining flooded late money and letting a kid try both arms with no punishment. Re-forking is a per-wave re-answer to the telegraphed threat ahead (Froster on swarms/boss-hold, Bomber on clusters, Sniper on evasive/fast).
4. **Curve rebalance.** Retune `towers.{basic,strong}.levels` so mid-tiers are not strictly dominated by L1 spam at equal coin spend — so the before→after card earns a felt YES at the levels players actually buy.

The fork is a **role** choice with opportunity cost, never raw "buy the win" power: it must NOT, on its own (without the P3 Freeze), make the wave-16 split boss beatable.

---

## 2. Current code (the real shapes this builds on)

- Commands live on `Simulation` (`v2/sim/Simulation.js`): `gridClick` (124), `placementPlace` (145), `placementCycle` (153), `placementClose` (161), `upgradeSelected` (163), `sellSelected` (168), `selectedTower` (113). All status-agnostic today.
- Tower stats: `towerSystem.levelStats(cfg, typeId, level)` (`v2/sim/systems/towerSystem.js:12`); `upgradeTower` caps at `tower.level >= 3` (58-69); `update()` reads `levelStats` for range/fireRate/targeting (107-131); fire is delegated to `projectileSystem.fire` (123).
- Damage carries **no source** today: `projectileSystem.fire` (`v2/sim/systems/projectileSystem.js:9`) builds the projectile purely from `cfg.towers[tower.typeId]`; `impact` (65) applies a global `cfg.combat.critChance/critMult` and calls `damageEnemy` with no tower/fork info. This is the exact plumbing gap P2 also names.
- Slow: there is **no** slow mechanic. `enemySystem.effectiveSpeed(e)` (`v2/sim/systems/enemySystem.js:77`) only handles the speed-boss. P3 introduces the shared slow field here; P4 Froster reuses it.
- Selected-tower UI: `Renderer._towerCard` (`v2/render/Renderer.js:577`) draws name/level/Damage/Range/Fire, an `upgrade` button (593) and a `sell` button (595) via `_button` (612), which registers hit-rects via `addHit`. Input maps hit actions in `InputController._dispatch` (`v2/input/InputController.js:55`) — note `_dispatch(action)` currently **drops** `hit.data` (called with data at line 42 but the signature ignores it).
- Sprites: `SpriteCache.tower(typeId, level, frame)` (`v2/render/SpriteCache.js:75`), keyed `tower:${typeId}:${level}:${frame}` (82), pre-baked per type:level in `Renderer` (205-208).
- Events: `v2/sim/events.js:22` `EV` map (has `TOWER_UPGRADE`, `TOWER_SELL`; no fork).
- Bench fixture: `gameConfig.js:178` `bench.fixture {enemies:40, towers:12, coins:30}`; built in `GameApp.buildFixture` (`v2/app/GameApp.js:136`), which places alternating basic/strong and upgrades `placed % 3` levels (163-165). Counts are LOCKED.
- Balance: `tools/balance/harness.mjs` `Bot` (45) actions `place`/`upgrade`/`sell`; `policies.mjs` `optimal` (123); `measure-secret-boss.mjs` measures the wave-16 damage margin (current ~7.2x).

---

## 3. Files + changes

| File | Change |
|------|--------|
| `v2/config/gameConfig.js` | Retune `towers.basic.levels` + `towers.strong.levels` (curve rebalance). Add `towers.basic.forks` (`sniper`,`gunner`) and `towers.strong.forks` (`bomber`,`froster`). Add `economy.reForkCost` (+ `economy.firstForkCost: 0`). Reference the shared `combat.slow` defaults (owned by P3; P4 only reads/overrides via `forks.froster.slow`). |
| `v2/sim/Simulation.js` | New command `forkSelected(arm)` (~after `sellSelected`, line 172) → `towers.forkTower(state, t.gx, t.gy, arm)`. If P1 lands, allow `fork` while `status==='planning'`. |
| `v2/sim/systems/towerSystem.js` | Add `canFork(state, tower)` (level≥3), `forkArmsFor(cfg, typeId)`, `forkTower(state, gx, gy, arm)` (validate arm∈type's forks; no-op same arm; charge `firstForkCost` if `fork==null` else `reForkCost`; set `tower.fork`; emit `EV.TOWER_FORK`), and `effectiveStats(state, tower)` (base `levelStats` merged with fork mults/overrides). Switch `update()` range/fireRate reads (115,119,126) + `acquireTarget` range from `levelStats` → `effectiveStats`. Add `upgradePreview(state, tower)` pure helper (before→after + Power scalar) for the renderer to read headlessly. New tower field `fork: null` in `placeTower` (30-35). |
| `v2/sim/systems/projectileSystem.js` | `fire(state, tower, target, st)` now reads `effectiveStats` and **threads the source** onto the projectile: `damage` from effective stats, `critChance`/`critMult` (fork override or `cfg.combat` default), `aoeRadius` from effective AoE, and `slow` (= `forks.froster.slow` or `null`). `impact` uses `p.critChance ?? cfg.combat.critChance`; applies `p.slow` via `enemySystem.applySlow` to the single target (and to every enemy in the bomb radius). Shares P2's projectile-source field. |
| `v2/sim/systems/enemySystem.js` | (P3-owned shared slow field; P4 consumes it.) Enemy struct gains `slowUntil:0, slowFactor:1` (in `spawnEnemy`, ~41). `effectiveSpeed(e, state)` multiplies by `e.slowFactor` while `state.clock < e.slowUntil`. New `applySlow(state, e, factor, durationMs)` (takes the stronger of overlapping slows). Call site `update()` (97) passes `state`. |
| `v2/sim/events.js` | Add `TOWER_FORK: 'tower:fork'` to `EV` (after `TOWER_SELL`, line 33). |
| `v2/render/Renderer.js` | `_towerCard`: show before→after delta + Power scalar from `towers.upgradePreview`; draw a board range-ring preview for the pending upgrade. At L3, replace the "Max level" disabled button with TWO picture-only fork buttons (the arms' icons) registering hit action `fork` with `data = armId`; if already forked, the other arm shows the small `+{reForkCost}c` re-fork affordance and the current arm reads as chosen. Pre-bake fork sprites alongside (205-208). |
| `v2/render/SpriteCache.js` | `tower(typeId, level, frame, fork=null)` keyed `tower:${typeId}:${level}:${fork||'-'}:${frame}`; bake the 4 procedural fork overlays (scope ring, rapid-fire pips, bigger-boom burst, snowflake). First-render cost only. |
| `v2/input/InputController.js` | Fix `_dispatch(action, data)` to accept data; add `case 'fork': sim.forkSelected(data); break;` (~67). |
| `v2/app/GameApp.js` | `buildFixture` (136): fork the L3 towers deterministically (e.g. cycle through all 4 arms) so the LOCKED bench fixture exercises fork sprites + the Froster slow path. Counts stay 40/12/30. |
| `tools/balance/harness.mjs` | `Bot`: add `fork(t, arm)` action (selectTower → `sim.forkSelected(arm)`); expose `tower.fork`. |
| `tools/balance/policies.mjs` | `optimal`: after a tower reaches L3, fork it via `forkChoice(bot, tower)` keyed to the next telegraphed wave's threat; re-fork when the upcoming threat flips the right arm. |
| `tools/balance/measure-secret-boss.mjs` | Uses the now fork-aware optimal bot; re-establish the wave-16 margin (must stay a wall WITHOUT freeze). |

---

## 4. New `gameConfig.js` keys (exact shapes)

```js
// economy
reForkCost: 20,          // small flat coin sink to SWITCH a fork arm
firstForkCost: 0,        // reaching L3 forks for free (the felt upgrade reward)

// towers.basic.forks
forks: {
  sniper: { name: 'Sniper', icon: 'scope',  rangeMult: 1.6, critChance: 0.6, critMult: 3 },
  gunner: { name: 'Gunner', icon: 'rapid',  fireRateMult: 0.55 },
},
// towers.strong.forks
forks: {
  bomber:  { name: 'Bomber',  icon: 'bigboom',   aoeRadiusMult: 1.8, bombDamageMult: 1.15 },
  froster: { name: 'Froster', icon: 'snowflake', slow: { factor: 0.5, durationMs: 1200 } },
},

// combat (shared slow field — DEFINED by P3; P4 references it)
slow: { defaultFactor: 0.5, defaultDurationMs: 1200 },
```

(Curve-rebalance numbers in `towers.{basic,strong}.levels` are tuned by the `upgrade-curve` + `balance-ladder` tests, not hand-frozen here; the property the numbers must satisfy is pinned by §5.)

---

## 5. Failing tests FIRST (write before any implementation)

All under `tools/tests/`, `node:test` style (mirror `economy.test.mjs` / `secret-wave.test.mjs`). Use the SHORT_MAP + `cfg()` helper convention already in those files. These are RED before, GREEN after.

### 5.1 `tools/tests/fork.test.mjs` — the fork mechanic (unit/sim)

- **`forkSelected requires max level`** — place basic, select it, `forkSelected('sniper')` at L1 and L2 returns `false` and `tower.fork === null`; only after two `upgradeSelected()` (L3) does it succeed.
- **`forking basic → Sniper applies range + crit overrides`** — at L3 fork `sniper`; assert `towers.effectiveStats(state,t).range === levelStats(cfg,'basic',3).range * cfg.towers.basic.forks.sniper.rangeMult`, and a projectile produced by `fire()` carries `critChance === forks.sniper.critChance`, `critMult === forks.sniper.critMult`.
- **`forking basic → Gunner shortens fire interval`** — `effectiveStats(...).fireRateMs === base.fireRateMs * forks.gunner.fireRateMult` (strictly lower than base).
- **`forking strong → Bomber widens AoE`** — `effectiveStats(...).aoeRadius === base.aoe.radius * forks.bomber.aoeRadiusMult`; a fired bomb projectile's `aoeRadius` matches.
- **`Froster fork slows on hit via the ONE shared slow field`** — fork `froster`; tick until a bomb impacts an enemy; assert `enemy.slowUntil > state.clock`, `enemy.slowFactor === forks.froster.slow.factor`, and `enemySystem.effectiveSpeed(enemy, state) === enemy.baseSpeed * forks.froster.slow.factor`. Assert there is exactly one slow path: a P3-style `applySlow` and the Froster both end at the same `slowUntil/slowFactor` fields (no froster-private slow state on the enemy).
- **`first fork is free; switching arms charges reForkCost`** — record coins at L3; `forkSelected('sniper')` leaves coins unchanged (firstForkCost 0); `forkSelected('gunner')` deducts exactly `economy.reForkCost`; calling `forkSelected('gunner')` again (same arm) is a no-op and deducts nothing.
- **`re-fork is reversible`** — sniper → gunner → sniper; `effectiveStats` reflects each arm in turn (range/crit then fireRate then range/crit again).
- **`invalid arm for a type is rejected`** — `forkSelected('bomber')` on a basic tower returns `false`, `fork` unchanged, no charge.
- **`TOWER_FORK event fires with id + arm`** — successful fork pushes `{type: EV.TOWER_FORK, id, arm}` to `frameEvents` and emits on the bus.

### 5.2 `tools/tests/upgrade-curve.test.mjs` — curve rebalance (balance/unit)

- **`each tier is a legible improvement`** — for both towers: `damage` strictly increases L1<L2<L3, `fireRateMs` strictly decreases, `range` non-decreasing — so the before→after card never shows a flat/negative delta.
- **`mid/high tiers are not strictly dominated by L1 spam at equal coin spend`** — on a single chokepoint cell, compute total damage-per-second·coverage for the coins it costs to reach L3 (one L3 tower) vs the same coins spent as L1 towers spread on the path; assert the L3 (upgrade) path delivers **≥** the L1-spam path against a clustered/boss target. Concretely: `dps(L3) / costToL3 >= dps(L1) / costL1` for the strong tower (coin-efficiency must not strictly fall with level). This is the "did upgrading help = YES" gate.

### 5.3 `tools/tests/economy.test.mjs` — legibility data (extend, unit)

- **`upgradePreview exposes a before→after delta and a rising Power scalar`** — `towers.upgradePreview(state, towerAtL1)` returns `{ from:{damage,range,fireRateMs}, to:{...}, powerFrom, powerTo }` with `to.damage > from.damage`, `to.fireRateMs < from.fireRateMs`, and `powerTo > powerFrom`. At L3 (no next level) it returns the fork arms instead (`{ arms: ['sniper','gunner'] }`) so the card can render the picture choice. (Headless: tests the data function the renderer consumes — no canvas.)

### 5.4 `tools/tests/balance-ladder.test.mjs` — fork-aware ladder parity (extend, balance)

- **`ladder #4 OPTIMAL still clears all 15 waves with the fork-aware bot`** — re-assert the existing shape: `wavesCleared === 15`, `0 < perWaveLives[15] <= 10`, `status === 'lost'` at `finalWave === 16` — now that `optimal` forks. Guards that the curve rebalance + fork keep the calibrated ladder.
- **`OPTIMAL exercises the fork lever`** — across seeds×maps, at least one run ends with a tower whose `fork !== null` (the lever is not dead code).
- **`monotone separation #5 still holds`** — re-run the existing `unfocused < spread < save < optimal` depth check under the new curve.

### 5.5 `tools/tests/secret-wave.test.mjs` — buy-the-win guard (extend, balance)

- **`the fork alone (no Freeze) does NOT make the split boss beatable`** — drive the fork-aware optimal bot to wave 16; assert `boss_split` is NOT killed and the damage margin `scaledBossHp / maxDamageLanded` stays above a guard threshold (≥ 3×). Proves P4 is a role, not "buy the win"; the real win path stays gated on P3 Freeze + P5 tuning.

### 5.6 render-capture — fork sprites + L3 card (render-capture)

- **`fork sprite variants are visually distinct`** — `SpriteCache.tower('basic',3,'neutral','sniper')` vs `...'gunner'`, and `tower('strong',3,'neutral','bomber')` vs `...'froster'` produce different-canvas pixel hashes (and differ from the unforked L3). Headless via SpriteCache + a canvas shim, or as a `tools/harness/visualCheck.mjs` assertion.
- **`L3 tower card renders two fork hit-rects (not a Max-level button)`** — via the capture harness: after a tower hits L3, `Renderer.hitTest` returns a `fork` action for both arm icons; before L3 it returns `upgrade`.

---

## 6. Implementation outline (after tests are RED)

1. Add `EV.TOWER_FORK`; add config (`forks`, `reForkCost`, `firstForkCost`, retuned `levels`).
2. `towerSystem.effectiveStats` + `forkTower` + `canFork` + `forkArmsFor` + `upgradePreview`; add `fork:null` to `placeTower`; swap `update()`/`acquireTarget` range+fireRate reads to `effectiveStats`. Tests 5.1/5.3 go green for stats.
3. `projectileSystem.fire` threads source (damage/crit/aoe/slow) onto the projectile; `impact` honors `p.critChance` and applies `p.slow` via `enemySystem.applySlow`. (Depends on P3's `applySlow`/`effectiveSpeed(e,state)`; depends on P2's projectile-source field — share it.) Froster + Sniper combat tests go green.
4. `Simulation.forkSelected` + `InputController` data-threaded `fork` dispatch.
5. Curve rebalance numbers in `levels` until 5.2 + 5.4 + 5.5 pass.
6. Renderer/SpriteCache: fork sprites, before→after delta, Power scalar, range-ring preview, L3 fork buttons. 5.6 + captures.
7. `policies.optimal` fork awareness + `Bot.fork` + `buildFixture` fork application + re-run `measure-secret-boss.mjs`.

---

## 7. Completion criteria (the gate)

- All new + extended tests GREEN: `fork`, `upgrade-curve`, extended `economy`, extended `balance-ladder`, extended `secret-wave`, render-capture.
- Full `npm test` GREEN (no regression in `sim`, `playthrough`, `replay-reset`, `maps`, `cute-soul`).
- `npm run bench` PASS — V2 p95 < V1 p95 with the fork-extended LOCKED fixture (40/12/30, now carrying forked L3 towers incl. an active Froster slow). Fork sprites are first-render only; no per-frame cost added.
- `measure-secret-boss.mjs` re-run with the fork-aware optimal bot: the no-Freeze margin stays a wall (≥ guard), confirming P4 is not buy-the-win.
- Before/after captures produced (§ captures).

---

## 8. Dependencies (and why)

- **P3 (hard).** Froster REUSES P3's single shared slow field. P3 owns the `effectiveSpeed(e, state)` slow handling + `applySlow` + enemy `slowUntil/slowFactor`. Building slow in P4 too would create two slow mechanics — explicitly forbidden ("exactly one slow mechanic in `effectiveSpeed()`"). P4's Froster test (5.1) asserts the SAME fields P3's Freeze sets.
- **P2 (hard-ish).** Both need a damage **source** threaded onto the projectile at `fire()` → `impact()` (`damageEnemy` carries none today). P4's per-tower Sniper crit and Froster slow ride the same projectile-source field P2 adds for affinity. Share it to avoid two competing plumbings. If P2 has not landed, P4 introduces the minimal source-carry itself (`p.critChance/p.critMult/p.slow`).
- **P1 (soft).** The fork is a picture-only binary surfaced in the L3 popup; P1's plan-mode/auto-pause give the kid a calm, frozen window to read before→after and pick an arm. P1 also status-gates `placement`/popup commands — the new `fork` command must be in the `planning`-legal set. Fork is functional without P1, but the legibility goal leans on it.
- **P5 (reverse).** P5 depends on P4 (the Bomber/Froster forks are the alert-player's boss tools), and P5 — not P4 — owns gating the wave-16 win on the fork+Freeze combo and re-tuning the summit. P4's only obligation upward is the §5.5 buy-the-win guard.

---

## 9. Balance-harness parity deliverable

The optimal bot + LOCKED bench fixture must exercise every new lever so the 7.2x split-boss measurement and the p95 gate keep measuring the REAL game:

- `tools/balance/harness.mjs` — `Bot.fork(t, arm)` faithful command-API action; expose `t.fork`.
- `tools/balance/policies.mjs` — `optimal` forks each tower on reaching L3 via `forkChoice(bot, tower)` (arm chosen from the next telegraphed wave's dominant threat), and re-forks (paying `reForkCost`) when the upcoming threat flips the right arm — so the bot drains the late economy through the sink, as a real player would.
- `v2/app/GameApp.buildFixture` — fork the fixture's L3 towers across all 4 arms (incl. an active Froster slow) with counts locked at 40/12/30.
- `tools/balance/measure-secret-boss.mjs` — re-measure the wave-16 margin with the fork-aware bot; record the new no-Freeze margin (must stay ≥ guard). This is the figure §5.5 asserts against.

---

## 10. Before/after captures (observable changes)

Produced via `tools/harness/captureAll.mjs` / `captureAnim.mjs` / `visualCheck.mjs` into `v2/captures/`:

1. **L3 tower card:** before = disabled "Max level" button; after = two picture-only fork buttons (icons), and the re-fork `+{reForkCost}c` affordance once forked.
2. **Upgrade legibility:** before = static `Damage 8  Range 2`; after = `Damage 8 → 12` delta + rising **Power** scalar + on-board range-ring preview.
3. **Fork sprites grid:** the 4 new procedural variants (Sniper scope, Gunner pips, Bomber boom, Froster snowflake) beside the unforked L3.
4. **Sniper range:** before/after board showing the extended range ring vs base L3.
5. **Froster slow (animated):** a crowd visibly iced/slowed by a Froster bomb (proves the shared slow field renders).
6. **Re-fork spend:** coin total before/after switching arms (the recurring sink in action).
