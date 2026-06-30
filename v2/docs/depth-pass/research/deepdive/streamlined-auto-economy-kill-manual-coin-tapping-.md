# Deep Dive — Streamlined / Auto Economy (kill manual coin tapping)

**Category:** Economy delivery & income decisions
**Targets feedback:** #4 (too much money), #5 (did upgrades help?), #6 (too much to click), #7 (can't see the enemies)
**Researched:** 2026-06-28
**Lens:** how successful 2D tower-defense games deliver income *without* a manual
janitorial collection chore — and, crucially, *where they relocate the interesting
economic decision once collection is automatic* — then an honest fit read for
CuteDefense V2 (kid-friendly ages 5-10, static GitHub Pages, no backend/build,
deterministic sim, 2 towers, perf-budgeted).

Primary sources:
- Sibling on-disk research: `../external/kingdom-rush-series-.md` (§10 auto-gold,
  call-early), `../external/defense-grid-the-awakening.md` (§4 auto-credit + interest +
  Command tower, §5 click-load), `../external/bloons-td-6.md` (§6 Banana Farm), `../external/gemcraft-series-.md`
  (§3 mana leech), `../external/infinitode-2.md` (§5 miners, bounty modifier),
  `../external/mindustry.md` (§4 sink-matching), `../external/plants-vs-zombies.md`
  (the *manual* counter-example).
- On-disk area analysis: `../v2/economy-coin-collection.md` (ground-truth of the live code).
- Live code: `v2/sim/systems/economySystem.js`, `v2/sim/systems/enemySystem.js`,
  `v2/sim/systems/waveSystem.js`, `v2/config/gameConfig.js`.
- Web: Bloons Wiki (Monkey Bank, Income Farming, Eco/BTDB2), Infinitode Bounty tactics,
  The Tower / TDS golden-mode income. Links in **Sources**.

---

## 0. Ground-truth: CuteDefense has *already* taken the foundational step

The project brief still says *"killed enemies DROP coins that the player must MANUALLY
tap to collect (15s lifetime)."* **That is no longer true in the shipped code.** Per
`../v2/economy-coin-collection.md` §0 and the source:

- `enemySystem.killEnemy` → `creditCoins(state, e.reward)` — the reward is **auto-banked
  the instant an enemy dies** (`enemySystem.js:160-162`, `economySystem.js:16-19`).
- The input layer has *no* coin-tap path: *"Coins are auto-collected now, so there is no
  coin tap to handle."* (`InputController.js:46-47`).
- The whole on-board coin object system (`spawnCoin`, lifetime/warning/expire/collect
  animation) plus the `economy.coin` config block (`lifetimeMs:15000`, `collectRadius:60`,
  …) is **dead code in the live path**, kept only for the benchmark stress fixture.

**So the single most important move in this entire category — removing the janitorial
manual-tap collection — is done.** That immediately defuses the *attention* half of the
complaints: there is no longer a stream of low-value clicks pulling the player's eyes to
the ground during the fight (the textbook root cause of #6 "too much to click" and #7
"can't see the enemies," exactly as Defense Grid's design proves the genre works *better*
without pickup — see DG §5).

That reframes this deep dive. The question for CuteDefense is **not** "should we kill
manual tapping?" (already answered, correctly, with the entire genre — KR, Defense Grid,
Infinitode, BTD6, GemCraft all auto-credit; PvZ is the lone deliberate manual outlier and
it's a *different* design contract). The real question is the **second half of the
category that CuteDefense has *not* yet addressed**:

