# Deep Dive — Time control / pause-to-plan + low-click play

> **Category (scout catalogue #12).** Let the player *stop the clock, look, think, and
> place* with no time pressure — plus variable game speed and set-once automation so
> the moment-to-moment loop never demands fast clicking. Defender's Quest's thesis in
> one line: design for **FOCUS and THINKING, not APM**.
>
> **Symptoms it owns:** #6 (can't keep up placing/upgrading — too many clicks),
> #7 (can't even *see* the enemies — too busy placing), #1 (keep the place-loop fun).
> **Touches:** #5 (an unrushed player can actually *read* whether an upgrade helped),
> #3 (you can pause to study why a boss is eating lives).
>
> **Hard filter (applied throughout):** static GitHub-Pages host, no backend, no build
> step, plain ES modules; pure seeded deterministic fixed-60fps sim; must stay charming
> + minimal for ages ~5–10; must not regress the perf gate (V2 p95 < V1 p95).

---

## 0. Why this category is the single cheapest high-impact lever for CuteDefense

The grownup feedback's two loudest complaints — #6 and #7 — are not a balance problem
and not a content problem. They are a **time problem**. The player is forced to make
every placement/upgrade decision *while the board is moving*, so the act of building
literally steals the eyes away from the payoff (watching towers shred a wave). The
genre solved this two decades ago, and every solution is **pure client-side
logic over the game clock** — no assets, no backend, no build step, no new rendering.
For a static-hosted, perf-budgeted, deterministic-sim game this is the rare lever where
the proven fix is also the cheapest one and is *subtractive* (it removes pressure rather
than adding systems).

CuteDefense is already 90% of the way to the architecture this category wants:

- **Single screen, no scroll.** The whole board is `2514×1154`, fixed, never scrolls.
  Defender's Quest names no-scroll as a *precondition* for pause-to-plan (you can't
  "stop and look" if threats live off-screen). CuteDefense gets this for free.
- **A clean fixed-timestep accumulator.** `Simulation.step(realDtMs)` accumulates real
  wall-clock time and runs constant-size `timestepMs` ticks
  (`v2/sim/Simulation.js:58-63`). This is *exactly* the structure that makes
  deterministic speed control trivial (see §3 and §6) — speed = number of ticks per
  frame, never a change to `dt`.
- **A latent "calm window" already in the data.** Waves carry `prepMs: 8000` and
  `betweenWaveMs: 3000` (`v2/config/gameConfig.js:50-53`) — guaranteed no-enemy time
  that is *already* a planning window but is never framed, surfaced, or made
  player-controllable.

The one thing CuteDefense has that is actively *anti*-pause-to-plan: its pause **blocks
all world interaction** (`v2/input/InputController.js:44` returns before `gridClick`
unless `status === 'playing'`) and draws a **full-canvas scrim** over the board. Today's
pause is "freeze and stare at a grey sheet" — the literal opposite of the pattern below.

---

## 1. The canonical thesis (Defender's Quest)

The reference text for this whole category is Lars Doucet's "Optimizing Tower Defense for
FOCUS and THINKING." Two foundational rules:

> "Let the player **FOCUS** … we don't want to *TEST* the player's focus (ie assault
> them with strobe lights and dancing kittens and see if they can still concentrate),
> we want to *LET* them focus, freeing up as many mental resources as possible. This in
> turn lets us crank up the difficulty of the game's thinking-based challenges without
> overwhelming or stressing out the player."

> "Test the player's **THINKING**."

The payoff is counter-intuitive and is the core argument for CuteDefense: **giving the
player time control lets you make the game deeper without making it harder to play.**
Pause/slow is not "easy mode" — it moves the difficulty from *how fast can you click*
(a test of reactions, bad for a 6-year-old) to *did you make the right call* (a test of
thinking, which is the fun part and the thing the depth pass is trying to add).

The essay is also the genre's clearest statement that **busywork is the enemy**:

> "manually click on coins to collect them, having to pick up and fling enemies away
> with the mouse, etc … the PC's equivalent of the Wii's infamous 'waggle' … they are
> just another stupid test for their own sake that only serves to frustrate my mind."

