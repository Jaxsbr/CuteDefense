# Plants vs. Zombies — Depth Mechanics Research Brief

**Purpose:** Mine transferable depth + attention-management mechanics from *Plants vs. Zombies* (PopCap, 2009, designed by George Fan) for **CuteDefense V2**. Focus is on the *why* behind each mechanic — the strategic decision or sustained engagement it creates — and on how PvZ keeps cognitive/click load low for an audience that explicitly includes young/casual players.

PvZ is the gold standard here: it is a tower-defense game that George Fan deliberately engineered to be **learnable by total non-gamers** while staying deep enough for hardcore players. That is almost exactly CuteDefense's brief (ages 5-10, charming, minimal, low click-load, but with real strategic depth). Many of the grownup-playthrough complaints CuteDefense received are problems PvZ explicitly solved.

---

## 1. The Sun Economy — *why an active, scarce, attention-grabbing resource*

**What it is.** The single currency is **sun**. You get it two ways:
- **Sky drops:** sun balls fall from the sky at regular but infrequent intervals (worth ~25 each). You must **manually click each one to collect it**, and uncollected sun fades.
- **Producer plants:** Sunflowers generate ~25 sun every ~24s for a fixed cost (50 sun, halved to 25 after early tuning — see §9).

**Why manual collection matters (the *why*).**
- It makes the economy an **active mini-game inside the defense game**, not a passive number that ticks up. "Players who click faster generate resources quicker," so collection becomes a light skill expression and keeps hands/eyes busy during the calm setup phase.
- Crucially it is a **deliberate, satisfying micro-reward loop** (the click → coin sound → number goes up) that PvZ uses to keep idle hands engaged without adding decisions.
- Sky drops alone are **deliberately insufficient** to survive — "getting sun from only the sky is insufficient to provide the sun needed to survive the attack." This forces the player into the economy-vs-offense decision (§2).

**The core scarcity tension.** Sun gates *both* purchasing power *and* progression pace. You never have enough to do everything, so every sun ball is a real choice: spend now on offense, or invest in a Sunflower for more sun later?

> **CuteDefense relevance — directly addresses feedback #4 ("Why do I have so much money?").** CuteDefense already has manual coin-tapping (good — same satisfying loop), but the *economy is too loose*: the player ends up swimming in coins. PvZ's lesson is that the resource must stay **scarce relative to desire** the entire game. If the player can afford everything, every purchase decision evaporates and so does the strategy. The fix isn't "give less money," it's "always make the player want more than they can afford" — i.e. there must be a compelling *sun-producer-equivalent investment decision* competing with offense for every coin (see §2 takeaway).

---

## 2. Sunflower-vs-offense — *the single best "meaningful decision" in the genre*

**The decision.** Early each level you face one repeated dilemma: spend your first suns on **Sunflowers** (economy — pays off later, but does nothing to stop zombies *now*) or on **Peashooters/Potato Mines** (offense — survive the next 30s, but your economy stays flat).

**Why it's deep.**
- It's a **risk/reward investment curve**. Over-invest in Sunflowers and an early rush kills you before they pay off. Under-invest and you're economically starved by the late waves. The "right" ratio shifts per level and per the threat you can see coming.
- Veteran heuristic: "use sunny phases for setup only — spend sun exclusively on Sunflowers and cheap insta-kills early, then deploy heavy hitters once you can afford them." That's a genuine **build-order** the player discovers, the kind of emergent strategy that gives a simple game replay depth.
- It produces a **positive-feedback economic engine** the player builds and protects, which makes the economy feel *earned* rather than handed out.

**Board-space cost.** Sunflowers occupy grid tiles (usually the back columns). So economy literally competes with offense for *space*, not just sun. More economy = less room for guns = a spatial as well as temporal tradeoff.

> **CuteDefense relevance — fixes #4 AND #5 ("did upgrades actually help?").** CuteDefense has *no economy-building decision at all* — coins only come from kills, so the only choice is "which gun." Adding a producer-style investment (a tower or structure that increases coin income, paid for now, paying off later) would (a) absorb the surplus money, (b) create the Sunflower dilemma every match, and (c) give the player a clearly legible payoff ("my income went up") which is exactly the legibility that upgrades currently lack. Keep it to **one** such option to respect the 2-tower minimalism.

---