> Once income arrives automatically, the interesting economic decision has to live
> *somewhere*, or you are left with a bare faucet→fixed-sink pipe — which is exactly the
> "I have so much money and nothing to do with it / did my spend even matter?" state the
> grownup hit (#4, #5).

The rest of this document catalogs *where successful auto-economy TDs put that decision.*

---

## 1. The two halves of "auto economy"

Every game in the corpus that removes manual collection pairs it with **at least one**
mechanic that re-injects an income decision. The pattern is consistent:

| Game | Collection | Where the income *decision* lives |
|---|---|---|
| **Kingdom Rush** | auto gold on kill | **call-wave-early** for bonus gold (= seconds skipped) |
| **Defense Grid** | auto-credit on kill | **interest on idle cash** + **Command tower** (economy investment) + fast-kill **Seeker bonus** |
| **Bloons TD 6** | auto cash (kill + per-round) | **Banana Farm / Monkey Bank** income towers (invest-vs-defend, 15% bank interest) |
| **GemCraft** | auto mana (regen + on-hit) | **orange-gem mana leech** (income is a *build choice*) + summon-early for bonus |
| **Infinitode 2** | auto-bank kill rewards | **Miners** (economy-vs-defense tile bet) + **Bounty modifier** (+2%/wave) |
| **Mindustry** | auto-deposit by ship | income is a *flow rate you grow* — sinks never cap |
| **Plants vs Zombies** | **manual** sun clicks (counter-example) | the click *is* the decision (skill + scarcity) |

The lesson is blunt: **auto-credit is necessary but not sufficient.** It fixes attention;
it does nothing for money confusion. CuteDefense currently has the *necessary* half and
none of the *sufficient* half — its only income decisions are "spend now vs spend slightly
later" and "which tower," which is why a finite 2×3 sink ladder floods at endgame
(`../v2/economy-coin-collection.md` §3, `BALANCE.md` §5).

---

## 2. The patterns (how successful TDs implement auto economy)

### Pattern A — Auto-credit kill bounty (the baseline streamline)
**How it works.** Each enemy carries a fixed bounty; on death it is credited instantly to
the wallet with light juice (a number pulse, a sound). No object to chase, no pickup
window, no expiry. Universal: KR, Defense Grid (*"kills auto-credit resources — no manual
pickup"*), Infinitode, BTD6, GemCraft.
**Depth added.** *None on its own — and that's the point.* It *removes* a non-decision
(janitorial collection) and returns the player's eyes and clicks to the actual game
(placement, watching the lane). It is the enabling move, not a depth source.
**Complexity / click-load cost.** Negative cost — it deletes work. **Already implemented in
CuteDefense** (`enemySystem.js:160-162`). The only residue is dead code/config to retire.

### Pattern B — Taught, visible end-of-round lump sum
**How it works.** Beyond per-kill bounty, pay a predictable chunk at wave end, *shown and
explained* ("Wave clear +20c"). BTD6's per-round cash and KR's gold both give a clean
"earn during the wave → spend in the calm between waves" cadence the player can plan
around.
**Depth added.** Cleanly separates the **build/decide phase** (between waves) from the
**watch/react phase** (during the wave) — the exact separation KR §11 and DG ("design then
wait") use to manage attention. Predictable income lets the player *plan* a purchase
rather than react to a trickle.
**Complexity / click-load cost.** Low. CuteDefense *already pays a 25% end-of-wave bonus*
(`waveSystem.js:157-164`) — but **the rule is invisible**, so it reads as random free money
and *feeds* the "too much money, no idea why" perception (#4). Cost here is almost entirely
*surfacing* an existing mechanic: show the number and teach it once. Pure UI, no sim change.

### Pattern C — Passive income tower / "farm" (the invest-now-pay-later fork)
**How it works.** A buildable that **earns coins instead of shooting** — BTD6's Banana
Farm, Defense Grid's Command tower (boosts salvage 125-145% in range), PvZ's Sunflower,
Infinitode's Miner. You pay now for a structure that does *nothing defensive*; it pays back
over later waves.
**Depth added.** The single most-cited "best decision in the genre" (PvZ §2, BTD6 §6). It
creates the **offense-vs-economy dilemma every match**: over-invest and an early push kills
you before it pays off; under-invest and you're starved late. It also makes the upgrade
payoff *legible* — "my income went up" is a clear before/after, directly answering #5. And
it **absorbs surplus** — money now has a competing use, defusing #4. BTD6 hard-modes
*cannot* be won on kill-income alone; you *must* farm — economy becomes a real second game.
**Complexity / click-load cost.** Medium-high *conceptually for the 2-tower brief* — a farm
is effectively a third placeable, and delayed-payoff economics is a sophisticated idea for a
5-year-old. Mechanically cheap (a tile that emits coins on a timer). Mitigation seen in the
corpus: make it a **structure, not a combat tower** (preserves "exactly 2 towers"), or fold
the role into an *upgrade choice* on an existing tower.

### Pattern D — Tie income to play quality (fast-kill bonus / leech-on-hit / bounty %)
**How it works.** Income scales with *how well* you're playing, automatically, with zero
extra clicks: Defense Grid's Seeker drops **more resources the faster you kill it**;
GemCraft's **orange gems leech mana on every hit** (income *is* a build choice);
Infinitode's **Bounty modifier** grants **+2% of current coins each wave** (capped ~50-100);
idle-TD "golden" windows multiply cash-per-kill during an activation.
**Depth added.** Income reflects skill, not just elapsed time — *self-balancing*: a
struggling player earns less (gentler), a dominating player earns more (a reward they can
*see*). It turns "too much money" into "I *chose* to invest in income vs damage — was it
worth it?" (GemCraft §3, Infinitode §5). All of it is **automatic** — no janitorial clicks,
fully compatible with auto-credit.
**Complexity / click-load cost.** Low-medium. The leech/bounty math is a multiplier in the
existing kill path (deterministic, perf-trivial). Risk: a sudden money jump the player
can't attribute can *worsen* the "why do I have so much money?" confusion unless the cause
is visualized (a coin-pop on the leeching hit, a "+N bounty" float).

### Pattern E — Call-wave-early / send-to-earn (the opt-in greed valve)
**How it works.** One tap converts spare time or confidence into income at the cost of
stacking pressure. KR: tap the incoming-wave icon to **summon the next wave early for bonus
gold equal to the seconds skipped**. GemCraft: summon waves (or several) early for **bonus
XP/mana**. BTD Battles: **eco** — *sending* economic bloons raises your passive income/6s,
while strong sends give little or negative eco (a pure risk/greed dial).
**Depth added.** An elegant **single-tap risk/reward** lever: confident players
self-accelerate and earn more (opt-in difficulty, no difficulty menu); strugglers simply
ignore it (the floor never rises). It directly soaks the "nothing to do between waves / too
much idle money" lull (#4) by letting skilled play *convert spare time into gold*. Decision
is **timing** ("now or save for the boss?"), not dexterity.
**Complexity / click-load cost.** Low. One button, one tap, paced by its own nature. Adds
near-zero UI. Deterministic (cooldown/bonus tick on the fixed timestep). The main authoring
cost is balancing the bonus so it's tempting but not mandatory.

### Pattern F — Interest / banking on idle cash (spend-now vs hold)
**How it works.** Unspent money grows. Defense Grid: *"if you have unspent resources you
are awarded more over time; the more unspent, the more you gain."* BTD6 Monkey Bank:
deposited cash earns **15% compounding interest per round** up to a cap (~$7,000), withdrawn
on demand; full banks stop earning, so *when you collect* is itself a decision.
**Depth added.** Makes **hoarding a strategy, not a failure** — a real spend-now-vs-bank
fork, and banking early can snowball a stronger late board. Gives the player a reason to
*ever* delay a spend (which CuteDefense's pure faucet→sink pipe never provides).
**Complexity / click-load cost.** Mechanically trivial (a per-wave multiply on the wallet).
But **conceptually the worst fit for ages 5-10**: it rewards delayed gratification and
mental compounding, and — critically — it *encourages accumulating a big pile*, which risks
**actively worsening #4** (a child watching a number balloon with nothing to spend it on).
Include only if paired with a strong, always-present sink.

### Pattern G — Match sinks to income so surplus always has a home
**How it works.** Not an income mechanic at all — the spend side that makes auto-economy
*feel* good. Mindustry never caps the sink (always another turret/wall/factory), so "too
much money" can't occur: economy is a *flow rate you grow*, with good options always
slightly out of reach. The feeling to copy: *always saving toward the next meaningful
thing.* Defense Grid goes further — **leftover money literally scores points**, so surplus
is never "wasted."
**Depth added.** Re-frames the entire economy from "fill a finite ladder then drown" to "an
open-ended optimization." This is the *true* root fix for #4: `../v2/economy-coin-collection.md`
§3 and `BALANCE.md` §5 both diagnose CuteDefense's flood as a **finite 2×3 sink ladder**, not
an income problem. Auto-credit only feels flat because there's nothing left to want.
**Complexity / click-load cost.** Design-level. Cheap, kid-safe options from the corpus: a
one-tap repeatable consumable (a "boom"/"freeze" charge), a single aspirational *golden
top-tier* upgrade that requires real saving (BTD6 §11, Mindustry §6), or scoring leftover
coins. Overlaps the sibling "deeper sinks / banking" deep dive — flagged, not duplicated here.

### Pattern H — Make the freed attention pay off: legible "saving toward X" affordance
**How it works.** Once collection is automatic, the wallet stops being a thing you *act on*
and becomes a thing you *read*. The genre keeps it legible: a clear next-purchase target, an
"almost enough" cue, a visible before/after on a spend. CuteDefense currently shows a bare
pulsing number and an `Upgrade 50c` button with **no preview of what 50c buys**
(`Renderer.js:593`, `../v2/economy-coin-collection.md` §3 #5).
**Depth added.** Converts auto-income's freed attention into *anticipation* ("3 more kills
and I can upgrade"), and makes spends evaluable — the core of answering #5.
**Complexity / click-load cost.** Pure renderer/UI, zero sim, zero perf cost. Show the
upgrade delta (`Damage 8→12`, range-ring preview) and a single "power" number a child can
watch rise (raw `Damage` + `Fire 1.80s` is kid-hostile — they can't compute DPS).

---

## 3. Honest fit assessment for CuteDefense V2

**The headline:** CuteDefense has already done the hard, correct part of this category
(auto-credit, killing the manual tap) and thereby largely *fixed the attention complaints*
(#6, #7) at the economy layer. What it has **not** done is the second half — giving the
now-automatic economy a *decision* and a *legible payoff* — which is why #4 and #5 persist.
So the highest-value work in this category for CuteDefense is **not** more streamlining;
it's adding a *single* income decision and *surfacing* what's already there.

Ranked by fit (impact vs the four hard constraints):

**Tier 1 — do these (cheap, kid-safe, high impact):**
- **B (surface the end-of-wave bonus)** and **H (legible "saving toward X" + upgrade
  preview).** Both are pure UI over mechanics that already exist (the 25% bonus is live but
  invisible; the upgrade button shows no delta). Zero sim risk, zero perf cost, directly
  answer #4 ("now I see *why* money arrives") and #5 ("now I see what the spend buys").
  These are the obvious first moves.
- **G (one always-relevant sink).** The diagnosed root cause of #4 is the finite 2×3 ladder,
  not income. One cheap repeatable sink (a tap-to-fire "boom"/"freeze" charge) or a single
  aspirational golden top-tier gives surplus a home without a third tower. (Note: this
  overlaps a sibling deep dive on sinks — coordinate there.)

**Tier 2 — strong fit, one well-chosen addition:**
- **E (call-wave-early for a coin bonus).** The best *pure* fit for this category: one
  optional button, no floor-raising, deterministic on the fixed timestep, and it converts
  the late-game "nothing to do / too much money" lull into a greed decision. Kid-safe
  because ignoring it costs nothing. Low UI, low perf. If only one *new* mechanic is added
  from this category, this is it.
- **D (tie income to play quality), in its gentlest form.** A small "fast-kill" or
  per-wave bounty bonus, *visualized* (a coin-pop), rewards good play automatically with no
  clicks. Watch the attribution risk — an unexplained money jump worsens #4, so it must be
  *shown*.

**Tier 3 — fits the genre but fights CuteDefense's brief:**
- **C (income/farm structure).** Genuinely the deepest economy decision in TD, and it would
  absorb surplus *and* make upgrade payoff legible. But it is effectively a third placeable
  and a sophisticated delayed-payoff concept — real tension with "exactly 2 towers" and the
  5-10 audience. Viable only as a *structure* (not a combat tower) or folded into a tower's
  level-3 fork; treat as a stretch, not a first move.
- **F (interest/banking).** Best avoided. Mechanically trivial but it *rewards hoarding*,
  which risks **worsening** the exact symptom (#4) the category is meant to fix, and
  delayed-gratification compounding is the least kid-legible idea in the corpus. Only
  consider if a strong sink (G) is already absorbing surplus.

**Constraint check (applies to all of the above):**
- *Static host / no backend / no build:* every pattern here is in-sim state + a config
  number + renderer work. None needs a server, persistence, or a build step. (Cross-run
  meta-economy would need `localStorage`, but no Tier-1/2 pattern requires it.)
- *Deterministic sim:* all income math (bonus, bounty %, call-early bonus, interest) is
  arithmetic on the fixed 60fps step with the seeded RNG already in place — no determinism
  risk. Keep every constant in `gameConfig.js` (the 25% bonus, the cap-wave logic, and the
  vestigial `economy.coin` block already live there).
- *Perf budget:* auto-credit is *cheaper* than the on-board coin objects it replaced (the
  dead `spawnCoin`/lifetime/animation path can be deleted, a small win). Surfacing the bonus
  and adding a call-early button are negligible. Nothing in Tier 1/2 adds per-frame work
  near the V1 p95 gate.
- *Low click-load (the whole point):* Tier 1 adds *zero* clicks (it's display). E adds *one
  optional* tap. None re-introduce a per-coin or per-wave janitorial action — the category's
  cardinal rule, already honored by the auto-credit baseline.

**Bottom line.** For CuteDefense, "streamlined / auto economy" is ~80% already shipped and
correct. The remaining 20% that actually moves #4 and #5 is **legibility + one decision**,
not more automation: surface the bonus, preview the upgrade, give surplus one home (Tier 1),
and — if adding a single new mechanic — a **call-wave-early coin bonus** (Tier 2). Avoid
banking/interest; defer the farm structure as a brief-straining stretch.

---

## Sources

- [Income Farming (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Income_Farming_(BTD6))
- [Monkey Bank (BTD6) — Bloons Wiki](https://bloons.fandom.com/wiki/Monkey_Bank_(BTD6)) (15% compounding interest, ~$7,000 cap, collect-when-full strategy)
- [Complete Guide to Banana Farms — bloon.games](https://bloon.games/complete-guide-to-banana-farms-in-btd6/)
- [Eco (BTDB2) — Bloons Wiki](https://bloons.fandom.com/wiki/Eco_(BTDB2)) (income/6s, send-to-earn risk/greed)
- [Bloons TD Battles 2 — Income Strategies — Bloons Wiki](https://bloons.fandom.com/wiki/Bloons_TD_Battles_2/Strategies/Income_Strategies)
- [Bounty tactics — Infinitode 2 Wiki](https://infinitode-2.fandom.com/wiki/Bounty_tactics) (+2% current coins/wave, ~50-100 cap)
- [Currency — The Tower (Idle TD) Wiki](https://the-tower-idle-tower-defense.fandom.com/wiki/Currency) · [Golden Tower](https://the-tower-idle-tower-defense.fandom.com/wiki/Golden_Tower) (timed cash-per-kill multiplier window)
- [Gold — Kingdom Rush Wiki](https://kingdomrushtd.fandom.com/wiki/Gold) (auto gold on kill; call-wave-early bonus = seconds skipped) — corroborated via on-disk `../external/kingdom-rush-series-.md` §10
- On-disk corpus: `../external/defense-grid-the-awakening.md` (§4 auto-credit + interest + Command tower), `../external/bloons-td-6.md` (§6), `../external/gemcraft-series-.md` (§3 mana leech), `../external/infinitode-2.md` (§5), `../external/mindustry.md` (§4), `../external/plants-vs-zombies.md` (manual counter-example), `../v2/economy-coin-collection.md` (live-code ground truth)
