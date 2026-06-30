# CuteDefense V2 — Current Mechanics: Value & Shallowness (Synthesis)

> **What this is.** An honest, code-grounded write-up of every mechanic CuteDefense V2
> *actually runs today*, the genuine value each adds to the play experience, and — just
> as honestly — where each is shallow. Synthesised from the six area research docs under
> `research/v2/` and `research/feedback-diagnosis.md`, re-verified against the live code.
>
> **Audience:** the depth pass. The goal is a shared, accurate picture of the floor we
> are building on, so depth work targets real gaps and doesn't re-tune things that are
> already working.
>
> All citations are `file:line` against `/Users/jacobusbrink/Jaxs/projects/CuteDefense`.

---

## 0. Three ground-truth corrections the brief still gets wrong

The project brief is stale on three points. Any plan must start from the *code*, not the brief:

1. **Coins are NOT manually collected.** Kills auto-credit the wallet directly
   (`enemySystem.js:162` → `creditCoins`; `economySystem.js:16-19, 55-57`;
   `InputController.js:46-47`). The whole on-board coin object system (`spawnCoin`,
   15s lifetime, collect radius, the entire `economy.coin` config block
   `gameConfig.js:36-42`) is **dead code**, alive only to feed the locked benchmark
   fixture. "Coin collection" as a player mechanic does not exist. This is a primary
   driver of feedback #4 (frictionless income).

2. **"Formations" are not spatial.** `single/line/wedge/swarm/phalanx` are config keys
   that resolve to a single **spawn-interval multiplier** (`FORMATION_FACTOR`,
   `waveSystem.js:10`, `{single:1.0, line:0.5, wedge:0.5, phalanx:0.4, swarm:0.25}`).
   Every enemy spawns at the one start cell and walks the one path single-file; a
   "wedge" is just enemies released closer together *in time*. **`wedge` is a dead
   alias of `line`** (both 0.5). The names promise 2D tactics the engine never produces.

3. **The game cannot currently be won.** "Win" only fires after the final pattern
   clears (`Simulation.js:94-98`, `isFinalWaveComplete` counts all 16 patterns incl. the
   secret), and the final pattern is the intentionally-unbeatable wave-16 split boss. So
   `status === 'won'` is unreachable in real play; the win overlay is dead code.

---

## 1. Towers, upgrades & projectiles

**Source:** `towerSystem.js`, `projectileSystem.js`, `CONFIG.towers`/`combat`, `SpriteCache.js`.

### What actually runs
- **Exactly two towers, three levels each** (`gameConfig.js:116-142`):
  - **basic** — `kind:'single'`, dmg 8/12/18, range 2/2.5/3 tiles, fire 1800/1350/900ms,
    cost 5/50/100, projectile 800px/s.
  - **strong** — `kind:'aoe'` radius **1.0 tile**, bombDamage 40/80/120, range 1.5/2/2.5,
    fire 3000/2000/1500ms, cost 15/60/120, projectile 400px/s.
- **Lifecycle:** `placeTower` (one per buildable cell; `canPlace` only checks bounds +
  buildable + not-occupied, `towerSystem.js:18-23`); `upgradeTower` (linear 1→3, monotonic,
  no branches, `:58-69`); `sellTower` (refund `floor(invested×0.7)`, `:75-85`).
- **Targeting** is one fixed weighted score `dist·0.3 + lowHealth·0.4 + typeScore·0.3`
  (`acquireTarget`, `:89-105`; weights `gameConfig.js:150-151`). Re-acquired only when the
  target dies/leaves range. **The player has no control over targeting.**
- **Projectiles** home (re-lock to live target each frame, `projectileSystem.js:42`) with a
  generous hit radius (`:30-32`) — they essentially never miss. Crit roll 1%×2 lives in the
  **single-target branch only** (`:78`); AoE bombs bypass it.

