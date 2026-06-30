# Depth Pass — Area Analysis: Enemies, Waves, Formations & Bosses

Scope: what the enemy / wave / formation / boss layer actually does in CuteDefense V2
today, what genuine strategic decisions it puts in front of the player (honestly,
where it is thin), and where it falls short — against the grownup playthrough feedback
(esp. **#10** "every wave is the same enemies just more", **#3** "why does the boss take
so many lives?", **#2** "losing to the first boss made me want to replay and beat it")
and against tower-defense genre norms.

Primary sources read:
- `v2/sim/systems/enemySystem.js` (spawn, movement, boss behaviors, death/split, lives ledger)
- `v2/sim/systems/waveSystem.js` (phase machine, spawn-queue build, formation factor, scaling, end-of-wave bonus)
- `v2/config/gameConfig.js` (`enemies`, `waves`, `combat`)
- `v2/sim/systems/towerSystem.js` (`acquireTarget` — the one place enemy *type* influences play)
- `v2/sim/Simulation.js` (win/lose decision, secret wave consequence)
- `v2/config/maps/map1.js`, `map2.js` (path geometry the waves run through)
- `v2/docs/BALANCE.md`, `v2/docs/SECRET-WAVE.md` (the deliberate boss/secret tuning + its own admitted gaps)

---

## 0. Ground-truth corrections (important)

Two things in the project brief are not what the code actually does:

1. **"Formations exist: single/line/wedge/swarm/phalanx."** They exist *as config keys
   only*. A "formation" in this codebase is **purely a spawn-interval multiplier**, not a
   spatial arrangement. `FORMATION_FACTOR = { single: 1.0, line: 0.5, wedge: 0.5,
   phalanx: 0.4, swarm: 0.25 }` (`waveSystem.js:10`) only shrinks the time *gap* between
   consecutive spawns within a group (`buildSpawnQueue`, `waveSystem.js:45-47`). Every
   enemy still spawns at the single start cell `path[0]` (`enemySystem.js:18,32`) and
   travels the identical single-file path. So a "wedge" is not wedge-shaped — it is just
   enemies released closer together in time. **`wedge` is a dead alias of `line`**
   (both `0.5`). There are really only four density levels (1.0 / 0.5 / 0.4 / 0.25), and
   the names imply 2D tactics the engine never produces.

2. **Enemies "DROP coins that the player must MANUALLY tap to collect."** Not in the live
   path — `killEnemy` auto-credits the reward straight to the wallet
   (`enemySystem.js:158-162`, `creditCoins`). (Covered fully in the economy area doc; noted
   here only because it changes what a "kill" gives the player: instant money, no on-board
   object.)

These matter for a depth pass: any plan that wants *spatial* formations or *manual*
kill rewards is **adding** a mechanic, not tuning an existing one.

---

## 1. Current mechanics (what actually runs)

### Enemy roster (`gameConfig.js:90-113`)
Three regular types, distinguished **only by stat block + shape** (no abilities):

| type | shape | speed | hp | size | reward | livesCost |
|------|-------|------|-----|------|--------|-----------|
| basic | circle | 1.1 | 100 | 0.8 | 3 | 1 |
| fast | diamond | 2.0 | 50 | 0.7 | 5 | 1 |
| strong | square | 0.7 | 200 | 1.0 | 8 | 1 |

Bosses (waves 5/10/15) add one behavior each (`gameConfig.js:97-99`):

| boss | wave | hp | speed | livesCost | behavior |
|------|------|-----|------|-----------|----------|
| boss_shield | 5 | 925 | 1.2 | **3** | periodic invuln window (`shield`, 3s on / 8s cd) |
| boss_speed | 10 | 555 | 2.7 | **4** | periodic 2× speed burst (`speed`, 4s on / 10s cd) |
| boss_regenerate | 15 | 1110 | 0.9 | **5** | constant +2 hp/s (`regen`) |

Plus the **secret wave-16** `boss_split` (star) and its `boss_splitling` shards
(`gameConfig.js:108-112`) — see §5.

### Boss behavior implementation (`enemySystem.js:52-80, 135-142`)
- **shield** — while `bs.shieldActive`, `damageEnemy` returns `false` and the hit is
  discarded (`enemySystem.js:137-141`). There is **no player action that strips it**; you
  simply waste shots during the window.
- **speed** — `effectiveSpeed` multiplies base speed during the burst
  (`enemySystem.js:77-80`); less time-on-target → a fraction leaks.
- **regen** — accumulates hp every tick (`enemySystem.js:70-73`); punishes low/trickle DPS.
- Cooldowns are staggered off the game clock at spawn so the ability triggers mid-path
  (`enemySystem.js:43-45`).

Every behavior reduces to the **same answer for the player: bring more total DPS / coverage
before the boss arrives.** None has a distinct, legible counter.

### Movement & lives ledger (`enemySystem.js:82-132`)
Exact per-segment lerp between path-cell centers; on reaching the end, `reachGoal`
subtracts the fixed `livesCost` **exactly once** (`enemySystem.js:127`) and flashes the HUD
(`livesFlashAmount`, display-only). Towers cannot be touched — risk is one-directional.

### Wave phase machine (`waveSystem.js:87-179`)
`idle → prepare(countdown) → spawning → active → complete → (next | win)`. Prep is 8s
(`gameConfig.js:50,54`); a `BOSS WAVE` / `Next in: N` banner is the only pre-wave intel.

### Spawn queue construction (`buildSpawnQueue`, `waveSystem.js:34-58`)
- A wave is a list of **groups**, each `{ type, count, formation }` (`gameConfig.js:61-85`).
- Groups are expanded **fully and sequentially** into one queue — all of group 1's type,
  then all of group 2's, etc. (`waveSystem.js:41-56`). There is **no interleaving of
  types**: a "mixed" wave is actually a *sequence of mono-type bursts* (e.g. all basics →
  all fasts → all strongs). Incidental mixing only happens because faster enemies released
  later overtake slower earlier ones on the shared path.
- `formation` sets the within-group gap; `count` is multiplied by `countMult` (bosses
  exempt, `waveSystem.js:43-44`).

### Scaling (`computeScaling`, `waveSystem.js:21-32`; values `gameConfig.js:55-59`)
Per wave: `hp ×1.12`, `speed ×1.03`, `count ×1.20`, `reward ×1.08`, spawn interval ×0.95,
all capped at wave 15; boss waves get `×1.5` hp/reward. The entire late-game difference
between wave 6 and wave 14 is **"more enemies, tankier enemies, arriving faster"** — same
three types throughout.

### The 15 (+1 secret) patterns (`gameConfig.js:61-85`)
- W1–2: basic-led intros (+ a couple fast).
- W3–4: introduce `strong`.
- W5 / W10 / W15: a **lone boss**, no escort (`{ boss, enemies: [{ boss, count: 1 }] }`).
- W6–14: escalating re-mixes of the *same three types* in different ratios/formations.
- W16 (secret): the unbeatable split boss.

So the full enemy *vocabulary* is introduced by wave 3 and never grows; bosses are the only
new mechanic after that, and they appear three times.

### The one place enemy type touches play (`towerSystem.acquireTarget`, `towerSystem.js:89-105`)
Targeting score = `dist·0.3 + low-health·0.4 + typeScore·0.3`, with `typeScore`
`fast 0.8 / strong 0.6 / basic 0.4` (`gameConfig.js:150-151`). This biases which enemy a
tower *shoots first* — it does **not** change damage dealt, and it is **fully automatic**
(the player has no targeting control; scout cat. #2 is absent). It is the only enemy-type
interaction in the game, and the player never makes it.

---

## 2. What genuine strategic decisions this area offers

Honest read: **this layer offers the player almost no decisions of its own. Its real job is
to be the difficulty *pressure* that the placement/economy game responds to.**

**The closest thing to an enemy-driven decision — latent and never made legible:**
- **AoE (strong tower) vs single-target (basic tower) against bunching.** Swarm/phalanx
  formations release enemies tightly (factor 0.25/0.4), so they sit closer on the path,
  where the strong tower's 1.0-tile AoE can hit two or three at once; single/line waves
  reward the basic tower's faster single-target fire. This is a *real* relationship in the
  numbers — but it is weak (AoE radius is only 1.0 tile, `gameConfig.js:134`; "formations"
  are 1D timing not 2D clusters) and **never surfaced to the player** (feedback #9, #10).
  A child cannot infer "this wave is bunched, so I want the square tower."
- **"Do I have enough DPS/coverage before the boss?"** A boss is a preparation *check*
  decided minutes earlier, not an in-the-moment decision. There is no counter to choose,
  no ability to time — just "did I build enough."

**Non-decisions (the bulk of the layer):**
- **No counter choice.** No damage types, no armor, no affinities — no enemy that *needs* a
  particular tower (and no player-set targeting). The two towers are interchangeable except
  for the weak, hidden AoE-vs-single edge above.
- **No in-wave adaptation.** Waves arrive as fixed mono-type bursts with no telegraph of
  composition; the player cannot scout and pre-position for "a fast wave" vs "a tank wave."
- **No boss-mechanic interaction.** Shield can't be stripped, regen can't be burst-broken
  legibly, speed can't be slowed (no slow/freeze tower exists). Every boss is a DPS race.

So as a self-contained system, "enemies/waves/bosses" currently gives the player **one
latent, invisible lever (AoE vs single vs bunching)** and otherwise functions as the timer
and the tax that the *economy/placement* game plays against — which is where the proven
depth actually lives (`BALANCE.md`).

---

## 3. Gaps vs the grownup feedback

### Feedback #10 — "Are all waves the same enemies just more?" (HIGH)
Structurally accurate, by construction:
- **The enemy vocabulary never grows.** All three regular types exist by wave 3; nothing new
  is introduced for the rest of the run except the three bosses (`gameConfig.js:61-85`). No
  flyer, no healer, no shielded mob, no splitter among regular enemies.
- **"Variety" is count + ratio + spawn-density.** Scaling is literally `count ×1.20,
  hp ×1.12, speed ×1.03` (`gameConfig.js:56`) — "more, tankier, faster," not "different."
- **Formations don't deliver the variety their names promise.** They are a 1D timing knob
  with `wedge` a dead alias of `line` (`waveSystem.js:10`); no wave ever poses a *spatial*
  puzzle.
- **Mono-type bursts reduce even the mixing that exists.** Groups spawn sequentially
  (`waveSystem.js:41-56`), so a "mixed" wave is experienced as phases, not a simultaneous
  combined-arms threat that would demand a layered answer.
- Net: there is no wave that *requires a different strategy/layout/tower* than the wave
  before it. That is precisely the symptom.

### Feedback #3 — "Why does the boss take so many lives?" (HIGH)
- **The cost is real and invisible.** A single boss reaching the goal costs **3 / 4 / 5**
  lives out of 12 (`gameConfig.js:97-99`, applied at `enemySystem.js:127`). `BALANCE.md` §4
  states this is *deliberate*: bosses were retuned to ~1.85× hp and 1.5× speed specifically
  to "bleed a few lives even off a completed build." So leaking to a boss is by design — but
  **the game never tells the player a boss is worth 3–5 lives**, only flashes the number
  after the hit (`livesFlashAmount`, display-only). The loss reads as arbitrary.
- **No legible cause.** Because the boss behaviors (shield/speed/regen) have no tell + no
  counter (§1), the player can't form the mental model "it survived because it was shielded
  / regenerating / sped past." It just "ate my lives." The *why* is unanswerable in-game.
- **Lone-boss waves make it a pure sponge.** Boss waves are a single enemy with no escort
  (`gameConfig.js:66,71,76`) — nothing else to manage, so the whole wave collapses to "did
  my DPS out-race its HP before it reached the goal," and any shortfall converts directly to
  a chunky, unexplained life loss.

### Feedback #2 — "Losing to the first boss made me want to replay and beat it." (MEDIUM — positive but incomplete)
- **The hook fires organically** — the wave-5 shield boss is the first real wall, and
  wanting a rematch is exactly right. But the layer doesn't *support the learning loop*:
- **There is nothing new to learn on the rematch.** With no counter to the shield (you can't
  strip it; there's no anti-shield tower) the only lesson is "build more / cover more before
  wave 5" — replay-as-grind, not replay-as-insight. A good boss "explains itself" so the
  rematch feels solvable in a *smarter* way (scout cat. #10); this one only asks for *more*.
- **The ultimate payoff is gone.** The secret wave-16 split boss makes the game **unwinnable
  by design** (`SECRET-WAVE.md`: win only fires after W16, which "currently cannot happen";
  `Simulation.js:94`). So "beat it" tops out at *surviving* the three public bosses — the
  satisfaction of actually winning the run does not exist yet. The replay drive is real but
  has no summit to reach.

---

## 4. Gaps vs the genre (tower-defense norms)

- **No damage-type / armor / affinity triangle (scout cat. #1).** Towers have no type
  effectiveness; `typeScore` (`gameConfig.js:151`) only biases target *selection*, not
  damage, and is automatic. The genre's core "which tower?" decision is absent — which is
  why the two towers feel interchangeable (feedback #9).
- **No enemy abilities/roles among regular enemies (scout cat. #4).** Regular enemies are
  pure stat blocks. The genre's engine for "every wave a new puzzle" — flyers (anti-air),
  healers, shield-bearers, splitters, burrowers, speed-bursters — exists here only on three
  bosses, three times. This is the direct genre-level cause of feedback #10.
- **Formations are nominal.** Real TD formations are spatial; here they are a spawn-cadence
  factor with a dead alias (`waveSystem.js:10`). No lane/column/spread tactic is ever posed.
- **Boss mechanics lack tell + counter (scout cat. #10).** Shield/speed/regen are flavor on
  a stat block, not solvable mechanics. No anti-shield, no slow (cat. #13 control role is
  absent), no burst-window counter to regen. Bosses are DPS races, so they teach nothing on
  loss (feeds feedback #3 and blunts #2).
- **No combined-arms / interleaved spawns.** Sequential mono-type groups (`waveSystem.js:41-56`)
  mean the player never has to *simultaneously* answer fast + tank, which is the standard
  source of mid-wave tension.
- **No wave affixes / telegraphed modifiers (scout cat. #5)** and **no pre-wave intel.** The
  only signal is `BOSS WAVE` / `Next in: N` (`waveSystem.js:81,106`). A kid-legible named
  challenge ("this wave is SHIELDY!") or a scouting peek at composition would convert waves
  into distinct, plannable puzzles — currently impossible.
- **Boss waves are isolated single targets.** Genre bosses usually arrive *with* a wave to
  split attention; the lone-boss design here maximizes the "unexplained life sponge" effect.
- **Difficulty is one global curve.** `computeScaling` applies the same multipliers to every
  type on every map (`waveSystem.js:21-32`); there is no per-wave bespoke threat, so the
  curve is monotone "harder," not "different."

---

## 5. Note on the secret split boss (replay/hook design)

`boss_split` is carefully engineered to be **unbeatable** with current towers — on-field HP
≈146,613 vs a measured peak player damage of ~20,366 (~7.2× margin, `SECRET-WAVE.md`), with
a `livesCost: 99` one-shot and a 3-shard `boss_splitling` fail-safe if it is ever killed
(`enemySystem.js:164-173`, `gameConfig.js:108-112`). It is well-built as a *future* hook for
the planned boss-tower-upgrade feature. The depth-pass-relevant consequence is the one in
§3 (#2): **it removes the win state**, so the layer currently offers no victory payoff, and
`boss_split` / `boss_splitling` are defined but unused by the 15 shipped waves.

---

## 6. Summary

The enemy/wave/boss layer is, today, primarily a **difficulty *timer and tax*** for the
economy/placement game rather than a source of player decisions in its own right. It offers
the player essentially **one latent, never-surfaced lever** (AoE-vs-single-target against
bunched spawns) and otherwise asks only "did you build enough before this arrived."

The three named feedback symptoms are all structurally real:
- **#10 (waves all the same)** is true by construction — a three-type vocabulary fixed by
  wave 3, "variety" delivered as count/hp/speed scaling and a misleadingly-named 1D
  formation knob, with mono-type sequential spawns; no wave ever demands a different answer.
- **#3 (boss eats lives)** is a *deliberate* lives-tax (3/4/5 of 12, `BALANCE.md` §4) made
  **opaque**: the cost is never previewed and the boss behaviors have no tell or counter, so
  the loss is unexplainable.
- **#2 (replay to beat the boss)** is a genuine organic hook that the layer fails to support:
  nothing new to learn on the rematch (no counter, only "build more"), and the secret wave
  16 removes the win state, so there is no summit to actually reach.

The highest-leverage fixes all point the same way the scout's picks do: give **regular
enemies one readable gimmick each** with a **legible 2-tower counter** (turning waves into
distinct puzzles → #10, #9), make **boss cost + mechanics telegraphed and counterable**
(→ #3, #2), and consider **real (interleaved/spatial) wave composition** so "more" becomes
"different."
</content>
</invoke>
