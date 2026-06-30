# V2 Area Analysis — Win/Lose, Balance Curve & the Secret Split Boss

> Scope: how V2 decides win/lose, the shape of the 15-wave difficulty curve and
> how it is tuned/proven, and the hidden wave-16 split boss. What genuine
> strategic decisions this area gives the player today (honestly), and the gaps —
> both vs the grownup playthrough feedback and vs the genre.

Ground-truth files read: `v2/sim/Simulation.js`, `v2/sim/systems/waveSystem.js`,
`v2/sim/systems/enemySystem.js`, `v2/config/gameConfig.js`, `tools/balance/*`,
`tools/tests/{balance-ladder,playthrough,secret-wave}.test.mjs`,
`v2/docs/BALANCE.md`, `v2/docs/SECRET-WAVE.md`.

---

## 1. What exists today (mechanics, with citations)

### Win/lose decision — central, tiny, deterministic
- `Simulation._checkWinLose()` runs every tick (`Simulation.js:87-99`). Exactly two
  outcomes:
  - **Lose**: `s.lives <= 0` → `status = 'lost'`, emit `GAME_LOST`.
  - **Win**: `waves.isFinalWaveComplete(s)` → `status = 'won'`, emit `GAME_WON`.
- `isFinalWaveComplete` = wave phase `complete` **and** `wave.index >= patternCount`,
  where `patternCount` counts **all 16 patterns including the secret one**
  (`waveSystem.js:181-183`, `patternCount` at `:12`). So "win" only fires after the
  wave-16 split boss is cleared.
- The single loss path is the lives ledger in `enemySystem.reachGoal()`
  (`enemySystem.js:123-132`): `state.lives -= e.livesCost`, applied exactly once when
  an enemy flips `reachedGoal` false→true. There is one and only one fail state
  (lives), and one and only one win state (clear the final pattern).

### The 15-wave balance curve
- **Geometric, uniform scaling** per wave (`gameConfig.js:55-59`, applied in
  `waveSystem.computeScaling` `:21-32`): `hp ×1.12`, `speed ×1.03`, `count ×1.20`,
  `reward ×1.08`, `intervalReduction ×0.95`, `bossMult ×1.5`, `capWave 15`,
  `coinReduction ×0.95`.
- **15 hand-authored patterns + 1 secret** (`gameConfig.js:61-85`). Bosses at
  5/10/15 (`boss_shield`/`boss_speed`/`boss_regenerate`); the rest are mixes of
  `basic`/`fast`/`strong`. Scaling is applied identically to every type; bosses get
  the extra `×1.5` HP/reward via `bossMult`. Boss count is **not** scaled
  (`waveSystem.js:43-44` — `isBossType ? group.count : round(count×countMult)`).
- **Formations** (`single/line/wedge/phalanx/swarm`) resolve to a single number —
  a spawn-gap multiplier `FORMATION_FACTOR` (`waveSystem.js:10`,
  `{single:1.0, line:0.5, wedge:0.5, phalanx:0.4, swarm:0.25}`). They change *how
  tightly bunched* a group spawns in time, nothing spatial.
- **Phase machine** (`waveSystem.js`): `idle → prepare(countdown) → spawning →
  active → complete → (next | win)`. Between waves `betweenWaveMs 3000`,
  prep `8000`. End-of-wave bonus = `floor(earnings × 0.25)` credited to the wallet
  (`waveSystem.js:155-167`).

### How the curve is *proven* (the real engineering investment here)
- A **four-bot difficulty ladder** drives the real command API headlessly
  (`tools/balance/policies.mjs`, `harness.mjs`): `unfocused` (loses ~W3), `spread`
  (L1-only, loses mid-run), `saveUpgrade` (few towers + banking, loses W14-15),
  `optimal` (barely clears 15). Asserted across seeds `{1,2,3,7}` × both maps with a
  **machine-checked monotone separation** `unfocused < spread < save < optimal`
  (`balance-ladder.test.mjs:93-110`).
- Tuning was deliberate and documented (`BALANCE.md §4`): the headline fix was
  collapsing tower range from 5/6/7 → **2/2.5/3** so coverage is *local* and full
  defense needs many towers; `lives.max 25 → 12`; `count 1.15 → 1.20`; boss HP
  ≈1.85×, boss speed ≈1.5×; AoE radius `2.0 → 1.0`.

### The secret wave-16 split boss
- Appended as `patterns[15]` with `secret: true` (`gameConfig.js:77-84`).
  `publicWaveCount` filters secret patterns so the HUD reads `…/15` until the
  surprise makes it `16/15` (`waveSystem.js:16-19`).
- `boss_split` (`gameConfig.js:108`): base `hp 20000` → **on-field ≈146,613** after
  `1.12^14 × 1.5 ≈ 7.33×`; `speed 1.35`; `livesCost 99` (instant game-ender vs a
  12-life pool); `behavior: split → boss_splitling ×3`, `childHp 40000`.
