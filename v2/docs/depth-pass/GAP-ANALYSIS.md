# CuteDefense V2 — Depth-Pass GAP ANALYSIS

**Role:** SYNTHESIS-C (gap analysis). This cross-references **every grownup-feedback
symptom** and **every notable cross-genre gap** to (a) its root cause in the V2 code and
(b) the candidate mechanics from the surveyed genre that would close it — then ranks the
gaps **highest player-value first**, flagging kid-friendliness and winnability impact
(including the unbeaten secret split boss).

**Inputs synthesized:** `research/feedback-diagnosis.md`, `research/scout.md`, all of
`research/v2/*` (economy, enemies/waves/bosses, placement/HUD, risk/maps, towers/upgrades,
win-lose/balance), all of `research/deepdive/*` (auto-economy, time-control, enemy-abilities,
active-ability, readable-boss/kid-safe-risk), and `research/external/*` (Kingdom Rush,
Defense Grid, PvZ, Bloons TD6, Rogue Tower, Infinitode 2, GemCraft, Mindustry).

> **Ground-truth correction carried from the research (matters for Gap 6):** the project
> brief still says *"killed enemies DROP coins that the player must MANUALLY tap to collect
> (15s lifetime)."* **This is no longer true in the code.** Kills auto-credit the wallet
> (`enemySystem.js:160-162` → `creditCoins`; `economySystem.js:16-19, 55-57`), and the input
> layer has no coin-tap path (`InputController.js:46-47`). The on-board coin object +
> `economy.coin` config block are dead code kept only for the benchmark fixture. The single
> hardest move in the "auto-economy" category is therefore **already done**; the remaining
> economy work is *legibility + one decision*, not more automation.

---

## How the 11 symptoms + genre gaps consolidate

The 11 verbatim symptoms and the genre survey collapse into **8 root gaps**. Two are the
loud, universally-felt failures (overload, flatness); three are structural depth levers that
are entirely absent (risk axis, winnable payoff, varied challenge); three are
cheap-but-high-value legibility/polish fixes (boss cost, economy feedback, tower sizing).

| Root gap | Feedback symptoms | Genre gaps | Depth or Polish | Player value |
|---|---|---|---|---|
| **G1 Click/attention overload** | #6, #7, (#1) | no time-control, no build-tray, no pause-to-plan | Polish/UX (couples to depth pacing) | **Highest** |
| **G2 Combat flatness (towers + waves)** | #9, #10, #5, #3 | no affinity/counter, no enemy abilities, nominal formations | **Depth** | **Highest** |
| **G3 No risk / no agency for the player** | #11, (#2, #1) | no threat to player assets, no active ability/hero | **Depth** | High |
| **G4 Boss illegibility** | #3, (#2) | bosses are stat-blocks not telegraphed exams | Polish/UX (legibility) | High (cheap) |
| **G5 No win / no payoff / thin replay + split boss** | #2 | unreachable win, no stars/score, ~zero RNG variety | **Depth/Structure** | High |
| **G6 Money glut + invisible upgrade value** | #4, #5 | finite sink ladder, no income decision, no upgrade preview | Depth (economy) + UX | Medium |
| **G7 Tower sprite squish/overlap** | #8 | footprint grows past the tile | Polish/render | Medium (cheap) |
| **G8 Front-loaded novelty / hook decay** | #1 | nothing new introduced after the opening | Depth (emergent) | Medium |

**The two loudest signals** (scout's "two root causes") are **overload** (G1) and
**flatness** (G2). **G3/G5** are the structural depth levers most absent. **G4/G6/G7** are
disproportionately cheap legibility/render wins. The prioritised list below orders these by
player value, with sequencing/dependency notes at the end (some cheap fixes must ship early
even though they rank mid-list, and some depth adds are *gated* on others).

---

## The prioritised gap list (highest player-value first)

### GAP 1 — Click & attention overload (the time/interaction problem)
**Maps to:** feedback **#6** ("can't keep up placing/upgrading — too many clicks", HIGH),
**#7** ("can't even see the enemies — too busy", HIGH), assists **#1** (keeps the place-loop
fun). Genre gaps: no time control, no build tray, no pause-to-plan, split on-board/dock
locus, silent dead taps.

