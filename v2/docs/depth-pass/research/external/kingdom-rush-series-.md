# Kingdom Rush (series) — depth mechanics brief for CuteDefense V2

**Researched:** 2026-06-28
**Subject:** Kingdom Rush, Frontiers, Origins, Vengeance, Alliance (Ironhide Game Studio)
**Why this game:** Kingdom Rush is the genre's reference standard for *fixed-path, readable, hand-authored* tower defense. It is the closest high-pedigree relative to CuteDefense's design (fixed path, restricted build spots, hand-authored waves) — so its solutions to "every wave feels different," "does my choice matter," and "how do I keep the player engaged without overwhelming them" are directly transferable. It is also pitched at a broad/young-friendly audience and built on cartoon charm, which matches CuteDefense's constraints.

---

## 0. TL;DR — the 6 ideas worth stealing

1. **Tower archetypes with hard counters (rock-paper-scissors), not just "fast vs slow."** Each tower type is *the only good answer* to some enemy trait. This is what makes "which tower do I use?" a real, legible decision (directly fixes CuteDefense symptoms 5, 9, 10).
2. **Enemy traits ARE the puzzle.** Armor / magic-resist / flying / heal / spawn / regen each *invalidate* a tower and *demand* another. Waves are authored as trait-mixes, so each wave reads as a distinct question (fixes symptom 10).
3. **A small set of player-triggered active abilities on cooldowns** (reinforcements, rain of fire) give a *pulse* of agency between placements — high impact, low click-count, player chooses *when* to spend attention (fixes symptoms 6, 7, 11).
4. **A single controllable hero** concentrates "active play" into one focal unit instead of many micro-managed objects — one thing to watch, not twelve (fixes symptoms 6, 7).
5. **Irreversible specialization fork at the top of each tower's tree** turns "upgrade" from a stat-bump into an identity choice you commit to (fixes symptoms 5, 9).
6. **Readable fixed-path encounters** with restricted build spots and predictable "furthest-along" targeting — the battlefield is a legible board, so a 6-year-old can predict what happens (fixes symptoms 7, 8).

---

## 1. The four-tower foundation: archetypes with *hard counters*

Kingdom Rush ships **exactly four base tower archetypes**, and the entire strategic spine of the game comes from the fact that each one is *good at one thing and useless at another*:

| Tower | Role | Strong vs | Weak / useless vs |
|---|---|---|---|
| **Archer** | Fast, cheap, single-target physical DPS, longest range | Unarmored, fast, flying (after range upgrades) | Heavily **armored** enemies (physical damage soaks into armor) |
| **Mage** | Slow, expensive, magic damage that **ignores armor** | **Armored** enemies | **Magic-resistant** enemies (blue shield) |
| **Artillery** | Slow AoE bombard, partially bypasses armor via splash | **Groups / swarms**, spawners | Single fast targets; full damage only near epicenter |
| **Barracks** | Deals little damage; spawns **soldiers that physically block** | Stalling fast/dangerous melee enemies | **Flying** enemies (ignored entirely); AoE enemies (kill all soldiers) |

**Why it matters (the design lesson):** "Which tower?" is only an interesting question if the *wrong* tower visibly fails. Kingdom Rush makes the failure legible — pump physical arrows into an armored Dark Knight and you watch the numbers shrug off; the player learns "armor → mage" by *seeing it not work*, not by reading a tooltip. This is the single most important fix for CuteDefense symptoms **9** ("does it matter which I use?") and **10** ("are all waves the same?"). With only 2 towers you cannot do full rock-paper-scissors, but you *can* give each tower one trait it hard-counters and one it whiffs on.

> **Damage-type system (the engine underneath counters):** physical damage is reduced by **armor** (gray shield); magic damage **ignores armor** but is reduced by **magic resistance** (blue shield); some abilities deal **true damage** that ignores both. Three damage relationships are enough to generate the entire counter web.

