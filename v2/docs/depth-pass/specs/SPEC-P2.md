# SPEC-P2 — Every wave is a puzzle: tower affinity + readable enemy flags + spawn-direction variety

**Status:** Implementation spec (TDD). Derived from `PROPOSALS.md` → "### P2".
**Rough cost:** L. **Addresses:** #9, #10 (incl. layouts), #5, #3, G2, G4.

---

## 1. Value proposition

Today the two towers are per-coin near-substitutes (no counter rule), the three
enemy archetypes are fixed by wave 3, and "variety" is only count/hp/speed
scaling — no wave ever demands a *different answer* than the one before. P2 makes
the "which tower / where do I build?" question the central per-wave decision by
adding three composable axes, each shipped **with a loud non-numeric tell** (the
gate — a 5-10yo cannot read a multiplier):

1. **Soft 2-way tower affinity** — a damage multiplier (never immunity): the
   right tool ≈2×, the wrong tool ≈0.5×. Pointy/precise `basic` shreds *evasive*;
   boomy/AoE `strong` shreds *armored* + *swarm*. Feedback is spectacle: wrong
   tool **tinks/bounces** + sad puff; right tool **splats**.
2. **≤3 composable enemy property flags** authored onto base bodies in the wave
   list (not new enemy types): *armored* (spikes glyph), *evasive* (shimmer
   glyph — the one live-animated flag), *regen* (leaf glyph + visible gulp, no
   numeric heal counter). Capped at 2 flags early, 3 only as an upper tier.
