# CuteDefense V2 — Depth Catalogue (SYNTHESIS-A: external + scout + deepdive)

> A ruthlessly curated menu of mechanics worth stealing, drawn from the 8 external game
> briefs (Bloons TD 6, Kingdom Rush, Defense Grid, GemCraft, Infinitode 2, Mindustry,
> Plants vs. Zombies, Rogue Tower), the cross-genre `scout.md`, and the 5 depth-pass
> deepdives. Organised by category. Each entry: **what it is · depth it adds · kid /
> static-host fit · which grownup-feedback gap it closes · a verdict** (priority +
> dependency/caveat). This is a curator's pick-list, not a transcript — weak or
> off-constraint ideas are demoted to §10 (non-imports) rather than listed as equals.

**Feedback legend** (referenced as `#n` throughout):
1 placing is fun · 2 lost-to-boss → wanted to replay · 3 boss eats lives, why · 4 too
much money · 5 did upgrades help · 6 too many clicks · 7 can't watch the enemies · 8 big
towers overlap/squish · 9 only 2 towers, does the choice matter · 10 every wave is the
same, just more · 11 no risk to me (towers can't be touched).

---

## 0. Ground-truth corrections (read before designing)

The deepdives audited the live code; three brief assumptions are **stale** and change the
priorities:

- **Manual coin-tapping is ALREADY gone.** Shipped code auto-credits the bounty on kill
  (`enemySystem.killEnemy → creditCoins`); the on-board coin object / 15s-lifetime / tap
  path is dead code kept only for the bench fixture. So the single biggest economy fix
  (kill the janitorial tap) is **done**. The remaining economy work is *legibility + one
  decision*, not more automation.
- **A 25% end-of-wave bonus already pays out — but invisibly** (`waveSystem.js`). It reads
  as random free money and actively *feeds* #4. Surfacing it is nearly free.
- **Calm windows already exist in data** (`prepMs: 8000`, `betweenWaveMs: 3000`) but are
  never framed as planning time or made skippable. Pattern E (below) is "add one button."
- **Current pause is an anti-pattern:** it blocks all world taps and draws a full-canvas
  scrim ("freeze and stare at grey"). The whole time-control category needs this inverted,
  not built from scratch.
- **`boss_split` is already implemented**; the public bosses (5/10/15) do *not* peel and
  the shield boss's invuln has *no tell*. So "legible bosses" is mostly wiring existing
  signals, not new systems.

---

## 1. Pacing & click-load — the "time" levers (cheapest, highest-impact)

The two loudest complaints (#6, #7) are a *time* problem, not a content problem: the player
must decide while the board moves, so building steals the eyes from the payoff. Every fix
here is pure client-side logic over the game clock — no assets, no backend, mostly
*subtractive*, and perf-positive (a paused frame runs zero sim ticks).

- **Active / tactical pause (place + inspect while frozen, non-occluding overlay)**
  *(Defender's Quest, GemCraft, Bloons)* — Pause anytime and still issue commands;
  building still *costs coins*, so pause buys thinking-time, not free power.
  **Depth:** decisions get strictly better unrushed, so you can pose harder spatial/economic
  puzzles (the #9/#10/#11 work) without raising the click bar. **Fit:** the sim already
  freezes on non-playing; the work is *allowing* taps through + replacing the scrim with a
  thin frame. **Closes:** #6 #7 #1 (assists #3 #5). **Verdict: TIER 1, do first.** The
  single most important change in the category and it is small.

- **Build/watch phase separation + "calm window" + call-wave-early "GO!" bonus**
  *(Kingdom Rush, Mindustry, Defense Grid, Rogue Tower)* — A guaranteed enemy-free prep
  window to set up, then a button to start the wave early for a coin bonus = unused calm
  time. **Depth:** real risk/reward decision (set up safe vs rush for gold) at *zero*
  in-combat clicks; cleanly splits "think" from "watch." **Fit:** the window already exists
  in config; this is "surface it + one GO! button." Kid-perfect (eager kid rushes,
  overwhelmed kid takes all the time). **Closes:** #6 #7 #4 #1. **Verdict: TIER 1**, the
  lowest-hanging fruit on the whole board.

- **Auto-pause / auto-slow on the build popup** *(Bloons deselect-on-Esc; project's own
  feedback note)* — The game brings the calm window to the player instead of relying on a
  hotkey a 6-year-old will never find. **Depth:** removes the "forgot-to-pause → overwhelmed"
  failure entirely. **Fit:** tie `status` to popup-open. **Closes:** #6 #7. **Verdict:
  TIER 1** — the kid-framing that makes the rest of the category actually pay off.

- **Variable speed — ONE slow + ONE fast toggle** *(Defender's Quest 0.25–4×, Bloons 3×)*
  — Slow to thread a boss window, fast to skip a trivial trickle. **Depth:** pacing becomes
  a small skill expression with no added clicks. **Fit/caveat:** the *only* perf-sensitive
  item — implement as "more fixed ticks per frame, never a bigger `dt`" (determinism +
  perf), and **bench 2× against the p95 gate before shipping.** Skip 4×. **Closes:** #5 #7.
  **Verdict: TIER 2**, bench-gated; cut the 5-step ladder to 0.5×/1×/2×.

- **Set-once / low-click play: build-tray + 2–3-mode targeting toggle** *(Bloons
  shift-to-place, First/Last/Strong; Infinitode 6 modes; Rogue Tower)* — Pick a type once
  then tap cells; a per-tower "aim" toggle (front / biggest / hurt) set once, persistent.
  **Depth:** the same tower in two modes solves two problems — decision depth that costs
  *zero* combat clicks; lets affinity (§4) pay off (focus the enemy you counter). **Fit:**
  `lastTowerType` default already tracked; cut the genre's 7 modes to 2–3 icons. **Closes:**
  #6 #5 #9. **Verdict: TIER 2**, a depth multiplier that rides on §3/§4.

---

## 2. Economy — legibility + one decision (80% already shipped)

Auto-credit is the *necessary* half and it's done. Every corpus game that auto-credits pairs
it with at least one mechanic that re-injects an income *decision*; CuteDefense has none, so
a finite 2×3 sink ladder floods at endgame — the real root of #4/#5.

- **Surface the end-of-wave bonus + legible "saving toward X" + upgrade preview**
  *(BTD6 per-round cash, Defense Grid, Mindustry/Infinitode HUD)* — Show "Wave clear +20c,"
  show the upgrade delta (`Damage 8→12`, range-ring preview) and one rising "power" number a
  child can read (raw DPS math is kid-hostile). **Depth:** converts freed attention into
  *anticipation* ("3 more kills and I can upgrade") and makes spends evaluable. **Fit:**
  pure UI over mechanics that already exist; zero sim/perf cost. **Closes:** #4 #5.
  **Verdict: TIER 1, do regardless** — the cheapest move that actually shifts #4/#5.

- **One always-relevant sink so surplus always has a home** *(Mindustry never caps the
  sink; Defense Grid scores leftover money; BTD6 aspirational top-tier)* — A cheap repeatable
  consumable (a tap-to-fire boom/freeze charge — overlaps §7), a single *golden top-tier*
  upgrade that needs real saving, or scoring leftover coins at run-end. **Depth:** reframes
  economy from "fill a finite ladder then drown" to open-ended "always saving toward the
  next thing." **Fit:** design-level, cheap, kid-safe. **Closes:** #4 (the diagnosed root).
  **Verdict: TIER 1.**

- **Call-wave-early for a coin bonus** *(Kingdom Rush, GemCraft, BTD Battles eco)* — One
  optional tap converts spare time/confidence into gold at the cost of stacking pressure.
  **Depth:** elegant single-tap risk/greed valve; soaks the "nothing to do / too much idle
  money" lull; decision is *timing*, not dexterity; never raises the floor (ignore it = no
  cost). **Fit:** one button, deterministic, low UI — and it's the *same* button as §1's GO!.
  **Closes:** #4 (assists #10 via pacing). **Verdict: TIER 2** — if adding one new economy
  mechanic, this is it.

- **Tie income to play quality (gentle)** *(Defense Grid fast-kill Seeker, GemCraft
  orange-gem leech, Infinitode +2%/wave Bounty)* — Income scales with how well you play, no
  clicks. **Depth:** self-balancing (struggler earns less, dominator earns a *visible*
  reward); turns "too much money" into "I chose income vs damage — worth it?" **Fit:** a
  multiplier in the existing kill path; **must visualise the cause** (coin-pop on the
  bonus hit) or it *worsens* #4. **Closes:** #4 #5. **Verdict: TIER 2**, attribution-gated.

- **Producer / "farm" structure (the Sunflower decision)** *(PvZ Sunflower, BTD6 Banana
  Farm, Defense Grid Command, Infinitode Miner)* — A buildable that earns coins instead of
  shooting; pay now, pays back later. **Depth:** the single most-cited "best decision in the
  genre" — an offense-vs-economy dilemma every match, with a *legible* "my income went up"
  payoff (#5). **Fit/caveat:** effectively a third placeable and a sophisticated
  delayed-payoff idea for a 5-year-old. Viable only as a non-combat *structure* (preserves
  "exactly 2 towers") or folded into a tower's level-3 fork. **Closes:** #4 #5. **Verdict:
  TIER 3 stretch**, brief-straining.

---

## 3. Tower identity & differentiation — make the 2 towers (and upgrades) *matter*

- **Soft 2-way affinity (multiplier, never immunity)** *(Kingdom Rush physical/magic/true,
  BTD6 damage types, Rogue Tower layers)* — `basic = precision/single-target` is the answer
  to fast/evasive (and regen, via burst); `strong = splash/AoE` is the answer to
  swarm/clustered (and the boom that dents armor). Wrong tool does ~0.5×, right tool ~2×,
  **never 0×**. **Depth:** converts "which tower?" from a shrug into the central per-wave
  decision; the board becomes a deliberate composition. **Fit:** O(1) multiplier lookup,
  zero added clicks (only changes damage numbers) — but adds *reading* load, so cap flags at
  2–3 and **ship with the readability layer (§5/§8) in the same change** or it's invisible
  (the exact current shield-boss failure). Hard immunity is too punishing with only 2 towers.
  **Closes:** #9 #10 (assists #5 #3). **Verdict: TIER 1** — the highest-leverage depth lever
  for the two flatness complaints; mostly *connecting existing pieces*.

- **Upgrade as an IDENTITY FORK, not a stat bump** *(Kingdom Rush specialization fork, BTD6
  crosspathing, Infinitode choose-1-of-3, Rogue Tower)* — At max level, each of the 2 towers
  forks into one of two specializations (basic → *Sniper* long-range crit **or** *Gunner*
  faster fire; strong → *Bomber* bigger AoE **or** *Froster* slows). New sprite + new
  behaviour, a commitment with opportunity cost. **Depth:** turns "do I upgrade?" into "which
  way do I specialize, and what do I give up?" — the antidote to a pure number-go-up money
  sink; 2 towers × a fork = 4 felt roles without new tower types. **Fit:** infrequent,
  binary, icon-legible; the spend becomes *seen and felt*. **Closes:** #5 #9 (assists #4 as
  a real sink). **Verdict: TIER 2**, the cleanest "did upgrading help?" fix.

- **Earn-by-fighting (dual-axis) tower growth** *(Infinitode upgrade-level + XP-level)* — On
  top of coin-bought upgrades, a quiet XP track: a tower visibly grows from *use*, not only
  spend. **Depth:** a wave-1 tower isn't the same object at wave 10 even untouched — the
  player *sees* investment pay off with near-zero clicks; "progress as a byproduct of
  watching" protects #7. **Fit:** a counter + a milestone visual; deterministic. **Closes:**
  #5 #9. **Verdict: TIER 2/3**, charming but adds a second progression model — sequence
  after the fork.

- **Two-state ammo toggle (visible projectile change)** *(Mindustry ammo, GemCraft pure-vs-
  hybrid)* — Tap a tower to swap its shot between "fast pellets" (anti-swarm) and "big boom"
  (anti-armor), with a *visible* sprite change. **Depth:** Mindustry's "a turret has a
  personality you tune to the wave" at near-zero click-load; makes upgrades legible by the
  eyeball. **Fit:** one tap, instantly readable. **Closes:** #5 #9. **Verdict: TIER 3** —
  overlaps the fork (§3) and targeting toggle (§1); pick *one* expression, don't ship all.

- **Movable / re-socketable upgrade value** *(GemCraft "the gem is the unit, the tower is a
  socket")* — An upgrade or "charm" you can pick up and move to the other tower/tile.
  **Depth:** investment is *never* wasted by a layout mistake (#5) and a squished placement
  can be *rescued by moving the value, not the footprint* (#8). **Fit:** charming, low-click,
  but a genuinely new ownership model. **Closes:** #5 #8. **Verdict: TIER 3**, elegant but a
  bigger conceptual lift than the fork; note for later.

- **Decouple visual scale from grid footprint** *(Defense Grid fixed one-cell, PvZ staged
  art, Kingdom Rush spaced build spots)* — Towers may *look* bigger per level (grow art
  *within* the cell, taller not wider; express level via glow/range-ring/crown) but occupy a
  fixed tile so neighbours never collide. **Depth:** none — it's a pure renderer fix. **Fit:**
  no sim/perf impact. **Closes:** #8 (directly). **Verdict: TIER 1 bugfix**, do it; #8 is a
  rendering decision, not a balance one.

---

## 4. Enemy abilities & wave variety — the "every wave is a puzzle" engine

The cheapest path to "every wave is unique" is enemy *rules*, not more towers. Variety is
combinatorial from a tiny vocabulary; authoring cost is flags in the wave config.

- **Composable property FLAGS, not new enemy types** *(BTD6 Camo/Lead/Regrow layered on any
  bloon; Defense Grid orthogonal traits)* — A handful of booleans compose onto a base body
  (DDT = Camo+Lead+Black on one). **Depth:** exponential wave variety from ~3 flags — the
  direct, cheap answer to #10; the player reads 2–3 icons, not a stat block. **Fit:** zero
  added clicks; trivial authoring; **legibility is the cap — 2–3 flags max** for ages 5–10.
  **Closes:** #10 #9. **Verdict: TIER 1**, pairs with §3 affinity.

- **Support / "buffer" enemy (a priority-target puzzle)** *(Defense Grid Spire/Decoy,
  Kingdom Rush Shaman)* — One enemy whose only rule is "buff the others"; the wave becomes
  "pop the umbrella monster first, then the rest are easy." **Depth:** emergent target-
  priority depth from a single rule on a single enemy; "gold for CuteDefense" per both DG and
  KR briefs. **Fit:** zero clicks if targeting stays auto; one glyph; highest depth-per-asset
  on the board. **Closes:** #10 #9 (pairs with §1 targeting toggle). **Verdict: TIER 1**, one
  of the cheapest wins available.

- **Regen / self-heal as the burst-vs-trickle test** *(BTD6 Regrow, KR Troll, CuteDefense's
  own `boss_regenerate`)* — Heals unless out-DPS'd; spread damage fails, concentrated burst
  wins. **Depth:** the clearest *in-game proof that "more damage per hit" mattered* — the
  direct answer to #5; rewards the single-target tower's identity. **Fit:** already
  implemented; unsolvable today only for lack of a legible counter + a tell. **Closes:** #5
  #3. **Verdict: TIER 1**, cheapest to *surface*.

- **Recurring (beatable) splitter** *(Infinitode Fighter, Rogue Tower vampire, CuteDefense's
  secret `boss_split`)* — Splits into smaller fast units on death; changes *where and how
  fast* you must kill. **Depth:** validated by Infinitode/Rogue Tower as real depth (not just
  more HP). **Fit:** already coded as the secret boss. **Closes:** #10. **Verdict: TIER 2**,
  promote a tamed version from "secret unbeatable hook" to a recurring wave type.

- **One telegraphed "verb" per wave, introduced one-at-a-time then recombined** *(Kingdom
  Rush/PvZ campaign craft, Mindustry, Defense Grid Tactical Recon)* — Wave 2 introduces
  armor (forces a tower swap), wave 3 a swarm (forces AoE), later armor+swarm together; each
  wave foregrounds one verb with a pre-wave icon. **Depth:** the combination space *is* the
  campaign — "every wave is a unique challenge" without exhausting the designer or adding
  assets. **Fit:** pure authoring intent over existing formations + a telegraph banner.
  **Closes:** #10 #9. **Verdict: TIER 1**, the authoring discipline that makes §3/§4 land.

- **Flying/ground (or evasive) gatekeeper axis — SOFT form** *(Mindustry air/ground, BTD6
  Camo, Defense Grid flyers)* — One enemy archetype only one tower reliably answers.
  **Depth:** the sharpest "you needed the *other* tower" lesson → informed replay (#2).
  **Fit/caveat:** a *binary* gatekeeper with only 2 towers can leak a whole wave with no
  recourse — **highest punishment-risk for kids.** Needs a soft landing (telegraph + a
  forgiving leak, not instant loss). **Closes:** #9 #10 #2. **Verdict: TIER 2**, only with
  guardrails.

- **Adaptive-resistance "anti-spam" enemy** *(Infinitode Light — gains resistance to the
  last damage type that hit it)* — A single enemy visibly shrugs off repeated identical hits.
  **Depth:** gently punishes "build one tower ×10," nudging a mix. **Fit:** subtle for the
  age band; needs a very clear tell. **Closes:** #9. **Verdict: TIER 3**, note only — risks
  illegibility for 5-year-olds.

---

## 5. Boss legibility — make the loss *teach* (fair → replay)

- **Skull-threshold telegraph (the boss explains itself on its own HP bar)** *(BTD6 Vortex /
  Bloonarius)* — Mark the HP bar with icons; crossing one fires a *scripted, watched* effect
  (a stun, an add-burst, a shield). **Depth:** converts a DPS race into a paced multi-beat
  encounter (bank damage → survive the consequence → time your burst); learnable because HP
  is deterministic. **Fit:** "`if hp crosses X% and not fired: trigger`" + a bar marker; zero
  new clicks. **Closes:** #3 #2. **Verdict: TIER 1** — the cleanest fix for #3; replace the
  current *untelegraphed* shield invuln with a skull the player watches approach (a
  `shieldedHitMs` signal already exists to wire up).

- **Boss as a peeling coverage-exam, not a fat HP bar** *(BTD6 MOAB-class; CuteDefense's own
  `boss_split`)* — Boss peels into a small telegraphed burst; tuned so loss teaches a
  *specific, solvable* lesson ("I had no AoE"), not "grind more DPS." **Depth:** loss becomes
  *diagnostic* → replay-with-a-plan (#2). **Fit:** the primitive exists. **Closes:** #2 #3
  (#9/#10 at the edges). **Verdict: TIER 2, gated on §3/§4** — a peeling boss is only a
  coverage exam if there's coverage to check; deliver it as the boss-shaped exam for whatever
  tower-job the player skimped.

- **Pre-wave Tactical Recon + boss lives-cost badge** *(Defense Grid recon icons +
  green/amber/red; PvZ telegraphed Final Wave)* — Show the special threat *before* it arrives
  and a heart-badge for the boss's lives-cost *before* it leaks. **Depth:** moves thinking
  into the calm window, makes combat watchable (#7), makes each wave feel distinct by
  announcement (#10), de-mystifies #3. **Fit:** the prepare-phase banner already exists;
  extend it (one icon, ≤8 words). **Closes:** #7 #3 #10. **Verdict: TIER 1, do regardless** —
  the connective tissue that makes affinity (§3) and risk (§6) *fair*.

---

## 6. Kid-safe risk to the player — stakes without destruction (#11)

The contract every kid-friendly TD honours: **telegraphed → answerable → recoverable.**
Avoid the adult version (literal tower HP + manual repair re-adds the click load §1/§2 just
removed; board-wide stuns; permanent/silent loss).

- **Temporary, recoverable tower "nap" / disable** *(BTD6 Vortex stun, Kingdom Rush
  Blacksurge/Twilight, RimWorld EMP)* — An enemy briefly stuns the nearest tower ("gets
  dizzy" ~3–4s), which auto-recovers; counter = kill/stall the disabler first; a post-recovery
  immunity prevents stun-lock. **Depth:** positional risk + a target-priority decision +
  a readable non-DPS boss threat. **Fit:** one branch in the fire loop + a "zzz" overlay;
  deterministic, perf-trivial; preserves the cozy "my towers are safe (they just nap)" tone.
  Must stay gentle (single-target, short, never board-wide). **Closes:** #11 #3. **Verdict:
  TIER 1** — the **best value-per-complexity** in the risk category; the recommended first
  step into the #11 axis.

- **Recoverable theft of the player's stuff (the comeback minigame)** *(Defense Grid power
  cores; PvZ plant-eating)* — Enemies *carry off* a physical treasure from a base pile; kill
  the carrier and it drops and floats home (a live tug-of-war); one telegraphed flyer's theft
  is permanent ("don't let *that* one through"). HUD: green/amber/red dots. **Depth:** the
  most *transformative* #11 answer — a leak becomes "he's taking my cookie, get it back!"
  instead of a silent −1; a boss is scary for a *legible* reason (it hoists three); creates a
  reason to keep watching the lane (#7); differentiates enemies by how much they take.
  **Fit:** deterministic (a treasure entity + a `carrier` pointer; on death it drifts home);
  auto-recovery = no required clicks. The honest cost: it *replaces the lives abstraction* and
  needs real renderer work. **Closes:** #11 #3 #7 #9. **Verdict: TIER 3** — the ambitious
  version; scope as a deliberate feature, not a tweak.

- **Active player ability as "responsibility = stake"** *(see §7)* — Reframes the cozy "my
  towers are safe" into "but *I* have a job in the fight." Personal stake via responsibility,
  no destruction. **Closes:** #11 #2 #3. **Verdict: TIER 1/2** (detailed in §7).

- **Forgive-once safety net (the lawnmower)** *(PvZ lawnmower)* — A small count of *visible,
  consumable* guardian charges at the base; the first breach spends one (a clear one-time
  save), and you can see how many remain. **Depth:** makes failure fair and legible; a few
  visible charges read far better than a big hidden "12 lives" buffer (#3). **Fit:** pure data
  + a HUD object; pairs naturally with the treasure pile. **Closes:** #3 #2. **Verdict: TIER
  3**, optional capstone that makes the difficulty contract explicit.

---

## 7. Active player agency — one button, big payoff, paced by cooldown

The genre-standard kit is tiny (Kingdom Rush ships *two* abilities, the comfortable ceiling;
for ages 5–10, *one* is plenty). The decision an ability tests is **timing, not dexterity**
— pure thinking, the opposite of the janitorial clicking that broke #6/#7. Perf is
effectively free (event-driven, fires a handful of times per run).

- **One-tap field FREEZE** *(GemCraft Freeze, PvZ instants, Defender's Quest thesis)* — Tap
  → all on-screen enemies slow/ice for ~2–3s. No aim. **Depth:** a crisis/comeback lever and
  a hard counter to the speed boss; the only skill is *when*. **Fit:** truest one-tap, safest
  for the youngest; cleanly sidesteps the shield-window problem (it's crowd-control, not
  damage); a per-enemy `slowUntil` flag. **Closes:** #2 #3 #11 (assists #1). **Verdict: TIER
  1** — lowest-friction meaningful action in the game.

- **Two-tap aimed TREAT-BOMB** *(Kingdom Rush Rain of Fire, PvZ Cherry Bomb)* — Tap → tap a
  spot → AoE candy explosion. **Depth:** adds an aim+timing skill and the "I beat the boss
  with that throw" highlight (#2); must fire *between* shield windows vs the shield boss →
  free emergent depth. **Fit:** **reuses the strong tower's existing AoE-radius query** (no
  new hot loop). **Closes:** #2 #3 #11. **Verdict: TIER 1/2** — if optimizing for the
  youngest → Freeze; for agency/replay-pull + code reuse → Treat-Bomb. Ship **one** first.

- **Cooldown as the difficulty dial (+ ~33% initial cooldown)** *(Kingdom Rush 80s vs 10s,
  BTD6 initial-cooldown rule)* — Long cooldown (~25–40s) = a *precious* "save it for the boss"
  decision; short = routine tool; an initial cooldown stops insta-fire on unlock. **Depth:**
  one config number tunes the whole feel. **Verdict: TIER 1** dial for whichever ability ships.

- **Charge-up "panic" ability (banked, fills over the wave)** *(GemCraft 0→200% spells)* —
  Fills during the wave; unleash at the dramatic moment. **Depth:** banking *when to spend* as
  the skill. **Verdict: TIER 2/3** — an alternative cadence to the flat cooldown; pick one.

> **Three honest caveats for any ability:** (1) it does **not** fix the structural flatness
> (#9/#10) — don't let a satisfying boom paper over the §3/§4 work; (2) **dent, don't
> delete** the boss, or you destroy the tension you meant to make fair; (3) the "optimal bot
> barely clears 1–15" balance ladder breaks unless the bot is taught a one-line ability
> heuristic.

**Skip:** summon/deploy blockers (no blocking model + single-file path) and a controllable
hero unit (movement + AI + leveling = a whole sub-game; violates "minimal").

---

## 8. Cross-cutting readability & onboarding craft (the multiplier on everything above)

None of the depth in §3–§6 is worth anything to a pre-reader unless it's *readable*. This is
the gate item, budget it first.

- **Show, don't tell — art encodes role** *(PvZ "Peashooter's mouth = it shoots")* — The
  single-target tower *looks* pointy/precise; the AoE tower *looks* heavy/splashy/boomy;
  enemy resistance shows on the *body* as a glyph (spikes = armored → boom tower; halo =
  evasive → precise tower; green pulse = regen → focus it). **Closes:** #9 #10. **Verdict:
  prerequisite for §3/§4.**
- **State by colour/shape, never numbers** *(GemCraft grade-by-shape, Kingdom Rush gray/blue
  shields, Defense Grid green/amber/red)* — V2 already grows tower size per level; lean on
  that as the primary readout. **Verdict: free win.**
- **≤8 words on screen; one passive hint, only on first relevance** *(George Fan's "eloquent
  caveman" + adaptive non-nagging hints)* — Competent players see nothing and feel smart.
- **Ration novelty: one new mechanic at a time, then recombine** *(PvZ/KR onboarding)* — the
  same discipline that powers §4's wave authoring.
- **Total information + single-screen** *(Defender's Quest)* — CuteDefense already has the
  no-scroll board; a pause is only a *planning* pause if the frozen frame shows everything
  (range rings, AoE footprint, shield state, upgrade before→after).

---

## 9. Replayability & light meta (deliberate "second wave" — after the roots are fixed)

Static-host-friendly via `localStorage`; larger scope, so defer until click-overload (§1) and
flatness (§3/§4) are solved.

- **Tiny persistent meta (3–5 unlocks)** *(Rogue Tower blue/yellow cards, Infinitode research,
  Kingdom Rush stars, GemCraft wizard levels)* — On loss, unlock a small permanent boon ("beat
  the first boss → basic towers start one level higher"). **Depth:** systematizes the #2
  replay urge (loss feeds forward) into an arc, not luck. **Caveat:** keep it *small and
  bounded* — Rogue Tower's own meta breaks difficulty balance. **Closes:** #2.
- **Daily seeded puzzle** *(Infinitode daily map)* — One shared map/seed per day, bounded,
  fresh. **Depth:** replayability at *zero* ongoing content cost — and CuteDefense's sim is
  *already* a pure seeded deterministic core, so this is nearly free and a perfect static-host
  fit. **Closes:** #10 #2.
- **Challenge / modifier modes on the existing 2 maps** *(Defense Grid challenge modes,
  GemCraft battle traits, Rogue Tower difficulties)* — "Tower Limit," "No Upgrades," "Single
  Treasure," or 2–3 pre-run opt-in toggles ("faster enemies → more coins"). **Depth:** one
  constraint flips the whole optimization — content multiplied without new assets; opt-in
  difficulty serves the focused *and* the overwhelmed kid from one build. Keep it tiny (2–3
  toggles, not GemCraft's 15×12). **Closes:** #2 #10.
- **"Pick 1 of 3" between-wave draft** *(Rogue Tower card drafting)* — A bounded, paused,
  *fun* choice each boundary (a new upgrade, a coin bonus). **Depth:** makes spend
  intentional (#4/#5), caps click-load (#6). **Caveat:** needs RNG guardrails (pity/weighting)
  — never deal a child a useless hand. **Closes:** #4 #5 #6. **Verdict: TIER 3** — a bigger
  structural shift; promising but not a first move.
- **Keep the unbeatable wave-16 split boss — frame it as a HORIZON** *(GemCraft Endurance,
  intentionally-unbeatable endgame)* — It's *good design*, not a gap: "how far can you get,"
  not "you failed to win." **Verdict:** validated — keep it.

---

## 10. Explicit NON-imports (the curator's "no" pile)

These appear in the corpus but fail CuteDefense's constraints — listed so they're not
re-litigated:

- **Maze / path-shaping / wall-building** *(Mindustry, GemCraft, Defense Grid open maps)* —
  high cognitive load for ages 5–10 and against the hand-authored fixed-path model. The
  *biggest* genre depth lever, but the wrong audience.
- **Conveyor / production-chain logistics** *(Mindustry)* — hundreds of moving item entities
  would blow the p95 gate; non-starter for kids.
- **Hard immunity (0× damage)** *(BTD6 Lead)* — with only 2 towers, a mono-build hits a wall
  with no recourse. Use *soft* affinity (§3).
- **Mana = life (dual resource)** *(GemCraft)* — too punishing/confusing for the age band.
- **Interest / banking on idle cash** *(Defense Grid, BTD6 Monkey Bank)* — rewards hoarding,
  which *worsens* #4; delayed-gratification compounding is the least kid-legible idea in the
  corpus.
- **Full 0.25×–4× speed ladder & 7-mode targeting menus** — too many states; cut to 1 slow /
  1 fast and 2–3 targeting icons.
- **Controllable hero unit & summon/deploy blockers** — a whole sub-game (movement, AI,
  leveling); violates "minimal" and CuteDefense's single-file-path model.
- **Destructible towers + manual repair** — re-adds the exact click/grind load §1/§2 remove;
  use the recoverable "nap" (§6) instead.
- **Adjacency / support auras between towers** *(Bloons synergy, Infinitode modifiers,
  GemCraft amplifiers)* — charming, but clustering for the buff **directly aggravates #8**
  (overlap/squish). Revisit only after the footprint fix (§3) lands.
- **Breadth for breadth & untuned RNG** *(Rogue Tower 400+ cards, Infinitode 16 towers)* —
  steal the *structure*, never the scale; any RNG must be pity-protected so every hand is fun.

---

## 11. The shortlist — strongest candidates, ranked by value-per-complexity

**Tier 1 (do first — cheap, kid-safe, high impact, mostly subtractive or pure-UI):**
1. **Active/tactical pause** — place + inspect while frozen, non-occluding overlay (#6 #7 #1).
2. **Calm-window framing + "GO!" call-wave-early bonus** (#6 #7 #4 #1) — also the §2 economy
   valve.
3. **Auto-pause/slow on the build popup** (#6 #7) — brings the calm window to the kid.
4. **Surface the end-of-wave bonus + upgrade preview + one "power" number** (#4 #5).
5. **Soft 2-way tower affinity** (basic=precision/regen-burst, strong=AoE/swarm), shipped
   *with* the readability layer (#9 #10 #5).
6. **Composable enemy flags (2–3) + a support/"buffer" enemy + surfaced regen counter**
   (#10 #9 #5).
7. **One telegraphed verb per wave, one-at-a-time then recombined** (#10 #9).
8. **Skull-threshold boss telegraph + pre-wave Tactical Recon + boss lives-cost badge**
   (#3 #2 #7 #10).
9. **Decouple visual tower scale from grid footprint** (#8) — a pure renderer bugfix.
10. **One active ability — Freeze or Treat-Bomb** on a precious cooldown (#2 #3 #11 #1).
11. **Temporary recoverable tower "nap"** — best value risk lever (#11 #3).

**Tier 2 (one well-chosen addition each — strong depth, more design care):**
12. **Upgrade IDENTITY fork** at max level (basic→Sniper/Gunner, strong→Bomber/Froster)
    (#5 #9 #4).
13. **2–3-mode set-once targeting toggle + build-tray** (#6 #5 #9).
14. **One always-relevant coin sink** (consumable boom/freeze charge or a golden top-tier)
    (#4).
15. **Tamed recurring splitter** + a **soft flying/evasive gatekeeper** (guardrailed) (#10 #9
    #2).

**Deliberate horizon / second wave (validated, not now):** tiny `localStorage` meta · daily
seeded puzzle · 2–3 challenge-mode toggles · keep the unbeatable wave-16 split boss as a
"how far can you get" hook · recoverable treasure-theft as the ambitious #11 swing.

---

*Sources: `research/scout.md`; `research/external/{bloons-td-6, kingdom-rush-series-,
defense-grid-the-awakening, gemcraft-series-, infinitode-2, mindustry, plants-vs-zombies,
rogue-tower}.md`; `research/deepdive/{active-player-ability…, enemy-abilities…,
readable-boss-enemy-stakes…, streamlined-auto-economy…, time-control-pause-to-plan…}.md`.*
