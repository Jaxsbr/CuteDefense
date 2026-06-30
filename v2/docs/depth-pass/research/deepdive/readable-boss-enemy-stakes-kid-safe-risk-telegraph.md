# Deep Dive — Readable Boss/Enemy Stakes & Kid-Safe Risk

**Researched:** 2026-06-28
**Category:** Scout catalogue **#10 (boss mechanics & telegraphed counters) + #11 (real,
kid-safe risk to the player's own assets)** — combined as Pick 5 in `scout.md`.
**Primarily addresses grownup feedback:** **#11** ("there's no risk to me — enemies can't
destroy my towers"), **#3** ("why does the boss take so many lives?"), **#2** ("losing to the
first boss made me want to replay and beat it"). Touches **#9 / #10** at the edges.

**Lens:** how successful 2D TD games make a boss/enemy threat *legible* (you can see it
coming and understand why it hurt you) and make risk *reach the player's own stuff* without
becoming punishing — i.e. **telegraphed, recoverable** rather than sudden and permanent. For
each pattern: how it works, the strategic depth it adds, and the implementation + cognitive +
click cost for a kid-friendly minimal TD.

> This is a *depth-pass deep dive*, narrower and deeper than the broad `scout.md` and the
> per-game `external/*` briefs. It cross-references those rather than repeating them
> (`external/defense-grid-the-awakening.md`, `external/plants-vs-zombies.md`,
> `external/bloons-td-6.md`, `external/kingdom-rush-series-.md`).

---

## 0. Why this category exists — the gap it fills in CuteDefense today

Two structural facts in the current sim make this category high-value, and both are confirmed
in code (`feedback-diagnosis.md`, `enemies-waves-formations-bosses.md`):

