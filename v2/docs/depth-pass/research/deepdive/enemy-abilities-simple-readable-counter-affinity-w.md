# Deep Dive — Enemy abilities + simple readable counter/affinity (with a control role)

**Mechanic category:** Enemy abilities + a simple, readable counter/affinity system, including a
*control* (slow/stun/"buy time") role — the thing that makes the two towers *matter* and turns each
wave into a distinct puzzle.

**Targets feedback symptoms:** #9 (only 2 towers — does it matter which I use?), #10 (every wave is
the same enemies, just more), #5 (did upgrades actually help?), #3 (why does the boss take so many
lives?). Touches #2 (replay-to-beat) and #11 (no risk to me) at the edges.

**Researched:** 2026-06-28. Sources: the depth-pass external briefs already on disk (Kingdom Rush,
Bloons TD 6, Plants vs. Zombies, GemCraft, Defense Grid) plus fresh web search/fetch on
damage-affinity and the control role. Current-state citations are `file:line` against
`/Users/jacobusbrink/Jaxs/projects/CuteDefense`.

---

## 0. What this category actually is (three coupled sub-mechanics)

This is not one mechanic — it is a tightly-coupled triad, and the depth only appears when all three
are present:

1. **Enemy abilities / properties** — an enemy *is* or *does* something beyond a stat block (armored,
   shielded, flying/evasive, regenerating, swarming, buffs-allies). These are the *questions*.
2. **A counter/affinity rule** — a tower's damage interacts with that property (more/less/none). This
   is what makes a wrong tool *fail visibly* and a right tool *feel correct*. This is the *answer key*.
3. **A control role** — at least one tool whose job is **not damage but time**: slow, stun, freeze,
   teleport-back. "Buying time" is its own strategic axis; the modern TD meta treats utility/control
   towers as *"as critical as damage dealers"* because *"these effects buy time, which is often more
   valuable than raw damage."* ([Game-Ace][ga], [TD Skiller][tds])

Today CuteDefense has the *raw materials* of #1 (basic/fast/strong shapes; shield/speed/regen bosses)
but **none of #2 or #3**. The only place enemy *type* touches play is `towerSystem.acquireTarget`'s
`typeScore` (fast 0.8 / strong 0.6 / basic 0.4, `gameConfig.js:150-151`), which biases which enemy a
tower *shoots first* — it never changes damage, and the player never controls it. So the two towers
are mechanically interchangeable and every wave reduces to "did you build enough DPS" — exactly the
symptom (`v2/docs/depth-pass/research/v2/enemies-waves-formations-bosses.md` §2).

---

## 1. How successful 2D TD games implement it — the concrete patterns

