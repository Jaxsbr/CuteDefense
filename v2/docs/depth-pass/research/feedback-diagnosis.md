# CuteDefense V2 — Grownup Playthrough Feedback Diagnosis

**Role:** Feedback Diagnostician. For each of the 11 verbatim symptoms from the grownup
playthrough, this names the underlying V2 *game-mechanic* root cause (grounded in the code),
gives 1–3 concrete fix directions, marks **depth** vs **polish/UX**, and rates severity.

All citations are `file:line` against the ground-truth codebase at
`/Users/jacobusbrink/Jaxs/projects/CuteDefense`.

> **Important ground-truth correction up front:** the project brief still says "killed enemies
> DROP coins that the player must MANUALLY tap to collect." **That mechanic has been removed in
> code.** Kills now credit the wallet directly (`v2/sim/systems/enemySystem.js:162` →
> `creditCoins`; `v2/sim/systems/economySystem.js:16-19, 55-57`; `v2/input/InputController.js:46-47`).
> `spawnCoin`/the coin list survive only to feed the locked benchmark fixture. This removal is a
> primary driver of feedback #4 (see below).

---

## Summary table

| # | Symptom (verbatim) | Root mechanic | Depth? | Severity |
|---|--------------------|---------------|--------|----------|
| 1 | Fun to place towers initially | Placement loop is tactile but novelty is fully front-loaded | Depth | low |
| 2 | Losing to wave-5 boss made me want to replay | Intentional retuned boss spike — the *good* depth, working | Depth | low |
| 3 | Why does the boss take so many lives? | `livesCost` 3/4/5 + shield invuln, never surfaced | Polish/UX | medium |
| 4 | Why do I have so much money? | Auto-credit kills + 25% wave bonus + reward scaling, no friction/sink | Depth | medium |
| 5 | Did upgrades actually help? | Upgrade effect invisible; no DPS/Δ feedback | Depth | medium |
| 6 | Can't keep up placing/upgrading — too many clicks | Multi-tap actions × balance-demanded continuous investment | Polish/UX | high |
| 7 | Can't even see the enemies — too busy | No placement pause; UI panel over board; APM steals attention | Polish/UX | medium |
| 8 | Big towers overlap their neighbours | `r = tile * sizeScale`; L3 sprite (115px) > tile (96px) | Polish/UX | medium |
| 9 | Only 2 towers — does it matter which? | 2-type roster; basic vs strong distinction never communicated | Depth | high |
| 10 | Every wave is the same enemies, just more | Waves = 3 archetypes scaled by count/hp/speed; formation ≈ spawn cadence only | Depth | high |
| 11 | No risk to me — towers can't be destroyed | Towers have no HP / no enemy→tower interaction; safe tiles all equivalent | Depth | high |

---

## 1. "Fun to place towers initially." (positive — but decays)

**Root mechanic.** The placement loop is genuinely tactile: tap a buildable tile →
`Simulation.gridClick` opens a `placement` (`v2/sim/Simulation.js:124-143`); the renderer shows a
live ghost tower, a dashed range circle, and a cute sticker panel (`v2/render/Renderer.js:309-336`);
confirming fires `TOWER_PLACE` with a grow-in pop (`v2/sim/systems/towerSystem.js:33-50`). That
feedback density is *why* the opening is fun.

The problem is the fun is **entirely front-loaded**: once the board is covered, every subsequent
action is the same tap with no new decision (BALANCE.md §1 calls this exact decay out:
"plant ~8 towers and coast"). Nothing new is introduced after the opening — see #9/#10/#11.

