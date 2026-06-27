# V2 Plan — architecture, config schema, harness & gates

> Phase 2 deliverable. How V2 is built so it is *provably* free of V1's failure
> modes and *measurably* faster, while staying statically servable with no build.

## Architecture: headless-first, three thin layers over a pure sim

```
index.html ?v=2  ──▶  v2/main.js (ES module entry)
                         │
                         ├── config/gameConfig.js   ← ALL balance/visual/bench constants (injectable)
                         ├── config/maps/*.js        ← 2 human-editable ASCII maps
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
        sim/  (PURE)            app/GameApp.js  (browser glue)
        no DOM, no canvas,        - RAF loop, fixed-timestep accumulator
        no Date.now, seeded RNG   - viewport fit (visualViewport, reused from V1 model)
          - Simulation.js          - owns sim + renderer + input + audio
          - state factory          ▼
          - systems/*         render/Renderer.js  (reads sim state, draws)
            wave, enemy,        - offscreen SPRITE CACHE per look (bake once, drawImage)
            tower, projectile,  - flat fills, ZERO per-frame shadowBlur/gradients
            economy, lives      - HUD / PlacementMenu / StartMenu / Overlay (one hit-rect registry)
                              input/InputController.js  (pointer → sim commands)
                              audio/AudioBridge.js      (sim events → V1 .ogg SFX)
```

### Why this kills V1's bugs by construction
- **Pure sim, fresh per game.** `createInitialState(config, seed)` returns a deep, newly-allocated state every New Game/Restart. No long-lived mutable singletons → the boss-counter leak (Bug #1) is structurally impossible.
- **One lives ledger.** Lives lost = Σ `enemy.livesCost` for enemies whose `reachedGoal` transitioned `false→true` (applied exactly once, at the moment of transition, from a value fixed at spawn). No parallel counters, no cache-and-diff.
- **Uniform `Enemy`** with `isBoss`/`behavior` — bosses are data, not a subclass that shares a parent counter.
- **Exact segment-lerp movement.** Position = `lerp(path[i], path[i+1], t)`. No smoothing → no corner-cutting onto open tiles (Bug #2).
- **Pausable game clock.** `state.clock` accumulates only while running; all wave/spawn/ability timers read it. Pause/background can't skew timing.

### Determinism
Fixed timestep (sim steps in fixed `dtMs = 1000/60` slices from an accumulator) + a **seeded RNG** (mulberry32) threaded through the sim. Same seed + same script ⇒ identical run. This makes headless tests and the benchmark reproducible, and lets `fireRate` jitter exist without breaking tests.

### Rendering performance plan (beat V1's p95 82.9ms)
1. **Sprite cache**: bake each tower (type×level), enemy (type, with mean face), coin (state), projectile/bomb into small offscreen canvases **once**; every frame is `drawImage` + transform. Re-bake only on look change (keyed cache, like V1's tile cache).
2. **Ban per-frame `shadowBlur` and gradient allocation** entirely (V1's #1 and #2 costs). Glow is baked into the sprite or faked with a flat alpha halo.
3. **Static layer**: tiles + HUD chrome drawn to an offscreen canvas, re-rendered only on real change; dynamic entities/particles on the main canvas.
4. **No day/night**, **no hot-path logging**, **no per-entity color interpolation**.
5. Pooled particles/projectiles; flat circles/quads with `globalAlpha`, no shadow.

## Injectable config schema (`config/gameConfig.js`)

A single frozen object, deep-cloned into state at game start so nothing mutates the source. Shape:

```
layout    { canvasW, canvasH, cols, rows, tile, hudWidth, gridOffsetX, gridOffsetY }
economy   { startingCoins, sellRefundFraction, coin:{ lifetimeMs, warningMs, value, collectRadius } }
lives     { max }                       // single source for the lives pool
waves     { prepMs, betweenWaveMs, spawnIntervalMs, countdownThudFromSec,
            scaling:{ hp, speed, count, reward, intervalReduction, bossMult, capWave },
            patterns:[ { enemies:[{type,count,formation}], boss? } ... ] }
enemies   { <id>: { shape, color, face, speed, hp, size, reward, livesCost, isBoss, behavior? } }
towers    { <id>: { name, shape, color, cost, levels:[ {damage,range,fireRateMs,...}, ... ],
            projectile:{ speed, size }, aoe?:{ radius, ... } } }
combat    { critChance, critMult, projectileTtlMs, targetWeights:{dist,health,type} }
visual    { palette, particles..., effectsEnabled }   // effects gated by bench headroom
bench     { fixture:{ enemies, towers, coins }, frames, warmup, throttle }
maps      [ map1, map2 ]
```

All V1 numbers (§4/§1 of findings) are reproduced here unless PARITY doc marks a deliberate change. No magic numbers in logic.

## Headless simulation harness & per-module gate

- **Sim is importable in Node** (pure ESM). Tests use built-in `node:test` (no deps): construct a `Simulation(config, seed)`, drive `sim.step(dt)` / scripted commands, assert state. No DOM.
- **A scripted driver** (`tools/harness/simDriver.mjs`) runs a wave end-to-end headlessly and exposes helpers (advance N ms, force a wave, place/upgrade/sell tower, collect coin).
- **Benchmark** (already built): `?v=2&bench=1` installs `window.__bench.run()` using the SAME protocol as V1's harness (steady fixture from `config.bench.fixture`, per-frame `update+render`, 1×1 `getImageData` flush), measured under 4× throttle by `tools/bench/run-bench.mjs`.
- **Per-module gate** (spec §4/§10): after each module lands, run `node --test` (logic) **and** `npm run bench` (perf). A module does not merge if a test fails or V2 p95 ≥ V1 p95 (or regresses past V2's own prior p95 by >15%).

## Build order (Phase 3 → 4 → 5)
1. **Engine core** (serial): config, RNG, clock, state factory, `Simulation.step`, event bus, headless driver, V2 bench harness, `main.js`/`GameApp` shell, router (done). Gate: a trivial scripted wave runs to completion headless; bench prints V2 numbers.
2. **Modules** (each: build → headless tests → bench): maps+tiles → enemies+waves → towers+projectiles → placement menu → HUD/in-play → start menu → audio → effects(if headroom).
3. **Integration & visual**: full win/lose/boss playthroughs, Playwright/CDP visual checks on both aspect ratios, the two regression gates, final bench vs V1.