### Pattern A — Hard damage-type ↔ resistance counter (the affinity table)
**Games:** Kingdom Rush (physical vs magic vs true; gray-shield armor, blue-shield magic-resist);
Bloons TD 6 (~11 damage types × bloon properties: Sharp can't pop Lead, Energy/Fire can't pop
Purple, Explosion can't pop Black).

**How it works.** Damage carries a *type*; enemies carry a *resistance/immunity* to some types. The
table is small (KR needs only 3 relationships — physical, magic, true — to generate its whole counter
web). The wrong tower's numbers visibly shrug off ("pump arrows into an armored Dark Knight and watch
it soak"); the player learns the rule *by seeing it not work*, not from a tooltip.
([KR brief §1, §6][kr]; [BTD6 brief §2][btd6])

**Depth added.** Converts "which tower?" from a shrug into the central, *forced, legible* decision —
you must field a mix, so the board becomes a deliberate composition and each wave's property-mix
dictates the tower ratio. This is the single highest-rated transfer in three of the five briefs.

**Complexity / click cost (kid-minimal TD).** Near-zero *click* cost — affinity is automatic (towers
already auto-fire; affinity only changes the damage number). The cost is *cognitive/reading*: each new
type↔resistance pair is a rule a child must learn. Hard immunity is risky with only 2 towers (see §3).

---

### Pattern B — Composable property *flags*, not new enemy types
**Games:** BTD6 (Camo, Lead, Purple, Regrow, Fortified, Ceramic are *modifiers layered onto any
bloon* — the DDT is Camo+Lead+Black on one body); Defense Grid (orthogonal traits — a Juggernaut is
"armor + shield"; a Spire is "shield + buffs allies").

**How it works.** A handful of boolean flags compose onto a base body. *"Huge variety from ~6 boolean
flags."* One enemy can be made of four orthogonal threats; the player reads 2–3 icons, not a stat
block. ([BTD6 brief §2][btd6]; [DG brief §3][dg])

**Depth added.** Exponential wave variety from a tiny vocabulary — the direct, cheap answer to #10
("every wave the same"). Variety is *combinatorial*, authored on the existing hand-written wave list,
no new sprites per combination.

**Complexity / click cost.** Zero added clicks. Authoring cost is trivial (flags in the wave config).
The real cap is *legibility*: keep it to **2–3 flags** for ages 5–10, each with an unmistakable glyph,
or the reading load (Pattern G) blows the budget.

---

### Pattern C — The "must-have-or-you-leak" gatekeeper ability (detection / anti-air)
**Games:** BTD6 Camo (invisible without a detector — projectiles phase through for *zero* damage);
Defense Grid Flying (Dart/Manta ignore the maze, only 3 towers can touch them, **theft is
permanent**); the modern meta's Stealth — *"a binary gatekeeper… failure results in instant loss,
making stealth detection a mandatory loadout slot."* ([Game-Ace][ga]; [BTD6 §2][btd6]; [DG §1,§3][dg])

**How it works.** A binary: you have *at least one* answer or the whole wave walks through free. It
forces a *coverage requirement* (you must reserve a slot for the answer) rather than a tuning knob.

**Depth added.** Strongest "you needed the *other* tower" lesson — the loss is total and specific, so
the replay is *informed* ("I had no anti-air"). Drives the #2 replay loop with a solvable lesson.

**Complexity / click cost.** Low click cost, but **highest punishment-risk for kids** — a binary
gatekeeper with only 2 towers can make a mono-build leak an *entire* wave with no recourse. Needs a
soft landing (telegraph + a forgiving leak, not instant loss) to fit the audience.

---

### Pattern D — The control role: slow / stun / freeze ("buying time")
**Games:** Defense Grid Temporal (doesn't attack; slows everything nearby — a *force-multiplier*, only
worth it where guns overlap its zone); GemCraft Blue=slow / Cyan=stun gems (best in *traps* on the
path); PvZ Snow Pea (damage **and** slow); Kingdom Rush Arcane Wizard *Teleport* (sends an enemy back
down the path) and Sorcerer *Polymorph* (turn an enemy into a harmless sheep). ([DG §2][dg];
[GemCraft §4][gc]; [PvZ §4][pvz]; [KR §2][kr])

**How it works.** A tool whose output is **time, not damage**. Slow stretches enemy time-in-range so
*every other tower lands more hits*; stun/freeze creates a burst window; teleport-back resets a near-leak.
Control is the answer to the *fast* and *speed-burst* threats that pure DPS can't catch (DG Meteor
whiffs on Racers without a slow source).

**Depth added.** A *third strategic axis* orthogonal to "single-target vs AoE" — it multiplies the
value of placement (overlap the slow zone with your damage) and is the clean, legible counter to the
existing `boss_speed` (#3: "why so many lives?" → because nothing slowed it). "Buy time" is a concept a
6-year-old grasps instantly.

**Complexity / click cost.** Depends entirely on *delivery*. As a **dedicated control tower** it costs
a 3rd roster slot (violates the 2-tower brief). As an **upgrade branch** (strong → adds a slow aura) or
a **single charge-up "freeze" button** it adds ~0 roster and ~1 optional tap — the kid-safe forms. As an
*enemy* ability aimed at the **player** (an enemy that briefly stuns/silences a nearby tower) it becomes
the #11 risk lever instead — non-destructive, recoverable, telegraphed.

---

### Pattern E — Support / "buffer" enemies (a priority-target puzzle)
**Games:** Defense Grid Spire (projects its shield onto neighbors) and Decoy (cloaks neighbors);
Kingdom Rush Shaman (heals nearby allies — *isolate it or burst it first*). ([DG §3][dg]; [KR §6][kr])

**How it works.** One enemy whose only rule is *"buff the others."* The wave becomes "kill the umbrella
monster first, then the rest are easy." Emergent depth from a single rule on a single enemy.

**Depth added.** Introduces *target priority* as a decision the player can feel ("pop the buffer!"),
turning a wave into a small puzzle with zero new tower needed. Pairs naturally with Pattern H.

**Complexity / click cost.** Zero added clicks if targeting stays automatic; very high
depth-per-asset. The only cost is the reading glyph (Pattern G). One of the cheapest depth wins on the
board (both DG and KR briefs flag it as "gold for CuteDefense").

---

### Pattern F — Regeneration / self-heal (the burst-vs-trickle test)
**Games:** BTD6 Regrow (regenerates popped layers every ~3s unless killed fast); Kingdom Rush Troll
(5–20 HP/s); CuteDefense's own `boss_regenerate` (+2 hp/s, `gameConfig.js:99`). ([BTD6 §2][btd6];
[KR §6][kr])