### Genuine value
- **The opening placement loop is the proven hook.** Tap tile → live ghost + dashed range
  circle + cute sticker panel → confirm with a grow-in pop. That feedback density is *why*
  the first minutes are fun (feedback #1).
- **The one real, deep decision is "upgrade-in-place vs. build another tower."** Because the
  range nerf (5/6/7 → 2/2.5/3) made coverage *local*, breadth genuinely competes with depth;
  the balance ladder proves "cover the path, then upgrade chokepoints" beats both pure
  spread and pure save-and-upgrade (`BALANCE.md`). This is legitimately the spine of the game.
- **Sell-to-reposition** exists (V1 lacked it) — a real lever, even if rarely needed.
- **Homing + low click-load targeting** is age-appropriate: a 5-year-old never fights the
  controls.

### Where it's shallow
- **Two towers on a single axis (single vs. small AoE), and at L1 they are per-coin
  identical:** basic 4.44 dps / 5c and strong 13.3 dps / 15c both = **0.89 dps/coin**. So
  strong dominates anything clumped and basic only wins on range and retarget speed — a
  distinction the UI never communicates (feedback #9). The *perception* of variety is thin
  because the reality is thin.
- **Upgrading is economically dominated by spamming L1s.** basic L1→L2 buys +4.44 dps for
  50c; the same 50c buys ~10 more L1 basics = +44 dps (~10× better). Upgrades only really buy
  **range** and **tile-consolidation** — both invisible. So the rational opening is "spam
  cheap towers," money piles up, and the upgrade button feels like a sink with no felt payoff
  (feedback #4, #5).
- **Upgrade payoff is invisible.** No DPS readout, no before→after, no floating damage
  numbers, no per-tower kills/damage; range circle only shows while selected. Just a 220ms
  grow-pop and a bigger sprite (feedback #5).
- **Targeting, crit, and projectile skill are non-decisions.** No First/Last/Strongest modes
  (the genre's canonical lever); crit is 1% single-target-only decorative flavour; homing +
  near-guaranteed hits mean no positioning/leading skill.
- **Dead config compounds confusion:** `strong.levels[].damage` (20/35/55) is **never read**
  — `fire` uses `bombDamage` for AoE (`projectileSystem.js:13`). The brief's "20/35/55 + bomb"
  describes a number the sim never applies.
- **L3 sprite overflows its tile** (render-area symptom, feedback #8): `r = tile×sizeScale`
  (`SpriteCache.js:78`); L3 `sizeScale 0.6` × 96px = Ø **115px in a 96px tile** → ~19px solid
  overlap between adjacent L3 towers, before idle-breathe (+4%) and fire-puff (+24% Y).

---

## 2. Enemies, waves, formations & bosses

**Source:** `enemySystem.js`, `waveSystem.js`, `CONFIG.enemies`/`waves`.

### What actually runs
- **Three regular enemy types, distinguished only by stat block + shape** (no abilities,
  `gameConfig.js:90-93`): basic (circle, hp100, spd1.1, rwd3), fast (diamond, hp50, spd2.0,
  rwd5), strong (square, hp200, spd0.7, rwd8). All cost **1 life** at the goal.
- **Three bosses, one behaviour each** (`gameConfig.js:97-99`): boss_shield (W5, hp925,
  3-life, periodic invuln window), boss_speed (W10, hp555, 4-life, periodic 2× burst),
  boss_regenerate (W15, hp1110, 5-life, +2hp/s). Plus the secret W16 boss_split (§5).
- **15 hand-authored patterns + 1 secret** (`gameConfig.js:61-85`). Enemy vocabulary is fully
  introduced by **wave 3**; nothing new appears after except the three bosses (3 times).
- **Scaling is one uniform geometric curve** (`computeScaling`, `waveSystem.js:21-32`):
  hp×1.12, speed×1.03, count×1.20, reward×1.08, interval×0.95 per wave, capped at 15; bosses
  get ×1.5 hp/reward. The whole difference between wave 6 and wave 14 is "more, tankier, faster
  — same three types."
- **Groups expand sequentially**, not interleaved (`waveSystem.js:41-56`): a "mixed" wave is
  all-basics → all-fasts → all-strongs as mono-type bursts; mixing is only incidental
  (faster enemies overtaking slower ones).
- Enemy type touches play in exactly one place: `typeScore` biases which enemy a tower
  *shoots first* (`gameConfig.js:151`) — automatic, doesn't change damage, player never sets it.

### Genuine value
- **The wave-5 shield boss is the standout success.** It's the first real wall; losing to it
  made the grownup *want to replay* (feedback #2). The deliberate ~1.85× hp / 1.5× speed
  retune (`BALANCE.md`) makes a boss "bleed a few lives even off a completed build" — a
  legible-enough skill wall that creates "so close, retry" pull. **This is the template the
  rest of the game should follow.**
- **One latent, real (but hidden) lever:** AoE-vs-single against bunched spawns. Tight
  formations (factor 0.25/0.4) sit enemies closer on the path where strong's 1.0-tile AoE can
  catch two or three. It's a genuine numeric relationship — just weak and never surfaced.
- The layer's honest job is to be the **difficulty pressure** the placement/economy game
  responds to, and at that it works through ~wave 13.

### Where it's shallow
- **This is the single biggest depth gap (feedback #10).** No wave ever *demands* a different
  answer than the one before. The vocabulary never grows; "variety" is count/hp/speed scaling
  plus a misnamed 1D timing knob; mono-type sequential bursts mean you never have to
  simultaneously answer fast + tank. The player correctly perceives "more of the same, faster."
- **No counter-play of any kind.** No damage types/armor/affinity triangle; no flyers,
  healers, splitters, burrowers among regulars; no anti-shield, no slow tower. Every boss
  reduces to the **same answer: bring more total DPS before it arrives.** Shield can't be
  stripped, regen can't be burst-broken, speed can't be slowed.
- **Boss lethality is opaque (feedback #3).** A boss silently costs 3/4/5 of 12 lives
  (`enemySystem.js:127`) — 25-42% of the run in one leak — and nothing previews `livesCost` or
  telegraphs the shield/speed/regen state. The loss reads as arbitrary. The cost is *intended*
  (`BALANCE.md`); it's just invisible — a legibility gap, not a balance bug.
- **Lone-boss waves are pure sponges.** Boss waves are a single enemy with no escort, so the
  wave collapses to "did my DPS out-race its HP," and any shortfall converts straight to a
  chunky unexplained life loss.
- **The replay hook has no summit.** Wave 16 makes the run unwinnable, so "beat it" tops out
  at *surviving* 15 waves — the satisfaction of actually winning doesn't exist (feedback #2).
- **Replay teaches nothing new.** Path, waves, stats, formations are all fixed; the only RNG is
  1% crits and ±50ms jitter — two seeds differ by rounding noise.

---

## 3. Economy & coin collection

**Source:** `economySystem.js`, `CONFIG.economy`, kill→reward in `enemySystem.js`, costs in `towerSystem.js`.

### What actually runs
- **Faucet:** 60 starting coins; per-kill reward auto-credited (basic 3 / fast 5 / strong 8;
  bosses 25/20/30); reward scales ~`1.026^(w-1)` net (1.08 growth softened by 0.95
  `coinReduction`); **+25% end-of-wave bonus** on everything earned that wave
  (`waveSystem.js:155-167`) — the 25% rule is never shown.
- **Sinks (the complete list):** place (basic 5 / strong 15), upgrade (basic 50/100 / strong
  60/120), sell (0.7 refund). That's it — **2 towers × 3 levels + sell.** No abilities,
  consumables, interest, global/meta upgrades, or unlocks.

### Genuine value
- **The spend side is the genuine spine of the game.** "Spread vs. save-and-upgrade vs.
  optimal" under a tight budget is real, machine-proven depth (`BALANCE.md` ladder). The
  "always a little short" reinvestment cadence — tuned via 60 start + count×1.20 +
  coinReduction 0.95 — keeps placing/upgrading a live decision nearly every round through ~W13.
- **Two-tap confirm** is a legitimate kid-friendly guard against mis-spends.

### Where it's shallow
- **The earn side is fully automatic; the collect side was deleted entirely.** Zero agency, no
  timing, no risk, no last-hit bounty, no banking choice. As a standalone "earn & collect"
  loop it offers the player *nothing* — and left a whole dead config block + dead system behind.
- **Too much money (feedback #4) is structural and self-acknowledged.** `BALANCE.md` §5 admits
  a "structural ceiling": with a finite 2×3 sink ladder and finite tiles, a covered build runs
  out of things to buy and floods with surplus in the last 1-2 waves (worst on easy Comb). Auto-
  credit + the invisible +25% bonus make the pile *feel* especially pointless — money you didn't
  work for and can't spend.
- **Upgrade value can't be evaluated (feedback #5).** No before/after on the upgrade button
  (just `Upgrade 50c`); the card shows raw `Damage` and `Fire 1.80s` separately — a child can't
  compute DPS = dmg ÷ interval; no single "power" number, no per-tower attribution.
- **No genre economy levers:** no interest/banking reward for holding, no income risk/reward
  (last-hit bounty, send-early bonus), no progress meter toward "the next thing you can afford."
  The wallet is a bare number that pulses.

---

## 4. Maps, spatial strategy & the risk model

**Source:** `config/maps/map1.js` (Ribbon), `map2.js` (Comb), `mapParser.js`, `canPlace`.

### What actually runs
- **Two ASCII maps, one strict single path each.** Ribbon = 22×12, 106-cell serpentine path,
  158 buildable (60%), long/easy. Comb = 59-cell path, 205 buildable (78%), short/fast/hard.
  The parser enforces exactly one S/E and degree-2 interior — **no branches, no loops, no
  alternate routes by construction** (`mapParser.js:48-67`).
- **Placement is off-path-only, one tower per cell, no spacing rule** (`canPlace`,
  `towerSystem.js:18-23`).
- **The map is RANDOM, not chosen** (`state.js:18` seeds it; `GameApp.js` never passes an
  index); restart locks the same map; there is no map-select UI.
- **No risk model for towers whatsoever.** Grepping the sim finds no tower hp, no
  enemy→tower interaction, no attack/destroy/disable, no maze/wall. Towers are immortal,
  untouchable. The only loss vector is an enemy reaching the goal.

### Genuine value
- **Local ranges give placement its one real teeth:** "is this tile close enough to the path
  to be useful?" A far tile wastes the tower, so the player must hug the path; the placement
  range-preview supports this decision (`Renderer.js:319`).
- **Emergent "valley" double-coverage** — a tower in the gap where the path doubles back can
  cover two passes. Real per-coin value for an observant player.
- Ribbon-long-easy vs. Comb-short-hard is a genuine, well-tuned intrinsic difficulty gap.

### Where it's shallow
- **No risk axis at all (feedback #11).** "Place towers safely out of the way" is *literally
  optimal* — every safe tile is equally safe, and with 60-78% buildable, scarcity never bites.
  There is no safe-vs-strong tradeoff because every strong spot is also perfectly safe.
  Placement is pure coverage-optimization with no stakes.
- **Every wave is spatially identical (feedback #10, spatial half):** one fixed path, one
  spawn point, timing-only formations. Coverage built for wave 1 *is* the coverage for wave 15;
  nothing ever asks you to re-shape the layout.
- **The genre's richest spatial levers are all structurally excluded:** no mazing/path-building
  (forbidden by design), no branching/multi-spawn paths, no bypass enemies (flyers/burrowers),
  no special terrain (high ground, slow/amplify, premium tiles), no coverage feedback/heatmap.
- The emergent valley depth that *does* exist is invisible and made harder to even perceive by
  the L3 sprite overlap (§1).

---

## 5. Placement, HUD & interaction / attention load

**Source:** `InputController.js`, `Simulation.gridClick`/`placement*`/`*Selected`, `Renderer.js`.

### What actually runs
- **One world gesture: a tap** (drags >24px discarded). `gridClick` is a priority chain
  (`Simulation.js:124-143`): tower → select; enemy → select; empty buildable → open placement
  popup.
- **Placement is a 2-tap commit** (tap tile → tap Buy), or **3 taps** to switch type (tap tile
  → Cycle → Buy). Type choice lives *only inside the popup* via a Cycle loop — you can't
  pre-select "strong" and place several. A full L3 tower = tile + Buy + Upgrade + Upgrade = **4
  taps minimum.**
- **Split locus of control:** placement is an **on-board** popup (right); management
  (Upgrade/Sell) is in the **dock** (far left, ~2000px away). Auto-select on place forces a
  cross-screen hand/eye jump for the common place→upgrade flow.
- **No time control of any kind.** The RAF loop steps the sim every frame unconditionally; no
  pause-to-plan, no slow-mo, no fast-forward — and world taps are *rejected while paused*
  (`InputController.js:44`), so you literally cannot stop to look and place.
- **Silent dead taps:** unaffordable Buy/Upgrade register no hit-rect and emit no feedback — a
  child taps a greyed button and nothing happens.

### Genuine value
- The 2-tap confirm and tap-to-inspect are legitimate, age-appropriate affordances.
- The Cycle button wears the next tower's colour + thumbnail — a non-reader cue for "what
  you'll switch to."

### Where it's shallow / actively harmful
- **This layer is a near-pure executor** — it generates almost no decisions of its own; its job
  is to make the *borrowed* decisions cheap and legible, and it underperforms on both.
- **Too much to click (feedback #6)** is structural: 2-3-tap placement, no build tray/hotbar,
  no paint/multi-place, type choice buried per-tile, split on-board-vs-dock locus, no batch ops,
  silent dead taps. Required interactions-per-minute climb each wave while per-action tap cost
  stays high — exceeding comfortable throughput for the age band (and for the grownup).
- **Can't see the enemies (feedback #7)** is *enforced* by the absence of any time control:
  there is no build phase, so placing always competes with watching; the opaque on-board popup
  occludes the board; attention is fragmented across four zones (dock / board / popup /
  announcements). The game's payoff — watching your towers shred a wave — is invisible because
  attention is spent on the input layer.
- **Stats are divorced from the entity:** a tower's stats live in the far dock while the tower
  lives on the board, with no upgrade preview.

---

## 6. The secret split boss (W16) — the hook with no summit

`boss_split` is appended as `patterns[15]` with `secret:true` (`gameConfig.js:84`), kept out of
the public count so the HUD reads `…/15` until it surprises the player as `16/15`. It is
**deliberately, empirically unbeatable:** base hp 20000 → on-field ≈146,613 (×7.33 wave-16
scaling) vs a measured peak player damage of ~20,366 (`measure-secret-boss.mjs`) — a ~7.2×
margin — with `livesCost:99` (one-shot) and a 3-shard `boss_splitling` fail-safe so even a
force-kill walks shards to the goal and ends the run (`enemySystem.js:164-173`).

**Value:** a well-engineered *future* hook for the planned boss-tower-upgrade feature; the
"16/15" surprise is genuinely charming. **Shallowness:** it currently **amputates the win
state** — the single most important reward in the genre. The replay drive that wave 5 creates
(feedback #2) has no summit to reach, and `boss_split`/`boss_splitling` are defined but unused
by the 15 shipped waves.

---

## 7. Cross-cutting synthesis

Three patterns recur across every area:

1. **The depth that exists is real but invisible.** The coverage→upgrade tradeoff is
   machine-proven; boss lives-cost is deliberate; the AoE-vs-single edge is a genuine number.
   But *none of it is surfaced* — no DPS, no coverage indicator, no livesCost preview, no boss
   tells, no upgrade delta. The game is deeper in the math than at the table.

2. **The breadth is genuinely thin, not just illegible.** Two near-substitute towers on one
   axis; three enemy types fixed by wave 3; one fixed path; a finite 2×3 sink ladder. Making
   the existing systems legible helps, but several gaps (#9 roster, #10 wave variety, #11 risk)
   need *more system*, not just better UI.

3. **The depth pass's own lever created the execution failure.** "Always a little short →
   place/upgrade nearly every round" raised required interactions-per-minute, but the
   interaction layer (2-3 taps/action, no tray, no pause, no time control) never paid that load
   down — producing #6 and #7. Any future depth that raises required actions must budget the
   interaction cost alongside it.

The **wave-5 boss is the proof that the good version of this game is reachable** — a legible,
counterable spike that makes you want to retry. The depth pass's job is to make the rest of the
game feel like that wave, while keeping it charming, minimal, and low-click for a 5-year-old.

---

## Appendix — mechanic-by-mechanic value/shallowness scorecard

| Mechanic | Genuine value | Core shallowness | Depth or polish? |
|---|---|---|---|
| Place towers | Tactile, proven hook (#1) | Fun fully front-loaded; novelty dies once board is covered | Depth |
| basic vs strong | A real choice (single vs AoE) | Per-coin identical at L1; one axis; never communicated (#9) | Depth |
| Upgrade 1→3 | Buys range + tile consolidation | Dominated by L1 spam; linear/no branches; payoff invisible (#5) | Depth |
| Sell (0.7) | Real reposition lever | Rarely needed (towers can't die, money abundant) | Depth |
| Targeting | Zero click-load (kid-friendly) | One fixed score; no player control; removes genre's core lever | Depth |
| Crit | — | 1%, single-target-only, decorative | Polish |
| Projectiles | Never-miss = no frustration | No skill/leading/positioning; homing | Polish |
| 3 enemy types | Clear shapes | Stat blocks only, no abilities; fixed by wave 3 | Depth |
| Waves/scaling | Pressure curve works to ~W13 | "More, faster, tankier" — never *different* (#10) | Depth |
| Formations | — | 1D timing only; `wedge`=`line` dead alias; names mislead | Depth |
| Bosses 5/10/15 | W5 is the standout retry hook (#2) | Opaque livesCost (#3); behaviours have no tell/counter; lone sponges | Depth + polish |
| Economy (spend) | The genuine spine; ladder-proven | Finite 2×3 sink → late surplus (#4) | Depth |
| Economy (earn/collect) | — | Auto-credit, zero agency; collect deleted; invisible +25% bonus | Depth |
| Maps (2) | Local-range placement has teeth; Ribbon/Comb gap | Map is random not chosen; spatially identical every wave | Depth |
| Risk model | — | None — towers immortal; safe placement is optimal (#11) | Depth |
| Interaction/HUD | 2-tap confirm; inspect | 2-4 taps/action, no tray/pause/time-control; occludes board (#6,#7) | Polish |
| Tower sprite size | Growth = progression feedback | L3 (115px) overflows 96px tile → overlap (#8) | Polish |
| Win/lose | Tight "barely win" margin tuned | Win unreachable (secret boss); no stars/score/milestones | Depth |
| Secret W16 boss | Charming future hook | Removes the win state; defined-but-unused otherwise | Depth |
</content>
</invoke>