**Root cause in V2:**
- **No pause-to-plan, and pause is actively anti-plan.** The RAF loop steps the sim every
  frame while `status==='playing'` (`Simulation.js:65-79`); there is no fast-forward, slow-mo
  or auto-pause. Hitting Pause *blocks* world taps (`InputController.js:44` returns before
  `gridClick`) and draws a full-canvas scrim (`Renderer.js:649`) — "freeze and stare at a grey
  sheet," the literal opposite of pause-to-plan. So all placing/upgrading must happen during
  live motion, and the act of building steals the eyes from the payoff (watching the wave).
- **Each action is 2–3 taps and the locus is split.** Place = tap tile → tap Buy
  (`Simulation.js:137-152`), +1 Cycle tap to switch type (`:153-160`); upgrade = select → dock
  Upgrade (`Renderer.js:593`). Type choice is buried per-tile (no build tray to amortise it).
  Placement is on-board (right) but management is in the far-left dock — the common place→upgrade
  flow forces ~2000px hand/eye travel.
- **Balance demands continuous investment** ("always a little short, placing/upgrading nearly
  every round through ~wave 13", BALANCE.md §1) while per-action tap cost stays high — required
  actions-per-minute climb but the UI never pays the tap debt down. Unaffordable Buy/Upgrade
  register no hit-rect and emit no feedback (`Renderer.js:397, 624`) → dead taps read as "the
  game ignored me."

**Candidate mechanics (genre):** *Time control / pause-to-plan* (deepdive: time-control;
scout cat. #12, Pick 2) — **active/tactical pause that lets you place + inspect while frozen,
non-occluding overlay**; **auto-pause/slow while the build popup is open** (Pattern D);
**surface the prep window (`prepMs:8000`/`betweenWaveMs:3000`, already in config) as planning
time + a "GO!" call-wave-early button**; a single **2× toggle** (bench against p95 first; never
scale `dt` — vary ticks-per-frame). *Low-click play* (scout cat. #2 / Pattern G): **build tray**
(pick type once, tap cells), **last-type default** (already tracked, `Simulation.js:138`),
relax the 24px drag cutoff for paint-place; **2-state targeting toggle** ("front / strongest")
as opt-in depth that costs *zero* combat clicks. Separate the **build phase (between waves) from
the watch phase (during wave)** (KR §11, DG §5, Rogue Tower: all decisions at wave boundaries).

**Kid-friendliness:** *Strongly positive and mostly subtractive.* Removes the APM test that
broke a grownup, let alone a 6-year-old; "design for FOCUS and THINKING, not APM"
(Defender's Quest). Caveat: kids won't discover a manual pause hotkey — **bring the calm window
to them** (auto-pause on popup + a big GO! button), don't rely on Esc.

**Winnability:** Neutral-to-positive — lets the player actually execute a winning build instead
of fumbling it under time pressure; it is the *substrate* that makes every later depth add fair.

**Perf:** Pause/slow are **perf-positive** (fewer ticks). Fast-forward is the only caveat
(`MAX_STEPS_PER_FRAME=5`); cap at 2×, bench p95. **Depth or polish:** Polish/UX, but *tightly
coupled* to the depth pass's investment-pacing lever — if any later gap raises required actions,
this must absorb it.

---

### GAP 2 — Combat flatness: undifferentiated towers + same-y waves
**Maps to:** feedback **#9** ("only 2 towers, does it matter which?", HIGH), **#10** ("every
wave is the same enemies, just more", HIGH), assists **#5** (upgrade meaning) and **#3** (boss
legibility). Genre gaps: no damage-type/armor/affinity triangle, no enemy abilities/roles among
regular enemies, nominal formations, no combined-arms spawns, single global difficulty curve.

**Root cause in V2 — the single biggest depth gap:**
- **The roster is two near-substitutes with no communicated role.** basic (`single`) vs strong
  (`aoe`, radius 1.0) (`gameConfig.js:116-142`); at L1 both are **0.89 dps/coin** (basic
  4.44dps/5c, strong 13.3dps/15c) — strong dominates anything clumped, basic only wins on range
  + retarget. Nothing in-game labels "single vs splash" or shows the AoE footprint
  (`Renderer._placement:316-319` draws one identical range circle for both). Dead config
  compounds it: `strong.levels[].damage` (20/35/55) is never read — `bombDamage` is
  (`projectileSystem.js:13`).
- **The only place enemy type touches play is automatic and invisible.** `acquireTarget`'s
  `typeScore` (fast 0.8 / strong 0.6 / basic 0.4, `gameConfig.js:150-151`) biases which enemy a
  tower *shoots first* — it never changes damage and the player never controls it
  (`towerSystem.js:89-105`). There is **no counter/affinity rule**, so both towers damage
  everything equally and "which tower?" is a coin-flip.
- **Waves are the same 3 archetypes scaled.** All of basic/fast/strong exist by wave 3; nothing
  new arrives except 3 bosses (`gameConfig.js:61-85`). Scaling is `hp×1.12, speed×1.03,
  count×1.20` (`:55-57`) — "more, tankier, faster," never "different." **Formations are a 1D
  timing knob, not spatial** (`FORMATION_FACTOR`, `waveSystem.js:10`; `wedge` is a dead alias of
  `line`), and groups spawn as **sequential mono-type bursts** (`:41-56`) — a "mixed" wave is
  experienced as phases, never a simultaneous combined-arms threat. No wave ever *requires* a
  different answer than the one before.

**Candidate mechanics (genre — the highest-rated transfer in the corpus):** *Enemy abilities +
a simple readable counter/affinity, with a control role* (deepdive: enemy-abilities; scout
Pick 3; KR §1/§6, BTD6 §2, DG §3, Infinitode §6, PvZ §4). Specifically:
- **Soft 2-way affinity (multiplier, NOT hard immunity):** basic = precision/single-target →
  answer to fast/evasive (and to regen via burst); strong = splash/AoE → answer to swarm/clustered
  (and the boom that dents armor). ~2×/1×/0.5×, never 0× — with only 2 towers a hard immunity
  lets a mono-build leak a whole wave (too punishing for ages 5–10).
- **2–3 composable enemy property flags** (Pattern B), each with an unmistakable glyph (spikes =
  armored → boom tower; halo/shimmer = evasive → precise tower; green pulse = regen → focus it).
  Authored onto the existing hand-written wave list → combinatorial variety from a tiny vocabulary
  (the cheapest answer to #10), introduced **one at a time then recombined** (KR §9, PvZ §9).
- **The readability layer is a prerequisite, not a follow-up** (Pattern G): glyph on the body +
  a **pre-wave telegraph banner** so the wrong tool *fails visibly* and each wave reads as a
  distinct plannable question (also fixes #7's build-vs-watch split). Shipping affinity without
  the tell reproduces the exact current shield-boss failure.
- **Control role = third axis, but never a 3rd tower:** a slow/freeze delivered as a `strong`
  upgrade branch, an active "freeze" button, or an *enemy* that slows — the legible counter to the
  speed boss.

**Kid-friendliness:** Excellent **iff soft + ≤3 glyph-legible flags + telegraphed**. Adds
*cognitive/reading* load, **zero click load** (towers already auto-target) — the right trade for
an over-clicked game. Cognitive budget, not the engine, is the ceiling: onboard one flag at a
time. **Winnability:** Strongly positive — makes a loss *diagnostic* ("I had no boom tower for
the swarm"), converting #2's replay drive into *informed* improvement. **Depth or polish:** core
Depth. **Dependency:** ships *with* its readability layer; the peeling-coverage-exam boss (Gap 5)
is gated on this.

---

### GAP 3 — No risk / no agency for the player
**Maps to:** feedback **#11** ("no risk to me — I place safely; enemies can't destroy my
towers", HIGH), assists **#2** (a tool to beat the boss) and **#1** (a new recurring verb).
Genre gap: stakes never reach the player's own assets; no active ability/hero.

**Root cause in V2:**
- **Towers are invulnerable by construction.** No `hp` field on the tower entity
  (`towerSystem.js:30-45`); *no* enemy→tower interaction anywhere in the sim (enemies only move
  and subtract lives at the goal, `enemySystem.js:82-132`). Placement is gated only by
  "buildable + unoccupied" (`canPlace`, `:18-23`), and both maps are 60–78% buildable
  (risk-model doc §1.1), so **every safe tile is equally safe** — placement is pure
  coverage-optimization with no risk axis and no spatial tradeoff. "Place towers safely out of
  the way" is *literally optimal*.
- **No player agency during combat.** Targeting is automatic and uncontrollable; there is no
  active ability, no hero, no in-the-moment tool. The player is a spectator once towers are down,
  so a boss "eating lives" feels like something *happening to them*, not something they can answer.

**Candidate mechanics (genre — kid-safe forms only):** *Readable boss/enemy stakes & kid-safe
risk* (deepdive: readable-boss; scout Pick 5; DG §1, PvZ §5, KR §7, BTD6 Vortex, RimWorld EMP)
**+** *Active player ability* (deepdive: active-ability; scout Pick 4; KR §5, BTD6 §7, PvZ §3):
- **Temporary, recoverable tower "nap"/stun (best value-per-complexity):** an enemy briefly
  switches off the *nearest* tower (a `stunnedUntil` tick; skip firing; "zzz" overlay), which
  **auto-recovers**, with a brief post-recovery immunity (the anti-stun-lock governor). Adds
  positional risk + a target-priority decision ("kill the disabler first") with **zero new
  required clicks**. Never board-wide, short, telegraphed → "exciting hiccup," not "unfair
  shutdown."
- **One active "boom/freeze" button on a precious cooldown:** one-tap field **Freeze** (truest
  kid one-tap; hard-counters the speed boss; sidesteps the shield window since it's CC not damage)
  *or* two-tap aimed **Treat-Bomb** (reuses the strong tower's AoE path; "I beat the boss with
  that throw"). Agency = *responsibility on me* — the kid-safe form of stake, no destruction.
- **Transformative option (medium build):** recoverable **treasure-theft** (DG power cores) —
  enemies carry off a visible treasure and you can chase + win it back; reframes the abstract
  12-lives into a concrete, emotional, recoverable stake. Scope as a deliberate feature.

**Kid-friendliness:** High **iff** every threat is *telegraphed, recoverable, gentle* (the
kid-difficulty contract). Avoid the adult version (literal tower HP + manual repair re-adds the
click load Gap 1 just removed; board-wide stuns; permanent/silent loss). The active button is
**anti-click-load** — occasional, high-payoff, cooldown-paced, the opposite of janitorial
tapping. **Winnability:** the active ability is a comeback/crisis tool (directly answers #3 "drop
the Bomb on it") — but **must dent, not delete** the boss, or it removes the very tension it
exists for. **Dependency / split-boss caution:** an ability is a plausible *future* key to the
unbeatable wave-16 boss — but its unbeatability is empirically anchored at **~7.2× measured peak
player damage** (`measure-secret-boss.mjs`); any tool that raises player power must re-measure or
the secret boss silently becomes beatable/cheesable. Also: the bot ladder must be taught the
ability heuristic or BALANCE.md stops meaning anything. **Depth or polish:** core Depth.

---

### GAP 4 — Boss illegibility ("why does the boss take so many lives?")
**Maps to:** feedback **#3** (MEDIUM but high-frequency), assists **#2** (informed replay).
Genre gap: bosses are stat-blocks, not telegraphed exams.

**Root cause in V2:**
- **A large, hidden `livesCost`.** Bosses cost **3/4/5 of 12 lives** (`gameConfig.js:97-99`),
  subtracted exactly once on reaching the goal (`enemySystem.js:127`) — a single leak is 25–42%
  of the run. The cost is **never previewed**; the HUD only flashes the number *after* the hit
  (`livesFlashAmount`, display-only). This is deliberate (BALANCE.md §4: bosses retuned to
  ~1.85× HP / 1.5× speed to "bleed a few lives even off a completed build") — it is a
  **legibility gap, not a balance bug**.
- **Behaviors have no tell and no counter.** The shield boss is simply *immune* during 3s windows
  (`damageEnemy` returns false, `enemySystem.js:137-142`) with no visible "invulnerable now" and
  no action that strips it; speed/regen are hidden timers (`:52-80`). Every boss reduces to a DPS
  race, so a loss teaches nothing — the player can't form "it survived because it was shielded /
  regenerating / sped past." **Lone-boss waves** (no escort, `gameConfig.js:66,71,76`) make it a
  pure sponge.

**Candidate mechanics (genre):** *Readable boss stakes* (deepdive: readable-boss; BTD6 §3,
DG §3/§5, Infinitode §7):
- **Skull-threshold telegraph (Pattern A):** mark the boss HP bar with icons; crossing one fires
  a *visible, scripted* effect the player watched approach. Convert the opaque random shield
  invuln into "when the boss hits the skull it shields — save your big shot for after." A
  `shieldedHitMs` feedback timer already exists (`enemySystem.js:138`) — wire it to a loud tell.
- **Pre-wave telegraph + glanceable state (Pattern E):** extend the existing `BOSS WAVE`/`Next in:
  N` banner (`waveSystem.js:81,106`) with one threat icon **and a heart-badge for the boss's
  lives-cost** so the player sees "this one is worth 3" *before* it leaks.
- **Boss as a peeling coverage-exam (Pattern B):** make public bosses peel into a small
  telegraphed burst tied to a counter — but this is **gated on Gap 2** (a peel is only a coverage
  exam if the towers have distinct jobs to skip).

**Kid-friendliness:** Very high — pure legibility, zero new clicks, color/icon over digits.
**Winnability:** Strongly positive — makes the loss *fair and fixable*, which is exactly what
converts #2 from replay-as-grind into replay-as-insight. **Depth or polish:** Polish/UX
(communicating existing mechanics), but it is the connective tissue that makes Gaps 2/3/5 fair —
**ship the telegraph/glyph pieces early, alongside Gap 2's readability layer.**

---

### GAP 5 — No win state, no payoff, thin replay (and the unbeatable split boss)
**Maps to:** feedback **#2** ("losing to the boss made me want to replay and beat it" — the
*good* hook, currently unsupported). Genre gaps: unreachable win, no stars/score, no
milestone payoff, ~zero RNG variety, single difficulty axis.

**Root cause in V2 — the winnability gap:**
- **The game cannot be won.** `isFinalWaveComplete` requires `wave.index >= patternCount`, and
  `patternCount` counts **all 16 patterns including the secret one** (`waveSystem.js:181-183`).
  The final pattern is `boss_split` — engineered **unbeatable** (on-field HP ≈146,613 vs measured
  peak player damage ≈20,366, ~7.2× margin; `livesCost:99` one-shot; 3-shard fail-safe if force-
  killed; `gameConfig.js:108-112`, `enemySystem.js:164-173`, SECRET-WAVE.md). So `status==='won'`
  is **dead code** in real play (`Simulation.js:94-98`); every shipped test asserts the optimal
  bot ends `lost@W16`. For ages 5–10, clearing all 15 public waves and being **guaranteed a loss
  with no victory screen, ever** is an anti-payoff — the secret hook amputates the single most
  important reward in the genre.
- **No milestone/score payoff.** The only positive feedback is the generic "Wave N Complete +Nc"
  banner (`waveSystem.js:164`). Beating the wave-5 boss — the exact motivating moment (#2) —
  produces no distinct celebration, no star rating, no per-map record.
- **Replays are identical.** `restart()` bumps the seed, but the *only* RNG-driven gameplay is 1%
  crits + ±50ms fire jitter; path, waves, enemy stats and formations are all fixed. Two seeds
  differ by rounding noise — strategically the same run, so the "replay to beat it" impulse has
  nothing fresh to replay into even if a win existed.

**Candidate mechanics (genre):** *Make it winnable with a real payoff* (win-lose doc §6; KR §3,
DG §8, Rogue Tower §2.3, Infinitode §4/§8): give the **wave-15 `boss_regenerate` clear a proper
win + celebration** and **demote the split boss to an optional/endless surprise** (or ship the
"boss-tower upgrade" key first); pair the win with **stars-from-lives** (uses the existing lives
ledger, zero new sim state) turning the already-tuned "barely win" margin into the score. For
replay: **light `localStorage` meta** (3–5 permanent unlocks; "beat the first boss → basic starts
+1 level"; KR stars, Infinitode research, Rogue Tower blue cards — *keep small*, meta power breaks
balance), **a daily seeded puzzle** (the sim is already pure-seeded-deterministic — near-free,
static-host-perfect), and/or **DG-style modifier modes** ("Tower Limit", "No Upgrades", "Single
Treasure") — a few config lines that re-flip the whole optimization on the existing 2 maps.

**Kid-friendliness:** High — a win screen + stars is the core reward young players chase; keep
meta tiny and bounded (Rogue Tower's cautionary balance break). **Winnability:** This *is* the
winnability gap — the headline fix. **Split-boss handling:** resolve deliberately (demote to
optional/endless, or gate behind a new boss-tower) and **re-measure the 7.2× margin** if Gaps
2/3/6 raise player power. **Depth or polish:** Depth/Structure. **Dependency:** the celebration/
stars piece is cheap and standalone; the "winnable secret boss" piece couples to towers getting
stronger.

---

### GAP 6 — Money glut + invisible upgrade value
**Maps to:** feedback **#4** ("why do I have so much money?", MEDIUM), **#5** ("did upgrades
actually help?", MEDIUM). Genre gaps: finite sink ladder, no income decision, no banking, no
upgrade preview, opaque denominations, invisible bonus math.

**Root cause in V2:**
- **Frictionless income + a finite, shallow sink ladder.** 60 starting coins; **every kill
  auto-credits** (`enemySystem.js:160-162`); a **+25% end-of-wave bonus the player never sees
  taught** (`waveSystem.js:155-167`); reward scales ×1.08 (`gameConfig.js:56`). The *only* sinks
  are 2 towers × 3 levels + sell (`towerSystem.js`). BALANCE.md §5 admits the structural ceiling:
  once the path is L3-covered there is nothing left to buy, so the late/easy-map endgame floods.
  A growing pile you didn't work for and can't spend reads as pointless.
- **Upgrades are invisible *and* historically dominated.** L1→L2 (50c, +4.44 dps) is ~10× worse
  dps/coin than placing 10 more L1 towers; upgrades only buy *range* + *tile consolidation*, both
  invisible. The Upgrade button is bare `Upgrade 50c` (`Renderer.js:593`) with **no before→after,
  no DPS, no range-ring preview**; the card shows raw `Damage`/`Fire 1.80s` separately
  (`:588-589`) — kid-hostile (a child can't compute DPS). No per-tower kill/damage stats exist to
  judge a spend.

**Candidate mechanics (genre):** *Streamlined auto-economy — the second half* (deepdive:
auto-economy; DG §4, BTD6 §6, KR §10, Infinitode §5):
- **Tier-1, free, do-first:** *surface the 25% bonus* (Pattern B — show + teach the number);
  *legible "saving toward X" + upgrade delta* (Pattern H) — show `Damage 8→12`, a range-ring
  preview, and one **single "power" number** a child can watch rise. Pure UI, zero sim/perf cost,
  directly answers #4 ("now I see *why* money arrives") and #5 ("now I see what the spend buys").
- **One always-relevant sink** (Pattern G — the diagnosed root of #4 is the finite ladder, not
  income): a cheap repeatable consumable (the Gap 3 boom/freeze charge), an aspirational golden
  top tier, an upgrade **identity fork** (KR §2 / BTD6 §1 — "Reach vs Rapid", makes #5's spend a
  *visible* identity change), or score leftover coins.
- **One income decision (Tier 2):** **call-wave-early for a coin bonus** (Pattern E) — one
  optional tap, floor never rises, converts the late-game "too much money" lull into a greed
  decision; pairs with Gap 1's GO! button. **Avoid banking/interest** — it rewards hoarding and
  *worsens* #4, and compounding is the least kid-legible idea in the corpus.

**Kid-friendliness:** High; Tier-1 is pure legibility (0 clicks), call-early is 1 optional tap.
**Winnability:** Re-tighten so a *casual* player (not just the optimal bot) trends slightly-short
into the endgame, keeping the place/upgrade decision tense. **Depth or polish:** Economy Depth +
UX legibility. **Dependency:** the upgrade-fork sink couples to Gap 2 (give the fork a role
identity); deleting the dead `economy.coin`/`spawnCoin` path is a small perf win.

---

### GAP 7 — Tower sprite squish / overlap
**Maps to:** feedback **#8** ("everything is getting squished — big towers overlap neighbours",
MEDIUM). Genre gap: footprint grows past the tile (DG/KR/PvZ all keep a fixed one-cell footprint).

**Root cause in V2 (mathematical, not perception):** tower body radius `r = tile * sizeScale`
(`SpriteCache.js:78`); with `tile=96` and L3 `sizeScale=0.6` (`gameConfig.js:127,139`),
**r=57.6 → 115px body inside a 96px tile** — it bleeds ~9.6px past every edge at rest; two
adjacent L3 towers overlap ~19px of *solid body*. Then idle-breathe (×1.04, `Renderer.js:227`)
and the fire-puff (+14% wide / +24% tall, `:235-236`) push an L3 firing tower to ~143px tall.
`canPlace` enforces **no spacing rule** (`towerSystem.js:18-23`), and the tightened *local*
ranges (basic 2/2.5/3, strong 1.5/2/2.5) actively reward the very clustering that triggers the
collision — a design contradiction.

**Candidate mechanics (genre):** *Decouple visual scale from grid footprint* (KR §13.9, DG §7,
PvZ §9): clamp effective `sizeScale ≤ ~0.46` (or clamp the grid blit to the tile), pull
glow/rings/puff inside the cell, and **express level via crown/pips/glow/range-ring colour**, not
raw body size (the level badge already exists, `SpriteCache.js:107`). Grow art *taller, not
wider* if growth must stay for charm.

**Kid-friendliness:** Positive — restores readable, discrete tiles (also re-enables perceiving the
emergent "valley" double-coverage trick). **Winnability:** Neutral. **Depth or polish:** pure
Polish/render, perf-free. **Dependency / ordering:** **must be fixed BEFORE any synergy/adjacency/
clustering idea** (scout cat. #7, Infinitode §3 helper tiles) — those collide with #8 if naive.

---

### GAP 8 — Front-loaded novelty / hook decay
**Maps to:** feedback **#1** ("fun to place towers initially" — positive, but the fun is entirely
front-loaded; once the board is covered every action is the same tap with no new decision; BALANCE.md
§1: "plant ~8 towers and coast").

**Root cause in V2:** nothing new is introduced after the opening — the decision space is fully
revealed in the first minute (2 towers, fixed waves, no abilities, no risk). This is the *sum* of
Gaps 2/3/5: with no varied challenge, no risk axis, no new verbs and no summit, the proven
placement hook has nowhere to go.

**Candidate mechanics (genre):** none standalone — it is the **emergent payoff of fixing Gaps 2,
3 and 5.** Each closed gap re-introduces a "first placement" novelty beat later in the run:
a new enemy flag that demands a tower switch (Gap 2), a new active verb / a tower under threat
(Gap 3), a milestone celebration / unlock (Gap 5). One-mechanic-at-a-time onboarding (KR §9,
PvZ §9) is the authoring discipline that spreads novelty across the 15 waves.

**Kid-friendliness / winnability / depth:** inherits from its parent gaps. Track it as the
*acceptance test* for the depth pass ("is there still a new decision at wave 10?"), not a separate
work item.

---

## Coverage matrix — every symptom & notable genre gap → gap

| Symptom / genre gap | Primary gap | Also touched |
|---|---|---|
| #1 fun to place, then decays | G8 | G2, G3, G5 |
| #2 lost to boss → want to replay | G5 | G2, G3, G4 |
| #3 boss eats so many lives | G4 | G2, G3 |
| #4 too much money | G6 | G5 |
| #5 did upgrades help? | G6 | G2 |
| #6 too much to click | G1 | G6 |
| #7 can't see enemies | G1 | G4 (telegraph), G6 |
| #8 towers squished/overlap | G7 | — |
| #9 only 2 towers, does it matter | G2 | G6 |
| #10 every wave the same | G2 | G4, G5 |
| #11 no risk to me | G3 | G5 (risk on base) |
| Genre: no affinity/counter triangle | G2 | — |
| Genre: no enemy abilities/roles | G2 | G4 |
| Genre: nominal (timing-only) formations | G2 | — |
| Genre: no time control / pause-to-plan | G1 | — |
| Genre: no build tray / set-once targeting | G1 | G2 |
| Genre: no active ability / hero | G3 | — |
| Genre: no risk to player assets | G3 | — |
| Genre: bosses are stat-blocks not exams | G4 | G2 |
| Genre: unreachable win / no stars/score | G5 | — |
| Genre: ~zero RNG / no replay variety | G5 | — |
| Genre: finite sink ladder, no income decision | G6 | — |
| Genre: no banking/interest | G6 (deliberately *avoid*) | — |
| Genre: footprint grows past tile | G7 | — |
| Genre: maze/path-building, branching paths | *not picked* (too high cognitive load for ages 5–10; against hand-authored-map model) | — |
| Genre: synergy/adjacency auras | *deferred* — collides with G7; revisit after sizing fixed | G7 |
| Genre: full roguelike draft / meta tree | *light version only* under G5 | — |

---

## Sequencing & dependencies (read before building)

1. **G1 (time control + low-click) is the substrate — do it first.** It is the loudest pain, the
   cheapest, perf-positive, and *every* depth add (G2/G3/G5) is only fair if the kid has time to
   think. Pay the click debt down before any depth raises required actions.
2. **Ship the cheap legibility pieces of G4 + G6 early, alongside G2's readability layer.** The
   telegraph/glyph/heart-badge (G4) and the bonus/upgrade-delta surfacing (G6) are pure UI, near-
   free, and they are the connective tissue that makes the depth fair.
3. **G2 ships affinity *with* its readability layer** (never affinity alone — that re-creates the
   shield-boss failure). Use **soft** affinity, **≤3** glyph-legible flags, onboarded one at a time.
4. **G7 (sizing) before any synergy/adjacency idea** — clustering mechanics collide with the
   overlap bug.
5. **G5's "winnable secret boss" couples to player power.** Any of G2/G3/G6 that strengthens the
   player means the split boss's empirically-anchored **7.2× unbeatability margin must be
   re-measured** (`measure-secret-boss.mjs`), or it silently becomes beatable/cheesable. The
   cheap half of G5 (a real wave-15 win + stars-from-lives + demote split boss to optional/endless)
   is standalone and high-value.
6. **The peeling-coverage-exam boss (G4 Pattern B) is gated on G2** — a peel only teaches a lesson
   if the towers have distinct jobs to have skipped.
7. **Re-run the committed ladder** (`balance-ladder.test.mjs`) after any balance-touching change,
   and **teach the optimal bot any new active ability** (G3) or the call-early valve (G6) so the
   "barely clears 1–15" proof keeps meaning something.

**Constraint check (all gaps):** every candidate above is client-side sim/config + thin render,
deterministic on the fixed 60fps step, no backend/build, constants in `gameConfig.js`. The only
perf caveat in the whole list is fast-forward (G1) — cap at 2×, bench p95, never scale `dt`.
