# Bloons TD 6 — Depth-Mechanics Research Brief

> Source game: **Bloons TD 6** (Ninja Kiwi, 2018, still actively updated through v40+).
> Purpose: mine transferable *depth* mechanics for **CuteDefense V2**, a kid-friendly (ages ~5–10), static-hosted, deterministic, **2-tower minimal** TD.
> Lens throughout: **the WHY** — what strategic decision or sustained engagement each mechanic creates, and **how it manages player attention / click-load** (critical for young kids).

BTD6 is the single most-studied tower-defense game on the market and the gold standard for *depth without a backend* — it is fundamentally a deterministic, offline-capable simulation (rounds are fixed, hand-authored bloon sequences; no procedural RNG in the threat). That makes it unusually relevant to CuteDefense's hard constraints (seeded sim, fixed waves, no server). The lessons below are deliberately filtered: BTD6 has ~23 towers and 60+ upgrade tiers; CuteDefense has **2 towers**. So the goal is not "copy the tree" — it's to extract the *design primitives* that generate decisions, then ask how each survives radical simplification.

---

## 1. The Three-Path Upgrade System + Crosspathing (the core depth engine)

### What it is
Every tower has **three upgrade paths** (called Top / Middle / Bottom). The hard rule:

- You may take **one path to Tier 5** (the "main" path), **a second path to Tier 2 max**, and the **third path is locked to Tier 0**.
- The lock is *triggered*: the moment you put upgrades into two different paths, the unused third path is permanently closed for that tower.
- A "**crosspath**" = the combination you chose, written like `5-2-0`, `0-2-4`, `2-0-5`, etc.

### Why it creates depth
This is the heart of BTD6. A single tower type becomes **many distinct tools** depending on the crosspath:

