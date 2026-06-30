# GemCraft (series) — depth-mechanics research brief

**Researched for:** CuteDefense V2 depth pass
**Date:** 2026-06-28
**Game:** GemCraft series — *GemCraft* (2008), *Chapter 0*, *Labyrinth*, *Chapter 2: Chasing Shadows* (2014), *Lost Chapter: Frostborn Wrath* (2020). Dev: Game In A Bottle (Peter Szabo / "Gameinabottle").
**Genre slot:** dark-fantasy, fast real-time TD where the *projectile is the build*. Free flash originals + paid Steam remasters.

> Reading note for CuteDefense: GemCraft is the **antithesis** of "kid-minimal" on its surface (9 gem colors, 15 battle traits, 70k wizard levels). It is included precisely because its *depth comes from one elegant idea repeated* — **the gem is a craftable, combinable, relocatable unit** — and almost everything else is optional scaffolding layered on top. The transferable lesson is the *core decision structure*, not the breadth. Most sections below end with a **→ CuteDefense** note mapping the idea down to a 2-tower, kid-safe, static-hosted game and to the grownup-playthrough symptoms (numbered #1–#11 in the brief).

---

## 1. The one idea that carries the whole series: the gem is the unit, the tower is just a socket

In every CuteDefense-style TD, **the tower is the thing you own and upgrade**. In GemCraft, **the gem is the thing you own**, and towers/traps/amplifiers are just *sockets* you drop gems into. This single inversion is the source of nearly all the game's depth, and it is the most important takeaway.

Consequences of "gem-is-the-unit":
- **Gems are portable.** You can pull a gem out of one socket and drop it into a better-positioned socket, or into a trap, or into an amplifier, mid-battle. Your investment is never stranded by a bad placement decision.
- **Gems persist and grow across the battle**, independent of the building holding them. A single gem can be the protagonist of an entire level.
- **The building only decides *how* the gem behaves** (tower = ranged attacker, trap = short-range special-amplifier, amplifier = buffs neighbors). Same gem, three completely different roles.

This is why a GemCraft player never feels the CuteDefense #5 problem ("did I just waste money upgrading?") — upgrade value lives in a *movable object*, so it's never thrown away by a layout mistake.

→ **CuteDefense:** The single highest-leverage idea here is **separating "the valuable thing you invest in" from "the spot on the map."** Even with only 2 towers, if the *upgrade* (or a "gem"/"charm" attached to a tower) could be **picked up and re-socketed** onto the other tower or a better tile, you simultaneously fix #5 (investment never wasted), #8 (you can rescue a squished placement by moving the value, not the footprint), and give meaningful low-click decisions.

---

## 2. Gem combine / grade system — the core "make a bigger number, but choose how" loop

### How it works
- Gems exist at **grades 1–6+** (visible grade shown by gem *shape*; combining never stops — you can chain to very high grades).
- **Combine two gems → one gem of the next grade**, costing mana. Higher grade = more damage, more range, stronger specials. Cost scales exponentially with grade.
- Two gems of **different colors** can be combined; the result carries the *special abilities of its component colors*, but each special is **diluted** (weaker than it would be in a pure gem of that color).
- Power level is **shown by the gem's shape**, not a number bar — instant visual read of "how strong is this thing."

### Pure vs. hybrid — the central recurring decision
- **Pure gems** = the *strongest single special*. Best when you need one effect at maximum strength (and best in amplifiers, see §5).
- **Hybrid (dual/triple/quad) gems** = multiple specials at once, each weaker, BUT multi-component gems get **flat bonuses to damage/range/firing-speed** that pure gems don't, plus **specials that synergize** (e.g. armor-tear + crit + poison stack into more than the sum). A well-built dual gem out-damages a pure gem.
- Later games fold the old per-color mastery skills into one **"True Colors"** skill: small bonus to pure-gem damage per level, *large* bonus to dual/triple/quad gems every few levels — eventually the multi-gem bonus *outstrips* the pure bonus. This is a deliberate designer thumb on the scale that **keeps the pure-vs-hybrid question live the entire game** instead of one answer dominating.

### Why it creates depth / sustained engagement
- Every gem you hold is a **standing question**: "combine it up for raw power, or keep two specialists?" There is no dominant answer because of the dilution-vs-multi-bonus tension.
- The exponential cost curve means a high-grade gem is a **major commitment** you feel — and because gems are movable (§1), that commitment is never accidentally wasted.
- **Attention/click management:** the entire upgrade system is *one verb* — drag gem onto gem. No tech tree, no per-tower upgrade menus. The depth is in *which two you pick*, not in menu navigation. This is the key kid-relevant insight: **deep ≠ many buttons.**

→ **CuteDefense (directly addresses #5, #6, #9):**
- A "combine two to make one stronger" verb is far lower click-load than "open tower, click upgrade tab, click level 2." It's one gesture and the result is *visually obvious* (shape/size grows — which V2 already does per level!).
- The **pure-vs-hybrid tension** maps to your 2 towers: if basic and strong could be *fused* (or share a combinable charm), the question "does it matter which tower I use?" (#9) becomes a real, legible choice rather than a stat-sheet comparison kids won't read.
- **Show grade by shape, never by a number** — this is how GemCraft stays readable for fast play; perfect for ages 5–10.

---

## 3. Mana pool — resource as life, currency, and engine all at once

### The mechanic
- **Mana is the player's life bar AND magic energy — the same single statistic.** You spend mana to forge gems, combine gems, build towers/traps, and cast spells; when monsters reach your orb they *drain mana*; if mana hits zero you lose.
- The **Mana Pool** stores all your mana, and **leveling the pool gives a global multiplier to all mana income** (regen + mana from kills + mana leech).
- **Mana farming** is an emergent economy: **Orange gems "leech" mana** — every time an orange gem hits a monster, you gain a fixed amount (scales with grade). Players build dedicated "mana farms" (orange gems in traps/amps, supported by red/white/yellow) that turn the monster stream into an income faucet.
- This creates a **feedback loop the wiki explicitly calls out:** leveling your mana pool makes orange gems more effective → more mana income → faster pool leveling → more income. The strategic skill is *bootstrapping* this loop before the waves overwhelm you.

### Why it's brilliant (and why it's the answer to "why do I have so much money?")
- Because **life and money are the same pool**, every spend is a *risk* and every kill is *income*. There is no "I'm drowning in unused coins" state (CuteDefense #4) — spending too aggressively can literally kill you, and hoarding starves your defense. The resource is *always* tense.
- It makes **economy a build target**, not a passive trickle. Choosing to invest in mana farming *instead of* raw damage is a real strategic fork.

### Attention/click cost
- This is GemCraft's *least* kid-friendly system — mana farms demand micro and planning. But the **underlying principle is portable and simple**: tie income to *engagement with the battle* (hitting enemies) rather than a passive drip.

→ **CuteDefense (directly addresses #4 "why so much money?"):**
- V2's coins-drop-and-must-be-tapped system is *already* "income tied to engagement" — that's the same spirit as orange-gem leech. The problem (#4 too much money, #7 can't watch enemies) is that tapping coins is **busywork that competes with watching the battle**, whereas GemCraft's leech is **automatic and visualized as part of the attack**.
- **Lesson:** make income a *consequence of your towers working*, shown as a satisfying number ticking up, rather than a separate manual collection chore. Consider: a tower "type" or upgrade that earns coins per hit (the orange-gem role), so the *economy itself is a build choice* — this turns #4's "too much money" into "I chose to invest in money, was it worth it vs. damage?"
- Do **not** import life=money for kids (too punishing/confusing). But *do* import "spending should feel like a real tradeoff," e.g. a soft pressure so coins don't pile up meaninglessly.

---

## 4. Gem colors / types — specials that change *how you fight*, not just damage numbers

GemCraft's color palette (peaked at ~9, trimmed to 6 in Frostborn Wrath). Each color is a *verb*, not a stat:

| Color | Special (the verb) | What it changes about play |
|---|---|---|
| **Red** | *Chain hit* (early) / *Bleeding* (Frostborn: target takes +damage from all sources) | anti-swarm OR a damage-amplifier that makes every *other* gem hit harder |
| **Orange** | *Mana leech* | turns the monster stream into income (see §3) |
| **Yellow** | *Critical / multiple damage* | spiky burst; rewards stacking with armor-tear |
| **Lime/Green-yellow** | *Chain hit* (later games) | bounces between adjacent enemies → swarm answer |
| **Green** | *Poison* (damage-over-time, **ignores armor**) | answer to high-armor enemies; ramps over time |
| **Cyan** | *Shock / stun* | crowd control; freezes a target briefly |
| **Blue** | *Slow* | stretches enemy time-in-range → more total hits |
| **Purple** | *Armor tearing* | enabler — makes everything else's damage land |
| **White** | *Poolbound* (damage scales with your mana pool size) | rewards a big economy |
| **Black** | *Bloodbound* (damage scales with cumulative kills) | rewards a long battle / snowballs |

Frostborn Wrath cut Cyan, the chain-hit Red, White and Black — and **folded the White/Black scaling bonuses into ALL gems by default**. This is a notable *simplification-for-readability* move by the designers: fewer colors, less overlap, each remaining color clearly distinct.

### Why depth
- Colors are a **rock-paper-scissors-ish toolkit against enemy properties**: armored enemies → green poison or purple armor-tear; swarms → red/lime chain; fast enemies → blue slow + cyan stun; a long grind → bloodbound/poolbound scalers. **The waves dictate which colors matter**, so the player re-decides their build per encounter (this is the antidote to CuteDefense #10 "every wave is the same").
- **Synergy chains** make colors multiplicative, not additive: purple (armor-tear) → yellow (crit) → red (bleed amplify) means a *combined* gem does far more than three separate ones. Discovering synergies is the long-tail engagement.

→ **CuteDefense (directly addresses #9 "what's the difference between towers?" and #10 "every wave the same"):**
- Your 2 towers are *already* two verbs: basic = single-target DPS, strong = AoE/bomb. The problem is the **difference isn't legible to a kid** (#9). GemCraft makes verbs legible by (a) **distinct color**, (b) **distinct visual effect on hit**, (c) **enemies whose properties obviously demand one verb** (armored = needs poison; swarm = needs splash).
- **The cheapest depth win for V2: make enemies that *obviously* require the strong tower vs the basic tower** — e.g. a tight swarm formation that only AoE can handle, a single armored tank that only focused single-target can grind. That alone converts "more enemies" (#10) into "different puzzle each wave" *without adding any new towers* — it just makes your existing 2 verbs matter.
- You do **not** need 6 colors. Two well-contrasted verbs + enemies that demand each = the entire GemCraft color lesson at kid scale.

---

## 5. Building types — same gem, three roles (Towers / Traps / Amplifiers / Walls)

The depth multiplier: one gem behaves completely differently depending on *what you socket it into*.

- **Tower** — ranged attacker. The default. Good range, good damage, versatile. Bread-and-butter.
- **Trap** — built **on the monster path itself**. The gem does ~**80% less damage** and has near-zero range (only the trap's own tile), BUT gets **massively boosted special-ability strength and fire rate**. → Traps are where you put *specials-first* gems (poison, mana-leech, slow). A poison/mana gem doesn't care about raw damage, so the trap penalty is nearly free.
- **Amplifier** — **cannot attack at all**; placed adjacent to towers/traps and **boosts their damage, fire-rate, and range**. If the amp's gem **shares a color** with the neighbor's gem, it *also* boosts that special. Crucially: **amplifiers activate instantly — you can swap/combine gems in them with no firing-cooldown penalty.** → Amps are a *force-multiplier layer*; one great pure gem in an amp can buff a whole cluster.
- **Wall** — non-attacking; **reshapes the monster path** (mazing). Towers/amps can be built on walls.

### Why depth
- The **same gem** asks "tower, trap, or amp?" — a placement decision *on top of* the combine decision. A pure poison gem is mediocre in a tower, devastating in a trap.
- **Amplifier adjacency turns the map into a layout puzzle**: clustering for amp coverage vs. spreading for path coverage. This is *spatial* depth that doesn't add buttons — it adds *meaning to where things go*.
- **Mazing with walls** is player-authored difficulty: you literally design the path the enemies walk.

→ **CuteDefense (directly addresses #8 "towers squish/overlap" and #11 "no risk / I build safely out of the way"):**
- **Adjacency-as-strategy is gold for a minimal game.** Instead of more tower types, make **placement *next to* the other tower matter** — e.g. basic + strong adjacent get a small synergy buff. This rewards deliberate layout (depth) and reframes #8: tiles being tight becomes a *puzzle to solve*, not just a UI annoyance. (You'd still need to fix the literal sprite-overlap rendering bug separately.)
- GemCraft's "trap on the path" idea is a clean way to add **risk** (#11): a structure *on* the enemy lane is more powerful but more exposed. For kids, a tile that's stronger but closer to the action (e.g. takes a "scare"/stun if an enemy reaches it) gives the player skin in the game without the harshness of destructible towers.
- Walls/mazing is probably **too much click-load for ages 5–10** — note it as a deliberate *non*-import.

---

## 6. Spells & the wizard skill tree — meta-progression and active "panic buttons"

- **Spells** (introduced GC2) come in two kinds: **gem-enhancement** (buff your gems) and **strike** (hit enemies directly). Examples: **Bolt** (sniper shot, armor-pierce + brief stun), **Beam** (sustained ray), **Barrage** (splash artillery), **Freeze** (immobilize + makes enemies vulnerable + death-explosion), **Curse** (amplifies your gems' effects on enemies). Spells **charge 0%→200%** over the battle, then you fire them — a *resource you bank and spend at the dramatic moment*.
- **Wizard leveling:** you earn XP across battles → **wizard levels → skill points** spent in a persistent **skill tree** (Focus = bigger mana pool, Forge/Construction = cheaper building, masteries = stronger colors, True Colors = the pure-vs-hybrid lever, etc.). This is **meta-progression across the whole campaign**, not per-level.
- Skills are unlocked by finding them in fields (exploration), giving a light **discovery/collection** loop.

### Why depth
- **Spells are the "active layer"** on top of the passive tower defense — a few high-impact buttons you time, rather than constant micro. Charge-to-200% means **deciding *when* to spend is the skill**, not spamming.
- **Wizard skill tree = the reason to replay.** A lost battle still earns XP → you come back stronger → the previously-impossible wave falls. This is *exactly* the loop the grownup felt at CuteDefense #2 ("losing to the wave-5 boss made me want to replay and beat it").

→ **CuteDefense (directly addresses #2 "replay to beat the boss", #6 "too much to click", #11 "no risk"):**
- A **single charge-up "panic" ability** (one button that fills over the wave and unleashes a big freeze/zap) is a fantastic kid mechanic: low click-load (one button), high drama, and the *only* skill is timing it. It directly serves #6 (one button, not constant fiddling) and gives the player a heroic moment of agency.
- **Lightweight meta-progression** (e.g. a tiny persistent unlock or a "you got further!" marker between runs) converts the #2 instinct into a structural retention loop — *as long as it stays static/local* (localStorage; respects the no-backend constraint).
- Keep it to **one or two** abilities. GemCraft has ~8 spells + a sprawling tree; the *principle* (banked active power + persistent growth) survives radical trimming.

---

## 7. Gem bombs, wave-summoning & "angering" — PLAYER-CONTROLLED PACING and risk-reward

This is GemCraft's most underrated design pattern and the most relevant to CuteDefense's attention problems.

- **Pause anytime to build.** Later games moved "closer to *Take Your Time*" — you can freeze the battle to think, place, and combine. The original was twitchy; the remasters deliberately de-stressed it.
- **Summon waves early for bonus.** Waves don't have to wait. You can call the next wave (or *several at once*) before it's due, for **bonus XP/mana**. → The player chooses the tempo: cautious (wait, build up) or greedy (rush waves for more reward, at more risk).
- **Gem Bombs:** throw a gem at the field — it's destroyed and deals **AoE damage**. Uses: nuke a swarm, destroy a beacon, *and* **"anger"/enrage a wave** — drop a bomb on the wavestone to make that wave **stronger (more HP/armor/count) but worth more mana, XP, and score.** Later games replaced bomb-angering with an **"enrage slot"**: drop a gem in the slot to enrage all upcoming waves.
- **Mana shards / beacons / pylons** dot some maps as optional objectives — towers can shoot a mana shard to drain bonus mana; pylons charge up and release big hits.

### Why this is the key attention-management insight
- **The player, not the timer, controls intensity.** A player who's overwhelmed simply *doesn't* summon early and *doesn't* enrage — the game stays calm. A player who wants more goes greedy. **Difficulty becomes opt-in.** This is the single most important transferable idea for a kids' game where attention varies wildly between a focused 9-year-old and an overwhelmed 5-year-old.
- **Risk-reward is explicit and self-selected:** "stronger enemies but more reward" is a clean, legible bargain a child can understand ("make it scarier to get more coins").
- **Pause-to-build removes the #6/#7 failure entirely** — the reason the grownup "couldn't keep up placing towers" and "couldn't see the enemies" is that placement and combat happen simultaneously under time pressure. GemCraft's pause decouples them.

→ **CuteDefense (directly addresses #6, #7, #1, #3):**
- **Pause-to-place / a calm build phase between waves** is the most important single fix for #6 ("can't keep up clicking") and #7 ("can't see the enemies"). Let kids place/upgrade in a frozen build phase, then *watch* the wave run. This preserves the joy of #1 ("fun to place towers") by giving it room, and lets them actually watch the boss instead of frantically building during it.
- **A "send the next wave now for bonus coins" button** hands pacing to the player: an eager kid rushes for reward, an overwhelmed kid takes all the time they want. Opt-in difficulty is *the* anti-overwhelm pattern.
- **Enrage-for-reward** is a kid-legible risk knob and a possible answer to #3 ("why does the boss take so many lives?") — if scariness is *something the player chose*, the boss's punch feels earned/understood rather than arbitrary.

---

## 8. Endless / Endurance scaling & Battle Traits — the "unbeatable hook" done deliberately

- **Endurance mode:** survive as long as possible; **no wave limit.** Enemy HP scales by a small per-wave increment that **compounds exponentially** — eventually monsters become "nigh-unkillable even in end-game setups." The fun is *how far you get*, not winning.
- **Battle Traits:** **15 toggleable modifiers, each up to 12 levels**, freely combinable. Each trait makes the battle harder in a specific way **in exchange for an XP multiplier**. So *the player buys difficulty with reward*. On max settings the game is *intentionally* unbeatable (HP scales faster than any attainable build) — the cap is a **deliberate horizon**, not a balance failure.

### Why depth
- **Self-set difficulty as a first-class system** (same theme as §7): the player composes their own challenge from a menu of modifiers, each with a transparent reward. This is enormously replayable and *teaches the player the systems* (you toggle the trait that targets the mechanic you understand).
- An **intentionally unbeatable endgame** gives a permanent aspiration without a frustrating "you should have won" — everyone knows the wall is the point.

→ **CuteDefense (directly validates the existing wave-16 split-boss design, addresses #2):**
- Your **secret, intentionally-unbeatable wave-16 split boss is the exact GemCraft "deliberate horizon" pattern** — keep it; it's good design, not a gap. Frame it the way GemCraft frames Endurance: *the point is how far you get.*
- A **kid-scale "battle traits" idea**: 2–3 optional toggles before a run ("faster enemies," "tougher boss," "less starting coins") each granting a visible reward (a star, more coins). Opt-in difficulty + reward = huge replay value at almost zero new mechanics, and it's the structural form of #2's replay urge.
- Keep it tiny — GemCraft's 15×12 is overwhelming; **2–3 one-tap toggles** is the kid-safe dose.

---

## 9. How GemCraft manages attention & click-load (the part most relevant to ages 5–10)

GemCraft is *information-dense*, yet sustained huge audiences. The techniques it uses to stay playable are the transferable craft:

1. **One core verb (drag gem onto gem) does all upgrading.** No upgrade menus per building. Depth lives in *which gems*, not in UI navigation. **→ minimize verbs, maximize the meaning of each.**
2. **Power is shown by shape, not numbers.** A glance tells you a gem's grade. **→ kids read shape/size/color instantly; numbers not at all.** (V2 already grows tower size per level — lean into that as the *primary* readout.)
3. **Pause-to-build decouples "think" from "react."** Placement is calm; combat is watched. **→ separate build and battle phases.**
4. **Player-set pacing (summon early / enrage / traits).** Intensity is opt-in, so the same game serves a frantic and a cautious player. **→ the universal anti-overwhelm lever.**
5. **Instant amplifier swaps** mean experimenting carries no cooldown punishment. **→ let kids try and undo freely; never punish fiddling with a timer penalty.**
6. **The remasters deliberately *removed* mechanics (9→6 colors, folded specials into defaults).** The flagship lesson: **the series got better by subtracting.** **→ for CuteDefense, "minimal" is not a constraint to fight — it's the same direction GemCraft's own designers chose.**

---

## 10. Distilled takeaways for CuteDefense V2 (2-tower, kid-friendly, static-hosted, minimal)

Ranked by leverage-per-effort against the grownup feedback:

1. **Build phase / pause-to-place (calm build, then watch).** Single biggest fix for #6 (can't keep up clicking) and #7 (can't see enemies); preserves #1 (placing is fun). Zero new content, pure flow change.
2. **Enemies that obviously demand a specific tower verb** (a swarm only AoE/strong can clear; an armored tank only focused/basic can grind). Converts #10 ("every wave the same") and #9 ("does it matter which tower?") into legible per-wave puzzles using your *existing* 2 towers. Cheapest depth win available.
3. **Income as a consequence of towers hitting, not manual coin-tapping** (the orange-gem-leech principle). Reframes #4 ("too much money") into "I chose to invest in economy vs. damage — was it worth it?" and removes the tap-busywork stealing attention from #7. Make the number tick up visibly on hit.
4. **Movable/re-socketable upgrade value** (gem-is-the-unit, §1). An upgrade or "charm" you can pick up and move to the other tower/tile means investment is *never* wasted (#5) and squished placements can be rescued (#8).
5. **One charge-up "panic" ability** (one button, fills over the wave, big freeze/zap). High drama, lowest possible click-load (#6), heroic agency, and a timing skill — the only skill being *when*.
6. **Player-set difficulty as opt-in reward** (a "send wave now for bonus coins" button; 2–3 pre-run toggles à la battle traits). The universal anti-overwhelm lever (§7–§8) and the structural form of the replay urge (#2). Serves the focused and the overwhelmed kid from the same build.
7. **Adjacency synergy between the 2 towers** (basic+strong next to each other get a small buff). Adds spatial depth and reframes tight tiles (#8) as a solvable puzzle — no new tower types.
8. **Keep the unbeatable wave-16 split boss; frame it as a horizon** (GemCraft Endurance pattern, §8). It's good design — "how far can you get," not "you failed to win."
9. **Readout by shape/size/colour, never numbers** (§9.2). Aligns with V2's per-level size growth; it's how GemCraft stays glanceable for fast play.
10. **Subtract, don't add.** GemCraft's own remasters got better by cutting (9→6 colors). "Minimal" is the same instinct its designers followed — depth from *meaning per element*, not count of elements.

**Explicit non-imports (too much click/cognitive load for ages 5–10):** mana=life dual resource (too punishing/confusing), full 6–9 color palette, wall-mazing/path authoring, the 15×12 battle-trait matrix, mana-farm micro-optimization, and exponential-grade infinite combining. Take the *principles*, leave the *breadth*.

---

## Sources

- [GemCraft — Wikipedia](https://en.wikipedia.org/wiki/GemCraft)
- [Gems | Gemcraft Wiki (Fandom)](https://gemcraft.fandom.com/wiki/Gems)
- [Gem Optimization | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Gem_Optimization)
- [Mana pool | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Mana_pool)
- [Mana farm | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Mana_farm)
- [Buildings | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Buildings)
- [Trap | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Trap)
- [Amplifier | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Amplifier)
- [Spells | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Spells)
- [Skills (GCFW) | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Skills_(GCFW))
- [Battle Traits (GCFW) | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Battle_Traits_(GCFW))
- [Endurance | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Endurance)
- [Gem Bomb | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Gem_Bomb)
- [Angering | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/Angering)
- [GemCraft Lost Chapter: Frostborn Wrath | Gemcraft Wiki](https://gemcraft.fandom.com/wiki/GemCraft_Lost_Chapter:_Frostborn_Wrath)
- [GemCraft — Walkthrough, Tips, Review (JayIsGames)](https://jayisgames.com/review/gemcraft.php)
- [GemCraft Labyrinth — Walkthrough, Tips, Review (JayIsGames)](https://jayisgames.com/review/gemcraft-labyrinth.php)
- [GemCraft (Video Game) — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/GemCraft)
- [GemCraft - Frostborn Wrath on Steam](https://store.steampowered.com/app/1106530/GemCraft__Frostborn_Wrath/)
- [GemCraft - Chasing Shadows on Steam](https://store.steampowered.com/app/296490/GemCraft__Chasing_Shadows/)
- [My first mana farm — Chasing Shadows discussion (Steam)](https://steamcommunity.com/app/296490/discussions/0/1733210552642824791/)
- [Pure vs combined gems? — Chasing Shadows discussion (Steam)](https://steamcommunity.com/app/296490/discussions/0/613956964592825202/)
- [Apparently Green and Purple are Great; Blue Sucks — Frostborn Wrath discussion (Steam)](https://steamcommunity.com/app/1106530/discussions/0/1737761954048848520/)
