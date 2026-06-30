# CuteDefense V2 — Depth Pass: Final Proposals

**Status:** Final (lead-designer integration of the adversarial critique panel)
**Scope cap:** MAX 5 proposals. All must respect the hard constraints (static GitHub Pages, no backend, no build step, plain ES modules, pure seeded headless sim, perf below V1 p95) and stay charming + legible for ages ~5-10.

---

## Intro

This set turns CuteDefense V2 from a click-treadmill with two near-identical towers into a small, legible, *winnable* tactics game a young child can actually read. It is sequenced deliberately:

- **P1** pays down the click debt (#6/#7) and the manual coin-harvest chore so the player can watch the fight — the fairness substrate everything else stands on.
- **P2** gives the two towers opposite jobs and makes every wave a readable puzzle (#9/#10) — the depth engine.
- **P3** adds the missing risk axis and the one active ability that is the *skill* key to the secret boss (#11).
- **P4** makes money finally legible and spendable on a felt, reversible identity choice (#4/#5).
- **P5** turns the win on (#2/#8) and reframes the secret split boss from an unbeatable amputation into an opt-in summit.

The three critique lenses (kid-friendliness, strategic depth, technical feasibility) plus the feedback-coverage lens have been folded in. The biggest integrations: **auto-collect coins** (deletes a fiddly, silently-punishing chore — kid lens missing idea), **per-wave spawn-direction variety** (closes the "different *layouts*" third of #10 — coverage lens missing idea), and **cheap re-forking** (converts the front-loaded one-shot fork into a recurring spend that drains the flooded economy — depth lens missing idea, and the kid-safe "undo a wrong pick" fix). A cross-cutting **balance-harness parity** requirement (extend the optimal bot + locked bench fixture to exercise every new lever) is now an explicit deliverable on every power-changing proposal, so the 7.2x split-boss measurement and the p95 gate keep measuring the *real* game.

---

## Ranked Proposals

### P1 — Plan, then watch: tactical pause + calm window + tap-once build + auto-collect coins

**One-liner:** Invert the broken pause into a non-occluding plan-mode, let the player pick a tower type once and tap cells to build, auto-collect dropped coins, and frame the prep window as planning time with one big "I'm ready!" valve — paying down the click debt that breaks the whole game.

**Problem (G1 → #6, #7; assists #1, #4):** The two loudest complaints are a *time* problem — every placement happens while the board moves, so building steals the eyes from the payoff. Today pause hard-blocks world taps (`InputController.js:44`) and draws a full grey scrim (`Renderer.js:649`), the exact opposite of plan-to-build. On top of that, the manual tap-each-coin-within-15s economy is itself a fiddly chore that competes for the eyes with the fight (#7) and silently punishes a kid who misses the window (#4).

**Mechanic:**
- **Tactical plan-mode** (a distinct `planning` sub-state, *not* an overload of `paused`): halts the sim (zero ticks — perf-positive) but keeps the board fully visible behind a thin frame (no scrim). Tap-through is allowed to place / inspect / upgrade / sell while frozen; building still costs coins, so plan-mode buys thinking-time, not free power. The frozen frame shows total info (range rings, AoE footprint, boss state, upgrade before→after). Scope *which* commands are legal in `planning` explicitly (place/sell/upgrade yes) since `gridClick`/`placementPlace`/`spend()` are status-agnostic today.
- **Auto-pause on the build popup** (`autoPauseOnPopup` flag) brings the calm window to a kid who will never find a hotkey.
- **Tap-once build tray:** a 2-icon tray (basic/strong) selected once, then taps on buildable cells place that type (`lastTowerType` already tracked), removing the per-tile Cycle tap. **Protect #1 as an invariant:** the first-placement feel stays identical — tap an empty buildable cell, a tower appears. Pause and the tray are *additive*, never mandatory; an untrained kid must still place a tower in the first 5 seconds without discovering any mode.
- **Auto-collect coins:** killed enemies' coins auto-bank on drop (or magnet to the nearest tower) — no manual tap, no 15s punishment window. Deletes a real fiddly chore and frees the eyes for the fight.
- **"I'm ready!" valve:** surface the existing `prepMs:8000` / `betweenWaveMs:3000` as a visible "Get ready" timer with one big button that starts the wave early. **Reframed for the age band as pure impatience, not a calculated tradeoff** — any small bonus is shown as coins visibly raining in, never as a risk/reward sum a 5-7yo must weigh; a confirm tap prevents accidental mid-think triggers. (Implemented by collapsing `wave.phaseClock=prepMs` in `waveSystem`.)
- **Optional set-once targeting toggle:** default **OFF/hidden** for young kids; if shown, use picture words ("closest"/"biggest"), never "strongest". Zero combat clicks.

**Why depth:** It *enables* depth — unrushed decisions can be strictly harder (the spatial + economic puzzles of P2/P4) without raising the click bar. **Honest accounting:** P1 is fairness substrate, not depth. The "I'm ready!" button is intentionally *not* credited as a strategic decision for this audience.

**Addresses:** #6, #7, #1, #4, G1 (+ deletes the manual coin-harvest chore).

**Rough cost:** M

**Risk:** The only perf-sensitive lever (fast-forward / variable speed) is explicitly **cut** (see discarded) — pause/auto-pause are perf-positive; leave `MAX_STEPS_PER_FRAME` untouched. The real risk is burying the #1 charm under modes/trays: guard it with the first-5-seconds playtest above.

**Winnability role:** None directly — but it lets a player *execute* a winning build instead of fumbling under time pressure. The fairness substrate that makes the split-boss path (P3) actually playable.

**Kid-friendly note:** Strongly subtractive — removes the APM test that broke an adult, plus the coin-tapping chore. The eager kid hits "I'm ready!", the overwhelmed kid takes all the time, the popup auto-pauses for both, and money now collects itself.

---

### P2 — Every wave is a puzzle: tower affinity + readable enemy flags + spawn-direction variety

**One-liner:** Give the two towers real opposite jobs via a soft, *visually felt* damage multiplier, compose ≤3 glyph-legible enemy property flags onto the existing wave list, and vary the spawn entry per wave — shipped WITH its loud non-numeric readability layer or it stays invisible.

**Problem (G2 → #9, #10; assists #5, #3):** Two near-substitute towers (per-coin identical at L1) with no counter rule; three enemy archetypes fixed by wave 3; "variety" is just count/hp/speed scaling. No wave demands a different answer than the one before. The verbatim ask (#10) is waves needing different *towers, layouts, and strategy* — the original draft covered towers + strategy but did nothing for **layouts**.

**Mechanic:**
- **Soft 2-way affinity** (multiplier, never immunity): basic = precision/single-target → ~2× vs fast/evasive (and the burst that out-DPSes regen); strong = splash/AoE → ~2× vs swarm/clustered (and the boom that dents armor); wrong tool ~0.5×, never 0× (hard immunity can leak a whole wave with only two towers). O(1) lookup in the damage step.
- **Visceral, non-numeric feedback (the gate — ship this or don't ship affinity):** a child cannot read a multiplier. Wrong tool = bullets visibly **bounce / "tink"** off + a sad puff; right tool = a huge satisfying **splat**. Learn by spectacle, not numbers. This shape-match game ("pointy tower → shimmery enemy, boomy tower → blob crowd") *is* the mechanic for the youngest.
- **≤3 composable property flags** authored onto base bodies in wave config (not new enemy types): *armored* (spikes glyph → boom), *evasive* (shimmer/halo glyph → precision), *regen* (green pulse glyph → focus-fire). **Drop the numeric heal counter** for an obvious animation — the monster visibly gulps and puffs back up. **Cap at 2 flags for early waves, 3 only as an upper tier.** One support "buffer" enemy whose only rule is shield/buff-the-others (`buffRadius`) — "pop the umbrella monster first."
- **Per-wave spawn-direction variety (closes the layout gap):** some waves enter from the other end, or a second telegraphed entry opens, so *where* you build genuinely changes wave-to-wave. Deterministic, no new entities, respects the single-path model.
- **One telegraphed verb per wave**, onboarded one-at-a-time then recombined (armor → swarm → armor+evasive).
- **Readability layer in the SAME change:** art encodes role (pointy/precise vs heavy/boomy tower); each flag is an unmistakable body glyph; a pre-wave **Tactical Recon banner** (extend the existing BOSS WAVE banner) shows the threat icon and entry direction, plus — for bosses — a skull HP-bar telegraph and a heart-badge for `livesCost` before it leaks (wire the existing `shieldedHitMs` signal to a loud tell).
- **Pair telegraphs with substance (#3):** also retune the boss `livesCost` so the answer to "why does the boss take so many lives?" isn't only "now you can watch it hurt you" — the drain itself is brought to a fair value.

**Why depth:** Converts "which tower?" from a shrug into the central per-wave decision, and makes a loss *diagnostic* ("I had no boom for the swarm") — the engine that turns #2's replay urge into informed improvement. Spawn-direction variety adds the only genuine *re-think where I build* driver. **Anti-dominant-strategy guard:** a 50/50 mix must not trivially cover everything — lean on P5's footprint fix to make buildable space scarce, author mono-threat waves (a pure swarm, a pure-evasive wave) that visibly leak against a balanced board, and rely on P4's cheap re-fork so affinity becomes a recurring re-answer, not a frozen opening.

**Addresses:** #9, #10 (now incl. layouts), #5, #3, G2, G4.

**Rough cost:** L

**Risk:** Illegibility if flags exceed the cap or affinity ships without the visceral tell — that reproduces the exact current untelegraphed shield-boss failure. **Feasibility plumbing the "O(1)" framing hides:** affinity needs a damage *source* — thread `towerTypeId`/mult onto the projectile at `fire()` and into the bomb loop in `projectileSystem.impact()` (`damageEnemy` carries no source today). Flags must cross three layers (pattern-group schema → `buildSpawnQueue` → `spawnEnemy`, which today reads only `config.enemies[typeId]`). **Bake static flag glyphs into SpriteCache keyed by `typeId+flagmask`** (one extra blit, zero per-frame cost); allow at most one live-animated flag — animated alpha/gradient overlays on a 40+ enemy scene are the set's only real p95 threat. **Extend the locked bench fixture (`CONFIG.bench.fixture` 40/12/30) to carry flags and re-run `__bench` before shipping.**

**Winnability role:** Partial but important — AoE affinity is the answer to the split boss's 3 shards and precision-burst is the regen counter; makes the public bosses fair and learnable, and supplies the *composition* half of the split-boss skill path.

**Kid-friendly note:** Cognitive budget is the ceiling, not the engine — one glyph at a time, shape/color over numbers, bounce-vs-splat over multipliers, no heal counters. Competent players see no extra text and feel smart.

---

### P3 — I have a job in the fight: kid-safe tower nap + one active Freeze (split-boss key)

**One-liner:** Add the missing risk axis with a gentle, obviously-temporary tower "nap" and give the player exactly one precious-cooldown active button (Freeze) that is dual-use — the agency that makes placement have stakes and gives an alert player the skill window to crack the wave-16 boss.

**Problem (G3 → #11; assists #2, #3, #1):** Towers are immortal, so "place safely out of the way" is literally optimal, and the player is a pure spectator once towers are down — a boss eating lives feels like something happening *to* them, not something they can answer.

**Mechanic:**
- **Temporary recoverable tower "nap":** a *specific silly enemy* fires a **visible "sleepy beam"** at the nearest tower, which briefly stops firing (`stunnedUntil` tick → skip firing) under a big "zzz" bubble **with a tiny visible countdown so the kid SEES it will wake up.** Auto-recovers, with brief post-recovery immunity (anti-stun-lock governor). Single-target, short, rare, telegraphed, **never near a leak.** "Kill the disabler first" is *discoverable, not load-bearing* — the game never requires the kid to learn it. Preserves the cozy "my towers can't be destroyed, they just nap" tone.
- **One active ability — field FREEZE** on a precious cooldown: tap → enemies slow/ice ~2-3s, **no aim** (truest one-tap, safest for the youngest); cooldown ~25-40s with a ~33% initial cooldown. Instant readable spectacle ("I froze the baddies!").
- **Make Freeze a real recurring read, not a scripted button:** dual-use — cast it *offensively* to bunch enemies for an AoE burst, or *defensively* to stop an imminent leak. Author multiple crisis moments per run where both are tempting and you can't have both, so "when" becomes a genuine judgment of the current board rather than "save it for the boss."

**Why depth:** Stake-via-responsibility is the kid-safe form of risk; the freeze decision is timing, not dexterity — pure thinking, the opposite of janitorial clicking. It reintroduces a "first-placement" novelty beat mid-run, paying down G8 hook-decay.

**Addresses:** #11, #2, #3, #1, G3, G8.

**Rough cost:** M

**Risk:** An ability must *dent, not delete*, public bosses (waves 5/10/15) or it flattens the very tension it exists for, while still enabling pin-and-burst on the split moment. **Validation is mandatory, not asserted:** run `measure-secret-boss.mjs` with a **freeze-aware optimal bot** (`tools/balance/policies.mjs`) in the *same change* — otherwise the 7.2x figure measures the old game. **Feasibility:** "all on-screen enemies" is a renderer concept — redefine in sim-space (all alive enemies, or a radius around path center). Enemies have *zero* tower interaction today, so the disabler adds a new nearest-tower query + governor + telegraph state. **Reuse the SAME slow field as P4's Froster** so there is exactly one slow mechanic in `effectiveSpeed()`.

**Winnability role:** THE primary skill path to the secret split boss (see split-boss win path below). Tune so only the *executed* composition+freeze combo clears the re-measured margin.

**Kid-friendly note:** Occasional, high-payoff, cooldown-paced — anti-click-load. Every threat telegraphed, recoverable, and gentle; the nap's cause and wake-up countdown are dead obvious so it never reads as "broken."

---

### P4 — Did upgrading help? economy legibility + reversible max-level identity fork

**One-liner:** Surface the money the game already hands out and the upgrade payoff, then replace the dominated linear stat-bump with a picture-only, *cheaply reversible* max-level identity fork — the adapted boss-tower idea, and (via re-forking) the always-relevant recurring coin sink.

**Problem (G6 → #4, #5; assists #9):** Frictionless income + an invisible +25% wave-clear bonus + a finite sink ladder flood the late game with money you didn't work for and can't spend; upgrades are economically dominated by L1 spam and their payoff is invisible (no DPS, no before→after, no per-tower attribution).

**Mechanic:**
- **Pure-UI legibility (ship regardless, zero sim/perf cost):** on the upgrade button show the delta (Damage 8→12, range-ring preview) and one single rising **"power" number** a child can watch grow (raw DPS math is kid-hostile). **Never surface "+25%"** — just show the coins arrive visibly bigger.
- **Max-level identity fork (the adapted boss-tower):** at max level each tower forks once — basic → Sniper (long-range crit) *or* Gunner (faster fire); strong → Bomber (bigger AoE) *or* Froster (adds a slow). New sprite + new behavior. **Picture-only choice (scope vs rapid-fire icon; bigger-boom vs snowflake) — no role words** to read or regret.
- **Cheap re-forking = the recurring spend the set was missing:** a wrong pick is cheaply undoable (re-fork for a small cost, or via the existing sell path). This (a) lets kids learn by trying both with no punishment, (b) makes the fork *recur* as a response to the telegraphed wave ahead instead of a frozen one-shot, and (c) converts the flooded late-game money (#4) into an ongoing sink. Both arms must be the right call on *different* telegraphed waves (Froster/slow on some, Bomber on others) so neither dominates.
- **Fix the dominance root, not just the optics:** rebalance the L1→L2→L3 curve so mid-tiers are not strictly dominated by L1 spam (or make the fork reachable earlier/cheaper), so "did upgrading help?" earns a felt YES at the levels players actually buy.
- **Explicitly avoid** banking/interest (rewards hoarding, worsens #4, least kid-legible idea in the corpus).

**Why depth:** The reversible fork is the cleanest "did upgrading help?" fix — number-go-up becomes a felt strategic commitment with opportunity cost that you re-answer per wave; the Froster fork is also the legible control/slow axis, a third role without a third tower.

**Addresses:** #4, #5, #9, G6.

**Rough cost:** M

**Risk:** The fork must not become "buy the win" against the split boss — keep it a *role* choice gated on skillful use (P3 freeze timing), not raw power; re-measure the margin if it raises ceiling DPS. **Feasibility:** legibility is free UI; the fork is the heaviest renderer lift (4 new procedural sprites + SpriteCache keys — first-render cost only). Keep fork stats in config so only Froster needs new logic — Sniper reuses `combat.critChance/critMult`, Gunner reuses `fireRateMs`, Bomber reuses `aoe.radius`, **Froster shares P3's slow field.** Gate the choice behind the existing max-level popup hit-rect machinery (no new always-on UI). Update the bot + bench fixture to exercise forks.

**Winnability role:** Supports the split-boss path — the Bomber/Froster forks are the powered top-tier an alert player commits to as the boss-killer (AoE for shards, slow to hold them) — but the win is gated on skillful use (P3 freeze timing), never on the purchase.

**Kid-friendly note:** Legibility is 0 clicks; the fork is one infrequent, picture-only binary that is *cheaply undoable*, so a wrong pick teaches instead of punishes; the spend finally becomes seen and felt.

---

### P5 — You won! real win state, stars, sprite-fit, and split-boss as an opt-in summit

**One-liner:** Make the public game actually winnable at wave 15 with a permanent celebration and stars, offer the secret split boss only as an explicit opt-in dare so a kid never feels robbed, and fix the L3 sprite overlap so the board stays legible.

**Problem (G5 + G7 → #2, #8):** The game CANNOT be won — `isFinalWaveComplete` counts all 16 patterns including the unbeatable secret boss, so `status==='won'` is dead code and clearing 15 public waves guarantees a loss with no victory screen; beating the wave-5 boss (the exact motivating moment) produces no distinct celebration. Separately, L3 towers render 115px in a 96px tile → ~19px solid overlap.

**Mechanic:**
- **Real, permanent public win (ship this unconditionally — true standalone S):** flip the last-wave gate and `isFinalWaveComplete` from `patternCount` (=16) to `publicWaveCount` (=15) so the wave-15 `boss_regenerate` clear fires a full-confetti celebration — *it's over, you won*, banked and permanent. A distinct banner for beating *each* boss along the way.
- **Stars — scored on strategic quality, not just survival:** award 1-3 stars, but weight them toward decision quality (fast clears, low coin-waste, no-leak boss handling) rather than pure leftover lives, so the meta goal pulls toward sharper play, not defensive turtling. Reuses the existing ledger, minimal new sim state.
- **Split boss as an opt-in summit (separate flow — *not* S):** only *after* the win is banked, offer an explicit "Want to try the SUPER boss?" dare. This needs a new flow (a celebration that does **not** latch `status='won'`, plus a continue path into wave 16) — do not conflate it with the cheap win ticket. Tune it (re-measured against P2/P3/P4 player power) so the P3 alert-player combo is a real path. **Explicit fallback:** if the margin won't tune cleanly between "still a 7.2x wall" and "buy-the-win," the summit *stays* an aspirational endless hook — the public win never depends on the tuning pass succeeding.
- **Sprite-fit (#8, pure renderer, perf-free):** decouple visual scale from grid footprint — clamp effective `sizeScale` (or clamp the grid blit to the tile), pull glow/rings/puff inside the cell, express level via crown/pips/glow/range-ring color, not raw body size.

**Why depth:** Restores the single most important reward in the genre and gives #2's replay drive a summit; quality-weighted stars reinforce (not flatten) the P2-P4 decisions; the sizing fix unblocks readable tiles and any later clustering.

**Addresses:** #2, #8, G5, G7.

**Rough cost:** M *(the win + stars + sizing half is a true standalone S; the opt-in summit continue-flow is the added M.)*

**Risk:** The "winnable summit" half couples to player power — re-run `measure-secret-boss.mjs` (freeze-aware bot) after P2/P3/P4, and honor the fallback so winnability never hinges on it. The win+stars+sizing half is fully standalone.

**Winnability role:** Defines winnability — turns on the public win and reframes the secret boss as the climbable, opt-in summit for the P2+P3+P4 skill path.

**Kid-friendly note:** A permanent win screen + stars is the core reward young players chase; the secret boss is an explicit *opt-in dare after* the win is banked, so declining or losing it never robs the child of their victory. Sizing restores discrete, readable tiles.

---

## Boss-Tower Verdict

**Decision: ADAPT.**

The literal level-4 boss-tower stat-bump is rejected as floated and folded into **P4's reversible max-level identity fork**. Research grounds this: upgrades are *already* economically dominated by L1 spam and their payoff is invisible (V2-MECHANICS §1, GAP-ANALYSIS G6) — another linear tier is one more invisible money sink that worsens #5, not fixes it. Worse, making the split boss fall to a *purchased* tier turns the genre's marquee challenge into a DPS grind, directly contradicting the brief's "beat it through skill" goal: the ~7.2x unbeatability margin (`measure-secret-boss.mjs`) would just become "save up, then auto-win." The CATALOGUE explicitly rates the identity fork *above* the stat bump as "the cleanest did-upgrading-help fix" — a commitment with opportunity cost, legible by sprite, a real sink with a felt payoff.

**If adapted, how:** Keep the "powerful endgame upgrade as the boss key" fantasy but express it as the P4 fork (basic→Sniper/Gunner, strong→Bomber/Froster), made *picture-only and cheaply reversible* so it is a recurring role choice rather than a one-shot purchase. Gate the split-boss win on *skillful use* of that fork plus the P3 active Freeze plus P2 AoE affinity — never on the purchase alone. The top tier is a role the alert player wields well, not a number that buys the win. Re-measure the 7.2x margin (with a freeze-and-fork-aware bot) after the fork lands so it cannot become buy-the-win.

---

## Split-Boss Win Path

**P3 is the primary key; P2 and P4 are the supporting composition; P5 frames and validates it.**

The wave-16 boss splits into 3 shards on death. An alert player:
1. Builds **AoE-forked strong towers (P4 Bomber)** at the chokepoint — **P2 affinity** gives AoE ~2× vs the clustered shards, and precision-burst counters the regen.
2. Holds the **P3 Freeze** for the split moment, casting it offensively to **pin all 3 shards inside the kill zone**, then bursts them while frozen.

The win comes from *composition + freeze timing + targeting*, not raw DPS. **P5** turns this from a 7.2x wall into a tuned, beatable summit and reframes the "16/15" surprise as an opt-in aspirational horizon — not an amputation of the win state.

**This is gated on validation, with a fallback.** Before the win is gated on this combo, run `measure-secret-boss.mjs` with a **freeze-/fork-aware optimal bot** to confirm (a) the executed combo clears the re-measured margin and (b) the same Freeze does not flatten the public bosses (waves 5/10/15). If the margin cannot tune cleanly between "still unbeatable" and "buy-the-win," **the public wave-15 win still ships (P5 standalone) and the summit remains an aspirational endless hook** — winnability of the core game never depends on the tuning pass.

---

## Discarded Ideas

| Idea | Why cut |
|------|---------|
| Fast-forward / variable-speed ladder (2× and up) | The one perf-sensitive lever (`MAX_STEPS_PER_FRAME`) — cut from P1; defer and bench p95 separately. The full 0.25×–4× ladder is too many states for ages 5-10. |
| "I'm ready!" as a calculated rush-for-gold tradeoff | The conditional/coupled version is real depth for adults but a risk/reward optimization a 5-7yo cannot weigh; reframed as pure impatience with a confirm tap. |
| Mazing / path-building / branching paths | The biggest genre depth lever but wrong audience: high cognitive load for young kids and against the hand-authored fixed-path model. (Spatial variety is instead covered by P2's per-wave spawn direction.) |
| Conveyor / production-chain logistics (Mindustry) | Hundreds of item entities would blow the p95 gate; non-starter for kids. |
| Hard immunity (0× damage) | With only two towers a mono-build hits a wall with no recourse; P2 uses soft affinity (~0.5×/2×) instead. |
| Interest / banking on idle cash | Rewards hoarding and worsens #4; compounding is the least kid-legible idea in the corpus. |
| Controllable hero unit & summon/deploy blockers | A whole sub-game (movement, AI, leveling); violates "minimal" and the single-path model. |
| Destructible towers + manual repair | Re-adds the exact click/grind load P1 removes; the recoverable "nap" (P3) is the kid-safe substitute. |
| Adjacency / support auras between towers | Clustering for the buff aggravates #8 overlap; revisit only after the P5 footprint fix lands. |
| Producer / "farm" (Sunflower) structure | Effectively a third placeable and a delayed-payoff idea straining "exactly 2 towers"; the P4 fork covers the economy decision more cheaply. |
| Movable / re-socketable upgrade "charm" (GemCraft) | Elegant but a genuinely new ownership model and a bigger lift than the fork; note for later. |
| Earn-by-fighting XP progression track | Charming but a second progression model on top of the fork; sequence after, not now. |
| Two-state ammo toggle | Overlaps the P4 identity fork and P1 targeting toggle; pick one expression. |
| Adaptive-resistance "anti-spam" enemy (Infinitode Light) | Risks illegibility for 5-year-olds even with a clear tell; note only. |
| Recoverable treasure-theft comeback minigame (DG power cores) | The most transformative #11 answer but replaces the lives abstraction and needs real renderer work; scope as a deliberate future feature. |
| Forgive-once lawnmower safety net (PvZ) | Optional capstone that makes the difficulty contract explicit; defer behind the risk axis. |
| Daily seeded puzzle / tiny localStorage meta / challenge-modifier modes | Validated second-wave replay levers (sim is pure-seeded) but defer until overload (P1) and flatness (P2) are solved; meta power breaks balance if rushed. |
| "Pick 1 of 3" between-wave draft (Rogue Tower) | A bigger structural shift needing RNG pity-guardrails; promising but not a first move. |
| Income-tied-to-play-quality multiplier (fast-kill / leech bounty) | Must visualize the cause or it worsens #4; lower-leverage than surfacing the existing bonus + the fork/re-fork sink. (Note: P5's quality-weighted stars capture the *scoring* form of this safely.) |

---

## How the set answers the feedback (summary)

P1 kills the two loudest complaints — too much clicking (#6) and can't watch the fight (#7) — by inverting pause into a non-occluding plan-mode, collapsing per-tile building into a tap-once tray, and auto-collecting coins, while protecting the one thing the grownup liked (placing towers, #1). P2 makes the two towers matter and differ (#9) and turns every wave into a distinct puzzle of towers, *layouts* (per-wave spawn direction), and strategy (#10), with the boss life-drain both telegraphed and retuned to a fair value (#3). P4 makes the flooded money visible and finally spendable (#4), and answers "did upgrading help?" with a felt, reversible, recurring identity choice instead of an invisible linear sink (#5). P3 adds the missing stakes (#11) via a gentle tower nap and a single active Freeze that is also the skill key to the boss, while P5 turns the win on with a permanent celebration and quality-weighted stars (#2), fixes the L3 sprite overlap (#8), and reframes the secret split boss as an opt-in summit beatable through composition + freeze timing — validated by a freeze-aware bot, with a public-win fallback so the game is *always* winnable.
