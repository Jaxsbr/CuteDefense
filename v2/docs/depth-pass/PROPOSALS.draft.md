# CuteDefense V2 — Depth-Pass PROPOSALS (first draft)

> Lead game designer's pick: up to 5 ranked depth additions, each concrete enough to spec
> & TDD. Drawn from CATALOGUE.md, V2-MECHANICS.md, GAP-ANALYSIS.md. Optimised for closing
> the 11 grownup symptoms, adding strategy without raising kid click-load, staying
> static-host / no-build / perf-budgeted, and giving an alert player a skill path to the
> secret wave-16 split boss.

Feedback legend: 1 placing fun · 2 lost-to-boss→replay · 3 boss eats lives why · 4 too much
money · 5 did upgrades help · 6 too many clicks · 7 can't watch enemies · 8 towers
overlap/squish · 9 only 2 towers, does it matter · 10 every wave same just more · 11 no risk
to me.

Root-gap legend (GAP-ANALYSIS): G1 overload · G2 flatness · G3 no-risk/agency · G4 boss
illegibility · G5 no-win/payoff · G6 money-glut/invisible-upgrades · G7 sprite-squish · G8
hook-decay.

---

## P1 — "Plan, then watch": tactical pause + calm window + GO! + build tray  (rank 1)

**One-liner:** Invert the broken pause into a non-occluding plan-mode, frame the prep window
as planning time with a single GO! call-wave-early valve, and let the player pick a tower
type once and tap cells — paying down the click debt that breaks the whole game.

