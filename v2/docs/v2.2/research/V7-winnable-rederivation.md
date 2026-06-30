# V2.2 — V7: Winnable-Summit Re-Derivation (single-target aimed beam)

Branch: `v2-depth-pass`. Depends on **V2** (the aimed single-target BEAM mechanic) and
**V3** (the new boss-tower sprite + aim-confirm UI). This item is the **rebalance + the
two-sided gate**: it re-derives HOW the secret wave-16 Split Boss (and its 3 shards) is
beaten once the full-map AoE nuke is replaced by a single-target DoT beam, and proves the
gate in the balance harness + tests.

---

## 1. What exists today (cite file:line) — the mechanic this pass DELETES

- **Boss tower + ultimate config:** `v2/config/gameConfig.js:257-287`.
  L1 cost 250 / L2 cost 300, `range 34`, `fullMap: true`, `fireRateMs 5000/4500`.
  `ultimate` block (`:271-286`): `name 'Boss Blast'`, **`damage: 180000`** (flat),
  `cooldownMs: 5000`, `initialReadyFraction: 0.5`, `piercesShield: true`, `fxTtlMs: 700`.
- **The cast (full-map AoE):** `v2/sim/Simulation.js:288-305` (`castUltimate()`).
  Loops `enemies.aliveEnemies(s)` and applies `ult.damage` to **every** alive enemy with
  `{ ignoreShield: true, sourceType: null }`. No target argument. Emits `EV.ULTIMATE_CAST`
  (`v2/sim/events.js:39`).
- **Readiness:** `Simulation._readyUltimateTowers()` / `ultimateReady()` (`:266-281`),
  per-tower `ultReadyAt` cooldown.
- **Policy:** `tools/balance/policies.mjs:227-256` (`maybeUltimate`) — casts the instant
  ready AND any `boss_split`/`boss_splitling` is alive (no target); `summitConqueror` =
  `optimal({ultimate:true})` (`:339-344`).
- **Harness:** `tools/balance/harness.mjs:185-186` (`castUltimate()` / `ultimateReady()`).
- **Measure:** `tools/balance/measure-secret-boss.mjs` Scenario C (`:124-156`) +
  gate (`:189-196`).
- **Tests:** `tools/tests/boss-tower.test.mjs:208-227` ("damages ALL alive enemies"),
  `tools/tests/secret-wave.test.mjs:136-150` (WITH-ultimate WINS), `:118-134` (WITHOUT loses),
  `tools/tests/summit.test.mjs:133`.

### Measured baseline (just ran `node tools/balance/measure-secret-boss.mjs`)
- Parent (`boss_split`) **on-field HP = 580,115** (base 24000 × scaling × bossMult 1.5 ×
  lateSurge 3.30).
- Tower-only chip on the parent during its crossing: **~30k map0, ~20k map1** (peak 30,847).
- No-ultimate wall margin **18.8×** (gate ≥5×); fork-only **19.7×** (gate ≥3×).
- Current win: optimal(ultimate) lands **5 casts** of 180k (= 900k) on the parent, then the
  post-split cast AoEs all 3 shards at once. Wins with **8-9 lives**.
- Shards: `boss_split.behavior.childHp = 22000` (authoritative; **not** wave-scaled —
  spawned via explicit hp in `enemySystem.killEnemy` `:335-342`). `boss_splitling` is
  shield-flagged (`durationMs 1800 / cooldownMs 2600` ≈ 41% uptime), `livesCost: 12`.

### The deletion & its consequence
The win mechanic IS the post-split full-map AoE: one cast clears all 3 shards. Single-target
removes it. Also `livesCost`: parent **99** (any leak = instant loss; `lives.max 12`) and each
shard **12** (any single shard leak = instant loss). So the winnable path requires killing the
parent **AND all 3 shards** before any reaches the goal — the AoE made the 3-shard step free;
the beam does not.

---

## 2. Re-derived winnable path (the design)

