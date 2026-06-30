# Secret Wave 16 — the Split Boss

The mean orange **star** that has always sat at the centre of the start menu finally
appears in the game — but only as a *hidden* 16th wave, and only once the player has
survived all 15 known waves. It is intentionally **unbeatable** with today's towers:
defeating it is meant to require the future, out-of-scope **boss tower upgrades**.

## How it stays secret

- The split boss is appended to `waves.patterns` as a **16th entry flagged `secret: true`**.
- `publicWaveCount()` (the HUD `/N` denominator) counts only non-secret patterns, so the
  player sees `… / 15` throughout — and only when the surprise wave begins does the chip
  read **`16/15`**.
- Nothing reveals it beforehand: the enemy catalog, the menu, and the wave schedule all
  still show 15 waves. (The catalog deliberately still lists the star as "menu-only / never
  spawns" to preserve the surprise.)
- Because truncated test configs *replace* `waves.patterns` wholesale, the secret wave never
  leaks into unit-test scenarios — only full-game runs (the balance ladder, the playthrough)
  ever reach it.

## Win semantics change

Win now fires only after the **final** pattern (wave 16) is cleared. The boss cannot be
killed yet, so it walks to the goal and ends the run. **The game therefore has no winnable
state until boss tower upgrades ship** — that is the intended hook. The 15-wave balance curve
is unchanged; "optimal" still masters all 15 known waves (with only a few lives left), then
meets the wall at wave 16.

## The boss — and why it can't be beaten

`boss_split` (config `v2/config/gameConfig.js`):

| field | value | why |
|------|------|-----|
| `hp` (base) | **24000** | wave-16 scaling (`1.12^14 × 1.5 ≈ 7.33×`) makes the on-field HP **≈ 175,936** (raised from 20000 in P4: the fork-aware "alert player" lands more on the boss, so the unbeatable margin was restored to ≥5×) |
| `speed` | 1.35 | on-field ≈ 2.04 tiles/s after scaling — reaches the goal promptly |
| `size` | 1.4 | the biggest baddie |
| `livesCost` | **99** | a one-shot game-ender: reaching the goal instantly drains the 12-life pool |
| `behavior` | `split → boss_splitling ×3` | if ever killed, it splits into weaker **boss** shards |

### Value tweaks — measured, not guessed

`tools/balance/measure-secret-boss.mjs` drives strong-player games to wave 16 and records the
**maximum damage any current build lands on the boss** while it crosses the map:

| scenario | damage landed on the boss | boss killed? | reaches goal? |
|---------|--------------------------|--------------|---------------|
| OPTIMAL bot, Ribbon (map 0), 4 seeds | ~19,800 – **20,366** (peak) | no | yes |
| OPTIMAL bot, Comb (map 1), 4 seeds | ~7,700 – 8,066 | no | yes |
| Saturated 40×L3 towers, straight line | 5,940 | no | yes |

On-field HP **146,613** sits at **~7.2× the worst damage observed (20,366)** — comfortably
unbeatable, with margin for seed/strategy variance, without resorting to an arbitrary giant
number. (Raising HP does not change damage-taken; damage is bounded by time-on-map × DPS, so
the 7× margin holds regardless.)

## The split shards — the fail-safe

If a future build ever *does* kill the boss, it must not be cheesable, so it splits into
**3 weaker boss shards** (`boss_splitling`) that carry on to the goal:

| field | value | why |
|------|------|-----|
| `childType` | `boss_splitling` | **boss-type, never basic** (the requirement) |
| `childHp` | **40000** | survives the full path even if the parent is killed at the very start under an optimal build |
| `boss_splitling.speed` | 1.5 | brisk; children spawn unscaled and still finish the path |
| `boss_splitling.behavior` | `shield 1.8s / 2.6s` | immune in bursts → very hard to stop |
| `boss_splitling.livesCost` | 12 | a single shard reaching the goal also ends the run |
| `boss_splitling.size` | 0.85 | a smaller "shard" of the star — visibly weaker than the parent |

Child-survival was measured by force-killing the boss the instant it appears (near the start,
worst case) on both maps under an optimal build:

| `childHp` | Ribbon (map 0) | Comb (map 1) |
|----------|----------------|--------------|
| 2,000 | killed (0/3 reach goal) | killed (0/3) |
| 12,000 | killed (0/3) | survive (3/3) |
| 30,000 | survive (3/3) | survive (3/3) |
| **40,000** | **survive (3/3, ≥20k HP to spare across seeds)** | **survive (3/3)** |

## Verification

- `tools/tests/secret-wave.test.mjs` — hidden-count math (`16/15`), shards are weaker bosses
  (not basics), a strong player reaches wave 16 and **cannot kill the boss** (it reaches the
  goal → loss), and the **split fail-safe** (force-killed boss → shards still reach the goal).
- `tools/tests/balance-ladder.test.mjs` (#4/#5) and `tools/tests/playthrough.test.mjs` updated
  to the new contract: optimal masters all 15 known waves, then the secret boss ends the run.
- Captures: `v2/captures/secret-wave/01-secret-reveal-16of15.png`,
  `02-boss-on-board-16of15.png`.
- `npm test` → 40/40 pass. `npm run bench` → V2 beats V1 (gate PASS).

## P3 re-measure (freeze-aware)

With the freeze ability shipped and `POLICIES.optimal` made freeze-aware, the
secret boss was re-measured via `tools/balance/measure-secret-boss.mjs`: peak
damage landed ≈ **14.9k** against an on-field HP of ≈ **146.6k** → **margin ≈ 9.9x
(≥5x required)**. Freeze increases the damage the optimal bot lands (the boss is
slowed inside the kill-zone) but, dealing no damage itself, never kills it. The
boss stays UNBEATABLE on the P3 build (`secret-wave.test.mjs` + `freeze-balance.test.mjs`
both green); P5 owns the summit win path.

## Final summit-tuning spike — why the summit stays ASPIRATIONAL (fallback honored)

The final pass attempted to make the wave-16 summit **genuinely beatable through skill**,
honoring the intended win path: kill the parent → it splits into 3 shards → **FREEZE pins the
shards in the AoE kill-zone** → Bomber/AoE bursts them, with *leaking a shard = loss*. The
acceptance bar was a clean **separation**, driven through the public command API on **both maps
× both seeds**:

- **(A)** freeze+fork+affinity-executing optimal bot **WINS** the summit, AND
- **(B)** the same optimal bot with **freeze disabled LOSES** (shards leak), AND
- **(C)** fork-only / naive builds also lose.

### What was tried (genuine effort)

The spike lowered `boss_split.hp` into a band where the executed build *does* kill the parent
(triggering the split), then swept the shard levers to make the **shard phase** the real skill
test — exactly the brief's key insight (the old measurement only looked at parent-crossing
damage, where freeze barely helps, so the designed shard fight never happened). Levers swept:

- `boss_split.hp` (2.5k–8k base) and `boss_split.speed` (0.4–1.35) — to control *when/where*
  the parent dies and how much runway the shards get.
- `boss_splitling.hp` (1.5k–8k), `.speed` (1.5–8), `behavior.count` (3–6), `.livesCost`, and
  removing the shard **shield** (it blocks the burst the design depends on).
- A new **`spreadCells` stagger** for the split spawn so the shards trickle out *strung along
  the path* instead of stacked on one point — the literal "pin them in the AoE zone" mechanic
  (un-pinned they zip through one-at-a-time so a bomb catches at most one; frozen they dwell &
  overlap so one burst chunks all of them).
- A genuinely **skilled freeze policy**: HOLD the precious freeze through the lone-parent phase
  (don't waste it on a single crosser), RESERVE it across the summit climb so the 32 s cooldown
  is recharged the instant the parent splits, then **pin** the shards. This change passed the
  public ladder (optimal still banks the wave-15 win on both maps/seeds).

### Why it cannot cleanly separate — the structural wall

The two shipped maps have a **structural coverage disparity** that no single wave-16 config can
straddle:

- **Map 0 "Ribbon"** (serpentine rows; towers in the gap rows double-cover two path passes) has
  so much firepower that it **kills the shards with *or* without freeze** — freeze is never
  *necessary*. Across the full sweep, whenever the freeze bot (A) won on Ribbon, the no-freeze
  bot (B) won too (both clear up to ~6k shard HP; both fail at ~8k). So **(B) cannot be made to
  lose on Ribbon without also breaking (A) on Comb.**
- **Map 1 "Comb"** (narrow 1-wide teeth; thin per-tower coverage) can only kill **low-HP
  (~≤3k) shards even when perfectly pinned**. Above that, even the freeze pin leaks.

The separation needs a shard-HP band where `Ribbon-unpinned FAILS` **and** `Comb-pinned
SUCCEEDS` simultaneously — i.e. `childHp > ~7000` **and** `childHp < ~3000`. That window is
**empty**: `Ribbon-unpinned capacity (~7k) > Comb-pinned capacity (~3k)`. The freeze's dwell
advantage (~5.5×) materially helps on Comb (lifts it from loss to win at low HP) but is
**irrelevant on Ribbon** (the shards die from raw volume before the pin matters). No config of
parent/shard hp·speed·count·spread·shield, plus the smarter freeze bot, closes that gap.

### Decision: FALLBACK (per the brief's sanctioned path)

Because freeze-wins cannot be cleanly separated from no-freeze-wins across both maps after
genuine effort, the boss is left **exactly as-is** (the unbeatable wall) and the **public win
ships standalone at wave 15**. All spike changes were reverted:

- `v2/sim/systems/enemySystem.js` — split spawn restored to the stacked spawn (no `spreadCells`).
- `tools/balance/policies.mjs` — `maybeFreeze` restored to the shipped P3/P4 logic.
- `v2/config/gameConfig.js`, `tools/balance/measure-secret-boss.mjs`, `secret-wave.test.mjs`,
  `summit.test.mjs` — **untouched** (the wall, the ≥5× unbeatable margin, and the force-kill
  shard fail-safe all remain the contract).

The summit remains the documented **aspirational hook** for the future boss-tower-upgrade
feature (and/or a third, coverage-balanced map). `npm test` → **106/106**; `npm run bench` →
V2 p95 ≈ 19 ms < V1 ≈ 75 ms (gate PASS); `measure-secret-boss.mjs` → margin **5.4×** (wall
intact).

---

## V2.1 — THE REVERSAL: the summit is now WINNABLE (boss-tower ultimate)

The aspirational hook above is now **shipped as a skill-gated win** (V2.1 batches W8 +
W9 + W11, landed in the single post-merge rebalance). The structural wall the previous
spike hit — the coverage-driven freeze-pin's win band was *empty* across the two maps —
is overturned by a **map-agnostic** weapon: the W8 boss-tower **ultimate** ("Boss Blast"),
a flat, full-map, **shield-piercing** nuke whose damage does NOT flow through tower
coverage, so it lands identically on Ribbon and Comb.

### The new contract (separation, both maps × seeds [1,7])

- **WITH the boss-tower ultimate** — `POLICIES.optimal({ ultimate: true })` builds + upgrades
  the boss tower in the endgame and times the nuke at the secret boss / its shards. It
  **WINS the summit with lives to spare**: a new **`SUMMIT_WON`** terminal fires (status
  `won`, `state.summitWon === true`), the boss never reaches the goal, and the public win
  stays banked. Measured: **lives 8–9**, ~5 casts.
- **WITHOUT the ultimate** — `POLICIES.optimal()` (the standard kit) still **LOSES**: it
  lands only ~30k of the ~580k on-field wall — the boss reaches the goal, the summit ends
  in a loss, and the public win stays banked. The wall still stands for anyone without the
  new weapon (no buy-the-win).

### The two terminals (the win fires exactly once)

`Simulation._checkWinLose` banks the public win at wave 15 via **`GAME_WON`** (fires
**exactly once**, never un-banked). A *cleared* secret wave 16 fires a SEPARATE
**`SUMMIT_WON`** terminal (`waveSystem.isSummitComplete`, `state.summitWon`) — it never
re-emits `GAME_WON`, so the public-win-once contract is preserved.

### W9 late-curve coupling (why the wall got meaner)

W9's `waves.scaling.lateSurge` ({ fromWave: 9, hp: 1.22, count: 1.02, speed: 1.04 }) bends
the late NON-boss curve UP (those waves were a formality) AND surges the **secret wave-16
boss only** (PUBLIC bosses 5/10/15 are excluded in `computeScaling`, so the public
nail-biters + the optimal life budget are unchanged). The surge raises the wall from ~176k
to **~580k** on-field HP — the wall the ultimate must overturn. `reward` is deliberately not
surged (no income re-flood / overbuild loop), which keeps the no-ultimate damage low and the
wall margin high.

### Final gates (V2.1 rebalance)

- `npm test` → **165/165** pass (balance-ladder #4 optimal still WINS all 15 public waves
  with L15 ∈ [8,9]; #8 boss-wave life-drain ≥ 4; the secret-wave wall/win re-flip; summit
  `GAME_WON` once + `SUMMIT_WON` once; new `balance-curve` late-tail tests).
- `npm run bench` → V2 p95 ≈ **22 ms** < V1 ≈ **76 ms** (gate PASS; boss tower in fixture).
- `tools/balance/measure-secret-boss.mjs` → no-ultimate wall margin **≈ 18.8×** (freeze+fork)
  / **≈ 19.7×** (fork-only) — both ≥ their guards — AND Scenario C separates on every
  map × seed (WITH = win-with-lives, WITHOUT = loss).

### Tuned levers (all named gameConfig keys — no magic numbers)

`towers.boss.ultimate` { damage **180000**, cooldownMs **5000**, initialReadyFraction 0.5,
piercesShield true }; `enemies.boss_split.behavior.childHp` **22000** (shards;
boss_splitling nominal hp aligned); `waves.scaling.lateSurge` as above;
`enemies.boss_split.hp` **24000** (UNCHANGED — the base wall); `freeze.minSpeedFraction`
0.15 (UNCHANGED). Policy: `policies.maybeUltimate` behind the `optimal({ ultimate })` flag
(default OFF → the public ladder is byte-for-byte unchanged); `summitConqueror =
optimal({ ultimate: true })`.

---

## V2.2 — THE COMBAT KEYSTONE: AoE nuke → AIMED SINGLE-TARGET BEAM

V2.2 reverses the **win MECHANISM** while keeping the game winnable and not a faceroll.
The old "Boss Blast" full-map nuke (one button clears parent + all 3 shards) is **deleted**
and replaced by an **aimed, single-target, shield-piercing DoT BEAM** ("Boss Beam"). The
summit win is **re-derived** for the beam and proved with a **two-sided gate**.

### What changed (the mechanism)

- **Single-target aimed beam (DoT).** `Simulation.castUltimate(target)` now **REQUIRES** a
  live enemy target (aim-confirm: no target → no fire, no cooldown spent, no event). It
  pushes a beam onto `state.beams`; the new `v2/sim/systems/beamSystem.js` applies
  `totalDamage * tickMs / durationMs` per tick over `durationMs`, capped at `totalDamage`.
  **Never instant-kills:** `beam.totalDamage` (340000) **< the ~580k on-field parent**, and
  no single tick removes > ~6% — it takes **~2 casts** to crack the parent.
- **Aim-confirm UI.** `armUltimate()` arms a crosshair; an enemy tap fires (`gridClick`),
  an empty tap cancels. If an enemy is already selected, the HUD button fires straight at
  it. Renderer draws the streaming beam + a contrasting crosshair. `'u'` arms the crosshair.
- **Rename** "Boss Blast" → **"Boss Beam"** everywhere (config name, HUD label `Beam!`/`PEW!`,
  `ULTIMATE_CAST` payload `{towerId,targetId}`).
- **Boss basic buffed:** projectile `size 14 → 28` (~2×), `fireRateMs` 5000/4500 →
  **4000/3600** (faster, still ≥ 3000), `damage` 30/45 → **90/130** (heavy plink that
  supports clearing the 3 shards).

### The re-derived win (early parent kill → towers mop the shards)

~2 aimed casts crack the ~580k parent **EARLY** (its shards then spawn mid-path and must
traverse the kill-zone), and the buffed boss basic + freeze + a leftover beam cast clear
the 3 (now weaker) shards before any leaks. Shards: `childHp` **22000 → 6000**, shield
uptime cut (`durationMs 1800 → 700`, `cooldownMs 2600 → 4300`, ~14%) — these are
**boss-only levers** that never enter the no-beam scenarios (the parent never dies there),
so the wall margin is untouched.

### Economy (V3): the boss is a deliberate late-game investment

Boss cost **L1 250 → 750, L2 300 → 500** (total **550 → 1250, ~2.3×**). **No reward surge
was needed** — the RESERVING `summitConqueror` hoards from wave 7 and reaches 1250 by
accumulation (the old ~857 "peak" was an artifact of the cheap 550 cost forcing an early
resume-to-spend). This keeps `waves.scaling.lateSurge` reward-free, so balance-curve W9 (the
rising late curve, `reward` un-surged) and the no-overbuild loop are preserved.

### The two-sided gate (BOTH hold)

1. **STILL WINNABLE.** secret-wave WITH-beam **wins, lives > 0**; WITHOUT **loses**; on
   maps[0,1] × seeds[1,7]. `measure-secret-boss` Scenario C separates on every map × seed —
   **lives 8–9, 4 casts** (in the 1–5 budget). `economy.test` proves the 1250 boss is funded.
2. **NOT A FACEROLL.** single-target (one enemy/cast — useless on a swarm); aim-confirm (no
   blind spam); DoT, not instant (340k < 580k — no one-shot); LONG cooldown **7000** (~2–3
   casts/crossing, not 5). The no-ultimate wall is **UNCHANGED** (parent 580,115; kit chips
   ~30k → **18.8×** freeze+fork / **19.7×** fork-only).

### Final gates (V2.2)

- `npm test` → **190/190** pass (public win@15 banked, `GAME_WON` once; `SUMMIT_WON` once;
  balance-ladder #4 optimal still WINS waves 1–15 with L15 ∈ [4,10]; the beam re-flip of
  boss-tower/secret-wave/summit; the new `offense-beam` suite; the fail-safe parity flip).
- `npm run bench` → V2 p95 ≈ **24.5 ms** < V1 ≈ **75 ms** (gate PASS; boss tower **and a
  scripted beam + crosshair** in the fixture, so the new render/DoT paths are measured).
- `measure-secret-boss.mjs` → wall **18.8× / 19.7×** (both ≥ guards) AND Scenario C separates
  with bounded casts on every map × seed.

### Tuned levers (V2.2 — all named gameConfig keys)

`towers.boss.ultimate` { name **'Boss Beam'**, cooldownMs **7000**, initialReadyFraction 0.5,
piercesShield true, requireTarget true, beam { totalDamage **340000**, durationMs **2500**,
tickMs **250**, widthPx 12, color } } (the flat `damage` field is **removed**);
`towers.boss.projectile.size` **28**; `towers.boss.levels` cost **750/500**, fireRateMs
**4000/3600**, damage **90/130**; `enemies.boss_split.behavior.childHp` **6000**;
`enemies.boss_splitling` { hp **6000**, behavior.shield durationMs **700** / cooldownMs
**4300** }. `enemies.boss_split.hp` **24000** + `waves.scaling.lateSurge` + the public ladder:
**UNCHANGED**. Policy: `policies.maybeUltimate` now AIMS (parent first, else the
most-advanced shard) via `castUltimate(target.id)`.
