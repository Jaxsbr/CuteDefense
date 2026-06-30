# Depth Pass — Milestones

Index of the five depth-pass specs, their value, cost, and the build order the
dependency graph forces. See `DEPENDENCY-GRAPH.md` for the batch reasoning and
the shared-hot-file analysis that makes this pass overwhelmingly sequential.

Hard constraints every spec must respect (unchanged from the brief): static
GitHub Pages (plain ES modules, no backend/build step); pure seeded headless sim
(`v2/sim/`, fixed 60fps, deterministic RNG); all constants in
`v2/config/gameConfig.js` (no magic numbers); V2 p95 frame time must stay below
V1; charming + legible for a 5–10 year old.

## Spec index

| ID | Title | One-line value | Cost | Status |
|----|-------|----------------|------|--------|
| **P1** | Plan, then watch | Pays down click/coin debt: freeze-the-board plan-mode + tap-once tray + "I'm ready!" valve + locked auto-collect. Removes a reaction test (no depth, no power) so later puzzles can be harder without raising the click bar. | M | todo |
| **P2** | Every wave is a puzzle | Makes "which tower / where?" the core decision: soft 2-way tower affinity (2x/0.5x, never immunity), ≤3 readable non-numeric enemy flags, per-wave spawn-direction variety, Tactical Recon banner, boss livesCost retune. | L | todo |
| **P3** | I have a job in the fight | Two kid-safe agency levers on one shared slow field: recoverable tower "nap" (telegraphed disabler, anti-stun-lock governor) + one active Freeze button (no aim, cooldown). The primary skill key to the wave-16 split boss. | L | todo |
| **P4** | Did upgrading help? | Economy legibility (before→after delta + rising Power scalar, no "+25%") + reversible L3 identity fork (Sniper/Gunner, Bomber/Froster — Froster reuses P3's slow) + cheap re-fork coin sink + L1→L3 curve rebalance. | L | todo |
| **P5** | You won! | Flips the win gate from patternCount(16) to publicWaveCount(15) so the game is finally winnable; quality-weighted 1–3 stars (anti-turtle); L3 sprite-fit clamp (#8); opt-in "summit" continue-flow into the unbeatable secret boss. | M | todo |

## Build order

```
P1  →  P2  →  P3  →  P4  →  P5  →  GLUE
```

This is a **strict linear chain**. It is forced two ways at once:

1. **Hard dependency edges** (cannot be reordered):
   - P3 → **P1** (Freeze is a HUD button; `castFreeze()` must be illegal in
     P1's `planning`/`paused` sub-states — P1 owns the input surface +
     command-legality scoping).
   - P4 → **P3** (HARD: Froster reuses P3's *single* shared slow field —
     `effectiveSpeed`/`applySlow`/`slowUntil`/`slowFactor`. Building slow twice
     is explicitly forbidden).
   - P4 → **P2** (HARD-ish: both thread a damage *source* onto the projectile at
     `fire()`→`impact()`; P4's Sniper crit + Froster slow ride the same
     projectile-source field P2 adds for affinity).
   - P3 → **P2** (soft for P3's own behavior, hard for *combined winnability*:
     the split-boss pin→burst only matters once P2's AoE affinity 2x's the
     clustered shards).
   - P5 Half B → **P2 + P3 + P4** (the summit / split-boss winnability
     validation needs affinity + Freeze + the powered fork to exist before it
     can be tuned between "still a wall" and "buy-the-win").

2. **Shared hot files** (force sequencing even where dep edges are only soft):
   `gameConfig.js` and `Renderer.js` are touched by **all five** specs;
   `Simulation.js` by four; `events.js`, `enemySystem.js`, `state.js`,
   `SpriteCache.js`, `harness.mjs`, `policies.mjs` by three or more. Running any
   two specs in parallel would collide in the core.

**Honest call: there is no genuinely parallel-safe pair in this pass.** Even the
nominally-standalone slice (P5 Half A: public-win + stars + sprite-fit) still
edits `Simulation._checkWinLose`, `state.js`, `Renderer._overlay`, and
`gameConfig.js`, which every other spec also touches. Pretending P5 Half A could
run alongside P1 would manufacture merge conflicts in the four hottest files for
no schedule win. Build one spec at a time, land it green, move on.

## Per-spec definition-of-done (summary)

Every spec must, before it is considered landed:

- `npm test` fully green — its own new suites **plus** every existing suite
  (sim, economy, balance-ladder, secret-wave, playthrough, replay-reset, maps,
  cute-soul) unweakened.
- `npm run bench` — V2 p95 < V1 p95 on the locked fixture (each spec extends the
  fixture with its own power-bearing levers; P1 and P5 add none).
- Balance parity — the 4-tier bot ladder keeps its monotone separation; the
  freeze/fork-aware optimal bot drives every new lever through the public command
  API only.
- `measure-secret-boss.mjs` re-run where the spec touches winnability (P2, P3,
  P4, P5) — the split-boss margin re-recorded on the *real* game (the stale 7.2x
  figure gets replaced as levers land).
- Before/after captures under `v2/captures/`.

## GLUE (final winnability rebalance)

After P5, one integration step ties the whole pass together; it is **not** a
spec but a required closeout. See `DEPENDENCY-GRAPH.md` § GLUE for the full
checklist (freeze/fork-aware bot end-to-end, `measure-secret-boss.mjs` via the
summit path, full bench vs V1, full capture regen, local launch sanity).