3. **Per-wave spawn-direction variety** — some waves enter from the far end of
   the single path, so *where* you build genuinely changes wave-to-wave
   (closes the "layouts" third of #10). Deterministic, no new entities.

Plus the readability layer in the SAME change (Tactical Recon banner extending
the existing announcement; flag glyphs baked into SpriteCache) and a fair-value
retune of boss `livesCost` (#3) so the telegraph pairs with substance.

A loss becomes *diagnostic* ("I had no boom for the swarm") — the engine that
turns #2's replay urge into informed improvement.

---

## 2. Real code this builds on (file:line, verified)

| Concern | Location | Today |
|---|---|---|
| Damage entry point | `v2/sim/systems/enemySystem.js:135` `damageEnemy(state, e, amount, fromBomb=false)` | carries NO damage source |
| Projectile spawn | `v2/sim/systems/projectileSystem.js:9` `fire()` | builds `p` with no `sourceType` |
| Projectile impact | `v2/sim/systems/projectileSystem.js:65` `impact()` | calls `damageEnemy(...,true)` (bomb, `:73`) and `damageEnemy(...,false)` (single, `:80`) |
| Enemy spawn | `v2/sim/systems/enemySystem.js:17` `spawnEnemy(state, item)` | reads only `config.enemies[typeId]`; sets `behavior` from def (`:40`); movement always path[0]→path[last] |
| Movement / reachGoal | `enemySystem.js:82` `update()` / `:123` `reachGoal()` | hardcoded forward (`pathIndex` 0→`last`) |
| effectiveSpeed | `enemySystem.js:77` | reads only `speed` behavior |
| Wave group → queue | `v2/sim/systems/waveSystem.js:34` `buildSpawnQueue()` | reads `group.{type,count,formation}` only |
| Wave queue item shape | `waveSystem.js:48-54` | `{typeId, hp, speed, reward, gapMs}` |
| Wave announce/banner | `waveSystem.js:81` (`beginNextWave`), `:105` (`updatePrepare`) | `{text, kind}`; honours `pat.announce` |
| Patterns | `v2/config/gameConfig.js:61-85` | groups have no `flags`; patterns have no `entry` |
| Enemy defs | `gameConfig.js:90-113` | no `traits`; `livesCost` per boss |
| Combat config | `gameConfig.js:144-152` | `critChance/critMult/typeScore`; no `affinity` |
| Bench fixture (locked) | `gameConfig.js:178` `bench.fixture = {enemies:40,towers:12,coins:30}` | no flags |
| Bench fixture builder | `v2/app/GameApp.js:136` `buildFixture()` | spawns 40 plain enemies (`:147-153`) |
| Enemy sprite bake | `v2/render/SpriteCache.js` `enemy(typeId, frame='neutral')` | no flag glyphs, no flagmask key |
| Renderer enemy draw | `v2/render/Renderer.js:143` `_enemies()` (`:148-152` warm + select) | no flagmask, no affinity tell |
| Event bus | `v2/sim/events.js:22` `EV.*` (`ENEMY_HIT` `:28`) | `ENEMY_HIT` payload `{id, amount, fromBomb, shielded}` |
| Balance bot | `tools/balance/policies.mjs:55` `chooseType()`, `:123` `optimal()` | picks type by coverage only, affinity-blind |

`damageEnemy`'s existing non-projectile callers pass only 3 args
(`tools/tests/secret-wave.test.mjs:56`, `cute-soul.test.mjs:130`,
`economy.test.mjs` via kill), so widening the 4th param to an options object is
backward-compatible.

---

## 3. New `gameConfig.js` keys

```js
// combat: (gameConfig.js:144 block) — add:
affinity: {
  strongMult: 2.0,    // right tool (soft, never immunity)
  weakMult:   0.5,    // wrong tool (soft, never 0× — two towers must not hard-leak)
  neutralMult:1.0,
  // tower typeId -> enemy traits this tower is the RIGHT counter for
  counters: { basic: ['evasive'], strong: ['armored', 'swarm'] },
},

// enemies: add `traits` to base types (gameConfig.js:90 block)
//   fast:   traits: ['evasive']     // precision counters the dodgy one
//   strong: traits: ['armored']     // boom counters the tanky one
//   basic:  (no traits — neutral)
//   boss_* : optional traits per fantasy (boss_split -> ['armored'] so AoE is its key)

// NEW top-level registry of composable flags:
enemyFlags: {
  cap: { early: 2, max: 3 },        // legibility cap, enforced by a test
  // stable order defines the SpriteCache flagmask bit order:
  order: ['armored', 'evasive', 'regen', 'swarm', 'buffer'],
  defs: {
    armored: { trait: 'armored', glyph: 'spikes',   animated: false },
    evasive: { trait: 'evasive', glyph: 'shimmer',  animated: true  }, // SOLE live-animated flag (p95 budget)
    regen:   { trait: 'regen',   glyph: 'leaf',     animated: false, behavior: { type: 'regen', hpPerSec: 3 } },
    swarm:   { trait: 'swarm',   glyph: 'cluster',  animated: false },
    buffer:  { trait: 'buffer',  glyph: 'umbrella', animated: false, behavior: { type: 'buff', buffRadius: 1.5, buffMult: 0.5 } },
  },
},

// waves block (gameConfig.js:48): no new top-level key, but the PATTERN/GROUP
// SCHEMA gains optional fields (no magic numbers; pure authoring):
//   pattern.entry: 'start' | 'end'   (default 'start') — spawn-direction
//   group.flags:   ['armored', ...]  (default [])      — composable flags
// Author at least: one armor wave (strong's job), one evasive wave (basic's job),
// one swarm wave, one reverse-entry ('end') wave, and one recombined armor+evasive
// upper-tier wave — onboarded one verb at a time.

// boss livesCost RETUNE (#3) — fair drain to pair telegraph with substance
// (gameConfig.js:97-99). Tunable; validated by the balance gate below:
//   boss_shield:     livesCost 3 -> 2
//   boss_speed:      livesCost 4 -> 3
//   boss_regenerate: livesCost 5 -> 4
//   (boss_split / boss_splitling unchanged — owned by P3/P5 win-path)

// bench.fixture (gameConfig.js:178) — extend the LOCKED fixture to carry flags so
// p95 measures the real game (glyph blits + the one live-animated overlay):
bench: { fixture: { enemies: 40, towers: 12, coins: 30, flags: ['armored', 'evasive', 'regen'] }, frames: 300, warmup: 60, throttle: 4 },
```

---

## 4. Files touched & changes

| File | Change |
|---|---|
| `v2/config/gameConfig.js` | add `combat.affinity`, base-enemy `traits`, top-level `enemyFlags`, pattern `entry` + group `flags` authoring, boss `livesCost` retune, `bench.fixture.flags`. |
| `v2/sim/systems/enemySystem.js` | export `affinityMult(cfg, sourceType, traits)`; widen `damageEnemy(state, e, amount, opts={})` (`{fromBomb,sourceType}`) and apply the multiplier + classify tell; `spawnEnemy` reads `item.flags`/`item.entry`, sets `e.flags`, `e.traits`, flag-driven `behavior`, and reverse spawn terminal/`dir`; generalize `update()`/`reachGoal()`/`effectiveSpeed` for `dir` (forward toward `last`, reverse toward `0`); add `'buff'` case to `updateBehavior` (radius damage reduction applied in `affinityMult`/`damageEnemy`). |
| `v2/sim/systems/projectileSystem.js` | `fire()` sets `p.sourceType = tower.typeId`; `impact()` passes `{fromBomb, sourceType}` to both `damageEnemy` calls and tags the hit/explosion effect with the primary target's affinity tell. |
| `v2/sim/systems/waveSystem.js` | `buildSpawnQueue` copies `group.flags` and `pattern.entry` into queue items; `beginNextWave`/`updatePrepare` enrich `announcement` with `{threat, entry}` (Tactical Recon). |
| `v2/sim/events.js` | `ENEMY_HIT` payload gains `affinity:'strong'|'weak'|'neutral'`, `mult`, `dealt` (no new EV name needed). |
| `v2/render/SpriteCache.js` | `enemy(typeId, frame, flagmask=0)` bakes flag glyphs once under key `enemy:${typeId}:${frame}:${flagmask}`. |
| `v2/render/Renderer.js` | `_enemies()` computes flagmask from `e.flags`, warms `(typeId,flagmask)`, blits glyph variant; cheap per-frame alpha modulation for the one animated flag (evasive shimmer); render affinity tell (tink/bounce + sad puff vs big splat) from the effect's `affinity`; draw Tactical Recon banner threat icon + entry arrow. |
| `v2/app/GameApp.js` | `buildFixture()` applies `fixture.flags` round-robin across the 40 enemies (incl. the animated `evasive`) so the locked bench exercises every new lever. |
| `tools/balance/policies.mjs` | add `affinity`-aware tile/type choice in `chooseType`/`optimal` (peek active+next wave flags via a new Bot helper); add a freeze-agnostic affinity-optimal export used by the balance gate. |
| `tools/balance/harness.mjs` | `Bot` gains `upcomingWaveFlags()` (reads `state.wave` + next `config.waves.patterns`) so policies can pick the right tool. |

---

## 5. CONCRETE failing-test-first plan (write these FIRST)

All new sim tests follow the existing `SHORT_MAP` + `makeConfig` pattern from
`tools/tests/sim.test.mjs:1-40` (deep-clone CONFIG, override `maps`/`waves`,
`advance(sim, ms)`).

### 5a. `tools/tests/affinity.test.mjs` (NEW — unit)
1. **`affinityMult is right-tool 2x, wrong-tool 0.5x, neutral 1x`** — import
   `affinityMult` from `enemySystem.js`. Assert `affinityMult(CONFIG,'basic',['evasive'])===2.0`,
   `affinityMult(CONFIG,'strong',['evasive'])===0.5`,
   `affinityMult(CONFIG,'strong',['armored'])===2.0`,
   `affinityMult(CONFIG,'basic',[])===1.0`, `affinityMult(CONFIG,null,['armored'])===1.0`.
2. **`damageEnemy applies the source multiplier to hp`** — spawn an `evasive`-flagged
   basic (hp 100). `damageEnemy(state,e,10,{sourceType:'basic'})` → hp === 80
   (10×2). Fresh enemy, `damageEnemy(state,e,10,{sourceType:'strong'})` → hp === 95
   (10×0.5). `damageEnemy(state,e,10)` (no source) → hp === 90 (×1).
3. **`damageEnemy emits an affinity tell on ENEMY_HIT`** — subscribe to
   `EV.ENEMY_HIT`; right-tool hit payload `affinity==='strong'` & `mult===2`;
   wrong-tool `affinity==='weak'` & `mult===0.5`; untagged `affinity==='neutral'`.
4. **`fire→impact threads sourceType end-to-end`** — place a `basic` tower next to
   an `evasive` enemy on SHORT_MAP, `advance` past one fire cycle, capture
   `ENEMY_HIT`; assert `affinity==='strong'` (proves `fire()` set `p.sourceType`
   and `impact()` forwarded it — no shortcut at the damage layer).
5. **`weakMult never reaches 0 (no hard immunity)`** — assert
   `CONFIG.combat.affinity.weakMult > 0`.

### 5b. `tools/tests/enemy-flags.test.mjs` (NEW — unit)
1. **`group.flags propagate schema→queue→enemy.traits`** — config one wave
   `{enemies:[{type:'basic',count:1,flags:['armored']}]}`; run to spawn; the live
   enemy has `flags` containing `'armored'` and `traits` containing `'armored'`.
2. **`base-type traits compose with flags`** — a `fast` enemy (base trait
   `evasive`) carrying flag `armored` ends with `traits` ⊇ `['evasive','armored']`.
3. **`regen flag attaches the regen behavior`** — basic + flag `regen`: after
   `damageEnemy(...,5)` then `advance(sim, 2000)`, hp has risen back toward maxHp
   (proves `enemyFlags.defs.regen.behavior` wired into `updateBehavior`), and the
   heal is animation-only (no `state` numeric-heal counter introduced).
4. **`flag cap is enforced`** — assert `enemyFlags.cap.early===2`,
   `enemyFlags.cap.max===3`; a test-config wave authored with >3 flags throws or
   is clamped (decide clamp; assert resulting `traits` ≤ max).
5. **`flagmask is stable from enemyFlags.order`** — a helper `flagMask(cfg,flags)`
   (exported by SpriteCache or a shared util) gives the same int regardless of
   author order: `flagMask(CONFIG,['evasive','armored'])===flagMask(CONFIG,['armored','evasive'])`.
6. **`buffer flag reduces damage to nearby enemies`** (upper-tier) — a `buffer`
   enemy adjacent to a basic: `damageEnemy(basic,10,{sourceType:'basic'})` deals
   `10*buffMult` while the buffer is alive & in radius; full damage once the
   buffer is killed. ("pop the umbrella monster first.")

### 5c. `tools/tests/spawn-direction.test.mjs` (NEW — sim)
1. **`entry:'end' spawns at the far terminal`** — SHORT_MAP wave with
   `pattern.entry:'end'`; first spawned enemy's `x` is near `cellCenter(path[last]).x`
   (i.e. `> cols/2`), `dir===-1`, `pathIndex===last`.
2. **`reverse enemy walks toward start and reaches goal`** — advance fully; the
   enemy's `x` strictly decreases across two samples, then `lives` decrement
   exactly once (reachGoal fires at `path[0]`), and `reachedGoal===true`.
3. **`default entry is unchanged (forward) — regression`** — a wave with no
   `entry` spawns at `path[0]` with `dir===1` and reaches `path[last]` (proves the
   forward path is byte-for-byte preserved; guards the existing sim tests).
4. **`announcement carries threat + entry for the Recon banner`** — a wave with
   `flags:['armored']` + `entry:'end'`: during `prepare`, `state.wave.announcement`
   has `threat==='armored'` and `entry==='end'`.

### 5d. `tools/tests/balance-ladder.test.mjs` (EXTEND — balance)
1. **`optimal still wins all 15 with affinity active`** — after wiring
   affinity-aware `optimal`, the existing win assertion still holds across
   `SEEDS × MAPS` (regression: P2 must not break the difficulty ladder).
2. **`affinity-blind play visibly leaks a mono-threat wave`** — a fixed
   wrong-tool-only board (all `basic`) vs an authored pure-`armored` wave loses
   more lives than an affinity-correct board on the same seed (proves the counter
   rule has teeth — anti-shrug).
3. **`no-leak boss handling is achievable (#3 retune)`** — an affinity-correct
   optimal bot loses ≤ a small fixed budget across boss waves 5/10/15 (validates
   the `livesCost` retune is fair, not punitive).

### 5e. `tools/tests/secret-wave.test.mjs` (EXTEND — balance)
1. **`affinity does not trivialize the secret boss`** — re-assert the unbeatability
   margin with the affinity-aware bot driving (the 7.2x measurement must still be
   measuring the real game; full re-measure via `measure-secret-boss.mjs`).

### 5f. Render-capture (capture harness, not node:test) — `tools/harness/`
- **affinity tell**: capture wrong-tool (tink/bounce + sad puff) vs right-tool
  (big splat) on the same enemy.
- **flag glyphs**: capture armored (spikes), evasive (shimmer), regen (leaf) and a
  2-flag composite enemy; confirm legible at tile size.
- **reverse-entry wave** and **Tactical Recon banner** (threat icon + entry arrow).

---

## 6. Implementation outline (after the tests are red)

1. **Config first** (§3) — add `affinity`, base `traits`, `enemyFlags`, schema
   authoring, `livesCost` retune, `bench.fixture.flags`. Makes 5a.1/5a.5/5b.4/5b.5 reachable.
2. **`affinityMult` + `damageEnemy` opts** in `enemySystem.js` — central
   multiplier + tell classification + `ENEMY_HIT` payload (5a.1-3, 5a.5).
3. **Thread the source** — `fire()` sets `p.sourceType`; `impact()` forwards
   `{fromBomb, sourceType}` to both calls + tags the hit/explosion effect (5a.4).
4. **Flags through the pipe** — `buildSpawnQueue` copies `group.flags`/`pattern.entry`;
   `spawnEnemy` sets `e.flags`/`e.traits`, composes flag behaviors (regen, buff),
   clamps to `cap.max` (5b.1-3, 5b.6).
5. **Spawn direction** — `spawnEnemy` honours `item.entry` (terminal + `dir`);
   generalize `update()`/`effectiveSpeed`/`reachGoal()` for `dir` (5c.1-3).
6. **Recon banner** — enrich `announcement` with `{threat, entry}` (5c.4).
7. **Bench fixture** — `buildFixture()` applies `fixture.flags` round-robin (perf).
8. **Render layer** — SpriteCache flag glyphs + flagmask key; Renderer flagmask
   select, one animated-flag alpha modulation, affinity tell, Recon banner art.
9. **Balance parity** — `Bot.upcomingWaveFlags()`, affinity-aware `optimal`;
   re-run ladder + `measure-secret-boss.mjs` (5d, 5e).

---

## 7. Completion criteria (the gate)

- `npm test` green, including all NEW tests (5a-5e) and the unchanged existing
  suites (sim, economy, balance-ladder, secret-wave, playthrough, replay-reset,
  maps, cute-soul) — proves no regression to determinism or the difficulty ladder.
- `npm run bench` PASSES: V2 p95 < V1 p95 with the **flagged** locked fixture
  (40 enemies carrying `['armored','evasive','regen']`, incl. the single live
  animated overlay). This is the real p95 threat — confirm the animated flag is
  the *only* per-frame non-blit cost.
- `node tools/balance/measure-secret-boss.mjs` re-run with the affinity-aware bot;
  the unbeatability margin is re-recorded (P2 must not, on its own, trivialize it).
- Before/after captures (§5f) produced under `v2/captures/`.

---

## 8. Dependencies on other specs (and WHY)

| Spec | Type | Why |
|---|---|---|
| **P5** (sprite-fit `sizeScale` clamp) | soft | flag glyphs must be legible at tile size; P5's footprint fix keeps glyphs inside the cell and makes buildable space scarce so a 50/50 mix can't trivially cover everything (anti-dominant guard). P2 can ship first but the glyph-legibility + anti-dominant story is only fully closed once P5 lands. |
| **P4** (cheap re-fork) | soft | makes affinity a *recurring* re-answer (re-fork per telegraphed wave) instead of a frozen opening — completes the anti-dominant-strategy guard. Not required for P2's mechanic. |
| **P3** (slow field / freeze) | none for P2; P3 depends on P2 | P2 supplies the AoE-affinity + precision-burst half of the split-boss win path P3 keys off. |
| **P1** (plan-mode calm window) | soft | unrushed affinity decisions read better, but P2 is independently testable headless. |

No HARD blocker: P2 is shippable standalone; the listed deps strengthen its
anti-dominant balance, not its correctness.

---

## 9. Balance-harness parity deliverable

- Extend `Bot` (`harness.mjs`) with `upcomingWaveFlags()` reading `state.wave`
  index + `config.waves.patterns` so policies can pick the right tool.
- Make `optimal` (`policies.mjs`) affinity-aware: `chooseType` prefers `basic`
  when the active/next wave is evasive-heavy and `strong` when armored/swarm-heavy,
  before falling back to coverage. Keep it deterministic (stable tile ordering).
- Extend the **locked** `bench.fixture` to carry flags (§3) and re-run `__bench`.
- Re-run `measure-secret-boss.mjs` with the affinity-aware optimal bot so the
  7.2x figure measures the real (post-affinity) game.

This is mandatory, not asserted: without it the ladder and the split-boss margin
measure the old game.

---

## 10. Before/after captures for observable changes

Wrong-tool **tink/bounce + sad puff** vs right-tool **big splat** (same enemy);
the three flag glyphs (spikes/shimmer/leaf) + a 2-flag composite; a reverse-entry
('end') wave; the Tactical Recon banner (threat icon + entry arrow). All via
`tools/harness/captureAll.mjs` / `captureAnim.mjs` into `v2/captures/`.