**How it works.** The enemy heals unless out-DPS'd; spread/trickle damage *fails*, concentrated burst
*wins*. The counter is not a tower *type* but a damage *shape* (focus fire / upgrade-for-burst).

**Depth added.** Makes upgrade investment *legible* — a regen enemy is the clearest in-game proof that
"more damage per hit" actually mattered (direct answer to #5: "did upgrading help?"). It rewards the
single-target tower's concentrated output over spreading.

**Complexity / click cost.** Zero added clicks. CuteDefense already implements the ability; it is
unsolvable today only because there is no *legible* burst counter and no tell. Cheapest to surface.

---

### Pattern G — The readability layer: visible glyphs + pre-wave telegraph
**Games:** Kingdom Rush (gray shield = armor, blue shield = magic-resist — you *see* the resistance);
Defense Grid "Tactical Recon" (icons of the special enemies + green/amber/red threat color shown
*before the wave arrives*); PvZ "show, don't tell" (Peashooter's mouth = it shoots; Wall-nut looks
like a wall; ≤8 words on screen). ([KR §6,§11][kr]; [DG §3,§5][dg]; [PvZ §9][pvz])

**How it works.** The counter only *becomes depth* if the player can read the threat and predict the
answer. Resistance is shown on the *enemy body* (a glyph), and the wave's composition is *announced*
in the quiet before it starts, so planning is front-loaded and combat is watchable.

**Depth added.** This is the multiplier that makes A–F worth anything for the target age. Without it,
affinity is invisible (the exact failure mode of CuteDefense's current shield/speed/regen bosses,
which have *no tell + no counter*, `enemies-waves-…md` §3, #3). With it, each wave reads as a distinct
*plannable* question — and the pre-wave telegraph is also the fix for #7 (separates build-phase
clicking from combat-phase watching).

**Complexity / click cost.** No gameplay clicks; pure render + one pre-wave UI banner. Sprite-cache
friendly (a per-flag glyph overlay). Authoring cost is one icon per flag. **This is the gate item** —
budget the reading load *first*, then add only as many flags as the glyph vocabulary can carry.

---

### Pattern H — Targeting priority as set-once control (focus fire)
**Games:** BTD6 (per-tower First / Last / Close / Strong toggle — one tap, persistent, zero ongoing
micro; "Strong" concentrates damage on the boss instead of wasting it on fodder). ([BTD6 §4][btd6])

**How it works.** A discrete, *persistent* setting that lets the player point the counter at the right
enemy (the buffer in Pattern E, the boss, the regen in F) without per-frame clicking. Default ("First")
is the no-knowledge-required safe option; depth is opt-in.

**Depth added.** Gives the player a *control* lever (where the damage goes) at essentially no attention
cost — the cleanest example in the genre of "depth that costs no ongoing clicks." Lets the affinity
system pay off (you can choose to focus the enemy your tower counters).

**Complexity / click cost.** One optional tap per tower, set once. For kids, trim to a **two-state
toggle** (a "leader/escaping" icon vs a "biggest" icon). Skip Last/Close as too abstract. Pure opt-in
— never required, so it doesn't raise the floor for #6.

---

### Pattern I — Soft affinity (multiplier) vs hard immunity — the fairness/legibility fork
**Games:** BTD6 uses **hard immunity** (Lead is *immune* to Sharp — zero damage); the modern mobile
meta increasingly uses **percentage mitigation** — *"percentage-based mitigation where enemies possess
properties like 'Explosion Immunity' or 'Laser Resistance'… this system invalidates entire damage
classes."* Kingdom Rush sits in between (armor *reduces* physical heavily but magic *ignores* it).
([Game-Ace][ga]; [BTD6 §2][btd6]; [KR §1][kr])

**How it works.** Hard immunity = "this tower does *nothing*" (maximally legible, maximally punishing).
Soft affinity = "this tower does 0.5× / 2×" (forgiving, still teaches, but the wrong tool *eventually*
works). The choice is a difficulty/fairness dial.

**Depth added.** Same strategic shape either way; the difference is the *feel of failure*. Hard
immunity drives the sharpest "you needed the other tower" lesson; soft affinity keeps a struggling
player in the game.

**Complexity / click cost.** Identical implementation cost (a multiplier lookup). The *design* cost is
the audience fit: with only 2 towers, hard immunity means a mono-build can lose a whole wave with no
recourse — too harsh for ages 5–10. Soft affinity (e.g. 2× / 1× / 0.5×) is the kid-safe default.

---

## 2. Cross-pattern synthesis (the design rules these games agree on)

1. **Variety comes from a small composable vocabulary, not many enemy types** (Pattern B). 6 flags >
   60 enemies. This is the cheapest possible answer to #10.
2. **A counter is only depth if it is readable** (Pattern G). Every game that does affinity well shows
   the resistance on the body *and* telegraphs the wave. CuteDefense's bosses fail precisely here.
3. **The wrong tool must fail *visibly*** (Patterns A, C, I). The lesson is taught by seeing damage not
   land — which requires floating numbers / a glyph, not a tooltip.
4. **Control ("buy time") is a first-class role, distinct from damage** (Pattern D). It is the missing
   third axis and the natural counter to the speed boss.
5. **Depth is opt-in; the floor stays low-click** (Patterns H, and the genre-wide "towers are
   fire-and-forget"). Affinity adds *cognitive* load, not *click* load — which is the right trade for a
   kid game already drowning in clicks (#6/#7).
6. **One new flag at a time, then recombine** (KR/PvZ onboarding). Introduce armor on one wave, swarm
   on another, then armor+swarm together. The combination space *is* the campaign.

---

## 3. Honest fit assessment for CuteDefense V2

**Verdict: strong fit for the affinity + readability + control-enemy core — but only in its *soft,
telegraphed, 2–3-flag* form, and the "control role" must arrive as an upgrade branch / one ability /
an enemy ability, NOT as a third damage tower.** This is the single highest-leverage answer to #9 and
#10 and it directly improves #5 and #3.

### Where it fits cleanly (low risk)
- **Static-host / no-build / perf:** trivially compatible. Affinity is an O(1) multiplier lookup keyed
  on `(damageType, enemyFlags)` at projectile-hit; flags are booleans on the enemy entity; glyphs are
  cached sprite overlays; the pre-wave telegraph is static UI. None of this touches the hot loop in a
  way that threatens V1's p95 frame time. It is pure `sim/` + `config/` + a thin render overlay, all
  deterministic on the fixed timestep — fully inside the architecture.
- **No magic numbers:** every multiplier, flag→tower mapping, and slow factor lives in
  `gameConfig.js` (matches the existing `combat`/`enemies`/`waves` blocks).
- **Click-load (#6/#7):** affinity itself adds **zero clicks** — towers already auto-target and
  auto-fire; the system only changes damage numbers. It adds *reading* load, not *action* load, which
  is the correct direction for an over-clicked game. (Pattern H's toggle and Pattern D's ability are
  the only optional click additions, both opt-in.)
- **Reuses what exists:** the three boss behaviors (shield/speed/regen) and the basic/fast/strong
  shapes are *already* the raw enemy-ability layer (`gameConfig.js:90-113`, `enemySystem.js:52-80`).
  The gap is purely the missing counter rule + the missing tell — i.e. this is mostly *surfacing and
  connecting* existing pieces, not net-new systems.

### The real constraints / risks (and the kid-safe resolutions)
- **Only 2 towers caps the affinity to a 2-way, soft relationship.** You cannot build BTD6's web with
  two tools. The clean, legible mapping the briefs converge on: **basic = precision/single-target →
  the answer to fast/evasive (and to regen, via burst); strong = splash/AoE → the answer to
  swarm/clustered (and the boom that dents armor).** That is enough to make "which tower?" a real,
  per-wave decision — but it must be **soft affinity (multiplier), not hard immunity** (Pattern I),
  because a mono-build hitting a hard immunity with no third option leaks the whole wave — too punishing
  for ages 5–10. Recommend ~2× / 1× / 0.5×, never 0×.
- **The control role cannot be a 3rd tower** without breaking the 2-tower brief. Best fits, in order:
  (a) a **slow-aura upgrade branch** on `strong` (turns its level-3 spend into a *visible* identity
  change — also fixes #5; Defense Grid Temporal as an upgrade, not a roster slot); (b) a **single
  charge-up "freeze" ability** (one button, fills over the wave — GemCraft's banked spell, KR's Rain
  of Fire cadence — high drama, ~1 tap, the only skill is *when*); (c) the inverse — an **enemy** that
  briefly stuns/silences a *nearby tower* (telegraphed, recoverable), which is the natural kid-safe
  form of the missing #11 risk axis. Pick *one*; don't ship all three.
- **Cognitive budget is the true ceiling, not the engine.** The hard cap is **2–3 enemy flags total**,
  each with an unmistakable glyph (spikes = armored → boom tower; halo/shimmer = evasive → precise
  tower; green pulse = regen → focus it). Beyond ~3, the reading load (Pattern G) exceeds a 5-year-old's
  budget and re-creates the overwhelm of #6/#7 in a new place. Onboard them one-at-a-time (KR/PvZ rule).
- **Readability is a prerequisite, not a follow-up.** Shipping affinity *without* the glyph + pre-wave
  telegraph would reproduce the exact current failure (the shield boss already has an ability with no
  tell and no counter — the player just loses lives, #3). Pattern G must land in the *same* change as
  Patterns A–F, or the depth is invisible.

### What it does and does NOT solve
- **Directly solves:** #9 (the two towers now have *non-overlapping, forced* jobs), #10 (each wave's
  flag-mix is a different question), #5 (regen + burst make upgrade value *felt*; a control/slow
  upgrade branch makes the spend a visible identity change), #3 (boss leaks become *legible* — "it was
  shielded / it sped past because nothing slowed it").
- **Helps:** #2 (loss now teaches a specific, solvable lesson → informed replay).
- **Does NOT, by itself, solve:** #11 (risk to the player) *unless* the control ability is turned
  around to target the player's towers (Pattern D variant c). #4 (too much money) and #6/#7 (click/
  attention) are separate levers — though affinity helpfully spends the player's *clicks on decisions*
  rather than adding new ones.

### Bottom line
This category is the **best-fit, lowest-perf-risk depth lever** for the two strongest feedback signals
(#9, #10), it is mostly *connecting and surfacing mechanics CuteDefense already has*, and it stays
inside every hard constraint **provided** it ships as: soft (multiplier) 2-way affinity, 2–3
glyph-legible enemy flags introduced one at a time, the readability/telegraph layer in the same change,
and the control role delivered as an upgrade branch *or* one ability *or* an enemy ability — never as a
third tower.

---

## Sources

**On-disk depth-pass briefs (primary synthesis):**
- `v2/docs/depth-pass/research/external/kingdom-rush-series-.md` (§1 damage types, §2 specialization,
  §6 enemy traits, §11 attention) — `[kr]`
- `v2/docs/depth-pass/research/external/bloons-td-6.md` (§2 damage types × bloon properties, §4
  targeting priority) — `[btd6]`
- `v2/docs/depth-pass/research/external/plants-vs-zombies.md` (§4 plant roles / RPS, §9 show-don't-tell)
  — `[pvz]`
- `v2/docs/depth-pass/research/external/gemcraft-series-.md` (§4 gem colors as verbs incl. slow/stun) —
  `[gc]`
- `v2/docs/depth-pass/research/external/defense-grid-the-awakening.md` (§2 counter roster, §3 orthogonal
  traits + support enemies, §5 Tactical Recon telegraph) — `[dg]`
- `v2/docs/depth-pass/research/v2/enemies-waves-formations-bosses.md` (current-state ground truth)

**Web (fresh):**
- [Engineering the Next Generation of Tower Defense Games — Game-Ace][ga]
- [Bloons Wiki — Damage Types](https://bloons.fandom.com/wiki/Damage_Types) · [Bloon Properties](https://bloons.fandom.com/wiki/Bloon_Properties)
- [Kingdom Rush Wiki — Magic Resistant Enemies](https://kingdomrushtd.fandom.com/wiki/Category:Magic_Resistant_Enemies)
- [What are TDSSKiller's best TDS strategies & tower loadouts][tds]

[kr]: ../external/kingdom-rush-series-.md
[btd6]: ../external/bloons-td-6.md
[pvz]: ../external/plants-vs-zombies.md
[gc]: ../external/gemcraft-series-.md
[dg]: ../external/defense-grid-the-awakening.md
[ga]: https://game-ace.com/blog/engineering-of-tower-defense-games/
[tds]: https://tdsskiller.com/what-are-tdsskillers-best-tds-strategies-and-tower-loadouts/