1. **Risk is one-directional and invisible.** The tower entity has no `hp` field and there is
   *no* enemy→tower interaction anywhere in the sim (`towerSystem.js:30-45`; enemies only walk
   and subtract lives at the goal, `enemySystem.js:82-132`). Every safe tile is equally safe,
   so placement is pure coverage-optimization with **no risk axis** (feedback #11). Nothing the
   player builds is ever threatened.
2. **Boss stakes are real but opaque.** A boss costs **3 / 4 / 5** of 12 lives
   (`gameConfig.js:97-99`), subtracted once on reaching the goal (`enemySystem.js:127`), and the
   shield boss is simply *immune* during 3s windows (`damageEnemy` returns `false`,
   `enemySystem.js:137-142`) with **no tell the player can read and no action that strips it**.
   The cost is never previewed; the HUD only flashes the number *after* the hit
   (`livesFlashAmount`, display-only). So the loss reads as arbitrary (feedback #3), and the
   organic "replay to beat it" hook (feedback #2) has nothing new to learn on the rematch.

The genre has well-proven, *kid-shaped* answers to both. The thread connecting them is a single
design contract the best children-friendly TDs all honour:

> **The kid-safe difficulty contract: every threat is (a) telegraphed before it lands,
> (b) answerable with a legible counter, and (c) recoverable if you fumble it.** Risk you can
> *see coming and claw back* — never silent, never permanent.

---

## 1. TL;DR — the patterns worth stealing

| # | Pattern | One-line | Best source |
|---|---------|----------|-------------|
| A | **Skull-threshold telegraph** | Mark the boss HP bar with icons; crossing one *triggers a visible effect* the player watched approach | Bloons boss bloons (Vortex, Bloonarius) |
| B | **Boss as a peeling coverage-exam** | Boss splits into a small telegraphed burst instead of being one fat HP bar; loss teaches a specific lesson | Bloons MOAB-class; CuteDefense's own `boss_split` |
| C | **Recoverable theft of the player's stuff** | Enemy *carries off* a physical thing you own; kill the carrier and it floats home — a tug-of-war, not a silent −1 | Defense Grid power cores; PvZ plant-eating |
| D | **Temporary, recoverable tower disable** | An enemy briefly "naps"/stuns a nearby tower; it auto-recovers after a few seconds — risk without loss | Bloons Vortex stun; Kingdom Rush Blacksurge / Twilight; RimWorld EMP |
| E | **Pre-wave telegraph + glanceable state** | Show the special threat *before* it arrives (icons), and the stake's status as green/amber/red, so reading the board is a glance | Defense Grid "Tactical Recon" + core dots; PvZ telegraphed Final Wave |
| F | **Forgive-once safety net** | A visible, consumable last-line save (lawnmower) makes a single breach survivable but *paid for* — lowers the floor, keeps the ceiling | PvZ lawnmower |

---

## 2. Pattern A — The skull-threshold telegraph (make the boss explain itself on its own HP bar)

**How it works.** In Bloons TD 6's boss events, a boss bloon's health bar is marked with
**skull icons at fixed health fractions**. The boss behaves like a normal (if huge) target
until its health drops past a skull — at which point a **scripted, dramatic effect fires**:

- **Vortex** — on crossing a skull, it **stuns all nearby towers** (stunned towers cannot
  attack, charge abilities, generate income, or be sold), raises a **temporary 6s deflect
  shield**, and is **knocked ~100 units back** along the track within 0.5s. Stunned towers
  **recover automatically** when the stun expires.
- **Bloonarius** — on crossing a skull, it **spawns a large burst of bloons right in front of
  itself**, converting "chip its HP" into "and now survive the add wave you just triggered."

The genius is that the trigger is **positional and visible**: the skull sits on the health bar,
so the player literally *watches the threat approach* as they damage the boss. The effect is
never a surprise — it is the most legible possible telegraph because it rides on the one number
the player is already staring at. And because boss HP is fixed/deterministic, the skull always
fires at the same point, so the lesson is **learnable and the same every run** (anticipation is
the engagement loop — `external/bloons-td-6.md` §3, §6).

Boss events also escalate across **tiers 1–5** (more HP, more skulls, bigger effects) as an
opt-in difficulty dial, but the *mechanic* is identical at every tier — only the magnitude
scales.

**Strategic depth added.** Converts a boss from a pure DPS race into a **paced, multi-beat
encounter**: the player must (1) *bank up* enough damage to push past a skull, (2) *survive the
consequence* (an add-wave or a stun window), and (3) *time* their burst/abilities around the
skulls. It rewards holding a reserve and reading the bar — real decisions, set up in advance.

**Complexity / click cost.** **Low-to-medium and pure data.** A skull threshold is just
"`if hp crosses X% and not yet fired[i]: trigger effect[i]`" on the deterministic tick — a few
fields in `gameConfig.js` per boss plus a render of the marker on the existing health bar. **Zero
new clicks** for the player; it is something to *watch and plan around*, not something to operate.

> **CuteDefense fit:** This is the single cleanest fix for feedback #3. Today the shield boss's
> invuln is an *untelegraphed* version of exactly this idea (`enemySystem.js:137-142`). Replacing
> "random 3s-on/8s-off invuln with no tell" with **skull marks on the boss bar that the player
> watches approach** makes the same difficulty *legible*: "when the boss hits the skull it
> shields — so save your big tower's shot for after." Loss becomes a fixable mistake (#3), and
> the rematch becomes *informed* improvement (#2). A `shieldedHitMs` feedback timer already
> exists (`enemySystem.js:138`) — this is wiring an existing signal to a visible cause.

---

## 3. Pattern B — The boss as a *peeling coverage-exam*, not a fat HP bar

**How it works.** Bloons' MOAB-class bosses do not vanish at 0 HP — they **peel into a burst of
children** (MOAB → 4 Ceramics; BFB → 4 MOABs). A boss is therefore a *multi-stage event*: you
see the shell crack, then face a follow-up surge you had to prepare for. Crucially, each boss is
tuned as a **coverage check** — the DDT is "Camo + Lead + Black at once," so losing to it teaches
a *specific, solvable* lesson ("I had no lead coverage"), which is what drives the
replay-with-a-plan impulse rather than "grind more DPS" (`external/bloons-td-6.md` §3).

**Strategic depth added.** Loss becomes *diagnostic*. A peeling boss says "you were missing X,"
so the rematch is a smarter build, not just a bigger one. This is the difference between
feedback #2 being a healthy retry loop and being a grind.

**Complexity / click cost.** **Low** — CuteDefense already ships the primitive: the secret
`boss_split` peels into 3 shards (`enemySystem.js:164-173`, `gameConfig.js:108-112`). The instinct
is correct; the gap is that the *public* bosses (5/10/15) don't peel and aren't tied to a counter,
so they teach nothing on loss (`enemies-waves-formations-bosses.md` §3).

> **CuteDefense fit:** Strong but **gated on roster/counter work** (Pick 3 in `scout.md`). A
> peeling boss is only a *coverage* exam if there is coverage to check — i.e. if the two towers
> have distinct jobs and the boss's peel demands the one you skimped on (e.g. a small boss that
> bursts into a tight swarm → you needed the AoE "strong" tower). Without the counter layer, a
> peeling boss is just "more enemies." Treat this as the *boss-shaped delivery* of the Pick-3
> enemy-trait work, not a standalone add. Make boss `livesCost` legible the same way: a small
> heart-badge so the player sees "this one is worth 3" *before* it leaks (feedback #3).

---

## 4. Pattern C — Recoverable theft: enemies carry off the player's stuff (and you can win it back)

This is the headline pattern for feedback #11, and it is the best-documented way to add *real
stakes* while staying kid-safe, because the loss is **physical, visible, and reversible**.

**How it works (Defense Grid — the canonical example).** Aliens don't "deal damage." They walk to
a central housing, **grab one or more power cores, and carry them toward the exit**. The key
mechanics (`external/defense-grid-the-awakening.md` §1):

- **Killing a carrier drops the core**, which then **slowly floats home on its own** — a visible
  second chance. But a *different* enemy can intercept the floating core, so a core in transit is
  a **live tug-of-war**. Tension peaks at the *end* of a wave (the comeback minigame), not the
  start.
- **Carry capacity is per enemy type** (a boss can hoist *three* at once) — so a boss is scary
  for a *legible* reason ("look how much it's taking"), not an opaque "−5 lives."
- **One exception is permanent:** flyers' theft can't be recovered — which is exactly why
  anti-air is non-negotiable. A clear "this one you must NOT let through."
- **Glanceable HUD:** each core is **green (safe) / amber (stolen, recoverable) / red (gone)** —
  the entire win/lose state reads from a row of colored dots.

**PvZ's variant of the same idea:** zombies **eat the plant** they reach — destroying *the thing
you spent your scarce sun on*. It is telegraphed (audible chomp; the Wall-nut **cracks in 3
stages** as advance warning) and answerable (put an expendable buffer in front of valuable
plants). The loss is your *investment*, which stings far more legibly than an abstract life
(`external/plants-vs-zombies.md` §5).

**Strategic depth added.** Huge. It (a) gives the player something of *theirs* at stake (#11),
(b) makes a boss's threat **concrete and proportional** — "it's carrying three of my cookies
home, chase it!" instead of a silent counter drop (#3), (c) creates a *reason to keep watching
the lane* (the comeback at the exit — helps #7), and (d) differentiates enemy types by *how much
they take* and *whether the theft is recoverable* (#9/#10).

**Complexity / click cost.** **Medium**, but sim-clean and deterministic. A stolen treasure is
just an entity with a position and a `carrier` pointer; on carrier death it becomes a free entity
drifting home at a fixed speed — fully compatible with the seeded fixed-timestep core. **No new
*required* clicks** if recovery is automatic (kill-the-carrier is already the core verb);
optionally a tap to "grab" a floating treasure adds agency but also click-load — prefer
auto-recovery for the age band. The cost is mostly *rendering + a HUD reframe* (replace/augment
the flat 12-lives counter with a small pile of N visible treasures).

> **CuteDefense fit:** This is the most *transformative* option for #11 and reframes #3
> beautifully — but it is the **biggest departure** from the current model (it replaces the lives
> abstraction with a carried-object economy). It respects every hard constraint (deterministic,
> client-side, no build), and the "carry it back" verb is deeply kid-legible ("he's taking my
> thing — get it back!"). The honest caution: it changes the loss condition's *feel* and needs
> the renderer to show carriers + drifting treasures + a green/amber/red base pile. Scope it as a
> deliberate feature, not a tuning tweak.

---

## 5. Pattern D — Temporary, recoverable tower disabling ("the tower takes a nap")

This is the **most direct, lowest-departure** way to put the player's *towers* at risk without
making them destructible (which the brief forbids and which would re-add the click/grind load the
economy/pause work is trying to remove).

**How it works (multiple sources converge on the same shape).**

- **Bloons Vortex** stuns nearby towers on a skull threshold: a stunned tower **cannot attack,
  charge abilities, or be sold**, then **recovers automatically** when the timer ends. The
  disable is *temporary and self-healing*.
- **Kingdom Rush** ships a whole family of tower-disablers: **Blacksurge** (7.5s disable, can chain
  to ~4 towers at once), the **Twilight Scourger** (releases a banshee *on death* that disables a
  nearby tower), the **Twilight Evoker / Twilight Queen** (disable + heal). In every case the
  tower **re-activates after the duration** — and the *counter* is to **kill or stall the
  disabler** before it fires (a stunned Blacksurge can't disable), which is a legible target-
  priority decision.
- **RimWorld's EMP** adds a fairness governor worth stealing: after being stunned, a target gains
  **temporary immunity** so it cannot be perma-stun-locked. The same principle in reverse protects
  the *player*: a tower that just recovered from a nap should be briefly immune, so a swarm of
  nappers can never lock a tower out forever.

**Strategic depth added.** Introduces **positional risk and a target-priority decision**: which
enemy must I kill *first* so it doesn't switch off my key tower? It makes *where* you place
matter (a disabler approaching your one long-range tower is a crisis), and it gives bosses a
readable, non-DPS threat ("the boss is about to nap your towers — burst it before the skull, or
have backup coverage"). It pairs naturally with Pattern A (deliver the disable on a skull
threshold so it's telegraphed).

**Complexity / click cost.** **Low.** A tower gains a `stunnedUntil` tick; while stunned it skips
firing in `towerSystem`; the renderer shows a clear "zzz"/dizzy overlay + a shrinking timer ring.
Deterministic and perf-trivial (one branch in the fire loop). **Zero new required clicks** —
recovery is automatic; the *optional* agency is "kill the disabler first," which uses the existing
targeting/placement verbs. The only real cost is the **fairness tuning** (short duration, post-
recovery immunity, never affect *all* towers at once) so it reads as "exciting hiccup," not
"unfair shutdown" — critical for a 5–10 audience.

> **CuteDefense fit:** **Best value-per-complexity in this whole category.** It directly answers
> #11 with a kid-safe, recoverable threat; it slots onto the existing tower fire-loop and
> boss-skull idea with minimal new systems; it is deterministic and perf-cheap; and it preserves
> the cozy "my towers are safe (they just nap)" tone. The design must keep it gentle: a single
> tower napping for ~3–4s with a clear tell and a brief recovery-immunity, **never** a board-wide
> blackout. This is the recommended *first* step into the category.

---

## 6. Pattern E — Pre-wave telegraph + glanceable state (so reading the board is a glance, not a study)

**How it works.** Defense Grid's **"Tactical Recon"** shows the *icons of the special enemies in
the coming wave*, color-coded green/amber/red for threat, **before the wave arrives** — so
planning happens in the quiet and the player can *watch* their plan execute during combat
(`external/defense-grid-the-awakening.md` §3, §5). PvZ telegraphs the **Final Wave** of each level
("a huge wave is approaching!") so the climax is predictable, and shows every stake's status
physically (cracking Wall-nut, lawnmower present/spent) rather than as a hidden number
(`external/plants-vs-zombies.md` §7, §9). Both encode state as **color/shape, not digits** —
essential for pre-readers.

**Strategic depth added.** Moves the *thinking* into the calm between-wave window and lets the
*combat* be watchable — the structural fix for feedback #7 ("can't even see the enemies"). It also
makes every wave feel *distinct by announcement* ("this one is the shieldy one!") which is the
cheapest possible contribution to #10. And a telegraphed boss-cost ("worth 3 hearts") directly
de-mystifies #3.

**Complexity / click cost.** **Very low.** CuteDefense already has a `prepare`/countdown phase
with a `BOSS WAVE` / `Next in: N` banner (`waveSystem.js:81,106`). Extending that banner to show
**one icon for the special threat** and a **heart-badge for boss lives-cost** is pure UI/data on an
existing phase — no new clicks, no sim change, no perf cost.

> **CuteDefense fit:** **Free and high-leverage; do this regardless of which other pattern is
> chosen.** It is the connective tissue that makes Patterns A–D *fair*: a telegraphed threat the
> player saw coming. The existing prepare-phase banner is the natural home. Keep it to ~8 words /
> one icon (the PvZ "eloquent caveman" budget).

---

## 7. Pattern F — The forgive-once safety net (lower the floor without lowering the ceiling)

**How it works.** PvZ parks one **lawnmower** per lane: the first zombie to break through triggers
it, clearing the lane once, then it's **spent** — a *visible, consumable* second chance
(`external/plants-vs-zombies.md` §7). The player can see which lanes still have a mower, so the
margin is always legible, and experts treat triggering one as a real loss while novices survive
their fumbles.

**Strategic depth added.** Makes failure **fair and legible** rather than a cheap surprise, and
makes the difficulty *contract* explicit: you get one warning. It directly reframes the abstract
"12 lives" — a few *visible, physical* safety charges read far better than a big hidden buffer
(feedback #3).

**Complexity / click cost.** **Low** — a small count of visible "guardian" charges at the base
that the player watches get consumed, with a clear one-time effect. Pure data + a HUD object; no
new clicks.

> **CuteDefense fit:** A gentle, optional reframing of the lives counter. Lower priority than
> A/D/E, but pairs well with Pattern C (the treasure pile *is* the visible buffer). Worth noting
> as the "kid-difficulty contract" capstone: **telegraph → counter → recover → forgive once.**

---

## 8. Strategic depth vs. cost — at a glance

| Pattern | Depth added | Click cost | Impl cost | Perf | Tone risk (5–10) | Maps to |
|---------|-------------|-----------|-----------|------|------------------|---------|
| A Skull-threshold telegraph | Paced multi-beat boss; bank/time burst | none | low (data + bar marker) | trivial | very low | #3 #2 |
| B Peeling coverage-exam | Loss becomes diagnostic → smart retry | none | low (have `boss_split`) | trivial | low | #2 #3 #9/#10 |
| C Recoverable theft | Real stake + comeback minigame + enemy diff | none–low | **medium** (carry/drift entities + HUD reframe) | low | low–med (loss-feel change) | **#11** #3 #7 #9 |
| D Temporary tower disable | Positional risk + target-priority decision | none (auto-recover) | low (one fire-loop branch) | trivial | **needs gentle tuning** | **#11** #3 |
| E Pre-wave telegraph + glanceable state | Plan in calm, watch in combat; waves feel distinct | none | very low (extend banner) | none | very low | #7 #3 #10 |
| F Forgive-once safety net | Fair, legible failure; explicit contract | none | low (visible charges) | none | very low | #3 #2 |

**Read:** the category's value is unusually front-loaded into *cheap* patterns. A/E/F are nearly
free and pure legibility wins; **D is the best risk-axis bang-for-buck**; B rides on the Pick-3
counter work; C is the most transformative but the only *medium* lift.

---

## 9. Honest fit assessment for CuteDefense V2

**Verdict: a strong fit, and unusually so — most of this category is achievable as data +
rendering on systems that already exist, with little or no added click-load.** That matters
because the loudest feedback (#6/#7) is *overload*; this is one of the few depth levers that adds
*meaning* without adding *taps*.

Against each hard constraint:

- **Static host / no build / plain ES modules:** Fully compatible. Every pattern is client-side
  logic + config + sprite-cached rendering. Nothing needs a server, a build step, or persistence
  (Pattern F's "contract" could optionally log a best-run to `localStorage`, but isn't required).
- **Deterministic seeded sim (fixed 60fps):** Excellent fit — these patterns *want* determinism.
  Skull thresholds fire at fixed HP; theft/drift and stun timers are integer-tick state; a boss's
  peel is scripted. All are reproducible by construction and belong in `v2/sim/` with constants in
  `gameConfig.js` (no magic numbers in logic — e.g. `boss.skulls`, `tower.napDurationTicks`,
  `enemy.carryCapacity`).
- **Perf budget (V2 p95 < V1 p95):** Negligible. A stun is one branch in the fire loop; a skull is
  one comparison per boss per tick; theft is a handful of extra entities. The renderer adds a few
  overlays (dizzy "zzz", skull marker, treasure pile, green/amber/red dots) — all sprite-cacheable.
  No new per-frame allocation patterns required.
- **2 towers today:** Patterns **A, D, E, F** work *as-is* with two towers and need no roster
  change — they are the right first moves. Pattern **B** is only meaningful *after* the towers have
  distinct counters (Pick 3); shipping it before that yields "just more enemies." Pattern **C** is
  roster-agnostic but is the biggest build.
- **Young kids / low cognitive + click load:** This is the category's strongest suit *if the
  kid-safe contract is honoured*. Telegraph (you see it coming) + recoverable (it heals / floats
  home) + forgive-once (a visible second chance) is exactly the children's-TD difficulty model
  (PvZ, Kingdom Rush). The **failure mode to avoid** is importing the *adult* version: literal
  tower HP + manual repair (re-adds the click load Picks 1/2 remove), board-wide stuns, or
  permanent/silent loss. Keep disables single-target, short, auto-recovering, and post-recovery
  immune (the RimWorld governor); keep theft recoverable except for one clearly-telegraphed
  "don't let it through" enemy.

**Sequencing recommendation (lowest risk → highest):**

1. **E (telegraph + glanceable state) + A (skull thresholds on existing bosses)** — near-free,
   pure legibility, directly fixes #3 and supports #2. Convert the current opaque shield invuln
   into a telegraphed skull effect. *Do these first.*
2. **D (temporary tower nap)** — the recommended entry into the actual *risk axis* (#11):
   low-cost, kid-safe, deterministic, slots onto the fire loop and the skull idea. Tune gently.
3. **B (peeling coverage-exam bosses)** — fold into the Pick-3 enemy-trait/counter work; deliver
   the boss as the exam for whichever tower-job the player skimped on.
4. **C (recoverable treasure-theft)** — the transformative, highest-ceiling option for #11/#3, but
   a *medium* build and a change to how loss feels; scope it deliberately as a feature, not a tweak.
5. **F (forgive-once safety net)** — optional capstone that makes the difficulty contract explicit;
   pairs naturally with C's visible treasure pile.

**Bottom line:** this category is **high fit, high value-per-complexity, and on-brand for a cozy
kids' TD** — provided every threat is telegraphed, recoverable, and gentle. The cheapest pieces
(A/E) should ship regardless; D is the best single new mechanic for the missing risk axis; C is the
ambitious version worth its weight if a bigger #11 swing is wanted.

---

## Sources

- [Vortex: Deadly Master of Air (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Vortex:_Deadly_Master_of_Air_(BTD6)) — skull-threshold tower stun (auto-recovering), deflect shield, knockback.
- [Bloonarius the Inflator (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Bloonarius_the_Inflator_(BTD6)) — skull-threshold add-spawn telegraph.
- [A look into Boss Bloons — Steam Community Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2824477232) — skull thresholds on the HP bar, tier 1–5 escalation.
- [MOAB-Class Bloon — Bloons Wiki](https://bloons.fandom.com/wiki/MOAB-Class_Bloon) — peeling/layered boss design (coverage exam).
- [Blacksurge — Kingdom Rush Wiki](https://kingdomrushtd.fandom.com/wiki/Blacksurge) — tower-disable (7.5s, chains), auto-recovery, counter = kill/stall the disabler.
- [Kingdom Rush Origins enemies (Twilight Scourger/Evoker/Queen) — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Characters/KingdomRushOriginsEnemiesAndAntagonists) — on-death and active tower-disablers.
- [Boss — Tower Defense Simulator Wiki](https://tds.fandom.com/wiki/Boss) — boss immunities/resistances framing.
- [Enrage (mechanic) — Wowpedia](https://wowpedia.fandom.com/wiki/Enrage_(mechanic)) — soft vs hard enrage timers (legible "you must finish in time" pressure).
- [Defense structures / Defense tactics — RimWorld Wiki](https://rimworldwiki.com/wiki/Defense_structures) — EMP stun + post-stun adaptation/immunity (anti-stunlock fairness governor).
- Internal cross-refs: `external/defense-grid-the-awakening.md` (recoverable core theft, green/amber/red HUD), `external/plants-vs-zombies.md` (plant-eating, cracking Wall-nut, lawnmower), `external/bloons-td-6.md` (peeling bosses, coverage exams), `external/kingdom-rush-series-.md` (tower-disable bosses, telegraphed encounters), `scout.md` (cats. #10/#11 + Pick 5), `feedback-diagnosis.md` and `enemies-waves-formations-bosses.md` (code ground-truth).
</content>
</invoke>