**Sources:** [Upgrades — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades), [Best Upgrades — TheGamer](https://www.thegamer.com/kingdom-rush-best-upgrades/), [Beginner's Guide — LevelWinner](https://www.levelwinner.com/kingdom-rush-beginners-guide-tips-tricks-strategies-to-vanquish-the-evil-forces/)

---

## 2. Tower specialization: the irreversible fork (the depth multiplier)

Each base tower upgrades **3 linear levels**, then at the top **forks into one of two mutually-exclusive specializations** (KR1–3). You pick one *per built tower, permanently for that match*. Representative forks in the original game:

| Base tower | Branch A | Branch B |
|---|---|---|
| **Barracks** | **Knights** — more/tougher soldiers, raw blocking | **Holy Order (Paladins)** — fewer but self-heal + a *Shield of Valor* damage-absorb ability |
| **Archer** | **Rangers** — poison/critical, *Wrath of the Forest* entangle | **Musketeers** — extreme range, high single-shot damage, *Shrapnel Shot* |
| **Mage** | **Arcane Wizard** — *Teleport* sends an enemy back down the path; *Death Ray* | **Sorcerer** — summons an elemental minion (extra blocker) + *Polymorph* (turn enemy into a harmless sheep) |
| **Artillery** | **Tesla** — chain lightning across grouped enemies | **Big Bertha** — one enormous single bombard |

**Why it matters:** The fork converts "upgrade" from a *number going up* into a *commitment with a tradeoff*. Knights vs Paladins isn't "better/worse," it's "more bodies vs more survivability" — a decision tied to *what this lane is fighting*. This is the antidote to CuteDefense symptom **5** ("did upgrading actually help / what did I even buy?"). When the level-3→4 step is a visible *identity change* (new sprite, new active ability, new behavior) rather than +6 damage, the player both *sees* and *feels* the spend.

**KR Vengeance variant (also instructive):** later games dropped the in-match fork and instead gave **~18–20 distinct towers**, of which the player pre-selects a **deck of 5** to bring into a level. The depth moves from in-match forking to **pre-match loadout drafting**. (Probably too much for kids/CuteDefense, but the principle — *constrained choice from a larger set* — is worth noting.)

**Source:** [Upgrades — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades), [Best Towers & Upgrade Paths](https://www.kingdomrushgenerator.com/guide/best-towers-upgrade-paths/) (guide), [Tower upgrade efficiency — Ironhide forums](https://forums.ironhidegames.com/viewtopic.php?f=5&t=29522)

---

## 3. Meta-progression: the "stars" economy (out-of-match growth)

Separately from in-match gold, completing levels awards **stars** spent in a persistent **6-tree upgrade screen** (one tree per tower type + one per spell). These are permanent, account-wide buffs (e.g. archer crit "Precision," mage "Arcane Shatter" that permanently lowers enemy armor, artillery "Smart Targeting" so the whole blast radius deals full damage).

**Why it matters:** This separates *"getting better at the game"* (meta-stars, slow, permanent) from *"solving this level"* (in-match gold, fast, reset each level). The player who lost to the wave-5 boss and *wants to replay* (CuteDefense symptom **2** — a desired behavior!) comes back slightly stronger and with more knowledge — a clean retry loop. Note the resource-allocation dilemma is deliberate: stars force "foundational early upgrade now vs save for the game-changing specialization."

**Caveat for CuteDefense:** static-hosting + no backend means meta-progression must live in `localStorage`. A *light* version (e.g. unlock a tower specialization, or a small permanent buff, between runs) is feasible and supports the replay loop the grownup tester already exhibited.

**Source:** [Upgrades — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades), [Best Upgrades — TheGamer](https://www.thegamer.com/kingdom-rush-best-upgrades/)

---

## 4. The hero unit: a single focal point of "active" play

A **hero** is one player-controlled unit you place/move around the map by tapping a destination. It:
- **Levels up within the match** (gains HP/damage, earns skill points to spend on its abilities),
- Has **active abilities on cooldowns** (e.g. *Sworn Defenders* — summon 2–5 Kingsguard for 25s, 60s cd; *Pandamonium* — call 4–6 panda warriors, 30s cd; *Fate Sealed* — a true-damage curse that explodes the target),
- Revives after a short cooldown if killed (it is never permanently lost).

**Why it matters for attention/click-load (critical for kids):** The hero concentrates *all* the "twitchy" active play into **one object the player watches**. Instead of micromanaging twelve towers, the player has *one* avatar to reposition to the current crisis ("park it by the exit as last line of defense," "rush it to the leaking lane"). It's a single, emotionally-attached focal point — much lower cognitive load than "keep up with placing and upgrading everything" (CuteDefense symptoms **6, 7**). It also adds a **personal stake**: the hero *can be downed*, giving the player something of their own that is at risk (relevant to CuteDefense symptom **11** — "there's no risk to me").

**Source:** [Heroes — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Heroes/Kingdom_Rush), [Hero Spell — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Hero_Spell), [Beginner's Guide — LevelWinner](https://www.levelwinner.com/kingdom-rush-beginners-guide-tips-tricks-strategies-to-vanquish-the-evil-forces/)

---

## 5. Two map-wide active abilities: reinforcements & rain of fire

Every level gives the player **two always-available player-triggered abilities**, each on a cooldown:

- **Call Reinforcements** — drop 2–3 militia soldiers *anywhere* on the map for a short duration. Used to: plug a leaking gap, body-block the last few enemies, or **isolate a dangerous enemy** (e.g. pull a healing Shaman away from the pack so it can't heal). One branch upgrades them to melee, another gives them ranged weapons that can hit flyers.
- **Rain of Fire** — call meteors onto a chosen spot; ground burns for ~5s. Pure burst AoE for when a swarm clumps up. Upgrades add damage and extra random meteors.

**Why it matters:** These are **low-frequency, high-impact** taps. Unlike continuous tower micro, an ability is *one tap, big payoff, then a wait*. That cadence is exactly what manages click-load: the player isn't *constantly* acting, they're *choosing the moment*. The decision is **timing** ("do I spend it now or save it for the boss?"), not dexterity. This is a strong template for giving CuteDefense players agency *during* combat without the "I can't keep up clicking" overload (symptoms **6, 7**), and it gives the player a way to *intervene in a crisis* rather than helplessly watching lives drain (symptom **3** — "why does the boss take so many lives?" → because you didn't drop Rain of Fire on it).

**Source:** [Hero Spell / Spells — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Category:Spells), [Beginner's Guide — LevelWinner](https://www.levelwinner.com/kingdom-rush-beginners-guide-tips-tricks-strategies-to-vanquish-the-evil-forces/), [Upgrades — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades)

---

## 6. Enemy roster: traits are the vocabulary of difficulty

Kingdom Rush's difficulty does **not** come primarily from bigger HP bars — it comes from **enemy traits that each demand a specific answer**. The trait set (and the response each forces):

| Trait | Example enemy | What it does | Forced player response |
|---|---|---|---|
| **Armored** (gray shield) | Orcs, Dark Knights, Orc Champion | Soaks physical damage | Switch to **mages** (magic ignores armor) |
| **Magic-resistant** (blue shield) | Giant Spiders, Shamans, Worgs | Soaks magic damage | Switch to **archers/artillery** (physical) |
| **Flying** | Gargoyles, Demon Imps, Rocket Riders | Ignores soldiers & ground blocks | **Archers/mages only**; barracks are useless |
| **Healer** | Shamans | Heals nearby allies | **Isolate** with reinforcements, or burst the healer first |
| **Spawner** | Spider Matriarch, Necromancer | Births more enemies if left alive | **AoE artillery** to clear before it snowballs |
| **Regenerator** | Trolls (5–20 HP/s) | Heals back unless out-DPS'd | Concentrate enough **burst** to overpower regen |
| **Fast / dodges melee** | Wulf, Bandits, Worgs | Slips past or dodges soldiers | **Stall** with knights/paladins, ranged pickoff |
| **Multi-life / armor-piercing** | Marauders, Dark Slayers | Survives a "kill," ignores soldier armor | Sustained layered damage |
| **AoE attacker** | Yetis, Lava Elemental | Kills *all* stacked soldiers at once | **Don't** stack blockers; insta-kill abilities |
| **Explodes on death** | Demon Spawn/Hound | Damages your troops when it dies | Kill at **range**, pull troops back |
| **Disables towers** | Bosses (J.T., Vez'nan) | Temporarily shuts off a tower | Spatial planning; respawning barracks |

**Why it matters:** This is the masterclass for CuteDefense symptom **10** ("every wave should have a unique challenge needing different towers/layouts/strategy"). The *enemy*, not the wave size, is the puzzle. A wave of "armored + a healer behind them" is a *fundamentally different question* than "a swarm of fast flyers," even with the same two towers. With CuteDefense's existing roster (basic/fast/strong + shield/speed/regen bosses) you already have the raw traits — the gap is that traits aren't yet *forcing distinct responses* because both towers can damage everything. Introduce even *one* "this tower can't hurt me" trait and waves instantly differentiate.

**Sources:** [Enemies & Bosses — Kromrah Wiki](https://kromrah-wiki.weebly.com/kingdom-rush-enemies-and-bosses.html), [Magic Resistant Enemies — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Category:Magic_Resistant_Enemies), [Wikipedia](https://en.wikipedia.org/wiki/Kingdom_Rush)

---

## 7. The barracks/blocking mechanic: a spatial puzzle (and a model of risk)

Soldiers from a barracks **physically stop** ground enemies in melee — an enemy locked by a soldier *cannot advance* until it kills the soldier or outnumbers the blockers. The player sets a **rally point** to position where soldiers stand. Tactics that emerge:
- Place barracks at a **choke** so blocked enemies sit inside the kill-zone of your towers.
- Overlap two barracks' rally points to **gang up** on a tough single enemy.
- *Don't* overlap against **AoE** enemies (they kill the whole clump).
- The block **breaks** when soldiers die — leaks happen dynamically, creating tension.

**Why it matters:** Blocking turns the map into a **spatial control puzzle**, not just a turret-placement exercise — *where* enemies are held matters as much as *what* shoots them. Critically, **the soldiers are at risk and die**, which is one of the few things in TD that puts something the player owns in genuine danger. This is a direct lead on CuteDefense symptom **11** ("there's no risk to me — enemies can't destroy my towers"). A CuteDefense analog could be a *destructible* deployed unit (not the towers themselves, preserving the cozy feel) whose loss matters.

**Source:** [Militia Barracks — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Militia_Barracks), [Knights Barracks — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Knights_Barracks), [Beginner's Guide — LevelWinner](https://www.levelwinner.com/kingdom-rush-beginners-guide-tips-tricks-strategies-to-vanquish-the-evil-forces/)

---

## 8. Targeting model & placement-as-strategy

Towers auto-target the **enemy furthest along the path** within range. There is **no per-tower priority menu** — the strategy lives in **where you place the tower**, not in fiddly target settings:

- Put **cheap fast archers early** on the path to delete weak enemies.
- Put **slow expensive mages later**, so they spend their slow shots on the *strong survivors* instead of wasting overkill on trash that archers would've cleared anyway.

**Why it matters for kids:** Predictable "furthest-along" targeting makes the board **readable** — a child can look at the screen and *predict* who gets shot next. No hidden priority logic, no menus. The depth is entirely positional and *visible*. This is a deliberate low-cognitive-load choice that still yields real strategy (placement sequencing). Strongly relevant to CuteDefense symptoms **7 & 8** (readability). Keep targeting dead-simple and legible.

**Source:** [Target Priorities — KR Frontiers discussion](https://steamcommunity.com/app/458710/discussions/0/350542145695133583/), [Sequence strategy — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Sequence_strategy)

---

## 9. Fixed-path, readable encounter design (the campaign craft)

From a designer post-mortem of KR's campaign design, the deliberate principles:

- **Restricted build spots near the road** (not freeform). This *forces meaningful placement decisions* and prevents the "spam cheap towers everywhere" degenerate solution. CuteDefense already does this — keep it.
- **One mechanic introduced at a time.** Early levels teach *one* idea (e.g. Southport teaches barracks-blocking with simple goblins) before combining. The hardest unique mechanics are *held back* for later levels so newcomers aren't overwhelmed.
- **Deliberate difficulty rhythm**, including **"breather levels."** Silveroak Forest hands the player strong starting towers/allies as a *pause* before the brutal Citadel. The peak (Icewind Pass "Dark Knight March," a 30-enemy armored wave) is positioned at the midpoint, demanding coordinated mage+cannon+soldier use.
- **Multi-path levels split enemy *types* down different routes** (e.g. armored left, monsters right) so the player must *budget* counters across lanes — you can't copy-paste one tower solution.
- **The final level recombines every previously-taught threat at once** — a knowledge exam.

**Why it matters:** This is the blueprint for "every wave is a unique challenge" (symptom **10**) *without* exhausting the designer. You don't need 50 enemy types — you need a small trait set, **introduced one at a time**, then **recombined**. The combination space *is* the variety. The breather-level concept also directly answers symptom **4** ("why do I have so much money?") — surplus economy should be *engineered* (a calm wave to let you build up) or *removed* (tighter economy), not accidental.

**Source:** [Kingdom Rush — the wonderful Campaign level design (gamedeveloper.com)](https://www.gamedeveloper.com/design/kingdom-rush---the-wonderful-campaign-level-design)

---

## 10. The "call wave early" risk/reward economy

The player can **tap the incoming-wave icon to summon the next wave early**. Reward: **bonus gold equal to the seconds skipped** (plus equivalent spell-cooldown recharge). Risk: the new wave stacks on top of whatever you haven't cleared yet. Meta-upgrades (Blitz Tactics / Golden Time, +80% bonus) make this lever even spicier.

**Why it matters:** This is an elegant, **single-tap** risk/reward valve that lets confident/advanced players self-accelerate and earn more — *opt-in difficulty* without a difficulty menu. It also solves the "too much money / nothing to do between waves" lull (CuteDefense symptom **4**): a skilled player *converts spare time into gold by raising the stakes*, while a struggling player simply ignores the button. Pure upside for engagement, near-zero added UI complexity.

**Relevance to CuteDefense's economy:** CuteDefense currently has the *opposite* friction — coins must be **manually tapped to collect** (15s lifetime), which adds click-load (symptom **6/7**: "too much to click," "can't watch enemies"). Kingdom Rush instead makes gold **automatic** and puts the *interesting* economic decision elsewhere (call-early gambit, spend-now-vs-save fork). Lesson: spend the player's clicks on *decisions*, not on *janitorial collection*. Consider auto-collecting coins and relocating the "interesting choice" to a call-early style lever.

**Source:** [Gold — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Gold), [Keybind to call waves early — Steam](https://steamcommunity.com/app/246420/discussions/0/630800446998172077/), [Upgrades — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades)

---

## 11. How Kingdom Rush manages attention & click-load (the kid-relevant core)

Synthesizing the above, KR's load-management toolkit:

1. **Towers are "set and (mostly) forget."** Auto-target, auto-fire. Baseline play requires *no* continuous input — you place, then watch. The active layer sits *on top* and is optional moment-to-moment.
2. **Active agency is concentrated, not diffuse.** One hero + two abilities = a *small, bounded* set of "live" actions. The player is never asked to micromanage *every* tower simultaneously (the exact failure CuteDefense's tester hit: symptoms **6, 7**).
3. **Cooldowns pace the player.** Abilities gate *how often* you can act, naturally spacing out attention spikes so there's breathing room to *watch* the battle.
4. **Predictable, visible rules.** Furthest-along targeting, gray/blue shields you can *see*, restricted glowing build spots. Nothing hidden → a child can read the board and predict outcomes.
5. **Difficulty is paced with breathers**, so attention demand rises and falls instead of pinning at 100%.
6. **The between-wave phase is the "build/decide" phase; the wave phase is the "watch/react" phase.** Clean separation of *planning* and *reacting* (CuteDefense currently blurs these — the tester was placing towers *while* trying to watch enemies, symptom **7**).

---

## 12. Direct mapping to CuteDefense's 11 feedback symptoms

| # | Symptom | Kingdom Rush lesson |
|---|---|---|
| 1 | Placing towers is fun initially | Keep restricted, satisfying placement; KR agrees this is the core hook |
| 2 | Losing to wave-5 boss made me want to replay | *Good* — KR is built on the retry loop; add light meta-progression so retries feel like progress (§3) |
| 3 | Why does the boss take so many lives? | Give the player a *crisis tool* (Rain of Fire / hero) to intervene, and telegraph the boss so the leak feels like a fixable mistake, not RNG (§5, §9) |
| 4 | Why do I have so much money? | Tighten economy *or* add a money sink that's a *decision* (specialization fork §2) + a call-early gold valve (§10); engineer surplus as a "breather," don't leak it (§9) |
| 5 | Did upgrading actually help? | Make the top upgrade an **identity fork** with a new ability/sprite/behavior, not +damage — the spend must be *seen and felt* (§2) |
| 6 | Can't keep up placing & upgrading — too many clicks | Concentrate active play into **one hero + a couple of cooldown abilities**; auto-collect coins; make towers set-and-forget (§4, §5, §11) |
| 7 | Can't even watch the enemies | Separate **build phase** (between waves) from **watch/react phase** (during wave); reduce janitorial clicks (§10, §11) |
| 8 | Big towers overlap/squish neighbors | KR grows towers *visually* but build spots are spaced so footprints never collide — decouple visual scale from grid footprint, or space the build tiles (§1, §9) |
| 9 | Only 2 towers — what's the difference, does it matter? | Give each tower a **hard counter** it owns and a trait it whiffs on, so the choice is *forced and legible* (§1, §6) |
| 10 | Every wave should be a unique challenge | Make **enemy traits** the puzzle; introduce traits one at a time then recombine across waves/lanes — variety comes from combination, not new assets (§6, §9) |
| 11 | No risk to me — towers are safe | Add a **destructible deployed unit** (KR's soldiers/hero) that the player owns and can lose — keep the *towers* safe to preserve coziness, but put *something* of the player's at stake (§4, §7) |

---

## 13. Concrete, constraint-respecting takeaways for a 2-tower minimal CuteDefense

These respect CuteDefense's hard constraints (static GitHub Pages, no backend/build, deterministic sim core, 2 towers, kid audience, perf gate):

1. **Give the 2 towers a hard counter each.** Make "basic" (physical/single-target) weak vs an **armored** enemy trait, and "strong" (AoE) the answer to **swarms/spawners**; conversely give a **shielded/magic-ish** trait that "strong" handles but "basic" can't. Suddenly "which tower?" is a forced, visible decision — fixes symptoms 5/9/10 with *zero* new towers. All thresholds live in `gameConfig.js`.
2. **Turn the level-3 upgrade into an identity fork**, not a stat bump. Even with 2 towers, each could fork into 2 specializations at max level (e.g. basic → *Sniper* long-range crit **or** *Gunner* faster fire; strong → *Bomber* bigger AoE **or** *Froster* slows). New sprite + new behavior at the fork makes the spend *felt* (symptom 5).
3. **Add ONE player-triggered cooldown ability** (e.g. a tappable "boom" / "freeze" on a 30s cooldown). One button, big effect, paced by cooldown — gives crisis agency against bosses (symptom 3) without click-overload (symptoms 6/7). Deterministic: cooldown ticks on the fixed timestep.
4. **Auto-collect dropped coins** (or auto-collect on kill). The manual-tap coin pickup is pure janitorial click-load fighting the player's attention (symptoms 6/7). Move the "interesting economic choice" to the upgrade fork and an optional *call-wave-early-for-bonus* button (symptom 4/10).
5. **Make enemy traits visible and legible** (a shield glyph, a heal pulse, a "this one splits" telegraph). Kids must be able to *read* the threat and *predict* the answer. Pairs with predictable furthest-along targeting (keep it).
6. **Author waves as trait-mixes introduced one-at-a-time, then recombined.** Wave 1: plain. Wave 2: introduce armor (forces a tower swap). Wave 3: swarm (forces the AoE tower). Later: armor+swarm together. Variety is *combinatorial*, not asset-driven — cheap to author, big perceived depth (symptom 10).
7. **Engineer the economy curve, including a deliberate "breather" wave**, instead of letting surplus accumulate accidentally (symptom 4). The breather is also where the player calmly builds/forks towers (clean build-vs-react phase separation).
8. **Put *something* of the player's at risk without making towers destructible.** A summonable, destructible helper unit (cooldown-spawned, dies, costs nothing but its absence hurts) borrows KR's soldier tension while preserving the cozy "my towers are safe" feel (symptom 11).
9. **Decouple visual tower scale from grid footprint.** Let towers *look* bigger per level (charm) but occupy a fixed tile so neighbors never visually collide (symptom 8) — a pure renderer concern, no sim impact, no perf cost.

---

## Sources

- [Upgrades — Kingdom Rush Wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades)
- [Heroes (Kingdom Rush) — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Heroes/Kingdom_Rush)
- [Hero Spell — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Hero_Spell)
- [Spells category — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Category:Spells)
- [Militia Barracks — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Militia_Barracks) · [Knights Barracks](https://kingdomrushtd.fandom.com/wiki/Knights_Barracks)
- [Magic Resistant Enemies — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Category:Magic_Resistant_Enemies)
- [Gold — KR Wiki](https://kingdomrushtd.fandom.com/wiki/Gold) · [Sequence strategy](https://kingdomrushtd.fandom.com/wiki/Sequence_strategy)
- [Kingdom Rush — the wonderful Campaign level design (gamedeveloper.com / Gamasutra)](https://www.gamedeveloper.com/design/kingdom-rush---the-wonderful-campaign-level-design)
- [The Best Upgrades To Get In Kingdom Rush — TheGamer](https://www.thegamer.com/kingdom-rush-best-upgrades/)
- [Kingdom Rush Beginner's Guide — LevelWinner](https://www.levelwinner.com/kingdom-rush-beginners-guide-tips-tricks-strategies-to-vanquish-the-evil-forces/)
- [Kingdom Rush Enemies and Bosses — Kromrah Wiki](https://kromrah-wiki.weebly.com/kingdom-rush-enemies-and-bosses.html)
- [Target Priorities — KR Frontiers Steam discussion](https://steamcommunity.com/app/458710/discussions/0/350542145695133583/)
- [Keybind to call waves early — Steam discussion](https://steamcommunity.com/app/246420/discussions/0/630800446998172077/)
- [Kingdom Rush — Wikipedia](https://en.wikipedia.org/wiki/Kingdom_Rush)