**Problem:** G1 (#6, #7, assists #1, #4). The two loudest complaints are a *time* problem,
not a content one: every placement must happen while the board moves, so building steals the
eyes from the payoff. Today pause *blocks* world taps and draws a grey scrim — the literal
opposite of plan-to-build. This is the substrate; no later depth add is fair until the kid
has time to think.

**Mechanic (spec-ready):**
- *Tactical pause:* tap a big pause button (or auto-trigger, below) → sim halts (zero ticks,
  perf-positive) but the board stays fully visible behind a thin frame, not a scrim. Allow
  tap-through: place, inspect, upgrade, sell while frozen. Building still costs coins, so
  pause buys thinking-time, never free power. Frozen frame shows total information: range
  rings, AoE footprint, current boss/enemy state, upgrade before→after.
- *Auto-pause on the build popup:* opening the placement/upgrade popup auto-enters plan-mode
  (config flag `autoPauseOnPopup`), and closing it resumes. Brings the calm window to a kid
  who will never find a hotkey.
- *Calm window framing + GO!:* surface the existing `prepMs:8000`/`betweenWaveMs:3000` as a
  visible "Get ready" timer with one big GO! button that starts the wave early for a coin
  bonus (scales with seconds skipped). Same button = the §2 economy valve.
- *Build tray (set-once placement):* a 2-icon tray (basic / strong) selected once; subsequent
  taps on buildable cells place that type. Removes the per-tile Cycle tap. `lastTowerType` is
  already tracked. Optional opt-in 2-state targeting toggle per tower (front / strongest),
  set once, zero combat clicks.

**Why it's depth (not just polish):** it *enables* depth. Unrushed decisions can be strictly
harder (the G2/G3 spatial+economic puzzles) without raising the click bar. The GO! valve is a
genuine timing risk/reward (set up safe vs rush for gold) at zero in-combat clicks.

**Cost:** M (mostly subtractive + UI; tap-through + frame replace the scrim).
**Risk:** the only perf-sensitive sibling is fast-forward — explicitly *cut* the 2× toggle
from this proposal (defer; bench p95 separately). Pause/auto-pause are perf-positive.
**Winnability role:** none directly — but it lets a player *execute* a winning build instead
of fumbling under time pressure; the fairness substrate for every other proposal.
**Kid note:** strongly subtractive — removes the APM test that broke an adult; the eager kid
hits GO!, the overwhelmed kid takes all the time, the popup auto-pauses for both.

---

## P2 — "Every wave is a puzzle": soft tower affinity + readable enemy flags + telegraphed waves  (rank 2)

**One-liner:** Give the two towers real opposite jobs via a soft damage-multiplier, compose
2–3 glyph-legible enemy property flags onto the existing wave list, introduce one telegraphed
"verb" per wave then recombine — turning "more of the same" into a sequence of plannable
questions, shipped *with* its readability layer or it's invisible.

**Problem:** G2 (#9, #10, assists #5, #3) — the single biggest depth gap. Two near-substitute
towers (per-coin identical at L1) with no counter rule; three enemy archetypes fixed by wave
3; "variety" is count/hp/speed scaling plus a misnamed 1D timing knob. No wave ever demands a
different answer.

**Mechanic (spec-ready):**
- *Soft 2-way affinity (multiplier, never immunity):* basic = precision/single-target → ~2×
  vs fast/evasive (and the burst that out-DPSes regen); strong = splash/AoE → ~2× vs
  swarm/clustered (and the boom that dents armor). Wrong tool ~0.5×, never 0× — with only two
  towers, hard immunity can leak a whole wave with no recourse. O(1) lookup in the damage
  step; zero added clicks.
- *2–3 composable property flags* authored onto base bodies in the wave config (not new enemy
  types): `armored` (spikes glyph → wants boom), `evasive` (shimmer/halo glyph → wants
  precision), `regen` (green pulse glyph + surfaced heal counter → focus-fire it). Exponential
  variety from a tiny vocabulary; legibility is the hard cap → 2–3 flags max for ages 5–10.
- *One support/"buffer" enemy:* a single enemy whose only rule is "shield/buff the others"
  (a `buffRadius`), so the wave becomes "pop the umbrella monster first." Highest
  depth-per-asset on the board; pairs with the optional targeting toggle.
- *One telegraphed verb per wave, onboarded one-at-a-time then recombined:* wave introduces
  armor (forces a strong), later swarm (forces strong AoE), later armor+evasive together. The
  combination space is the campaign — pure authoring intent over existing formations.
- *Readability layer (prerequisite, same change):* art encodes role (pointy precise tower vs
  heavy boomy tower); each flag is an unmistakable body glyph; a pre-wave Tactical Recon
  banner (extend the existing BOSS WAVE banner) shows the wave's threat icon and — for bosses
  — a skull-threshold HP-bar telegraph + a heart-badge for `livesCost` *before* it leaks
  (wires the existing `shieldedHitMs` signal to a loud tell). Without the tell this reproduces
  the exact current untelegraphed shield-boss failure.

**Why it's depth:** converts "which tower?" from a shrug into the central per-wave decision and
makes a loss *diagnostic* ("I had no boom for the swarm") — the engine that turns #2's replay
urge into informed improvement. Adds *reading* load, *zero* click load (towers auto-target).

**Cost:** L (affinity + flags + glyphs + telegraph banner + wave re-authoring).
**Risk:** illegibility if flags exceed 3 or ship without the tell — cap and gate hard; re-run
the balance ladder after the multiplier lands.
**Winnability role:** partial and important — the AoE affinity is the answer to the split
boss's 3 shards and the precision-burst is the regen counter; makes the public bosses fair and
learnable; feeds the split-boss path in P3.
**Kid note:** cognitive budget is the ceiling, not the engine — onboard one glyph at a time;
color/shape over numbers; competent players see no extra text.

---

## P3 — "I have a job in the fight": kid-safe tower nap + one active ability  (rank 3)  ★ split-boss key

**One-liner:** Add the missing risk axis with a gentle, auto-recovering tower "nap" and give
the player exactly one precious-cooldown active button (Freeze) — the agency that both makes
placement have stakes and gives an alert player the skill window to crack the wave-16 boss.

**Problem:** G3 (#11, assists #2, #3, #1). Towers are immortal; "place safely out of the way"
is literally optimal; the player is a pure spectator once towers are down, so a boss eating
lives feels like something happening *to* them, not something they can answer.

**Mechanic (spec-ready):**
- *Temporary recoverable tower "nap":* certain enemies (and a boss beat) briefly switch off
  the *nearest* tower (`stunnedUntil` tick → skip firing → "zzz" overlay), which
  auto-recovers, with a brief post-recovery immunity (anti-stun-lock governor). Single-target,
  short, telegraphed, never board-wide → "exciting hiccup," not "unfair shutdown." Adds a
  positional risk + a target-priority decision ("stall the disabler first") at zero new
  required clicks. Preserves the cozy "my towers can't be destroyed (they just nap)" tone.
- *One active ability — field FREEZE on a precious cooldown:* tap → all on-screen enemies
  slow/ice ~2–3s, no aim (truest one-tap, safest for the youngest). Cooldown ~25–40s with a
  ~33% initial cooldown so it's a "save it for the boss" decision, not a routine tool. The
  only skill is *when*. (Treat-Bomb — two-tap aimed AoE reusing the strong tower's radius
  query — is the alternative; ship exactly one. Freeze is recommended first for the age band
  and because it sidesteps the shield window as crowd-control, not damage.)

**Why it's depth:** stake-via-responsibility is the kid-safe form of risk; the freeze decision
is *timing, not dexterity* — pure thinking, the opposite of janitorial clicking. It
reintroduces a "first-placement" novelty beat mid-run (G8).

**Cost:** M.
**Risk:** an ability must **dent, not delete** the boss or it destroys the tension it exists
for; and the optimal-bot ladder must be taught a one-line freeze heuristic or BALANCE.md stops
meaning anything. Any power increase forces a re-measure of the split boss's 7.2× margin.
**Winnability role:** **THE primary skill path to the secret split boss.** The boss splits
into 3 shards on death; an alert player builds AoE-forked strong towers at the chokepoint,
holds the Freeze for the split moment to pin all 3 shards inside the kill zone, and burst them
while frozen — beating it through *composition + freeze timing + targeting*, not raw DPS. Tune
so only this executed combo clears the re-measured margin.
**Kid note:** occasional, high-payoff, cooldown-paced — anti-click-load. Every threat
telegraphed, recoverable, gentle (the kid-difficulty contract).

---

## P4 — "Did upgrading help?": economy legibility + max-level identity fork  (rank 4)

**One-liner:** Surface the money the game already gives (the invisible +25% bonus, an upgrade
before→after, one rising "power" number) and replace the dominated linear stat-bump with a
felt max-level identity fork — the adapted form of the boss-tower idea, and the one
always-relevant coin sink.

**Problem:** G6 (#4, #5, assists #9). Frictionless auto-income + an invisible +25% bonus + a
finite 2×3 sink ladder floods the late game with money you didn't work for and can't spend;
upgrades are economically dominated by L1 spam and their payoff is invisible (no DPS, no
before→after, no per-tower attribution).

**Mechanic (spec-ready):**
- *Pure-UI legibility (do regardless):* show "Wave clear +20c" and *teach* the +25% rule;
  on the upgrade button show the delta (`Damage 8→12`, range-ring preview) and one single
  "power" number a child can watch rise (raw DPS math is kid-hostile). Zero sim/perf cost.
- *Max-level IDENTITY FORK (the adapted boss-tower):* at max level each tower forks once into
  one of two specializations — basic → *Sniper* (long-range crit) **or** *Gunner* (faster
  fire); strong → *Bomber* (bigger AoE) **or** *Froster* (adds a slow). New sprite + new
  behaviour, a binary commitment with opportunity cost. 2 towers × a fork = 4 felt roles with
  no new tower types; turns "do I upgrade?" into "which way, and what do I give up?" and is a
  real coin sink that has a *seen* payoff.
- *Call-wave-early bonus* (shares P1's GO! button) as the optional income decision — converts
  the late-game lull into a greed valve; floor never rises (ignore it = no cost). Explicitly
  **avoid banking/interest** (rewards hoarding, worsens #4, least kid-legible idea in corpus).

**Why it's depth:** the fork is the cleanest "did upgrading help?" fix — number-go-up becomes a
felt strategic commitment with an opportunity cost; the Froster fork is also the legible
control axis (a third role without a third tower).

**Cost:** M (legibility S; fork = new sprites + behaviours).
**Risk:** the fork must not become "buy the win" against the split boss — keep it a *role*
choice, not raw power; re-measure the margin if it raises ceiling DPS.
**Winnability role:** supports the split-boss path — the Bomber/Froster forks are the powered
top-tier an alert player commits to as the boss-killer (AoE for shards, slow to hold them) —
but the *win is gated on skillful use* (P3 freeze timing), not on the purchase itself.
**Kid note:** legibility is 0 clicks; the fork is one infrequent binary, icon-legible; the
spend finally becomes seen and felt.

---

## P5 — "You won!": real win state, stars, sprite-fit, and split-boss as the summit  (rank 5)

**One-liner:** Make the public game actually winnable at wave 15 with a celebration and
stars-from-lives, demote the secret split boss from "unreachable wall" to the optional summit
the P2+P3+P4 combo can climb, and fix the L3 sprite overlap so the board stays legible.

**Problem:** G5 + G7 (#2, #8). The game *cannot be won* — `isFinalWaveComplete` counts all 16
patterns including the unbeatable secret boss, so `status==='won'` is dead code and clearing
15 public waves guarantees a loss with no victory screen. Beating the wave-5 boss (the exact
motivating moment) produces no distinct celebration. Separately, L3 towers render 115px in a
96px tile → ~19px solid overlap.

**Mechanic (spec-ready):**
- *Real win:* fire `won` on the wave-15 `boss_regenerate` clear with a celebration screen;
  count public waves only, not the secret pattern.
- *Stars-from-lives:* award 1–3 stars from remaining lives (reuses the existing ledger, zero
  new sim state), turning the already-tuned "barely win" margin into a score; a distinct
  banner for beating each boss.
- *Split boss as the summit:* keep the charming "16/15" surprise but reframe it as an optional
  endless/bonus horizon — and tune it (re-measured against P2/P3/P4 player power) so the
  alert-player skill combo in P3 is a *real* path, not a 7.2× wall. It stops amputating the
  win and becomes the aspirational hook.
- *Decouple visual scale from grid footprint (#8):* clamp effective `sizeScale` (or clamp the
  grid blit to the tile), pull glow/rings/puff inside the cell, express level via
  crown/pips/glow/range-ring colour, not raw body size. Pure renderer fix, perf-free —
  prerequisite for any later clustering idea.

**Why it's depth/structure:** restores the single most important reward in the genre and gives
#2's replay drive a summit. Sizing is pure polish but unblocks readable tiles (and the
emergent valley double-coverage trick).

**Cost:** S–M (several small, mostly standalone pieces).
**Risk:** the "winnable split boss" couples to player power — re-run `measure-secret-boss.mjs`
after P2/P3/P4. The cheap half (wave-15 win + stars + sizing) is fully standalone.
**Winnability role:** *defines* winnability — turns on the public win and reframes the secret
boss as the climbable summit for the P2+P3+P4 skill path.
**Kid note:** a win screen + stars is the core reward young players chase; keep any meta tiny
and bounded; sizing restores discrete, readable tiles.

---

## Boss-tower / level-4 upgrade verdict: **ADAPT**

The literal idea — a 4th-tier "boss tower" stat-bump as the key to the split boss — is
rejected *as floated* and folded into P4's max-level **identity fork** instead.

**Reasoning (grounded in research):**
- A pure level-4 stat bump is exactly the pattern the corpus flags as broken: upgrades are
  already *economically dominated by L1 spam* and their payoff is *invisible* (V2-MECHANICS §1,
  GAP-ANALYSIS G6). Another linear tier is one more invisible money sink — it worsens #5, not
  fixes it.
- Making the split boss fall to a *purchased* tier turns the genre's marquee challenge into a
  DPS grind (raw power), directly contradicting the brief's "alert player beats it through
  skill." The unbeatability is empirically anchored at ~7.2× measured peak damage
  (measure-secret-boss.mjs); a buyable power tier just becomes "save up, then auto-win," and
  forces a re-measure that resolves to "buy the win."
- The CATALOGUE explicitly rates the **identity fork** above the stat bump as "the cleanest
  'did upgrading help?' fix" (Tier 2) — a binary commitment with opportunity cost, legible by
  sprite, a *real* sink with a *felt* payoff.

**If adapted, how:** keep the "powerful endgame upgrade as the boss key" fantasy, but express
it as the P4 fork (Bomber/Froster, Sniper/Gunner) and gate the split-boss win on *skillful
use* of that fork **+ the P3 active freeze + P2 AoE affinity**, never on the purchase alone.
The top-tier is a *role* choice the alert player wields well, not a number that buys the win.

---

## Discarded (more ideas than fit — cutting is the job)

- **Fast-forward / variable-speed ladder** — the one perf-sensitive lever (MAX_STEPS_PER_FRAME);
  cut from P1, defer and bench p95 separately; full 0.25×–4× ladder is too many states for kids.
- **Mazing / path-building / branching paths** — the biggest genre depth lever but the wrong
  audience: high cognitive load for ages 5–10 and against the hand-authored fixed-path model.
- **Conveyor / production-chain logistics (Mindustry)** — hundreds of item entities blow the
  p95 gate; non-starter for kids.
- **Hard immunity (0× damage)** — with only two towers a mono-build hits a wall with no
  recourse; use soft affinity (P2) instead.
- **Interest / banking on idle cash** — rewards hoarding, *worsens* #4; least kid-legible idea
  in the corpus.
- **Controllable hero unit & summon/deploy blockers** — a whole sub-game (movement, AI,
  leveling); violates "minimal" and the single-file-path model.
- **Destructible towers + manual repair** — re-adds the exact click/grind load P1 removes; the
  recoverable "nap" (P3) is the kid-safe substitute.
- **Adjacency / support auras between towers** — clustering for the buff directly aggravates #8;
  revisit only after the P5 footprint fix lands.
- **Producer / "farm" structure (the Sunflower)** — effectively a third placeable and a
  delayed-payoff idea straining "exactly 2 towers"; the P4 fork covers the economy decision
  more cheaply.
- **Movable / re-socketable upgrade "charm" (GemCraft)** — elegant but a genuinely new
  ownership model; bigger conceptual lift than the fork; note for later.
- **Earn-by-fighting XP track** — charming but a second progression model on top of the fork;
  sequence after, not now.
- **Two-state ammo toggle** — overlaps the P4 fork and P1 targeting toggle; pick one
  expression, don't ship all.
- **Adaptive-resistance "anti-spam" enemy** — risks illegibility for 5-year-olds; note only.
- **Recoverable treasure-theft (the comeback minigame)** — the most transformative #11 answer
  but replaces the lives abstraction and needs real renderer work; scope as a deliberate future
  feature, not this pass.
- **Forgive-once lawnmower safety net** — optional capstone that makes the difficulty contract
  explicit; defer behind the risk axis.
- **Daily seeded puzzle / tiny localStorage meta / challenge-modifier modes** — validated
  second-wave replay levers (the sim is already pure-seeded), but defer until overload (P1) and
  flatness (P2) are solved; meta power breaks balance if rushed.
- **"Pick 1 of 3" between-wave draft** — a bigger structural shift needing RNG pity-guardrails;
  promising but not a first move.
- **Income-tied-to-play-quality multiplier** — must visualise the cause or it worsens #4;
  lower-leverage than surfacing the bonus + the fork sink.