## 3. Lane defense — *parallel, semi-independent puzzles that demand reallocation*

**What it is.** The lawn is a grid of **5 rows (lanes) × 9 columns** (6 lanes in pool levels). Zombies stay in their lane and walk straight left. Plants only affect their own lane (mostly). So the board is **5 simultaneous, semi-independent mini-defenses**.

**Why it creates depth.**
- **Threat triage / resource reallocation.** Zombies don't arrive evenly — a level might dump a heavy push in lane 3 while lane 1 is quiet. The player must constantly decide *where* to spend the next plant, robbing quiet lanes to reinforce hot ones. This is the core moment-to-moment decision.
- **Lane specialization.** Advanced play assigns *roles to lanes*: e.g. garlic on lanes 1/3/5 to **divert** zombies into lanes 2/4 where you've concentrated firepower (Torchwood). Players invent layered, board-wide plans.
- **Legible spatial reasoning.** Because lanes are independent and zombies move in straight lines, a 5-year-old can *see* "the zombie is in this row, my plant in this row shoots it." Cause and effect is spatially obvious — no hidden targeting logic.

**Contrast with CuteDefense's pathing.** CuteDefense uses a single winding path (Ribbon/Comb maps) with free tower placement on open tiles. That's a different, also-valid TD lineage (the "maze/coverage" school). PvZ's lane model is worth understanding as the *opposite pole*: extreme spatial legibility and forced reallocation, at the cost of free placement.

> **CuteDefense relevance — informs #10 ("are all waves the same?") and #11 ("no risk to me").** You don't need to switch to lanes. But the *transferable principle* is **directional/positional pressure that forces reallocation**: waves should attack *different parts of the path* or arrive in distributions that make the player's current layout wrong, so they must move/sell/re-place. A single static optimal layout that beats every wave is the enemy of depth.

---

## 4. Plants have distinct ROLES — *not "better gun, worse gun" but rock-paper-scissors*

PvZ's ~49 plants fall into clearly readable **role categories**, and the depth comes from the fact that **no single plant solves everything**:

| Role | Examples | Sun cost | Strategic purpose / tradeoff |
|---|---|---|---|
| **Sun producer** | Sunflower, Sun-shroom | 50 / 25 | Economy engine; zero combat value, pure investment |
| **Long-range shooter** | Peashooter, Repeater, Snow Pea | 100-200 | Sustained DPS; Snow Pea also *slows* (utility) |
| **Short-range / splash** | Fume-shroom, Cabbage-pult | 75-100 | Hits multiple/through shields; weak alone |
| **Instant-kill (single use)** | Cherry Bomb, Potato Mine, Squash, Jalapeño | 25-150 | Emergency button / cheap early defense; long recharge |
| **Defensive wall** | Wall-nut, Tall-nut | 50 | Absorbs bites, buys time (§5); no damage |
| **Utility / debuff** | Snow Pea (slow), Magnet-shroom (steal metal), Torchwood (buffs peas) | varies | Combo enablers; situational counters |
| **Environment modifier** | Lily Pad, Flower Pot, Spikeweed | 25-100 | Enables placement on water/roof; ground denial |