**Fix directions**
- Treat this loop as the proven hook and *extend* it: new tower behaviours, targeting toggles, or
  per-tower choices that keep placement meaningful past the opening (depends on #9 roster work).
- Add a mid-game decision beat (a one-time choice/unlock) so the "first placement" novelty recurs.

**Depth-related.** Sustaining engagement requires content/system depth.

---

## 2. "Losing to the first boss (wave 5) made me want to replay and beat it." (positive)

**Root mechanic.** Wave 5 is `boss_shield` (`gameConfig.js:66, 97`): ~1.85× HP retune
(hp 925), `livesCost: 3`, and a `shield` behaviour that makes it *immune* during 3s windows
(`enemySystem.js:56-62, 137-142`). The retune (BALANCE.md) deliberately makes a boss "bleed a few
lives even off a completed build." This is the **good kind of depth** — a legible-enough skill
wall that creates a "so close, retry" pull. It is working as designed and should be the template.

**Fix directions**
- Replicate this intentional spike *cadence* across more waves, not just 5/10/15 — each spike
  asking for a different answer (ties into #10).
- Make the boss's mechanic readable on the retry (telegraph the shield window) so the replay is
  *informed* improvement, not trial-and-error (ties into #3).

**Depth-related.** Difficulty/pacing design.

---

## 3. "Why does the boss take so many lives?"

**Root mechanic.** Two coupled, *unexplained* mechanics:
1. Bosses carry a large fixed `livesCost` — 3/4/5 for shield/speed/regen
   (`gameConfig.js:97-99`) vs 1 for every normal enemy. It is subtracted exactly once when the
   boss reaches the goal (`enemySystem.js:123-132`).
2. The shield boss is *invulnerable* during shield windows (`enemySystem.js:137-142`,
   `damageEnemy` returns false), so it survives more of the path and is more likely to leak.

Nothing in the HUD or enemy render surfaces `livesCost` or the shield state's gameplay meaning, so
the player experiences a sudden multi-life drop with no causal story. This is a **legibility** gap,
not a balance bug — the cost is intended (BALANCE.md), it's just invisible.

**Fix directions**
- Surface per-enemy `livesCost` (e.g. a small heart-count badge on bosses; the lives HUD already
  flashes the amount via `state.livesFlashAmount`, `enemySystem.js:128-129` — extend that to name it).
- Telegraph the shield: a clear "invulnerable now" visual so the player understands *why* damage
  isn't landing (a `shieldedHitMs` feedback timer already exists, `enemySystem.js:138` — make it loud).

**Polish/UX** (communication of an existing mechanic).

---

## 4. "Why do I have so much money?"

**Root mechanic.** Income is now almost entirely passive and frictionless:
- 60 starting coins (`gameConfig.js:34`).
- **Every kill auto-credits** the full reward straight to the wallet — the manual-tap collection
  step that used to gate income was removed (`enemySystem.js:158-162`, `economySystem.js:16-19, 55-57`).
- A **+25% end-of-wave bonus** on everything earned that wave (`waveSystem.js:155-167`).
- Reward scales `×1.08`/wave (`gameConfig.js:56`), softened only by `coinReduction 0.95`
  (`waveSystem.js:29`).

The balance retune (BALANCE.md §1) tuned the economy so the *Optimal bot* "is always a little
short." But a human who can't spend fast enough (see #6) banks the surplus, and there is no
late-game **sink** once towers approach L3 (`upgradeTower` caps at level 3,
`towerSystem.js:60`) — so coins pile up and the core place/upgrade decision loses tension.

**Fix directions**
- Re-introduce *some* income friction or a meaningful sink (the removed manual-collect was one such
  sink; alternatives: a coin cap, a banked-coin decay, or a "spend or lose" pressure).
- Re-balance so a *casual* player (not just the Optimal bot) trends slightly-short; the ladder
  currently only proves the optimal line stays tight, not the median human.
- Add late-game spend targets (beyond L3) so surplus always has a home (couples with #5/#9).

**Depth-related.** Economy pacing and sink design.

---

## 5. "Did I just spend all that money on tower upgrades — did it actually help?"

**Root mechanic.** Upgrades change real numbers (basic damage 8→12→18, range 2→2.5→3;
strong 20→35→55 + bomb, `gameConfig.js:124-140`) via `upgradeTower`
(`towerSystem.js:58-69`), but the **only feedback** is a size grow-in pop (`placeAnimMs = 220`) and a
bigger sprite. The range circle is drawn **only while the tower is selected**
(`Renderer.js:240-244`); there are no floating damage numbers, no before/after, no DPS readout.
The selection card shows `Damage X Range Y` (`Renderer.js:588`) but never the *delta*. BALANCE.md §1
notes upgrading was historically a *bad* DPS/coin deal (~0.10 vs ~0.88 spreading) — so the player's
doubt that "it helped" has historically been *correct*, and the UI gives them no way to judge.

**Fix directions**
- Show the upgrade's impact: a before→after stat delta in the upgrade popup, and floating
  damage/crit numbers in-world so bigger hits are *felt*.
- Make the always-on range/coverage of a tower glanceable (not selection-gated) so a level bump
  visibly grows reach.
- Confirm via the ladder that upgrade-vs-spread is a *live* tradeoff at the human skill level, then
  communicate it (couples with #4/#9).

**Depth-related.** Whether upgrades are a meaningful choice (balance) *and* legible.

---

## 6. "I can't keep up placing and upgrading towers — too much for me to click."

**Root mechanic.** This is the central tension and it is structural:
- **Each action costs multiple taps.** Placing a tower = tap tile (opens placement,
  `Simulation.gridClick:124-143`) → tap **Place** (`placementPlace:145-152`), plus a **Cycle** tap to
  switch type (`placementCycle:153-160`). Upgrading = tap tower to select → tap **Upgrade**
  (`upgradeSelected:163-167`). So 2–3 deliberate taps per meaningful action.
- **Balance demands those actions continuously.** BALANCE.md §1: the retune intends "you are always
  a little short, placing/upgrading nearly every round through ~wave 13." Spawn cadence tightens
  each wave (`intervalReduction 0.95`, `gameConfig.js:57`; `spawnInterval`, `waveSystem.js:30`).

So required interactions-per-minute climb while the per-interaction tap cost stays high. For the
target audience (ages 5–10) — and evidently a grownup — that exceeds comfortable throughput. The
depth pass *created* this load (continuous investment is its lever); the UI never paid it down.

**Fix directions**
- Cut taps per action: one-tap placement (last-used tower as default + drag-to-place), and an
  upgrade affordance directly on the selected tower (the upgrade button exists, but selection is a
  separate tap).
- Quick-build hotbar / drag-from-dock so type choice isn't a Cycle loop.
- Let the depth pass *budget* interaction load explicitly: if a wave demands N actions, the UI must
  make N actions cheap, or the balance must lower N.

**Polish/UX** (interaction design) — but tightly coupled to the depth pass's pacing lever.

---

## 7. "I can't even see the enemies — too busy placing towers."

**Root mechanic.** A consequence of #6 plus two specifics:
- **No pause/slow during placement.** The sim keeps ticking while the placement popup is open
  (`Simulation.tick` runs every system whenever `status === 'playing'`, `Simulation.js:65-79`); there
  is no build-phase freeze. Enemies advance while the player is heads-down in the panel.
- **The placement panel sits over the board** (`Renderer._placement:309-353`), and the dock/HUD live
  in the left gutter (`gridOffsetX = hudWidth`, `gameConfig.js:25`). The player's eyes are on chrome,
  not the field, exactly when combat happens.

Net: the *payoff* of the game (watching your towers shred a wave) is invisible because attention and
clicks are spent on the input layer.

**Fix directions**
- Pause or slow-mo while a placement popup is open (build phase = think time), so placing never
  competes with watching.
- Reduce the UI's board footprint during combat; let combat be the visual hero.
- Inherit the #6 click reductions so less *time* is spent in menus.

**Polish/UX** (attention design); root shared with #6.

---

## 8. "Everything is getting squished — big towers overlap the ones next to them."

**Root mechanic.** Tower sprite radius scales past the tile. In `SpriteCache.tower`
(`v2/render/SpriteCache.js:78`): `r = this.tile * st.sizeScale`. With `tile = 96`
(`gameConfig.js:23`) and L3 `sizeScale = 0.6` (`gameConfig.js:127, 139`), `r = 57.6px` →
**~115px diameter inside a 96px tile** — it overflows ~10px into each neighbour. Then the renderer
adds an idle breathe (×1.04, `Renderer.js:227`) and a fire puff of **+14% X / +24% Y**
(`anim.towerPuffX/Y`, `gameConfig.js:170-171`; applied `Renderer.js:235-236`), pushing it further.
Adjacent buildable tiles are 1 tile apart, so two upgraded towers visibly collide. ("Size grows per
level" is intended progression feedback — it just overshoots the tile.)

**Fix directions**
- Clamp max `sizeScale` so body diameter stays < 1 tile (≈ ≤ 0.46), or scale the *glow/aura* with
  level instead of the body.
- Reduce the fire-puff magnitude, or clip/anchor the puff so stretch never crosses the tile bound.
- Convey "level" with crowns/pips/colour rather than raw size (the level badge already exists,
  `SpriteCache.js:107`).

**Polish/UX** (visual sizing).

---

## 9. "Are there only 2 towers? What's the difference, does it matter which I use? It's not clear."

**Root mechanic.** The roster *is* exactly two: `towers.basic` (single-target) and `towers.strong`
(AoE) (`gameConfig.js:116-142`). Their distinction is real (basic: cheap/fast/long-ish range,
`kind:'single'`; strong: slow/expensive/`kind:'aoe'`, but the retune shrank its blast to **radius
1.0 tile**, `gameConfig.js:134`, and tightened ranges) — but **none of that is communicated
in-game**. The placement popup shows a ghost + a single range circle (`Renderer._placement:316-319`)
identically for both; nothing labels "single vs splash," "anti-swarm vs anti-tank," or shows the
AoE footprint. With the blast now small and ranges short, even watching them doesn't make the roles
obvious. So the player can't tell if the choice matters — and with only 2 options the *perception*
of variety is thin.

**Fix directions**
- Make the roles legible: show the AoE blast footprint in the placement preview, label each tower's
  job (e.g. "splash / crowds" vs "single / tanks"), and surface the stat contrast.
- Expand/specialise the roster so tower choice is a *strategy*, not a coin-flip (e.g. slow, chain,
  long-range sniper) — the most direct answer to "does it matter."
- Tie tower roles to enemy archetypes so #10's wave variety *demands* picking the right tower.

**Depth-related.** Roster breadth and differentiation are core depth.

---

## 10. "Are all waves the same enemies just more? Every wave should have a unique challenge needing different towers/layouts/strategy."

**Root mechanic.** Yes — 12 of 15 waves are the **same three archetypes** (basic/fast/strong)
recombined and scaled, not qualitatively varied. Patterns are lists of `{type, count, formation}`
(`gameConfig.js:61-76`), and `computeScaling` multiplies hp ×1.12, speed ×1.03, count ×1.20 per wave
(`gameConfig.js:55-57`, `waveSystem.js:21-32`). Crucially, **formation only changes spawn cadence**,
not spatial layout or required counter-play: `FORMATION_FACTOR` (`waveSystem.js:10`) is used solely to
scale the inter-spawn gap (`waveSystem.js:46-47`) — a "swarm" just spawns *closer together in time*
on the same single-file path. The only qualitative variety is the three boss mechanics at 5/10/15
(`gameConfig.js:97-99`). So the player correctly perceives "more of the same, faster."

**Fix directions**
- Give enemies *abilities that demand specific counters* (armoured → needs high single-hit; swarms →
  needs AoE; shielded/healing → needs sustained or burst), so each wave poses a different question
  (couples with #9 roster).
- Make formations actually *spatial/strategic* (clustering, lane behaviour) rather than just spawn
  timing, so layout choices matter per wave.
- Author per-wave gimmicks (a fast rush, an armour wave, a regen wave) on the existing
  hand-authored pattern list — cheap to add, high variety payoff.

**Depth-related.** Wave/enemy variety is the single biggest depth gap.

---

## 11. "There's no risk to me — I place towers safely out of the way; enemies can't destroy my towers."

**Root mechanic.** Towers are **invulnerable by construction**: the tower entity has no `hp`/health
field (`towerSystem.js:30-45`), and there is *no* enemy→tower interaction anywhere in the sim
(enemies only move along the path and subtract lives at the goal, `enemySystem.js:82-132`; confirmed:
no `damageTower`/tower-HP code exists). Placement is gated only by "buildable + unoccupied"
(`canPlace`, `towerSystem.js:18-23`); both maps have large open fields off the path
(`config/maps/map1.js`, `map2.js`). So every safe tile is equally safe — placement is a pure
*coverage-optimization* puzzle with **no risk axis and no spatial tradeoff**. The only failure
vector is leaks → lives (`enemySystem.js:123-132`), which the player experiences as abstract, not as
*their* towers being threatened.

**Fix directions** (must respect the charming, low-stress, kid-friendly constraint — destruction may
be too harsh):
- Introduce a *non-destructive* threat: enemies that briefly stun/silence a nearby tower, or that
  must be answered or they buff the wave — risk without losing the build.
- Add placement *tradeoffs* so "safe and optimal" diverge: scarce/limited build tiles, or
  bonus tiles near the path (high value, in harm's way), so where you build is a real decision.
- If destruction is ever wanted, make it gentle and recoverable (knocked-out, repairable) rather
  than permanent loss, to keep the tone.

**Depth-related.** A risk/threat-to-player-assets axis is entirely absent — a core depth lever.

---

## Depth vs Polish split (for the depth pass)

- **Depth pass owns:** #1 (sustain the hook), #2 (extend the spike template), #4 (economy
  pacing/sink), #5 (upgrade meaningfulness), #9 (roster breadth/legibility), #10 (wave/enemy
  variety), #11 (risk axis).
- **Polish/UX owns:** #3 (boss-cost & shield legibility), #6 (tap-cost reduction — *coupled* to the
  depth pass's investment-pacing lever), #7 (placement pause + attention), #8 (tower sprite sizing).

The two strongest, most repeated depth signals are **#9 (only 2 towers, unclear difference)** and
**#10 (waves are just "more")** — together they say *the game has breadth but no varied challenge*.
**#11 (no risk)** is the structural depth lever most absent today. **#6/#7** are the execution
failures that most degrade the moment-to-moment experience and should be paid down alongside any
depth work that raises required interactions.
