# CuteDefense V2 — Source of Truth

> **Status:** authoritative spec for the V2 rebuild. This document is the single source of truth and
> supersedes any ad-hoc prompt or note.
> **Repo:** `~/Jaxs/projects/CuteDefense` · GitHub `Jaxsbr/CuteDefense` · deploys to GitHub Pages at
> `https://jaxsbr.github.io/CuteDefense` via `.github/workflows/deploy.yml`.

---

## 1. Intent

Rebuild the tower-defense game **CuteDefense** as a second implementation (**V2**) living
**side-by-side** with the current one (**V1**) in the same repo, both served from the same
HTML page and selectable by a query parameter. V1 stays fully playable and untouched except
for benchmarking instrumentation.

The rebuild exists for **two reasons, in priority order:**

1. **Reliability** — a recent bug made the game unplayable and upset my kids; V2 must be
   *provably* free of V1's known failure modes.
2. **Performance** — V1's effects-heavy rendering crawls on a slow laptop and needs special
   layout handling on a tablet; V2 must *measurably* beat V1 on the same hardware (equalling
   V1 is the floor, not success) while staying visually charming.

### Quality bar (taste-led — you decide what "good" means)

Soft, fluffy, minimal. V1 is over-decorated and that is the suspected performance culprit, so
the bar for V2 visuals is **"charming with the least work the GPU/CPU has to do."** Keep the
*shapes, faces, and animations* of enemies / towers / coins (the kids recognise them) but render
them minimally. Where this doc says "research V1, critique and propose improvement" (e.g. the HUD
inner layout), **you own the design call** — show me your proposal, don't ask me to spec it.

### Ownership

This is a large, multi-module build. **Decompose it, fan it out where independent, gate every
piece with evidence, and bring me a working game** — not a pile of steps to approve.

---

## 2. Hard bounds — must not break

- **V1 stays playable and behaviourally identical.** The *only* permitted edits to V1 are adding
  benchmarking hooks.
- **Static-host constraint (load-bearing):** V2 must remain **statically servable on GitHub Pages —
  no backend, no server-side runtime** — exactly like V1 (the game ships via
  `.github/workflows/deploy.yml` to `jaxsbr.github.io/CuteDefense`). Any architecture that needs a
  server is out of bounds.
- **No build step for the shipped game.** V2 ships as **plain browser-native ES modules, no
  bundler** — the same delivery model as V1. A bundler/compiler is not introduced. The only tooling
  permitted is the **Node-based headless test + benchmark harness, which is a dev-only dependency**
  and never part of what gets served.
- **Game logic for V1 and V2 is completely separated** — no shared game code, no shared state. The
  shared surface is **infrastructure only — e.g. dev dependencies (the Node test/bench harness) and
  the single serve `index.html` + query-param router** (non-exhaustive; share whatever infra is
  genuinely common).
- **Preserve aspect ratio and screen-layout behaviour** across both target devices (slow laptop,
  fast tablet). The tablet's existing `visualViewport` / safe-area handling in `index.html` is
  load-bearing — **do not regress it.**
- **Audio:** reuse V1's *exact* sfx assets, and port every V1 trigger point that exists within
  V2's feature set.

### Routing

The serve `index.html` reads the query parameter **`v`** and mounts the matching version:
**`?v=2` loads V2; everything else (including no parameter) loads V1 — V1 is the default.**
`?v=1` is also accepted as the explicit V1 form. **Document the parameter** in the README.

---

## 3. Definition of done (acceptance gate for the whole effort)

1. Both versions load from the same page via the `v` parameter; V1 unchanged (diff is benchmarking
   hooks only).