- **Dart Monkey** paths: Path 1 = *pierce* (hit more bloons per shot), Path 2 = *attack speed / DPS*, Path 3 = *range + projectile behavior*. So a `2-0-0` dart is a wide-pierce popper; a `0-2-0` is a fast single-stream DPS dart; the same base tower, opposite roles.
- Even **the small Tier-1/Tier-2 "crosspath" upgrades change behaviour, not just numbers.** Classic example: the cheap Path-2 Tier-1 on many towers adds attack speed; the Path-3 Tier-1 adds range. Players learn that "the *second* point you spend reshapes the tower" — the choice is real even at low cost.
- Top-tier (T4/T5) upgrades are **build-defining transformations** (a Dart Monkey's T5 "Crossbow Master" is a different weapon than "Ultra-Juggernaut"), not stat bumps. The fantasy escalates visibly.

### The key transferable insight
**The decision isn't "do I upgrade?" — it's "*which way* do I specialize, and what do I give up?"** The locked third path means every upgrade is a *commitment with an opportunity cost*. That's what makes upgrading feel meaningful instead of a money sink.

> **CuteDefense relevance (directly answers grownup symptom #5 "did upgrading even help?" and #9 "what's the difference between the 2 towers?"):**
> With only 2 towers and 3 linear levels each, CuteDefense currently has *no branching* — upgrading is a pure number-go-up with no tradeoff, so the player can't *feel* the decision. A minimal port of crosspathing: give each of the 2 towers a **single binary fork at one level** (e.g. at Level 2, choose "Reach" vs "Rapid" for basic; "Bigger Boom" vs "Faster Reload" for strong). One fork, two icons, kid-legible. That converts an invisible upgrade into a *visible identity choice* — and makes the two towers feel like four roles without adding tower types or violating the 2-tower minimalism.

---

## 2. Damage Types vs Bloon Properties — the "rock-paper-scissors" that forces layout thinking

This is BTD6's second depth pillar and the most directly transferable to "**every wave should need a different strategy**" (grownup symptom #10).

### Damage types (what towers deal)
~11 offensive types. The ones that matter for the logic:

| Damage type | Cannot hurt… |
|---|---|
| **Normal** | (nothing — hits everything) |
| **Sharp** (darts, blades) | **Lead**, **Frozen** |
| **Explosion** | **Black** |
| **Cold / Ice** | **White**, **Lead**, **Zebra** (and can't hit Frozen unless "Glacier"/"Shatter" subtype) |
| **Energy / Magic** | **Lead**, **Purple** |
| **Plasma** | **Purple** |
| **Fire** | **Purple** (plus a burn DoT) |

### Bloon properties (what enemies *are*)
These are **modifiers layered onto any bloon**, not separate enemy types:

- **Camo** — invisible to towers without *camo detection*. Projectiles phase through and do zero damage. Demands the player has *at least one* detector, or the wave leaks entirely.
- **Lead** — immune to Sharp, Energy, Ice. Needs Explosive or Fire.
- **Purple** — immune to Energy, Fire, Plasma. (The "anti-magic" bloon.)
- **Black** — immune to Explosions. **White** — immune to Ice. **Zebra** — immune to both (black+white).
- **Regrow** — regenerates popped layers every ~3s if not killed fast enough → punishes weak/slow defenses, rewards burst.
- **Fortified** — roughly doubles HP (on bloons and on blimps).
- **Ceramic** — first multi-HP bloon; a "tanky" tier.

### Why it creates depth (the WHY)
**No single tower covers everything.** A Sharp-only defense is hard-walled by the first Lead bloon. A magic defense dies to Purple. This forces:

1. **Coverage planning** — the player must field a *mix* of damage types, so the board becomes a deliberate composition, not "spam the best tower."
2. **Wave reading** — players learn the fixed rounds ("round 28 brings the first Lead, round 24 the first Camo") and *pre-build the counter*. Anticipation is the engagement loop.
3. **The properties are composable**, so the game gets exponential variety from a tiny vocabulary: Camo+Lead+Regrow on a Ceramic is one enemy made of four orthogonal threats (this is literally the **DDT**). **Huge variety from ~6 boolean flags.**

> **CuteDefense relevance — this is the single highest-value transfer.** CuteDefense's grownup-feedback #10 is "all waves feel the same, just more." BTD6's answer is *property flags*, not new enemy types. With 2 towers, the cleanest minimal port:
> - Give **basic** = "sharp/precise" identity and **strong** = "boom/splash" identity, then introduce **2 enemy flags** that map onto them: an **armored** enemy (only the strong tower's boom hurts it much — answers "which tower, does it matter?") and a **shielded/"sneaky" or flying** enemy (only basic's fast precise shots reliably hit it). Now each wave's *mix of flags* dictates the tower ratio and placement — different strategy per wave, with zero new towers.
> - Keep it to **2–3 flags max** for kids, each with an unmistakable visual (spikes = armored, halo/shimmer = shielded). The rule a 6-year-old learns: "spiky ones need the boom tower." That's a real strategic read at a kindergarten cognitive budget.
> - **Regrow** is also worth porting as a "heals if you're too slow" enemy — it teaches *burst vs trickle* and makes upgrade investment visibly pay off (answers symptom #5).

---

## 3. MOAB-Class Bloons — bosses done as *layered, predictable* threats

BTD6's "bosses" are the **MOAB-class blimps**, and the design is instructive because they answer grownup symptoms #2/#3 ("losing to the boss made me replay" but "why does it take so many lives?").

### The hierarchy (each pops into children of the tier below)
- **MOAB** — 200 HP → spawns **4 Ceramics**.
- **BFB** — 700 HP → spawns **4 MOABs**.
- **ZOMG** — 4,000 HP → spawns **4 BFBs**.
- **DDT** — 400 HP, but is *Camo + Lead + Black* simultaneously → spawns 4 Camo-Regrow-Ceramics. (The "you need broad coverage or it walks through you" boss.)
- **BAD** — ~20,000 HP (40k fortified) → the apex.

### Why it works as a design
1. **Layered death, not instant.** A boss doesn't vanish when its HP hits zero — it *peels* into a burst of children. This makes a boss a **multi-stage event**: the player sees progress (the shell cracks) *and* faces a follow-up surge they must have prepared for. Far more satisfying and readable than a single fat HP bar.
2. **Predictable HP and contents.** Because rounds are fixed and deterministic, the player can learn exactly what a boss carries and *plan*. Losing teaches a specific lesson ("I had no Lead coverage"), which is what drives the *replay* impulse — the loss feels *solvable*, not arbitrary.
3. **The boss is a coverage exam.** The DDT in particular is the game testing whether you built a *complete* defense. The challenge is composition, not reflexes.

> **CuteDefense relevance:**
> - The current secret wave-16 split boss already uses the *peel-into-children* idea (splits into 3 shards) — that instinct is correct and matches BTD6's best boss design. Lean into it: **make the regular wave-5/10/15 bosses peel into a small, telegraphed burst** so the player *sees* what's coming and learns to pre-build. This directly fixes "why does the boss eat so many lives?" — right now the boss is opaque; a peeling boss is *legible* (you watch the shell crack, you see the 3 babies, you understand the leak).
> - **Make boss difficulty a *coverage check*, not an HP wall.** Tie the wave-5 boss to one enemy flag (e.g. it's *armored* → you needed the strong tower). Then losing teaches "I should have built a boom tower," which is exactly the *replay-with-a-plan* loop the grownup felt at wave 5. An HP sponge teaches nothing.

---

## 4. Targeting Priority — cheap, set-and-forget control that adds tactical depth

Every attacking tower exposes a **targeting priority** toggle. Standard options:

- **First** — the bloon furthest along the track (default). Best for "don't let leaks through."
- **Last** — the bloon least far along. Good for setups that want to hold bloons back / let other towers finish.
- **Close** — nearest bloon to the tower. Good for area/chokepoint towers.
- **Strong** — highest-HP bloon in range. The key one: concentrates single-target damage onto blimps/bosses instead of wasting it on fodder. Ties broken toward "First."
- Plus tower-specific specials (e.g. Sniper's **Elite**, Ace's set-path/patrol points, etc.).

### Why it adds depth without adding clicks
- It's a **one-tap, persistent setting** — you set it once and the tower obeys for the rest of the game. **Zero ongoing micro**, but it can be the difference between a tower wasting all its damage on the first weak bloon vs. focusing the boss.
- It teaches a real tactical concept (focus fire vs. cleanup) through a single discrete choice.
- The default (**First**) is the safe, no-knowledge-required option, so beginners never *have* to touch it — depth is **opt-in**.

> **CuteDefense relevance (relevant to symptom #6 "too much to click"):**
> Targeting priority is a model for **depth that costs no ongoing attention**. A radically minimal version for kids: a per-tower **"aim" toggle with just two states** — a **First/leader icon** (default, "shoot the one about to escape") and a **Strong/biggest icon** ("gang up on the big one"). Two icons, set once, persistent. It gives the player a real lever during boss waves *without* the per-frame clicking that's currently overwhelming them — and it teaches focus-fire, a transferable concept. Skip Last/Close; they're too abstract for the age band.

---

## 5. Heroes — one auto-leveling "character" tower that anchors a run

Heroes are BTD6's answer to "give the player a personality + a power button without adding micro."

### How they work
- **Exactly one hero per game**, placed like a tower. You pick *which* hero before the run.
- **No upgrade tree.** Heroes **auto-level (1→20) from XP earned just by rounds passing.** Higher difficulty = faster leveling. You *can* pay cash to instant-level, but you never *have* to.
- **Abilities unlock automatically** at fixed levels (typically a weaker, short-cooldown ability at **level 3** and a stronger, long-cooldown one at **level 10**; a few heroes get a third at level 7). Abilities are **manually activated** (one button, on cooldown).
- Each hero has a **distinct strategic identity**:
  - **Quincy** — straightforward damage, bouncing arrows; the beginner default.
  - **Gwendolin** — fire/burn, anti-grouped-bloon.
  - **Obyn Greenfoot** — buffs magic/nature towers; a *support* identity.
  - **Striker Jones** — buffs explosive towers.
  - **Benjamin** — pure **economy** hero: generates income, hacks, *can't even attack* — picking him is a whole-run strategy commitment.
  - **Ezili / Adora** — high-risk/high-reward (Adora literally *sacrifices your own towers* for huge XP).

### Why it's brilliant for attention/click-load
- **It's depth you choose at the menu, then mostly *receive*.** The hero levels itself; the only ongoing interaction is occasionally tapping one ability button. This is the cleanest example in the genre of **"front-loaded decision, back-loaded automation."**
- It gives a run an **identity and a narrative anchor** (a face, a voice, a power fantasy) which is enormously engaging for kids — but adds **at most one button** to the per-round click budget.
- The pre-game hero pick is a *meta* strategic layer that shapes the whole run (economy hero vs. damage hero vs. support hero) without complicating the in-round UI.

> **CuteDefense relevance (directly addresses symptoms #6, #7, #11):**
> A "hero" pattern is a strong fit for CuteDefense's overwhelm problem. The player is currently drowning in placing/upgrading (symptoms #6, #7). A single **auto-leveling buddy/mascot** that the player picks at the start and that **acts mostly on its own** (with *one* tappable "special" on a cooldown) would:
> - add a charming character for kids (high engagement, on-brand "cute"),
> - introduce a meta choice (which buddy?) without adding in-round clicks,
> - and create the **risk-to-the-player** that symptom #11 says is missing — e.g. a buddy that can be *temporarily knocked out* and must recover, giving the player something *of theirs* that's actually threatened, without making towers destructible (which the spec forbids).
> Keep abilities to **one button on a generous cooldown** — the BTD6 "level 3 weak / level 10 strong" cadence is more than kids need.

---

## 6. Economy as a decision (Banana Farm) — *spend-vs-save tension*

In BTD6 you can spend money on **defense now** or on **Banana Farms / income towers** that pay back over time. This "**farming**" loop is the spine of high-level play: the player constantly weighs "can I afford to invest in economy this round, or will I leak?" Harder modes literally *cannot be beaten* on popping income alone — you *must* farm. Income towers like the Merchantman cleverly **double as defense + economy**, easing the tension.

### Why it matters
- It turns money into a **second resource-management game** layered on placement. Every coin is a fork: power now vs. more power later.
- The risk (a farm is a tower that doesn't shoot) creates genuine tension and reward.

> **CuteDefense relevance (directly addresses symptom #4 "why do I have so much money?"):**
> The grownup had *too much* money and nothing meaningful to spend it on — the economy has **no sink and no decision**. BTD6's lesson is that **money needs a competing use**. Options that fit 2-tower minimalism:
> - A simple **save-vs-spend tension**: make the *interesting* upgrades (the forks from §1) genuinely expensive, so the player must choose between *more towers* and *better towers*.
> - **Coin collection is already a manual tap** in CuteDefense (15s lifetime). That's a click-load *cost* with little payoff right now. Consider either an auto-collect "buddy" (see §5, mirrors BTD6's "banana farmer" auto-collect power) **or** make the manual collection a *real* risk/reward (uncollected coins expire → leaking money is a punishment), so the tap *means* something. Don't keep a click that isn't a decision.

---

## 7. Activated Abilities + Auto-Play — how BTD6 caps click-load

The most relevant attention-management findings for a kids' game:

- **Activated abilities** are powerful, manually-triggered effects on **long cooldowns** (not per-shot micro). High-level players *micro* them for big gains, but the floor is "tap occasionally."
- BTD6 ships an explicit **"Tech Bot" auto-play power** that **automatically fires abilities for you** — an opt-in that *removes* the micro entirely for beginners. The game deliberately provides a **"depth off" switch.**
- The whole design philosophy: **towers are autonomous.** You place and upgrade; they fight on their own. The per-round interaction is *low* by default and *scales up only if the player wants it to.*

> **CuteDefense relevance (this is THE fix for symptoms #6 and #7 — "too much to click," "can't even see the enemies"):**
> CuteDefense's overwhelm comes from the *active* loop being placement+upgrade+coin-collection *all at once, every wave*. BTD6's counter-principles:
> 1. **Default to autonomy.** Towers should be fully fire-and-forget (they are). The *player's* per-wave job should shrink to ~1–2 meaningful taps.
> 2. **Move decisions to the gaps.** BTD6 lets you build/upgrade *between* rounds at your own pace (and even pause). A kid-friendly **build phase between waves** (place/upgrade calmly) followed by a **watch phase** (just watch your towers fight, maybe one ability tap) would *let the kid actually see the enemies* (symptom #7) and kill the frantic mid-wave clicking (symptom #6).
> 3. **Provide a "depth off" path.** Auto-collect coins, optional ability — make the advanced levers *opt-in*, never required.

---

## 8. Paragons — the endgame "merge" (aspirational, probably out of scope)

For completeness: BTD6's newest top-end mechanic. To build a **Paragon**, you must have **all three Tier-5 versions of the same tower** on the map at once; they **merge into one super-tower** whose strength ("**Degree**", up to 100) scales with how much investment fed it. It's the ultimate expression of the three-path system (you literally combine all three paths into one).

> **CuteDefense relevance:** Mostly *aspirational / out of scope* for a minimal kids' game, but the *primitive* is worth noting: **a long-horizon "fuse your towers into something awesome" goal** is a powerful hook. A featherweight echo could be a single **"Level 3 → Level MAX golden tower"** celebratory tier that requires real saving — a visible aspirational carrot that gives money a late-game sink (ties back to symptom #4). Treat as a stretch idea, not core.

---

## Cross-cutting principles (the meta-lessons)

1. **Big variety from small composable vocabularies.** BTD6 gets near-infinite wave variety from ~6 boolean *bloon properties* × a damage-type table — not from hundreds of enemy types. *This is the model for CuteDefense's "every wave is different" goal at minimal cost.*
2. **Every upgrade is a commitment with an opportunity cost.** The locked third path is why upgrading *feels* like a decision. Number-go-up alone (CuteDefense today) feels empty — add *one fork* to make it matter.
3. **Bosses are coverage exams that peel, not HP walls.** Layered/peeling bosses are legible and teach a specific, solvable lesson → drives replay.
4. **Depth is opt-in; the floor is low-click.** Sane defaults (First targeting, autonomous towers, optional auto-play) mean beginners are never forced into micro. *This is the template for keeping a kids' game un-overwhelming while still deep.*
5. **Front-load decisions, back-load automation.** Heroes and build-phase pacing put the *thinking* in calm moments and let the *action* run itself. Perfect for short attention spans.
6. **Determinism enables anticipation.** Because rounds are fixed (like CuteDefense's hand-authored waves), the player can *learn and plan* — anticipation is the engagement engine. CuteDefense's fixed waves are an asset; surface what's coming so kids can plan.

---

## Sources

- [Crosspathing — Bloons Wiki](https://bloons.fandom.com/wiki/Crosspathing)
- [BTD6 Crosspathing Guide — Mobile Game Master](https://mobilegamemaster.com/btd6-crosspathing-guide/)
- [Crosspathing / Dart Monkey — Bloons Wiki](https://bloons.fandom.com/wiki/Crosspathing/Dart_Monkey)
- [Upgrades — Bloons Wiki](https://bloons.fandom.com/wiki/Upgrades)
- [Damage Types — Bloons Wiki](https://bloons.fandom.com/wiki/Damage_Types)
- [Damage type — Blooncyclopedia](https://www.bloonswiki.com/Damage_type)
- [Bloon Properties — Bloons Wiki](https://bloons.fandom.com/wiki/Bloon_Properties)
- [What Pops Every Bloon — Basically Average](https://basicallyaverage.com/what-pops-bloons/)
- [MOAB-Class Bloon — Bloons Wiki](https://bloons.fandom.com/wiki/MOAB-Class_Bloon)
- [Regrow Bloon — Blooncyclopedia](https://www.bloonswiki.com/Regrow_Bloon_(BTD6))
- [Fortified Bloon — Blooncyclopedia](https://www.bloonswiki.com/Fortified_Bloon_(BTD6))
- [Targeting Priority — Bloons Wiki](https://bloons.fandom.com/wiki/Targeting_Priority)
- [Heroes (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Heroes_(BTD6))
- [Looking at: Heroes — Steam Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2536456970)
- [BTD6 Heroes Guide — Basically Average](https://basicallyaverage.com/btd6-heros/)
- [Income Farming (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Income_Farming_(BTD6))
- [Complete Guide to Banana Farms — bloon.games](https://bloon.games/complete-guide-to-banana-farms-in-btd6/)
- [Activated Abilities (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Activated_Abilities_(BTD6))
- [Rounds (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Rounds_(BTD6))
- [Most Important Rounds — Steam Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3079616074)
- [Paragons — Bloons Wiki](https://bloons.fandom.com/wiki/Paragons)
- [Bloons TD 6 — Wikipedia](https://en.wikipedia.org/wiki/Bloons_TD_6)