(CuteDefense already removed manual coin tapping — see `economy-coin-collection.md`. This
category is the same philosophy applied to *time* instead of *money*.)

And it ties the pause directly to "total information" — pausing is only useful if, once
frozen, the player can actually *read the whole situation*: exact numbers, full board,
no hidden state. That is the bridge from "pause" to "plan."

---

## 2. How successful 2D TD games implement it — pattern catalogue

Seven distinct patterns, ordered roughly cheapest→richest. Each: how it works in real
games, the strategic depth it adds, and its click/complexity cost for a *kid-friendly
minimal TD*.

### Pattern A — Tactical pause (pause-and-inspect, no commands)
**How it works.** Pressing pause freezes the sim but you may *look, read, and change
set-once settings* (targeting mode, inspect a tower/enemy card) — you cannot *build*. The
"sporting" middle ground. Tower Factory ships this as an explicit "tactical pause" mode
(camera + configure while frozen); many classic TDs (Defense Grid) sit here or stricter.
**Depth added.** Pure legibility: lets the player study *why* something is happening
("the boss is shielded right now", "this tower is out of range") without the clock
punishing them. Converts a reaction test into a reading test. Directly serves #3 and #5.
**Complexity / click cost.** Lowest of all. The sim already early-returns from `tick`
when `status !== 'playing'` (`Simulation.js:69`), so *freezing is already implemented*.
The only work is letting **inspect taps** (tower/enemy select) through while paused and
making the overlay non-occluding. ~Half a day. Zero perf cost (paused = zero ticks).

