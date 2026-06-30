# Mindustry — Depth-Mechanics Research Brief

> Source game: **Mindustry** (Anuke / Anuken), a free open-source 2D tower-defense + factory-automation hybrid.
> Purpose: mine *transferable* depth mechanics for **CuteDefense V2** (kid-friendly, 2-tower, static-hosted, minimal). This brief focuses on the **WHY** behind each mechanic — the strategic decision or sustained engagement it creates, and how it manages player attention/click-load.
>
> ⚠️ Reality check up front: Mindustry is the *opposite* extreme of CuteDefense on the complexity axis. It is high-click-load, high-cognitive, expert-facing. Its value to us is as a **menu of depth levers** to borrow *individually and heavily diluted* — not as a model to imitate. Each section ends with a "Dilute for kids" note.

---

## 1. The core game loop (one sentence)

**Gather → Build → Fight:** mine raw ore with drills, route it on conveyor belts into factories that refine it into better materials, feed those materials as *ammo* into turrets, and survive escalating waves of robots whose entire goal is to **destroy your buildings and your Core**. If your Core dies, you lose. ([Core wiki](https://mindustry-unofficial.fandom.com/wiki/Core))

The whole game is one feedback loop: **logistics feeds firepower; firepower buys time; time lets you expand logistics.** Every wave is a deadline against which your supply chain is racing.

---

## 2. Enemies ATTACK and destroy your stuff (the "real risk" lever)

This is the single biggest contrast with CuteDefense, and the most directly relevant to playthrough complaint #11 ("there's no risk to me").

- **Enemies target *anything* nearby — turrets, walls, factories, conveyors, and the Core.** Defenses are not invincible furniture; they are HP pools the enemy chews through. ("most enemies will attack anything nearby"). ([Defensive strategy](https://steamcommunity.com/sharedfiles/filedetails/?id=1893177624))
- **Losing condition is the Core:** "if all cores the player owns are destroyed, they lose." The Core is both your spawn/storage *and* the thing you're protecting — losing it ends the run. ([Core wiki](https://mindustry-unofficial.fandom.com/wiki/Core))
- **Pathing creates the threat geometry:** enemies seek the *quickest* route to the Core and will **go around walls** because breaking them is slow — *but if boxed in with no path, they smash through the thinnest wall*, turret or not. ([Defensive Blocks discussion](https://steamcommunity.com/sharedfiles/filedetails/?id=1893177624))

### WHY this creates depth / engagement
- **Placement becomes a real bet, not a safe chore.** In CuteDefense you place towers "safely out of the way." In Mindustry a forward turret that out-ranges enemies is powerful *but exposed* — it may get destroyed, costing you the resources you sunk into it. Risk/reward is baked into *where* you build, not just *what* you build.
- **It makes loss legible.** Complaint #3 ("why does the boss take so many lives?") is really "I can't see the threat acting on me." When the boss visibly *shoots and cracks your wall*, the cause of damage is on-screen and concrete instead of an abstract life counter ticking down.
- **It forces ongoing attention to the battlefield**, not just the build menu — directly opposite to complaint #7 ("I can't even see the enemies — too busy placing towers"). In Mindustry you *have* to watch, because watching is how you notice a wall about to break.

### Dilute for kids
A full "everything is destructible" model is too punishing and too busy. Borrow the *legibility*, not the attrition:
- Give bosses a **visible attack** on a single target (e.g., a boss "stomps" the nearest tower and **stuns it for a few seconds** rather than destroying it). The player sees the cause, feels the stakes, and can react — but loses time, not permanent investment.
- Or: enemies that reach the end **steal a coin drop / a small resource** instead of (or in addition to) a life, making the leak feel like theft rather than an opaque number.
- Keep the Core/base as the one thing truly at risk; keep towers safe-ish. The lesson is *make the risk visible and spatial*, not *make everything fragile*.

---

## 3. Ammo & resource types per turret (the "does my choice matter?" lever)

Turrets in Mindustry are **not** self-firing. Each one **consumes an input** to shoot, and the input *changes the shot*. ([Turrets — Encyclopedia](https://mindustry.miraheze.org/wiki/Turrets), [Turret API](https://mindustrygame.github.io/docs/mindustry/world/blocks/defense/turrets/Turret.html))

- **Input categories:** items, liquids, power, heat, or combinations. ([Turrets](https://mindustry.miraheze.org/wiki/Turrets))
- **Same turret, different ammo, different behavior.** A basic item turret (the Duo) fires weak shots on copper but better shots on graphite or silicon — "typically, the more difficult an item or liquid is to make, the better the projectiles." Each ammo type has its own **damage multiplier** and **ammo multiplier** (how many shots one item yields). ([Turrets](https://mindustry.miraheze.org/wiki/Turrets))
- **Liquid turrets** (Wave, Sublimate) spray liquids/gases that apply *status effects* — knockback, burning, freezing — depending on the liquid loaded. ([Wave wiki](https://mindustry-unofficial.fandom.com/wiki/Wave), [Sublimate wiki](https://mindustry-unofficial.fandom.com/wiki/Sublimate))
- **Cooling as a separate resource:** most turrets can be fed Water or Cryofluid as *coolant* to raise fire rate — but faster firing burns ammo faster. A genuine throughput tradeoff. ([Turrets](https://mindustry.miraheze.org/wiki/Turrets))

### WHY this creates depth / engagement
- **A single turret has a built-in upgrade curve that is *legible and earned*.** You don't buy "+10 damage"; you build the production chain to make better bullets, and the *same gun visibly hits harder*. This directly answers complaint #5 ("did upgrading actually help?") — the improvement is causal and observable (better ammo = bigger boom), not an invisible stat bump.
- **It distinguishes towers by *role*, not just numbers.** Knockback ammo vs. burning ammo vs. raw damage = different strategic uses against different enemies — answering complaints #9 ("what's the difference, does it matter?") and #10 ("every wave should need a different strategy").
- **Coolant tradeoff** turns a single tower into a small optimization puzzle (fire rate vs. ammo supply) without adding a new tower.

### Dilute for kids
Item-conveyor ammo is far too much for a 5-year-old. But the *principle* — "one tower behaves differently based on a simple choice you make" — is gold and cheap:
- **Two-state ammo toggle per tower.** Tap a tower to swap its shot between, e.g., **"fast pellets"** (anti-swarm) and **"big boom"** (anti-armor). One tap, no logistics, instantly readable visual change. This adds the *whole point* of Mindustry's ammo system (a turret has a personality you tune to the wave) at near-zero click-load.
- **Visible-tier ammo as the upgrade.** Make upgrades change the *projectile sprite* (small dart → glowing star → comet), so "did it help?" is answered by the eyeball, not a tooltip.
- Skip coolant entirely, or fold it into a single optional "speed boost" tile (see §6 overdrive).

---

## 4. Production chains (the "why do I have so much money?" lever — inverted)

Mindustry has **no free-floating currency for combat.** Instead of "coins," your economy *is* a physical pipeline:

- **Raw items** come from drills/extractors (copper, lead, sand, coal). **Processed items** come from factories (e.g., Graphite Press turns coal→graphite; Silicon Smelter turns coal+sand→silicon). ([Resources](https://mindustry-unofficial.fandom.com/wiki/Resources), [production guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1997547694))
- **Concrete chains with real ratios:** Graphite Press = 2 coal → 1 graphite every 1.5s. Silicon Smelter = 1 coal + 2 sand → 1 silicon. These ratios force you to *balance* input rates or starve the line. ([production guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1997547694))
- **Logistics is the actual game:** conveyors have fixed input/output sides; routers, junctions, sorters, and overflow gates let you split/merge/prioritize streams. Mismanaged routing *clogs* and silently starves your turrets mid-wave. ([Transportation guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1935045318))

### WHY this creates depth / engagement
- **Scarcity is *spatial and continuous*, not a lump sum.** This is the exact opposite of CuteDefense's "60 coins and a wallet of money I don't know what to do with" (complaints #4 + #5). In Mindustry you never have "too much money" because resources are a *flow rate* you're always trying to grow and never quite have enough of. Every turret you add is a draw on a pipe you can *see* straining.
- **It makes spending feel consequential.** Building a turret commits a chunk of your *throughput*, so over-building visibly starves the rest of your base. The cost is felt, not abstract.
- **Constant low-stakes optimization** keeps hands and eyes busy *between* waves — the "downtime" is productive, not empty.

### Dilute for kids — this is the most important takeaway for the economy complaints
Do **not** add conveyors. But fix "too much money" by importing the *idea* of **a flow you can see and outgrow**:
- Replace/augment the lump-sum wallet with a **visible income trickle** (e.g., a "coin factory" tile, or income that scales with enemies killed) and make **good options always slightly out of reach**, so there's never a moment of "I have everything, now what." The feeling to copy: *you are always saving toward the next meaningful thing.*
- **Sinks must keep pace with income.** The reason CuteDefense has "too much money" is sinks (2 towers, a few upgrades) cap out while income keeps flowing. Mindustry never caps the sink (always another turret/wall/factory to build). For kids: add a *few* always-relevant sinks (a cheap repeatable defense, a consumable, a one-tap boost — see §6) so spare coins always have an obvious home.
- Keep the **manual coin-tap collection** if you like the charm, but consider it the kid-friendly analog of "piloting your ship to grab dropped resources" — just make sure it doesn't compete with watching the battle (complaint #6/#7). Auto-collect during boss waves, manual otherwise, is one compromise.

---

## 5. Air vs. ground: the dedicated-coverage decision

Turrets are split by **what they can target**: ground-only, air-only, or both. ([Turret API](https://mindustrygame.github.io/docs/mindustry/world/blocks/defense/turrets/Turret.html))

- **Ground-only:** Salvo (high single-target burst), Ripple (long-range artillery), Lancer (piercing laser). ([Salvo](https://mindustry-unofficial.fandom.com/wiki/Salvo), [Ripple](https://mindustry-unofficial.fandom.com/wiki/Ripple), [Lancer](https://mindustry-unofficial.fandom.com/wiki/Lancer))
- **Air-only:** Scatter (flak, shreds aircraft). ([Scatter](https://mindustry-unofficial.fandom.com/wiki/Scatter))
- **Both (rare & prized):** Duo, Spectre, Cyclone, Swarmer. ([Duo](https://mindustry-unofficial.fandom.com/wiki/Duo), [Spectre](https://mindustry-unofficial.fandom.com/wiki/Spectre))
- Players openly find anti-air's scarcity *frustrating* — and that friction is the point: "there are only a few turrets that can target air, and some of the biggest bosses are air units," so you **must** dedicate slots and space to AA or get blindsided. ([Limited anti-air discussion](https://steamcommunity.com/app/1127400/discussions/0/1735507772343146315/))

### WHY this creates depth / engagement
- **A hard targeting axis forces *deliberate composition*.** You can't spam one turret; an all-ground defense gets wrecked by an air boss. This is the cleanest answer to complaint #10 — a wave's *type* (not just its size) dictates which defense matters. It also gives towers unambiguous *identity* (complaint #9): "this one hits planes, that one doesn't" is instantly understandable.
- **It creates legible counters.** Players can *learn* "air wave coming → I need the air turret," which is satisfying mastery, not memorized stats.

### Dilute for kids — very high transferable value, low cost
A binary "flying vs. walking" axis is one of the most kid-legible depth levers possible:
- Give one of the **two existing towers** a clear matchup edge: e.g., **basic = good vs. fast/flying**, **strong = good vs. armored/walking**. Telegraph it with shape (the V1 enemy diamond=fast already helps).
- Add **flying enemies** (balloons?) that *only* one tower can hit, and **shielded/ground** enemies the other counters. Now a wave that's "all balloons" *demands* the basic tower forward, and a wave of "tanks" demands the strong tower — without adding a single new tower. This alone could carry complaints #9 and #10.
- Telegraph the incoming wave's dominant type with a **big friendly icon** before it spawns, so a kid can pre-plan one decision rather than react under pressure (low click-load, high agency).

---

## 6. Support buildings: walls, repair (menders), overdrive

Mindustry separates *firepower* from *survivability* and *amplification* into distinct, placeable systems.

- **Walls** are HP tiers (copper → titanium → thorium → phase/plast), used to **soak damage, force enemy pathing, and protect the turrets behind them.** "Forcing enemy units to walk along a passage enclosed by highly durable walls maximizes the HP in your defense." ([Defensive strategy](https://steamcommunity.com/sharedfiles/filedetails/?id=1893177624))
- **Maze-building:** because enemies prefer to *route around* walls rather than break them, you can shape a long killing corridor — trading map space + build effort for extended turret exposure on the enemy. ([Maze strategy](https://steamcommunity.com/sharedfiles/filedetails/?id=1893177624))
- **Menders / repair projectors** heal nearby blocks, letting a wall line *survive sustained fire* instead of being one-and-done — repair is its own resource investment. ([Defensive strategy](https://steamcommunity.com/sharedfiles/filedetails/?id=1893177624))
- **Overdrive projectors** boost the speed/fire-rate of nearby buildings — an *area amplifier* that rewards clustering and adds a placement puzzle (cover the most turrets).

### WHY this creates depth / engagement
- **Decouples "deal damage" from "stay alive" from "go faster,"** so defense is a *composition* of complementary roles, not a single stat race. Each support building is a different lever on the same battlefield.
- **Walls + pathing turn the empty map into a design canvas** — *where* the lane goes is a player decision, which is much more engaging than a fixed path. (Note: CuteDefense uses fixed paths for simplicity; even a *few* player-placeable "blocker" tiles would import a slice of this.)
- **Overdrive/area-buff creates a "cluster vs. spread" tension** — concentrate for the buff, or spread for coverage.

### Dilute for kids
- **One area-buff tile** ("speed flower"? a tile that makes adjacent towers fire faster) is a single, cheap, repeatable **coin sink** (helps §4) *and* a light placement puzzle ("put it where it touches both my towers"). High charm, one decision.
- A **repair/heal** concept could pair with a "boss stuns my tower" mechanic (§2): a cheap "fix-it" tap that un-stuns a tower — visible cause, visible cure, tiny click.
- Skip walls/mazes unless you want player-shaped paths later; if so, a *handful* of placeable blocker tiles (not a full grid) keeps it kid-scoped.

---

## 7. Wave & enemy variety (the "every wave is the same, just more" lever)

CuteDefense's complaint #10 is the heart of this section. Mindustry's waves vary along several independent axes, not just count:

- **Enemy unit roster is broad and *role-differentiated*:** ground units (Dagger, Mace — flamethrower/burn status, Crawler — can walk over blocks & explodes), air units (Flare — fast burst flyer, Horizon, Zenith, Antumbra), and naval units. ([UnitTypes source](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/content/UnitTypes.java), [Dagger](https://mindustry-unofficial.fandom.com/wiki/Dagger), [Mace](https://mindustry-unofficial.fandom.com/wiki/Mace), [Flare](https://mindustry-unofficial.fandom.com/wiki/Flare))
- **Distinct movement/behavior, not just HP:** flyers ignore your ground maze entirely; crawlers walk *over* your blocks; burst-flyers only shoot while moving. Each demands a *different* counter.
- **Boss/Guardian waves** at fixed intervals (e.g., Quasar; Toxopid spawns wave 39, returns every 40) are spikes that test whether your *composition* (not just your DPS) is complete — an air guardian punishes a ground-only base. ([Units](https://mindustry.miraheze.org/wiki/Units))
- **Attack sectors run infinite escalating waves** until a guardian — a clear "rising tension → climax" rhythm. ([Attack sectors](https://mindustry-unofficial.fandom.com/wiki/Guide:_Attack_Sectors))

### WHY this creates depth / engagement
- **Each enemy is a *question* that a specific defense answers.** Variety lives in the *interaction* (this enemy ignores walls / that one resists fire / this one only the AA turret can hit), so "more enemies" is never the only change. This is exactly the design CuteDefense's tester is asking for.
- **The mix forces *re-planning* per wave**, which is the renewable engagement: you're never done thinking, because next wave changes the question.

### Dilute for kids — pairs directly with §5
- Lean on **2–3 enemy "verbs"** rather than many stats: *flies* (only tower A hits), *shielded* (needs the big-boom shot first), *fast swarm* (needs fast pellets / AoE), *heals itself* (V2 already has boss_regenerate — make the counter legible). Each verb maps to a tower/ammo choice you already have.
- Make **each public wave foreground one verb** with a telegraphed icon, so wave 3 is "the balloon wave," wave 4 is "the shield wave," etc. *Same two towers, genuinely different puzzle* — the cheapest possible fix for "every wave is the same."
- Boss waves = "all verbs at once" stress test, which justifies having built a balanced layout (and explains *why* the boss is hard — complaint #3).

---

## 8. Attention / click-load management (critical for ages 5–10)

Mindustry is high-load, but it uses several mechanisms to *cap* the load — and these are the relevant patterns:

- **Pause-to-plan:** "The Pause Button is your friend... stop time and plan your next moves." You can **queue building actions while paused**, converting real-time pressure into untimed decisions. ([Beginner guide via levelwinner](https://www.levelwinner.com/mindustry-beginners-guide-tips-tricks-strategies/))
- **Automation absorbs the repetitive clicks:** the player ship auto-deposits resources at the Core and can be sent to gather/fight semi-autonomously; conveyors/factories run *themselves* once placed. You set up a system *once*, then watch it work. ([levelwinner](https://www.levelwinner.com/mindustry-beginners-guide-tips-tricks-strategies/))
- **Set-and-forget structures:** the design ideal is "unattended sector defense" — build it right and it survives without micromanagement. ([Unattended defense](https://mindustry-unofficial.fandom.com/wiki/Unattended_Sector_Defense))

### WHY this matters for CuteDefense
Complaints #6 and #7 ("too much to click," "can't watch the battle because I'm placing towers") are *exactly* what these mechanisms address. The lesson:

- **Front-load decisions into untimed windows.** A **between-waves planning phase** (towers placeable freely, "Start Wave" button to begin) converts CuteDefense's frantic mid-wave placing into calm pre-wave setup. Kid presses "go" when ready. This is the most important single fix for click-load.
- **Set-and-forget is the default; tapping is the exception.** Towers should fire/target automatically (they do). Reserve taps for *meaningful* choices (place, upgrade, ammo-toggle, collect) — never for things the sim can do itself. Auto-targeting is right; manual coin collection *during* a busy wave fights this principle (consider auto-collect on boss waves).
- **One decision per beat.** Mindustry lets experts make many; for kids, telegraph *one* salient choice per wave (the incoming verb, §7) so a child makes a single confident decision rather than many anxious ones.

---

## 9. Anti-patterns to NOT import (perf + kid-scope guardrails)

- **No conveyor/logistics layer.** It's the soul of Mindustry but a non-starter for kids and for a minimal sprite-cached renderer — hundreds of moving item entities would blow the p95 frame budget.
- **No deep tech tree / dozens of turrets.** The "2 towers" constraint is a feature. Add depth via *modes* of those two (ammo toggle, air/ground edge), not new towers.
- **No fully destructible base.** Borrow *visible, recoverable* risk (stun/steal), not attrition that punishes a child for a placement made minutes ago.
- **No real-time resource starvation under the hood.** Keep economy a single legible number/flow, not a simulated pipe network.

---

## 10. Top transferable takeaways (ranked for CuteDefense V2)

1. **Between-waves planning phase + "Start Wave" button** — the highest-leverage click-load fix; turns frantic placing into calm setup. (§8 → complaints #6, #7)
2. **Air/ground (flies/walks) targeting axis on the existing 2 towers** — instant tower identity + per-wave strategy at near-zero cost. (§5 → complaints #9, #10)
3. **One telegraphed "verb" per wave** (flies / shielded / swarm / heals) mapped to the tower or ammo that counters it — kills "every wave is the same." (§7 → complaint #10)
4. **Two-state ammo toggle per tower** (fast pellets vs. big boom) with a *visible projectile change* — adds Mindustry's "tunable turret" depth and makes upgrades *legible*. (§3 → complaints #5, #9)
5. **Visible, recoverable risk from bosses** (stun-the-tower / steal-a-coin with an on-screen attack) — makes loss legible and gives the player real stakes. (§2 → complaints #3, #11)
6. **Fix the economy by matching sinks to income** — add a few always-relevant coin sinks (a one-tap area buff, a consumable) and keep good options "always saving toward," so there's never "too much money." (§4 → complaints #4, #5)
7. **One area-buff support tile** ("speed flower") — a cheap repeatable coin sink + a light placement puzzle, in one charming object. (§6 → complaints #4, #8-adjacent: gives a reason to spread towers out)
8. **Set-and-forget default; taps only for meaningful choices** — auto-target always, auto-collect coins during boss waves, reserve clicks for decisions. (§8 → complaint #6)

---

### Sources
- [Turrets — Mindustry Encyclopedia (Miraheze)](https://mindustry.miraheze.org/wiki/Turrets)
- [Turret — Mindustry API docs](https://mindustrygame.github.io/docs/mindustry/world/blocks/defense/turrets/Turret.html)
- [Resources — Mindustry Unofficial Wiki](https://mindustry-unofficial.fandom.com/wiki/Resources)
- [Deeper Understanding of Mindustry II: Extraction & Production (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=1997547694)
- [Deeper Understanding of Mindustry I: Transportation (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=1935045318)
- [Mindustry Beginners Guide (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=1893177624)
- [Mindustry Beginner's Guide (Level Winner)](https://www.levelwinner.com/mindustry-beginners-guide-tips-tricks-strategies/)
- [Core — Mindustry Unofficial Wiki](https://mindustry-unofficial.fandom.com/wiki/Core)
- [Units — Mindustry Encyclopedia](https://mindustry.miraheze.org/wiki/Units)
- [UnitTypes.java — Mindustry source (GitHub)](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/content/UnitTypes.java)
- [Dagger](https://mindustry-unofficial.fandom.com/wiki/Dagger) · [Mace](https://mindustry-unofficial.fandom.com/wiki/Mace) · [Flare](https://mindustry-unofficial.fandom.com/wiki/Flare)
- [Salvo](https://mindustry-unofficial.fandom.com/wiki/Salvo) · [Ripple](https://mindustry-unofficial.fandom.com/wiki/Ripple) · [Lancer](https://mindustry-unofficial.fandom.com/wiki/Lancer) · [Scatter](https://mindustry-unofficial.fandom.com/wiki/Scatter) · [Duo](https://mindustry-unofficial.fandom.com/wiki/Duo) · [Spectre](https://mindustry-unofficial.fandom.com/wiki/Spectre) · [Wave](https://mindustry-unofficial.fandom.com/wiki/Wave) · [Sublimate](https://mindustry-unofficial.fandom.com/wiki/Sublimate) · [Diffuse](https://mindustry-unofficial.fandom.com/wiki/Diffuse)
- [Limited anti-air is frustrating (Steam Discussions)](https://steamcommunity.com/app/1127400/discussions/0/1735507772343146315/)
- [Guide: Attack Sectors](https://mindustry-unofficial.fandom.com/wiki/Guide:_Attack_Sectors)
- [Unattended Sector Defense](https://mindustry-unofficial.fandom.com/wiki/Unattended_Sector_Defense)
- [Do turrets waste ammo? (Steam Discussions)](https://steamcommunity.com/app/1127400/discussions/0/4594180031255390437/)