**The rock-paper-scissors layer (the *why* roles matter).** Specific zombies *hard-counter* specific plant choices, so the player must bring the right tool:
- **Screen Door Zombie** carries a shield that blocks projectiles → countered by **Fume-shroom** (fumes pass through) or **Magnet-shroom** (steals the door). Peashooters are useless against it.
- **Buckethead / Football** have armor → need concentrated burst (Gatling, Cherry Bomb) or Magnet-shroom to steal the metal.
- **Pole Vaulter** jumps your first plant → put a cheap throwaway (Potato Mine) or a **Tall-nut** (can't be vaulted) up front.
- **Balloon Zombie** flies over ground defenses → only **Cactus** (or Blover) hits it.

This is why "which plant?" is a *real* question every level: the answer depends on which zombies that level brings.

> **CuteDefense relevance — directly hits #9 ("are there only 2 towers? what's the difference, does it matter which I use?").** This is the deepest lesson for CuteDefense. Today the two towers are "fast/cheap single-target" vs "slow AoE+bomb" — that *is* a real role distinction (single-target DPS vs crowd control), but it isn't being *taught* and isn't being *forced*. PvZ's fix is twofold: (1) **make the visual scream the role** (Peashooter's big mouth = it shoots; Wall-nut = it's a wall — see §8/#9 design tip), and (2) **author enemies that punish using the wrong one** — e.g. a tight swarm that *demands* the AoE tower, or a single armored fast-mover that *demands* the single-target tower. With only 2 towers you can absolutely make a clean rock-paper-scissors: per-wave, one tower is clearly correct. That converts "does it matter which I use?" from a shrug into the central decision.

---

## 5. Zombies EAT your plants — *the risk-to-defenses that CuteDefense is missing*

**What it is.** When a zombie reaches one of your plants, it **stops and eats it** (with the iconic chomp). Most plants take only ~5-6 bites to be destroyed; once eaten, the plant is **gone** (sun spent, board slot lost). Only the **Wall-nut** is built to be eaten — 4000 HP, ~40 bites, and it **visually cracks** in 3 stages so you can see how close it is to failing.

**Why this is the single most important risk mechanic.**
- **Your investments are at stake, not just your life total.** In CuteDefense, towers are invulnerable, so the only thing at risk is the abstract "lives" counter. In PvZ, a breach destroys *the thing you spent your scarce sun on*, often a Sunflower (your economy) — a far more painful, *legible* loss. The player viscerally feels "I'm losing what I built."
- **It creates a defensive-depth puzzle.** Because plants are fragile, you must put **expendable buffers in front of valuable plants**. Wall-nuts "convert sun into time" — they stall the zombie so your shooters (and economy) survive. This is the layered-defense decision: front-line meat, mid-line guns, back-line economy.
- **Graceful, readable failure.** The Wall-nut's 3-stage cracking is *advance warning* — the player sees the wall failing and can react (plant a second Wall-nut in front, redirect fire). Risk is telegraphed, not sudden.
- **Repair as an ongoing decision.** You can re-plant/refresh a damaged Wall-nut, so maintaining your front line is a recurring sun sink — more for the economy to do.

> **CuteDefense relevance — directly hits #11 ("there's no risk to me; I place towers safely out of the way; enemies can't destroy my towers") and #3 ("why does the boss take so many lives?").**
> This is the highest-value transfer. Options, in increasing order of departure from current design:
> 1. **Telegraphed, recoverable tower disabling.** Certain enemies (or bosses) can *temporarily disable* a tower they pass adjacent to (stun/web), with a visible cracking/timer — not permadeath, but the player must react. Kid-friendly: the tower "gets dizzy" for a few seconds, not destroyed.
> 2. **A buffer/wall structure** the player can place in the path that enemies attack-and-destroy (the Wall-nut analogue), buying time. This adds the "expendable front line vs protected back line" decision *and* gives money something to do.
> 3. **Boss that specifically targets/eats** the nearest tower — reframing #3: instead of a boss draining many *lives* (which feels arbitrary and invisible), it threatens *your towers* (visible, painful, forces relocation). This makes the wave-5 boss the memorable, replay-driving moment it already half-is (feedback #2), but for a *legible* reason.
> The key constraint to preserve: **risk must be telegraphed and recoverable** for a 5-10 audience. PvZ never has a plant silently vanish — it cracks, it chomps audibly, and the lawnmower (§7) is a final safety net.

---

## 6. Seed selection + recharge cooldowns — *pre-commitment and forced rhythm, which also CAP click-load*

**Two coupled systems:**

**(a) Pre-level seed selection (loadout).** Before a level you pick a **limited set** of plants (6 slots base, expandable to 10) from your whole collection. You cannot change mid-level.
- **Why deep:** it's a **pre-commitment / deck-building** decision. You must read the level (which zombies?) and bring the right counters (§4). Bring the wrong loadout and you can lose before you start. This front-loads strategy into a calm, no-time-pressure moment.

**(b) Recharge cooldowns.** After you plant something, *that plant type* must **recharge** before you can plant another. Speeds are tiered: fast (~7.5s), slow (~20s), very slow (~35s); Potato Mine ~16s; Cherry Bomb very slow.
- **Why deep:** prevents the dominant "spam the best plant" strategy. You *can't* just drop ten Cherry Bombs. You must **weave** cheap fast-recharge plants between expensive slow ones, and **pre-plant** insta-kills *before* you can see the threat (prediction, not reaction).

**The attention/click-load angle (critical for kids).**
- Recharge cooldowns **physically cap how many actions the player can take per second.** You literally cannot click faster than the game lets you act. This is a built-in **anti-overwhelm governor** — the game paces *itself*.
- Limited seed slots cap the number of *things to think about* on screen at once. Fewer buttons = less analysis paralysis.

> **CuteDefense relevance — directly addresses #6 ("I can't keep up placing and upgrading towers — too much to click") and #7 ("I can't even see the enemies — too busy placing towers").**
> These two complaints are a **pure click-load / pacing failure**, and PvZ's cooldown system is the textbook fix. If CuteDefense towers/upgrades have little to no placement cooldown, an engaged player feels *obligated* to spam-click constantly, drowning the actual gameplay (watching enemies). Introducing a **per-tower placement/upgrade cooldown** (a) caps frantic clicking, (b) forces the calm "set up, then watch it work" rhythm PvZ has, and (c) makes each placement a more considered decision. The deeper principle: **the game should *limit* the player's action rate so there's deliberately idle time to watch and enjoy the spectacle.** A kid-friendly TD wants long stretches of "I built it, now I watch my towers do their thing," punctuated by occasional decisions — not a clicking treadmill.

---

## 7. The Lawnmower — *a forgiving, legible last line of defense*

**What it is.** Each lane has one **lawnmower** parked at the far-left edge. If a zombie reaches the house in that lane, the mower **auto-fires once**, clearing the *entire lane* of zombies (kills even the biggest boss in one pass). Then it's **used up** — that lane has no more safety net.

**Why it's brilliant design.**
- **Forgiveness without removing stakes.** A single breach doesn't end the run — but it consumes a one-time resource, so you've *paid* for the mistake and the next breach in that lane is fatal. The player gets a second chance *and* a clear warning.
- **It makes failure legible and fair.** You can *see* which lanes still have their mower. You know exactly how much margin you have. Losing never feels like a cheap surprise.
- **It lowers the floor for kids/novices** (you survive your early fumbles) **without lowering the ceiling** (experts treat using a mower as a real loss and play to never trigger one).

> **CuteDefense relevance — reframes #3 ("why does the boss take so many lives?").** CuteDefense's "12 lives" is an *abstract, invisible* buffer — the player can't see it being spent or understand *why* a boss costs 5 of them. PvZ shows the alternative: a **small number of visible, physical safety-nets** is far more legible than a big abstract HP bar. Consider whether CuteDefense's "lives" could be made *visible and physical* (e.g. a few guardian charges at the base that the player watches get consumed), so losing feels fair and the boss's threat is *seen*, not just subtracted. Telegraphed + recoverable + visible = the kid-friendly difficulty contract.

---

## 8. Per-level gimmicks & environments — *each level a unique puzzle, not "same but more"*

PvZ's 50 Adventure levels span **5 environments**, each fundamentally rewriting the rules — this is the antidote to "every wave is the same enemies, just more":

- **Day:** baseline — sun falls from sky (active collection).
- **Night:** **no sky sun.** You must generate *all* sun from plants. Completely changes the economy — Sunflower investment becomes mandatory, and cheaper Sun-shrooms become viable. Different build order entirely.
- **Pool (6 lanes):** adds water lanes where **nothing can be placed without a Lily Pad first** (a two-step placement gate) — except aquatic plants. Forces parallel land+water infrastructure. Adds Dolphin Rider (jumps a plant) and Snorkel zombies.
- **Fog:** the **right 3 columns are hidden** under fog. Enemies arrive *unseen*. You must rush sun to buy light plants (Plantern) or blow the fog away (Blover). Adds time pressure + visibility as a resource.
- **Roof:** the surface is **angled and has no soil** — regular straight shooters barely work; you need **catapult/lob plants** (Cabbage-pult) and Flower Pots to place anything. Invalidates the player's whole learned toolkit and forces a relearn.

**Plus dedicated variety modes** (Mini-games, Vasebreaker, I-Zombie, Survival, Last Stand, conveyor-belt levels) that invert the core loop entirely — e.g. *conveyor-belt levels* hand you random plants on a timer instead of letting you buy them (shifts cognitive load from economy to tactical placement), and *Wall-nut Bowling* turns the wall into a bowling-ball projectile.

**Why this works (the *why*).**
- Each environment **invalidates the previous optimal strategy**, forcing the player to think fresh. Mastery of one level doesn't trivialize the next.
- It keeps the **introduction of novelty constant** — there's always a new wrinkle to learn, which sustains engagement across 50 levels.
- Gimmicks are **single, legible rule-changes** ("night = no sky sun"), not piles of new systems. One idea per level keeps it learnable.

> **CuteDefense relevance — directly hits #10 ("are all waves the same enemies just more? every wave should have a unique challenge needing different towers/layouts/strategy").** This is the explicit goal CuteDefense stated, and PvZ is the model. The transferable pattern: **each wave/level should change ONE rule that invalidates a lazy layout** and rewards a specific response. With CuteDefense's 2 towers + 2 maps + formations (single/line/wedge/swarm/phalanx), you already have the ingredients — the gap is *authoring intent*. E.g.: a swarm wave that demands AoE; an armored single-boss wave that demands focused single-target; a fast-flanking wave that demands repositioning; a "fog"-style wave with reduced range; a wave that splits when hit (you have boss_split already!). The key is **one clear new constraint per wave, telegraphed before it starts**, so the player can plan a counter — turning each wave into a small puzzle rather than a numbers ramp.

---

## 9. Onboarding & attention management — *the kid-friendly masterclass*

George Fan explicitly designed PvZ to teach **non-gamers** without them noticing. From his GDC 2012 talk + design history, the principles most relevant to a 5-10 audience:

**Pacing the introduction of complexity:**
- **One new plant per level**, **one new zombie roughly every two levels.** Complexity is rationed so each new thing gets a clean, isolated introduction. The player is never handed a full toolbox at once.
- **Core systems are withheld until the player is ready** — sun-purchasing/conveyor and even some currency mechanics aren't introduced until ~level 10. Early levels are *literally unloseable* (1-1 won't spawn zombies until you've planted enough), giving a pressure-free sandbox to learn the basic verb (collect sun → plant).
- **Each level starts slow** (zombies one at a time) and escalates to a **telegraphed Final Wave.** Predictable rhythm: calm setup → escalation → climax. The player always knows where they are in the arc.

**Managing attention / click-load / text:**
- **Teach by doing, not reading.** "Once they see the results of their action, that's often all it takes." A single successful click teaches the concept.
- **Max ~8 words on screen at any time** ("eloquent caveman" principle). Brevity prevents cognitive overload — vital for early readers.
- **Adaptive, non-interrupting hints:** tips appear *only* for players doing the wrong thing; competent players see nothing and "feel smart." Guidance never pauses the game or nags.
- **Eliminate message noise** ("boy who cried wolf") — every message must inform or entertain, or the player tunes them all out.
- **Visuals encode function** ("show, don't tell"): Peashooter's big mouth = it shoots; Wall-nut looks like a wall; slow shambling zombies match cultural expectation. The player *infers* the role from the art — **zero text needed.**
- **Leverage real-world knowledge:** rooted plants obviously can't move; this makes the premise instantly intuitive.

> **CuteDefense relevance — hits #6, #7, #8, #9 and the whole "minimal, kid-friendly" mandate.**
> - **#8 ("everything getting squished — big towers overlap neighbors"):** PvZ's grid *guarantees* one plant per tile with no overlap, and growth is shown via *visual stages on the same footprint* (Wall-nut cracking, Sunflower upgrades) rather than physically expanding into neighbors. CuteDefense's leveled towers that "grow per level" and overlap are violating this — **a tower's footprint should not grow into adjacent tiles.** Show level via internal art/glow/crown, not bounding-box size.
> - **#9 ("what's the difference between the towers?"):** apply tip #9 — make the *art* scream the role. The single-target tower should *look* fast/pointy/precise; the AoE tower should *look* heavy/splashy/boomy. And add a one-line, ~8-word passive hint the first time each is relevant.
> - **#6/#7 (can't keep up / can't watch):** apply the cooldown governor (§6) + the "start slow, escalate" wave rhythm so there's built-in watching time.
> - **General:** ration new mechanics one per wave/level; keep on-screen text under ~8 words; teach through a single successful action; never silently punish.

---

## 10. Top transferable takeaways for CuteDefense V2

Ordered by impact against the grownup-playthrough feedback:

1. **Give the economy a real investment decision (Sunflower analogue).** One coin-producer option that competes with offense for every coin. Fixes "too much money" (#4) and makes upgrades' payoff legible (#5). Absorbs surplus, creates a build-order, all within the 2-tower minimalism (it's a structure, not a 3rd tower).

2. **Put the player's defenses at risk — telegraphed & recoverable.** Let some enemies/bosses *disable or threaten towers* (dizzy/stun with a visible timer), or add a destroyable buffer/wall the player places in the path. Fixes "no risk to me" (#11) and reframes the boss as a *visible* threat to what you built (#3). Never silent, never permanent — kid-safe.

3. **Author each wave as a one-rule puzzle that punishes the wrong tower/layout.** Swarm→AoE, armored solo→single-target, fast flank→reposition, split-on-hit, reduced-range. One telegraphed constraint per wave. Fixes "all waves the same" (#10) and makes the 2 towers' difference *matter* (#9).

4. **Add a placement/upgrade cooldown governor.** Cap the player's action rate so there's deliberate idle time to *watch* the towers work. Fixes "too much to click" (#6) and "can't see the enemies" (#7). Pace the game *for* the player.

5. **Make tower roles legible through art, not text.** Single-target tower looks precise/pointy; AoE looks heavy/splashy. One ~8-word passive hint on first relevance. Fixes "what's the difference?" (#9).

6. **Fix tower growth: stage the art, not the footprint.** Show level via internal glow/crown/detail on a *fixed* tile footprint — never expand into neighbors. Fixes "everything getting squished" (#8). (PvZ's cracking-Wall-nut / upgraded-Sunflower model.)

7. **Make difficulty fair and legible: telegraph, then forgive.** Visible safety-nets (lawnmower model) > big abstract HP buffers. Start each wave slow, escalate to a telegraphed finale, give advance warning of breaches (cracking visuals). Preserves the "lost to boss → want to replay" hook (#2) while removing the "why did that cost so much?" confusion (#3).

8. **Ration novelty: one new thing at a time.** Introduce one new enemy/mechanic per wave with a clean, low-pressure first appearance, escalating thereafter. Keeps a 5-10 audience learning without overwhelm.

---

## Sources

- [Sun | Plants vs. Zombies Wiki (Fandom)](https://plantsvszombies.fandom.com/wiki/Sun)
- [Plants vs. Zombies/Plants — StrategyWiki](https://strategywiki.org/wiki/Plants_vs._Zombies/Plants)
- [Characters in Plants vs. Zombies - Plants — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Characters/PlantsVsZombiesPlants)
- [Adventure Mode/Strategy guide | Plants vs. Zombies Wiki](https://plantsvszombies.fandom.com/wiki/Adventure_Mode/Strategy_guide)
- [Wall-nut (Plants vs. Zombies) | Plants vs. Zombies Wiki](https://plantsvszombies.fandom.com/wiki/Wall-nut_(PvZ))
- [Plants vs. Zombies/Mini-Games — StrategyWiki](https://strategywiki.org/wiki/Plants_vs._Zombies/Mini-Games)
- [Seed slot — The Plants vs. Zombies Wiki (wiki.gg)](https://plantsvszombies.wiki.gg/wiki/Seed_slot)
- [A Walkthrough and Player's Guide for Plants vs. Zombies — Solitaire Laboratory](https://www.solitairelaboratory.com/solitairearcade/zombies/plantsvszombiesguide.html)
- [Plants vs. Zombies (video game) — Wikipedia](https://en.wikipedia.org/wiki/Plants_vs._Zombies_(video_game))
- [Lawn Mower — The Plants vs. Zombies Wiki (wiki.gg)](https://plantsvszombies.wiki.gg/wiki/Lawn_Mower)
- [GDC 2012: 10 tutorial tips from Plants vs. Zombies creator George Fan — Game Developer](https://www.gamedeveloper.com/design/gdc-2012-10-tutorial-tips-from-i-plants-vs-zombies-i-creator-george-fan)
- [Plants vs Zombies Zombie Types: Complete Strategy Guide](https://gardening.alibaba.com/plant-care/plants-vs-zombies-zombie)
- [Comprehensive Guide to Plants in Plants vs. Zombies 2 — BlueStacks](https://www.bluestacks.com/blog/game-guides/plants-vs-zombies-2/pvz-plants-guide-en.html)