### Pattern B — Active pause (pause-and-command)
**How it works.** Pause anytime, and **issue full commands while frozen** — place,
upgrade, sell. Defender's Quest: *"The player can pause the game at any time and still
issue commands."* GemCraft: pause (P) and build/cast while paused — *"act during pause …
think about what to do at any time."* Bloons TD6 reaches the same end via Esc-to-pause
plus click-to-place. The recurring "is this cheating?" worry is answered by **resource
gating**: building still costs coins and upgrades still cost coins, so pausing buys
*thinking time*, not free power ("building towers or casting spells almost always costs
some resource or comes with a cooldown").
**Depth added.** This is the headline. Decisions get strictly *better* when unrushed, so
the designer can pose harder spatial/economic puzzles (the depth pass's #9/#10/#11 work)
knowing the player can deliberate. It also literally lets the kid **watch the enemies**
(#7) — pause, place, unpause, watch the volley land.
**Complexity / click cost.** Low. CuteDefense needs: (1) allow `gridClick` + placement
commit while `status === 'paused'` (or a dedicated `'planning'` status), and (2) replace
the full-canvas scrim with a thin non-occluding "PAUSED — tap to place" frame so the
board stays visible. The two-tap placement popup already works frozen as-is. ~1–2 days.
Perf cost: **negative** (frozen frames do no sim work).

### Pattern C — Variable game speed / fast-forward
**How it works.** A speed control: Defender's Quest offers **0.25× / 0.5× / 1× / 2× /
4×**; Bloons TD6 has a **3× fast-forward** on the space bar; GemCraft offers
fast-forward + pause. Slow speeds are for *"super delicate advanced maneuvers"*; fast
speeds *"keep boredom at bay"* during cleared/trivial stretches. The player self-regulates
intensity.
**Depth added.** Pacing becomes a player tool: slow down to thread a boss window or watch
an upgrade land (helps #5/#7), speed up to skip a trivial trickle. Adds a small skill
expression ("I slow-mo'd the regen boss to time my burst") without adding clicks.
**Complexity / click cost.** Low to implement, but **this is the one pattern with a perf
caveat** (see §3). The deterministic-correct implementation is to vary the *number of
fixed ticks per frame*, never the tick size. For kids, a single big **slow ⏸/▶/⏩ toggle**
(say 0.5× / 1× / 2×) is plenty; the 5-step Defender's Quest ladder is too many states.

### Pattern D — Auto-pause on event (the planning window comes to you)
**How it works.** The game pauses *itself* at decision moments — when the build menu
opens, when a wave is cleared, or (in some designs) when the player hasn't acted for a
beat. The player never has to *remember* to pause. This is the natural reading of the
project's own "pause/slow while the placement popup is open" direction
(`feedback-diagnosis.md` #7) and of Bloons' deselect-on-Esc behaviour.
**Depth added.** Indirect but large for the target audience: removes the
"I-forgot-to-pause-and-got-overwhelmed" failure entirely. A 6-year-old will not discover
a pause hotkey; auto-pause *guarantees* the calm window is used.
**Complexity / click cost.** Low. Tie `status` to popup-open state: opening a placement
popup (or the prep phase) sets a soft pause; committing/cancelling resumes. The risk is a
"stutter" feel if it triggers too often — gate it to the build popup and the prep window,
not every tap. ~1 day. Perf-neutral/positive.

### Pattern E — Player-owned tempo: build/prep "calm window" + call-wave-early
**How it works.** Instead of (or alongside) a global pause, the *wave clock* gives the
player tempo control. There is a guaranteed enemy-free prep window before each wave, and
an optional **"start the wave now" button that pays a bonus** for the unused calm time.
Kingdom Rush is the canonical case and is *so* committed to this that it ships **no
fast-forward at all** — its designers' stated reasoning: *"you can call waves early …
there are more frantic moments than calm ones,"* so the calm/frantic rhythm IS the
pacing system. Tower Defense Simulator pairs the same idea with a **wave-clear bonus** and
a vote-to-skip, turning "I'm ready early" into a reward.
**Depth added.** A genuine risk/reward decision that costs *zero* in-combat clicks: take
the full calm window to set up safely, or rush the wave for extra coins (helps #4's
economy tension too). The player owns the pace without any twitch.
**Complexity / click cost.** **Lowest-hanging fruit of all for CuteDefense**, because the
calm window already exists in data (`prepMs: 8000`, `betweenWaveMs: 3000` —
`gameConfig.js:50-53`); it is simply never surfaced as "planning time" or made
skippable. Add one "GO!" button + a small bonus = the whole pattern. ~1 day. Perf-free.

### Pattern F — Total information + single-screen (the substrate that makes pause useful)
**How it works.** Everything is on one non-scrolling screen with exact, always-visible
state — so when you *do* pause, the pause is *worth* something. Defender's Quest: *"All
information about a game's internal state and each player's resources is available to
every player at all times,"* explicitly to make the game a test of **THINKING rather than
MEMORIZATION**, and *"No scrolling … scrolling reduces the player's ability to focus."*
**Depth added.** It is the enabling condition, not a feature in itself: a pause is only a
*planning* pause if the frozen frame shows the player everything they need (range rings,
the AoE footprint, the boss's current shield state, the upgrade's before→after). Pairs
with the #5/#9 legibility work — pausing + showing total info is what makes "did the
upgrade help?" answerable.
**Complexity / click cost.** CuteDefense already satisfies the *no-scroll, single-screen*
half for free. The "total information" half is shared work with other depth areas
(surface range/AoE/upgrade-delta), not unique to this category.

### Pattern G — Set-once / low-click play (so pause is compensating for less)
**How it works.** Reduce the *number* of in-combat actions the player must take, so the
need for time control drops too. Genre staples: **build trays / hotbars** (pick a tower
type once, then tap cells), **shift/drag to place several** (Bloons: hold shift to keep
placing the same tower), **last-type-as-default**, and **set-once targeting modes**
(First/Last/Strongest — programmed once, zero combat clicks; scout cat. #2).
**Depth added.** Targeting modes especially: the same tower in two modes solves two
problems, so it is *decision depth that costs zero clicking during combat*. The rest is
pure friction removal feeding #6.
**Complexity / click cost.** Low–medium. CuteDefense already keeps `lastTowerType` as the
popup default (`Simulation.js:138`), so a build-tray that pre-selects a type before
tapping cells is a natural extension. A kid-sized targeting cut is **2–3 modes with
icons** ("front / strongest / hurt"), not the genre's 7. Build-tray ~1–2 days; targeting
~1–2 days. The 24px drag-cutoff (`InputController.js:32`) currently forecloses
drag/paint-place — relaxing it is the prerequisite for "drag to place several."

---

## 3. The perf caveat (the only real cost in this whole category)

Pause (A/B/D) and slow-mo are **perf-positive**: a paused frame runs *zero* sim ticks
(`Simulation.js:69` early-returns), and 0.5× runs *fewer* ticks per frame. Neither can
regress the V2-vs-V1 frame-time gate; they only ever reduce sim work.

**Fast-forward (C) is the exception and must be sized carefully.** CuteDefense's loop runs
up to `MAX_STEPS_PER_FRAME = 5` fixed ticks per rendered frame (`Simulation.js:16,62`).
True N× fast-forward means running ~N× the fixed ticks per frame, i.e. N× the sim cost
per frame (the renderer is unchanged, so sprite-cache cost is flat). At 2× on the locked
bench fixture (40 enemies / 12 towers / 30 coins) the sim roughly doubles per frame —
almost certainly inside budget, but it **must be benched against the p95 gate before
shipping**, not assumed. 4× (Defender's Quest's top speed) is where the step cap and the
gate genuinely fight; for a kid game it is also unnecessary. **Recommendation: ship
pause + 0.5× + a single 2×, skip 4×**, and re-measure p95 at 2× during a heavy wave.

**The determinism rule (non-negotiable, and CuteDefense is already built for it):** speed
control must change the **number** of fixed ticks per frame, **never** the `dt` handed to
`tick()`. `tick(dt)` must always receive the constant `config.timestepMs`
(`Simulation.js:59,65`); a paused frame runs 0 ticks, 2× runs twice as many constant-size
ticks, 0.5× runs one every other accumulator-unit. Scaling `dt` would break both the
fixed-timestep contract and the seeded-RNG determinism that the whole sim core depends on.
Because the engine *already* accumulates real time and emits constant-`dt` ticks, this is a
clean, low-risk change — the architecture was effectively designed for it.

---

## 4. The contrarian data point — Kingdom Rush ships *no* speed control on purpose

Worth flagging honestly: the genre is not unanimous. Kingdom Rush deliberately omits
fast-forward (and, classically, pause-to-build), on the reasoning that *"there are more
frantic moments than calm ones"* and that the **call-wave-early** mechanic already gives
the player tempo control. Their game is a *reaction-and-rhythm* TD by design — the opposite
end of the spectrum from Defender's Quest's *thinking* TD.

**Why this does not generalize to CuteDefense:** Kingdom Rush's audience tolerates (enjoys)
frantic APM; CuteDefense's stated audience is ages ~5–10, for whom "more frantic moments
than calm ones" is precisely the #6/#7 failure. The *useful* lesson to steal from Kingdom
Rush is not its no-speed stance — it is **Pattern E (call-wave-early as player-owned
tempo)**, which is kid-perfect and which CuteDefense can adopt nearly for free on top of
its existing prep window.

---

## 5. Honest fit assessment for CuteDefense V2

**Overall: the best value-per-effort category in the scout list, and the safest under
every hard constraint.** It is the rare lever where the proven genre fix is also (a) pure
client-side logic — no assets/backend/build, (b) mostly *subtractive* — it removes time
pressure rather than adding systems, (c) perf-positive for everything except a capped
fast-forward, and (d) directly aimed at the two loudest, most-repeated symptoms (#6, #7).

**What already fits / is half-built:**
- Single-screen, no-scroll board → Pattern F substrate is free.
- Fixed-timestep accumulator with constant-`dt` ticks → Patterns B/C/D are a clean,
  deterministic-safe change, not a rewrite (`Simulation.js:58-69`).
- Freeze logic already exists (`tick` early-returns when not playing) → Pattern A is
  almost done.
- `prepMs`/`betweenWaveMs` calm windows already in config → Pattern E is ~a button.
- `lastTowerType` default already tracked → Pattern G's build-tray is a natural step.

**What must change (and is the actual work):**
- Today's pause is anti-pattern: it **blocks** world taps (`InputController.js:44`) and
  draws a **full-canvas scrim** (`Renderer.js:649`). Active pause requires *allowing*
  inspect+placement while frozen and making the overlay non-occluding. This is the single
  most important change in the category and it is small.
- Fast-forward must be benched against the p95 gate before shipping; cap it at 2× for
  kids; never scale `dt` (§3).

**What to avoid:**
- The full 0.25×–4× speed ladder (too many states for a 6-year-old; 4× stresses the perf
  cap for no kid benefit). One slow / one fast is enough.
- A 7-mode targeting menu (Pattern G) — cut to 2–3 icon modes, or defer.
- Treating pause as "easy mode" and apologizing for it. The thesis is the reverse: pause
  is what *lets* you add depth (#9/#10/#11) without raising the click bar (#6).

**Kid-framing caveat (important):** young kids will not discover a manual pause hotkey, so
the category only pays off if the calm window is **brought to them**. Lead with
**auto-pause on the build popup (D)** + the **legible prep window with a big GO! button
(E)** + **one obvious slow/fast toggle (C)**, and treat manual active-pause (B) as the
power-user layer on top. Esc-only pause (`InputController.js:72`) is not enough.

**Recommended minimal cut (the 80/20):**
1. **Active/tactical pause that lets you place + inspect while frozen, with a
   non-occluding overlay** (Patterns A+B). Fixes #7 directly; turns the existing freeze
   into real planning time.
2. **Auto-pause (or auto-slow) while the placement popup is open** (Pattern D). Fixes the
   "build steals my eyes" core of #6/#7 with almost no new UI.
3. **Surface the prep window as planning time + a "GO!" call-wave-early bonus button**
   (Pattern E). Free tempo control + a small economy-tension win for #4.
4. *(Optional, bench first)* a single **2× toggle** (Pattern C) for trivial stretches.

Items 1–3 are perf-positive, asset-free, build-free, deterministic-safe, and aimed
squarely at #6/#7/#1. They are the cheapest meaningful improvement available to V2 and
the natural foundation under the heavier depth picks (varied waves, distinct tower roles,
kid-safe risk) — because every one of those depth additions is only fair if the kid has
time to *think* about it.

---

## Sources

- Defender's Quest — "Optimizing Tower Defense for FOCUS and THINKING" (Lars Doucet,
  Fortress of Doors):
  https://www.fortressofdoors.com/optimizing-tower-defense-for-focus-and-thinking-defenders-quest/
- Same essay (Game Developer mirror):
  https://www.gamedeveloper.com/design/optimizing-tower-defense-for-focus-and-thinking---defender-s-quest
- Bloons Wiki — Fast Forward (3× speed, spacebar toggle):
  https://bloons.fandom.com/wiki/Fast_Forward
- Bloons TD6 — Steam discussions (shift-to-place-multiple, Esc pause/deselect):
  https://steamcommunity.com/app/960090/discussions/0/1638661595056416109/
- GemCraft — pause-and-act / fast-forward / "always doing something":
  https://www.kongregate.com/en/games/gameinabottle/gemcraft
- Kingdom Rush — Steam discussion "Any fast forward button?" (no FF by design;
  call-waves-early as tempo; "more frantic moments than calm ones"):
  https://steamcommunity.com/app/246420/discussions/0/451851477883608971/
- Kingdom Rush — Ironhide community forum, "Speed Up" thread (design + technical
  reasoning for no fast-forward):
  https://forums.ironhidegames.com/viewtopic.php?f=12&t=3529
- Tower Factory — Steam discussion "Ability to plan during pause" (tactical pause vs
  active/strategy-mode build-while-paused):
  https://steamcommunity.com/app/2707490/discussions/0/507318096807087942
- Defense Grid 2 — Steam discussion "Pause Game To Strategize?" (classic no-build-while-
  paused stance):
  https://steamcommunity.com/app/221540/discussions/0/613948093871964702/
- Tower Defense Simulator Wiki — Waves (wave-clear bonus, intermission, vote-to-skip):
  https://tds.fandom.com/wiki/Waves
- CuteDefense V2 ground truth: `v2/sim/Simulation.js:16,58-69` (fixed-timestep
  accumulator, freeze on non-playing), `v2/input/InputController.js:32,44,72` (pause
  blocks world taps; drag cutoff; Esc-only pause), `v2/config/gameConfig.js:30,50-53`
  (`timestepMs`, `prepMs`, `betweenWaveMs`), sibling research
  `v2/docs/depth-pass/research/feedback-diagnosis.md` (#6/#7) and
  `placement-hud-interaction-attention-load.md` (interaction model).