2. V2 plays a full game **start→win** and **start→lose**, including a **boss wave**, with **no
   instant-loss** and **no pathfinding glitch** (see [§5 regression gates](#5-reliability-regression-gates)).
3. **Every V2 game-logic rule is covered by headless tests** — happy paths *and* error/degradation
   scenarios (e.g. lives reaching 0, enemy floods, sell/upgrade edge cases; waves are always
   sequential, so there is no simultaneous-wave case).
4. **V2's benchmark meets the [performance contract](#4-performance-contract) at every gate,
   asserted in CI / headless — not eyeballed.**
5. Two maps load (randomly chosen at start), both in a human-editable config format.
6. **Visual playthrough confirmed via browser automation** for the parts headless tests can't see
   (layout on both aspect ratios, menus, win/lose overlay).
7. **A V1↔V2 parity & gap report exists** confirming nothing was unintentionally lost
   (see [§9 Execution, Phase 2](#9-execution-plan)).

---

## 4. Performance contract

The whole rebuild is justified by performance, so the gate that proves success is **numeric and
fail-able** — never "looks smooth." **The target is to beat V1 — there is no absolute fps number;
V1's own measured numbers are the bar.**

- **Benchmark fixture — a fixed synthetic scene.** Both V1 and V2 are measured under the *same*
  deterministic, scripted scene so the comparison is apples-to-apples and repeatable run-to-run.
  The canonical fixture is **40 enemies on the path simultaneously, 12 towers all firing, and 30
  collectable coins on screen**, driven by the headless harness. These counts are defined in config
  (see [§6](#6-v2-game-spec-acceptance-criteria)) and are the locked benchmark scene.
- **Measurement environment.** The hard CI gate runs the fixture under a **fixed Chrome CPU
  throttle of 4×** (the repeatable proxy for the slow laptop). The headline number is **p95 frame
  time** (p50/p99 recorded alongside).
- **Phase 0 deliverable — capture V1's baseline first.** Instrument V1, run the fixture under the
  4× throttle, and record V1's **p50/p95/p99 frame time** as the **locked baseline**.
- **V2's gate — beat V1.** At the fixture, **V2's p95 frame time must be *lower than* V1's p95**
  (equal is the floor, not a pass). Re-run after **every** V2 feature lands.
- **Regression alarm.** Also fail when a newly-added feature degrades V2 **past its own previously
  recorded p95 by a high margin** — this catches creeping degradation as features grow, independent
  of the V1 comparison.
- **Effects budget.** The optional effects in [§6](#6-v2-game-spec-acceptance-criteria) are added
  **only when the bench shows headroom** against V1. If they cost too much, they don't ship.

---

## 5. Reliability regression gates

Turn V1's known bugs into proof — each becomes a headless test that fails against a naive port and
passes in V2.

- **Boss-wave instant-loss on repeat plays** *(this is the "recent event that caused the sadness" —
  top priority):* write a headless test that plays **multiple games in a row**, spawns a boss wave,
  and asserts **lives are not deducted for enemies still on the path**. Root-cause why V1 does this
  (likely state leaking across plays) and document it.
- **Pathfinding on open tiles:** reproduce the undocumented V1 scenario, capture it as a headless
  test, and assert V2 enemies traverse **start→path→end** correctly with **no open-tile wandering**.

---

## 6. V2 game spec (acceptance criteria, by module)

**Config & architecture.** All balance and visual settings — coins, costs, damage curves, wave
composition, spawn frequencies, map layouts, palette, and the benchmark-fixture counts — are
**centrally defined and injectable**, changed in close proximity, with no magic numbers scattered
through logic. Build the simulation **headless-first** so every game state and scenario is drivable
without a browser.

**Maps & tiles.** Two maps, randomly chosen at start. **Human-editable format** where a non-coder
can set start / end / path locations; everything else is open (tower-placeable). New **minimal**
visuals for all tile types (start, path, open, end). **No day/night system** that alters tile look.

**Enemies.** Spawn in waves at configured frequencies, with a **countdown period between waves**
(waves are sequential, never concurrent). Per-wave config drives types, counts, and coin drops.
Enemies vary in attributes (speed, hp, etc.). They **spawn on the start tile and traverse the path
to the end tile**; reaching the end **removes them and deducts lives**. Enemies killed **by tower
fire drop coins** as configured for the current wave. **Boss enemies** behave identically but
**cost more lives** when they reach the end and **drop more coins** on death. Minimal enemy visuals;
keep shapes / faces / animation.

**Towers.**
- **Basic** — fast, cheap, single-target; damage scales L1–3.
- **Strong** — slow, medium cost, single-target with **AoE** damage; damage scales L1–3.
- Both **change size + visuals per level**. Towers shoot **projectiles** at enemies in range.

**Tower placement menu.** Player **clicks/taps an open tile** → a **small menu appears, modelled on
V1's existing placement menu (see V1)**, centered on the tap point, plus a **range circle** showing
the prospective tower's reach if purchased. Three buttons:
- **purchase** — displays the tower-to-buy and its cost;
- **rotate** — cycles which tower type the purchase button will buy, updating the button's
  appearance to indicate the selected type;
- **close** — dismisses the menu and the range circle.

**HUD & in-play menu (left-docked, same approach as V1).**
- **Info:** Lives, Current Wave, Total Coins.
- **Portrait:** the selected tower's type (basic / strong) and level (1–3).
- **Actions:** Pause, Sound, **Upgrade** (enabled only with sufficient coins), **Sell** (enabled
  only when a tower is selected).
- **Inner layout:** research V1's, critique it, and **propose an improvement — your call.**

**Start menu (new).** **Two buttons only — Play and Sound toggle.** Decorated with in-game visuals
(e.g. enemies, towers, coins).

**Effects (add only if the bench shows headroom).** projectile (shot / travel / hit), enemy (spawn /
death / end-reached), coin (glow / particles), tower (selected / shooting). Theme throughout: soft
palette, fluffy, minimal.

**Game loop.** Start with enough coins for a few towers → place towers → wait for first wave →
waves spawn and enemies travel the path → towers fire → killed enemies drop coins the **player
actively collects** (manual tap) → buy / upgrade / sell during and between waves when coins suffice
→ select a tower to see its portrait + details → **lose** if enough enemies reach the end that lives
≤ 0 → **win** when the last enemy of the last wave dies with lives remaining → **win/lose overlay
with game stats** and a **Play Again** option.

---

## 7. Audio

Reuse V1's exact sfx assets (under `assets/`). Port **every** V1 sfx trigger point that has an
equivalent in V2's feature set; do not invent new sounds.

---

## 8. Benchmarking discipline

- **The only permitted modification to V1 is adding benchmarking capability.**
- Run a **full performance benchmark on V1** (the fixed fixture, 4× throttle) to diagnose existing
  problems and steer V2's build.
- Implement a **full performance benchmark on V2** and **run it frequently** to detect degradation
  as features grow.
- Wire the benchmark into the per-feature gate ([§4](#4-performance-contract)) so a regression is a
  failing build, not a manual observation.

---

## 9. Execution plan

Fan out where independent; serialize only the shared foundation.

- **Phase 0 — Locate & baseline (serial).** Stand up V1, add benchmarking, build the fixed synthetic
  benchmark fixture, and **capture the locked V1 baseline numbers** under the 4× throttle.
- **Phase 1 — Research fan-out (parallel).** Independent investigations that don't block each other:
  - (a) V1 architecture, game-loop mechanisms, and **game polish**;
  - (b) performance profiling — where V1's frame time actually goes (effects, draw calls,
    allocations, entity counts);
  - (c) root-cause of **both** known bugs;
  - (d) reusable-asset & code inventory (sfx, sprites, shapes/faces/animations, config) **with file
    paths** under `src/{managers,systems,data}` and `assets/`.

  Merge into one findings doc that steers V2.
- **Phase 2 — Plan V2 (serial).** Architecture, the injectable config schema, and **two distinct
  deliverables:**
  1. a **V1↔V2 parity & gap analysis** — enumerate every V1 feature and mark each as
     *ported / intentionally-changed / intentionally-dropped*, and flag any **unintended** gaps; and
  2. an explicit list of **where V2 deliberately diverges from V1 and why** (research alternative
     approaches before copying).

  Also define the headless simulation harness and the per-module test + benchmark gate.
- **Phase 3 — Engine core (serial — shared foundation).** Tick loop, entity/state model, headless
  driver, config injection, router wiring, benchmark harness. **Gate:** headless sim runs a trivial
  scripted wave end-to-end and the benchmark prints numbers.
- **Phase 4 — Module build (parallel fan-out).** Once the core is stable, build the independent
  modules concurrently (subagents / worktrees): maps+tiles, enemies+waves, towers+projectiles,
  tower-placement menu, HUD/in-play menu, start menu, audio port, effects. **Each module is gated by
  its own headless tests *and* a benchmark run** — no module merges if it regresses past V1. The real
  constraint is my review bandwidth and cost, so **surface what's ready to review as it lands**
  rather than dumping everything at the end.
- **Phase 5 — Integration & visual verification (serial).** Full playthroughs (win + lose + boss),
  browser-automation visual checks on both aspect ratios, win/lose overlay, the regression gates,
  and a **final benchmark vs. the V1 baseline**. Report the V1-vs-V2 numbers.

---

## 10. Verification

- **Cover all V2 game logic with headless tests** spanning happy paths *and* error/degradation
  scenarios.
- **Use browser automation** for visual verification and playthroughs of areas not testable via
  mechanical checks.
- **After each feature lands in V2, run the performance benchmark**, confirm it beats V1 (and hasn't
  regressed past V2's own prior p95 by a high margin); **if worse than V1, fail and iterate** until
  the regression is rectified.

---

## 11. Reporting

At each phase boundary: tell me what landed, **show the benchmark numbers vs. V1**, and **flag any
spec item dropped or deferred for performance — never silently cut scope.**