- Intentionally **unbeatable**: HP is set to **~7.2× the maximum damage any current
  build was measured to land** while it crosses the map (`measure-secret-boss.mjs`;
  peak ≈20,366 with the Optimal bot on Ribbon). The split fail-safe means even a
  force-kill (`childHp 40000`, 3 shards, shielded) still walks shards to the goal and
  ends the run (`enemySystem.killEnemy:164-173`; verified `secret-wave.test.mjs`).

---

## 2. Genuine strategic depth this area offers today (honest)

**There is real, rigorous depth in the *balance tuning* — but almost none of it is
a decision the player consciously makes or sees.**

- **What is genuinely deep (in bot-space):** the upgrade-vs-spread-vs-cover tradeoff
  is real and machine-proven. Short range (2-3 tiles) means full path coverage
  takes many towers, so "cover the path, *then* upgrade chokepoints" strictly
  beats both "spread L1s forever" and "few towers, bank-and-upgrade." That is a
  legitimate strategic gradient and the ladder enforces it on both maps, every
  seed. This is the strongest part of the area.
- **What the player actually experiences:** a single difficulty axis (it gets
  harder), three boss spikes (5/10/15), and a coin balance that is tight until the
  path is covered and then goes slack. The decisions the tuning rewards
  (coverage breadth, chokepoint upgrades, repositioning) are **never surfaced** —
  there is no coverage indicator, no "this tower is redundant" hint, no DPS/efficiency
  readout. So the depth exists in the *math* but is illegible at the *table*
  (directly feedback #5 "did upgrades even help?").
- **Replay value is near-zero by construction.** `restart()` bumps the seed
  (`Simulation.js:36`), and `BALANCE.md §6` advertises "a new seed yields a
  genuinely different game." But the **only** RNG-driven gameplay is 1% crits
  (`projectileSystem.js:78`) and ±50 ms fire jitter (`towerSystem.js:125`); path,
  waves, enemy stats, and formations are all fixed. So two seeds differ by a
  rounding-noise amount — strategically identical runs. Replaying teaches the same
  lesson the same way.

Net: as a *system to tune*, this area is excellent. As a *source of player
decisions*, it currently offers one implicit, invisible decision (coverage→upgrade)
and one cosmetic axis (which of two near-identical towers), repeated 15 times.

---

## 3. Gaps vs the grownup feedback

### G1 — The game cannot be won. (HIGH) — feedback #2
The win branch in `_checkWinLose` (`Simulation.js:94-98`) is **unreachable in normal
play**: the final pattern is the unbeatable split boss, so `status === 'won'` never
fires. Every shipped test asserts the strong/optimal player ends `lost@W16`
(`balance-ladder.test.mjs:85-87`, `playthrough.test.mjs:61`, `secret-wave.test.mjs:105`).
The win overlay exists in the renderer (`Renderer.js:69,656`) but is dead code for a
real game. For ages 5-10, mastering all 15 waves and being **guaranteed a loss with
no victory screen, ever** is an anti-payoff. The grownup wanted to "replay and beat
the boss" (#2) — today there is no boss anywhere that can be beaten, and no win to
chase. The secret-boss "hook" is conceptually clever but currently amputates the
single most important reward in the genre.

### G2 — Boss lethality is opaque and curve-disproportionate. (HIGH) — feedback #3
Bosses cost `3/4/5` lives (`gameConfig.js:97-99`) against a **12-life pool** — a
single boss leak is 25-42% of the run, and the split boss is `99` (one-shot). Nothing
in the sim communicates `livesCost`; it is a hidden per-entity number subtracted
silently (`enemySystem.js:127`). "Why does the boss take so many lives?" (#3) is a
direct symptom of (a) large hidden `livesCost`, and (b) boss *behaviors*
(shield/speed/regen) that make the boss leak in the first place being equally hidden.
The difficulty here is delivered as opaque numbers, not legible mechanics.

### G3 — Every wave is the same challenge scaled up. (HIGH) — feedback #10
Scaling is one geometric formula applied uniformly to all types (`waveSystem.js:21-32`).
"Formations" are a single spawn-gap multiplier (`waveSystem.js:10`), not spatial or
qualitative — a "wedge" and a "phalanx" differ only by how bunched the spawns are.
There is no wave that *requires* a different answer: no armored/shielded swarm that
begs for AoE, no fast single-file rush that begs for single-target, no affix
("this wave is shieldy"). Bosses at 5/10/15 are the only qualitative variation in 15
waves. This is the textbook "same enemies, just more" curve.

### G4 — Money goes slack once the path is covered. (MEDIUM) — feedback #4, #5
`BALANCE.md §5` honestly admits a "structural ceiling": with 3 finite upgrade tiers
and finite tiles, a covered build runs out of things to buy and **accumulates surplus
coins in the last 1-2 waves**, worst on the easy map. Kills auto-credit the wallet
(`enemySystem.js:158-162`; note `economySystem.js:55-57` — manual coin collection has
already been removed despite the brief's description), reward scales `×1.08` plus a
25% wave-end bonus, while the only sinks are 2 towers × 3 levels. So late-game the
player is told nothing changes whether they spend or not (#4 "why so much money", #5
"did upgrades help?"). The balance is tightest ~W1-13 and solved thereafter.

### G5 — No run-to-run variety to replay into. (MEDIUM) — feedback #2 (replay)
Per G2 above: fixed path + fixed wave patterns + deterministic stats + negligible RNG
means a replay is the same run. There is no seed-driven layout shuffle, no draftable
modifier, no escalating difficulty tier on replay. The "replay to beat it" impulse
(#2) has nothing fresh to replay into even if a win existed.

### G6 — No partial-win / milestone payoff structure. (MEDIUM) — feedback #2
The only positive feedback in the whole win/lose loop is the per-wave "Wave N
Complete! +Nc bonus" banner (`waveSystem.js:164`). There is no star rating, no
"first boss down!" celebration, no per-map clear record, no checkpoint. Beating the
wave-5 boss — the exact moment the grownup found motivating (#2) — produces no
distinct reward beyond the generic wave-complete line.

---

## 4. Gaps vs the genre (independent of the feedback)

- **GG1 — Single difficulty axis, no rhythm.** The genre uses curve *shape*:
  breather waves, escalating-within-a-round composition (Defense Grid runs ~15 enemy
  types up inside one round), telegraphed spike waves. V2's curve is monotonic ramp
  + 3 boss spikes. (MEDIUM)
- **GG2 — Bosses are stat blocks, not legible exams.** Genre-standard bosses
  *explain themselves*: a visible shield bar to strip, a clear "regenerating!" tell,
  phases. V2 has the behaviors (`shield/speed/regen/split`) but as hidden timers
  (`enemySystem.updateBehavior:52-75`), so the boss is "big HP that eats lives," not
  a puzzle with a counter. (HIGH — overlaps G2)
- **GG3 — No difficulty selection / scaling for skill.** No easy/normal/hard, no
  endless/NG+ after a clear. The two maps have an *intrinsic, un-tunable* hardness
  gap (Ribbon win 8 lives, Comb 4-5; `BALANCE.md §5`) that is surfaced to no one and
  cannot be chosen. (LOW)
- **GG4 — Win is binary and terminal.** No score, no leaderboard-style metric, no
  meta-progression to carry a near-win into. A run either ends in silent loss or
  (notionally) a single win flag. The genre almost always layers a *measured*
  outcome (lives remaining → stars, score, time). (MEDIUM)

---

## 5. Notable code-level findings

- **`status === 'won'` is currently unreachable** in real play (final pattern is the
  unbeatable boss). The win path, its event, and its renderer overlay are all dead
  until "boss tower upgrades" ship. Any future "make it winnable" work must change
  `isFinalWaveComplete`/`patternCount` semantics or the boss tuning — they are
  coupled (`waveSystem.js:181-183`, `gameConfig.js:108`).
- **Boss count is exempt from `countMult`** (`waveSystem.js:43-44`) — correct, but it
  means boss-wave difficulty rides entirely on `bossMult` HP/speed, the lever
  `BALANCE.md §7` recommends for *map-symmetric* tightening. Good to know before
  touching it.
- **The split boss's unbeatability is empirically anchored**, not a magic number
  (`measure-secret-boss.mjs` → 7.2× the measured peak damage). If towers ever get
  stronger (a real win path, boss upgrades, a 3rd tower), this margin must be
  re-measured or the secret boss silently becomes beatable/cheesable.
- **Manual coin collection is already gone** in code (`economySystem.js:55-57`) — the
  brief's "must MANUALLY tap to collect" is stale. This matters for balance: income
  is now frictionless, which feeds G4 (too much money late).

---

## 6. Lowest-risk, highest-leverage directions (for the depth pass)

These respect static-host / no-build / pure-sim / kid-minimal / perf constraints and
target the area's own gaps:

1. **Make the game winnable with a real payoff** (G1, G6): either give the wave-15
   `boss_regenerate` clear a proper win + celebration and demote the split boss to an
   *optional/endless* surprise, or ship the "boss tower upgrade" that makes wave-16
   beatable. Pair the win with a **stars-from-lives** rating (uses the existing
   `lives` ledger, zero new sim state) — turning the already-tuned "barely win" margin
   into the score.
2. **Make boss lethality legible** (G2, GG2): surface `livesCost` and the active
   behavior as a readable tell (data already in `enemy.bs` / `behavior`). This is a
   render/HUD change over existing sim fields — no balance retune needed.
3. **Give a few waves a qualitative identity** (G3, GG1): a per-pattern `affix`/tag
   plus enemy property flags so a wave can *demand* AoE vs single-target. This is
   pure data in `gameConfig.js` + a small `waveSystem` branch, and it finally makes
   the basic-vs-strong choice (and the proven coverage→upgrade depth) *legible*.
4. **Add a single coin sink or income decision** (G4): re-tune late income or add one
   spend option so surplus is never dead — keeps the "always a little short" tension
   the ladder already achieves through ~W13 into the endgame.

Any of these must be re-run through the committed ladder
(`balance-ladder.test.mjs`) and, if the boss/towers change, re-measured with
`measure-secret-boss.mjs` per the `BALANCE.md §7` procedure.