**Tactical shape (the brief's "~2 casts/wave + tower support for the 3 shards"):**
1. **Aim the beam at the PARENT and kill it EARLY** (~2-3 casts). Killing it in the front
   half of the path is the whole trick: shards spawn at the parent's path progress
   (`child.progress = min(0.99, e.progress)`, `enemySystem.js:340`), so an early parent kill
   forces the 3 shards to traverse the kill-zone — giving towers time to clear them. (The old
   AoE didn't care where the parent died.)
2. **Towers clear the 3 shards** as they cross (the brief's "tower support"), with at most one
   leftover beam cast on the most-advanced shard. This requires **lowering shard HP and shield
   uptime** so the standard kit can finish them in the back half of the path.

**Why this satisfies both sides of the gate:**
- **(A) Winnable:** 2-3 casts × ~300k = 600-900k > 580k parent (+ ~30k tower chip) → parent
  dies early; weakened shards die to towers+freeze before any leaks → win, lives>0 (lives carry
  from the public win, ~8-12).
- **(B) Not a faceroll:** single-target (one enemy per cast — useless against a swarm, so it
  can't trivially clear public waves); **aim-confirm** (a cast needs a chosen target, adds
  friction, can't blind-spam); **DoT, not instant** (one cast cannot one-shot the 580k parent);
  **long cooldown** (12s vs 5s → ~2-3 casts/crossing, not 5).

---

## 3. Concrete changes

### 3a. `v2/config/gameConfig.js` — the `ultimate` sub-block (`:271-286`)
Keep the block named `ultimate` (API stays `castUltimate`) but flip its payload from a flat
nuke to a single-target DoT. Starting points (tuned by measure-secret-boss in implementation):
```js
ultimate: {
  name: 'Boss Beam',          // was 'Boss Blast'
  // single-target aimed DoT — pierces shields, affinity-neutral (sourceType null).
  dotTickMs: 250,             // tick cadence
  dotTicks: 8,                // 8 ticks -> 2000ms beam duration
  dotDmgPerTick: 40000,       // 8*40000 = 320000 total/cast (DoT, NOT a one-shot of the 580k parent)
  cooldownMs: 12000,          // LONG (was 5000): ~2-3 casts/crossing -> can't spam waves
  initialReadyFraction: 0.5,
  piercesShield: true,
  requireTarget: true,        // aim-confirm: a cast with no valid target is rejected
  fxTtlMs: 700,
},
```
Remove `damage: 180000` (replaced by the DoT triplet).

### 3b. `v2/config/gameConfig.js` — shards (winnability lever; safe to lower)
`boss_split.behavior.childHp 22000 -> 9000` (`:170`) and keep `boss_splitling.hp` in sync
`22000 -> 9000` (`:178`). Reduce shard shield uptime so towers can chip it:
`boss_splitling.behavior.durationMs 1800 -> 1000`, `cooldownMs 2600 -> 3500` (~22% uptime).
**These do NOT touch the no-ultimate ≥5×/≥3× margins** — without the beam the 580k parent never
dies, so shards never spawn in those scenarios (verified: Scenario A/A2/B only damage the parent).

### 3c. `v2/sim/Simulation.js` — `castUltimate(targetId)` (`:288-305`)
Single-target + aim-confirm + attach a DoT instead of the AoE loop:
```js
castUltimate(targetId) {
  const s = this.state, cfg = this.config;
  if (s.status !== 'playing') return false;
  const ready = this._readyUltimateTowers();
  if (ready.length === 0) return false;
  const target = enemies.aliveEnemies(s).find(e => e.id === targetId);
  if (!target) return false;                       // aim-confirm: no valid target -> no cast
  ready.sort((a, b) => (a.ultReadyAt || 0) - (b.ultReadyAt || 0));
  const tower = ready[0];
  const ult = cfg.towers[tower.typeId].ultimate;
  tower.ultReadyAt = s.clock + ult.cooldownMs;
  tower.ultActiveUntil = s.clock + ult.fxTtlMs;
  // attach a single-target DoT (processed by enemySystem); pierces shields, neutral.
  target.beam = {
    dmgPerTick: ult.dotDmgPerTick, ticksLeft: ult.dotTicks,
    tickMs: ult.dotTickMs, nextAt: s.clock + ult.dotTickMs,
    ignoreShield: ult.piercesShield, towerId: tower.id,
  };
  s.effects.push({ kind: 'ultimate', x: tower.x, y: tower.y, tx: target.x, ty: target.y, age: 0, ttl: ult.fxTtlMs });
  s.bus.emit(EV.ULTIMATE_CAST, { towerId: tower.id, targetId: target.id });
  s.frameEvents.push({ type: EV.ULTIMATE_CAST, towerId: tower.id, targetId: target.id });
  return true;
}
```
(`EV.ULTIMATE_CAST` payload gains `targetId`; drop `damage` — update `events.js:39` comment.)

### 3d. `v2/sim/systems/enemySystem.js` — DoT tick (mirror the `regen` lever)
In `applyBehavior`/`updateBehavior` (the per-enemy tick, alongside `case 'regen'` `:118-120`),
process an attached `e.beam` each frame:
```js
// single-target boss-beam DoT (set by Simulation.castUltimate)
if (e.beam) {
  while (e.beam.ticksLeft > 0 && state.clock >= e.beam.nextAt) {
    damageEnemy(state, e, e.beam.dmgPerTick, { ignoreShield: e.beam.ignoreShield, sourceType: null });
    e.beam.ticksLeft -= 1; e.beam.nextAt += e.beam.tickMs;
    if (!e.alive) { e.beam = null; break; }
  }
  if (e.beam && e.beam.ticksLeft <= 0) e.beam = null;
}
```
DoT does NOT transfer on parent death (single-target; shards spawn fresh). Add `beam: null` to
the `spawnEnemy` enemy struct (`:89` area) for shape-stability.

### 3e. `tools/balance/policies.mjs` — `maybeUltimate` now TARGETS (`:235-237`)
```js
if (bot.ultimateReady()) {
  const alive = bot.aliveEnemies();
  const parent = alive.find(e => e.typeId === 'boss_split');
  // focus the parent (kill it EARLY); once split, beam the most-advanced shard.
  const shards = alive.filter(e => e.typeId === 'boss_splitling');
  const target = parent || (shards.length ? shards.reduce((a, b) => (b.progress > a.progress ? b : a)) : null);
  if (target) bot.castUltimate(target.id);
}
```

### 3f. `tools/balance/harness.mjs` (`:185`)
`castUltimate(target) { return this.sim.castUltimate(target); }` (pass the id through;
`ultimateReady()` unchanged).

### 3g. `tools/balance/measure-secret-boss.mjs`
- Scenario C `runToTerminal` already counts `ultCasts` (`:135`). Add a **cast-budget gate**:
  assert `1 <= ultCasts <= 5` per WITH run (proves "not 5+ spam"; tightens to the ~2-3 design
  intent as tuned). Keep the WIN-with / LOSE-without separation gate (`:185-196`) and the
  ≥5× / ≥3× wall gates unchanged (they re-confirm the parent HP is untouched).

### 3h. V2/V3 interface (not owned here, but this gate consumes them)
- **V2** owns the beam DoT mechanic itself (3c/3d). V7 supplies the tuned numbers + gate.
- **V3** owns the aim-confirm UI: `InputController` action `'ultimate'` (`v2/input/InputController.js:73`)
  enters an **aim mode** (no blind cast), a subsequent enemy tap resolves `targetId` and calls
  `sim.castUltimate(targetId)`; the `'u'` key (`:86`) likewise. `abilityHud` slot
  (`v2/render/abilityHud.js:49-72`) + cooldown ring (`Renderer.js:1057-1059`) reused.

---

## 4. Failing-first tests

| # | File | Kind | Assertion (fails on current AoE code) |
|---|------|------|---------------------------------------|
| T1 | `tools/tests/boss-tower.test.mjs` | unit | **REPLACES** "damages ALL alive enemies" (`:208`): a cast with a `targetId` damages **only** the target; other alive enemies are untouched (single-target). |
| T2 | `tools/tests/boss-tower.test.mjs` | unit | aim-confirm: `castUltimate()` / `castUltimate(<dead-or-missing id>)` returns `false` and consumes no cooldown; `castUltimate(<alive id>)` returns `true`. |
| T3 | `tools/tests/boss-tower.test.mjs` | unit | not-instant / DoT: a single cast on a full-HP **parent** (`boss_split` at 580k) leaves it **alive**; HP drops by ~`dotDmgPerTick*dotTicks` over `dotTicks*dotTickMs`, not in one frame. Pierces a shielded shard. |
| T4 | `tools/tests/boss-tower.test.mjs` | unit | config: `ultimate` has `dotDmgPerTick/dotTicks/dotTickMs`, `requireTarget:true`, `cooldownMs >= 12000`, `piercesShield:true`; **no** `damage` field. (Replaces `u.damage` assert `:75`.) |
| T5 | `tools/tests/secret-wave.test.mjs` | sim | WITH-ultimate WINS summit, `lives>0`, both maps × seeds (`:141`) — now via the targeting policy. |
| T6 | `tools/tests/secret-wave.test.mjs` | sim | WITHOUT loses (the wall stands) — unchanged (`:118`); re-confirms shard nerf didn't leak a win to the no-beam kit. |
| T7 | `tools/tests/summit.test.mjs` | sim | summit WIN via `optimal({ultimate:true})` (`:133`) still terminal-wins. |
| T8 | `tools/tests/boss-tower.test.mjs` | balance | `summitConqueror` casts ≥1 ultimate AND its cast count is bounded (`<= 5`) — proves the long-cooldown budget (`:274-296`). |
| T9 | measure-secret-boss Scenario C | balance | per WITH run `1 <= ultCasts <= 5` (new gate) + WIN/LOSE separation + ≥5×/≥3× wall margins all PASS. |

Order: write T1-T4 against current code (RED: AoE hits all, no target arg, instant flat damage)
→ land 3a-3d → GREEN. Then T5-T9 drive the tuning loop (3a/3b numbers) until separation +
budget pass on both maps.

---

## 5. Balance impact

- **No-ultimate wall:** UNCHANGED. Parent on-field HP stays 580,115; the standard kit chips
  ~30k → ≥5× margin (18.8×) and ≥3× fork-only (19.7×) preserved. Shard HP/shield changes never
  enter the no-beam scenarios (parent never dies there).
- **WITH-beam win:** re-derived. 2-3 casts (320k each) crack the parent early; shards (9k, ~22%
  shield) fall to towers + freeze + one leftover beam. Expected win with lives 6-10 (slightly
  tighter than today's 8-9 — that's the intended difficulty bump).
- **Faceroll prevention:** single-target + aim-confirm + 12s cooldown means the beam cannot
  clear a public swarm (1 enemy/cast) nor one-shot the parent (320k < 580k). Casts/crossing drop
  from 5 → ~2-3.
- **Tuning risk:** if the parent dies too LATE (shards spawn near goal), towers can't clear 3
  shards → loss. Levers in priority order: (1) raise `dotDmgPerTick` / add a 3rd cast window via
  lower `cooldownMs` to kill the parent earlier; (2) lower `childHp`; (3) lower shard shield
  uptime. measure-secret-boss Scenario C is the tuning oracle (the B6-analog single rebalance).

---

## 6. Captures (manual, post-implement; V3 art/UI dependent)
- `npm run bench` p95 (must stay < V1 ~80ms; DoT is one per-enemy field + a tiny tick loop — no
  per-frame cost beyond the existing regen-style tick).
- A summit playthrough screenshot: beam aimed at the parent (early kill) + towers mopping the 3
  shards (`v2/captures/`).
- `node tools/balance/measure-secret-boss.mjs` console output showing Scenario C separation +
  bounded `ultCasts`.

---

## 7. Dependencies & parallel-safety
- **Depends on V2** (beam DoT mechanic: 3c/3d in `Simulation.castUltimate` + `enemySystem`) and
  **V3** (aim-confirm UI in `InputController`/`abilityHud`/`Renderer`; new sprite). V7 supplies
  the tuned numbers, the targeting policy, and the gate ON TOP of those mechanics.
- **NOT parallel-safe** with V2 or V3: all three touch `Simulation.castUltimate`
  (`Simulation.js:288`) and the boss `ultimate` config block; V3 also touches `InputController`.
  Sequence **V2 → V3 → V7** (V7 last: it tunes/gates what V2+V3 built).
- **Parallel-safe** with any item NOT touching: `gameConfig.js towers.boss` / `enemies.boss_*`,
  `Simulation.castUltimate`, `enemySystem` DoT, `policies.maybeUltimate`,
  `measure-secret-boss.mjs`, or the boss-tower/secret-wave/summit tests.
