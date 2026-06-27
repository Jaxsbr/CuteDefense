# V1 Findings — merged research that steers V2

> Phase 1 deliverable. Synthesis of a 7-way parallel code investigation of V1
> (architecture, perf, both bug root-causes, towers/economy, HUD/menus, assets).
> Every claim is grounded in `src/` with file:line. This is the reference V2 is
> built against.

## 0. Locked facts (layout & delivery)

- **Backing store fixed at 2514×1154**, **22 cols × 12 rows**, **96px tiles**, **400px HUD docked LEFT**. World→screen: `screenX = gridX*96 + 400`, `screenY = gridY*96 + 0`. Only the CSS *display* size scales, via `visualViewport` (`ResponsiveScalingSystem.getDisplaySize`). V2 keeps this model exactly.
- V1 ships as global `<script>` tags (no modules). `game.js` `CONFIG` literal (30 cols/64px) is a dead placeholder, overwritten at runtime by `ResponsiveScalingSystem` (22/96). The live offset `400/0` is hardcoded in **two** places (`GridSystem.js:146`, `RenderSystem.js:613`) — a latent desync bug. V2 has **one** transform.
- Delivery: static, GitHub Pages, no build step. V2 = native ES modules, same constraint.

## 1. Game loop, waves, win/lose

- Loop: `update()` → `render()` → rAF. **No fixed timestep**; `lastFrameTime=0` makes frame-1 dt garbage. Most logic ignores dt and uses **wall-clock `Date.now()`** for wave/spawn/ability timing — **not pause-aware** (a long pause skips the countdown on resume). → V2 drives ALL timing off an **accumulated, pausable game clock**.
- Wave machine (EnemyManager): `preparation`(8s, `countdown_thud` last 5s) → `spawning`(2s base interval, scaled) → `active` → `complete`("Wave N Complete!", 3s gap) → next. Waves always sequential.
- Difficulty scaling per wave (`enemyTypes.js:176`): HP ×1.12, SPEED ×1.03, COUNT ×1.15, REWARD ×1.08 (all `^(wave-1)`, capped at wave 15); **boss waves every 5th** ×1.5. Coin reward additionally ×`0.95^(wave-1)`.
- 15 hand-authored wave patterns; bosses at waves 5/10/15. `maxWaves=15` is duplicated across 3 independent constants — keep them single-sourced in V2.
- **Win**: `currentWave >= maxWaves && waveState==='complete'` (lose-check runs first each frame, so reaching final complete alive = win). **Lose**: `enemiesReachedGoal >= maxEnemiesAllowed` (lives pool: easy 25 / hard 15).
- **DROP the day/night system** (spec forbids tile-altering day/night): `updateDayNightPhase`, `renderDayNightTileLighting`, `renderPhaseChangeEffect`. It tints/dims the tile area during combat. Keep the tile/path/start/end *rendering* (it was entangled with "night visibility"), drop the dimming/tint/flash.
- Keep polish: dramatic centered wave announcements, "Wave N Complete!", start-menu black fade that **gates wave-system start**, countdown thud, game-over/victory overlay + restart.

## 2. BUG #1 — boss-wave instant-loss on repeat plays (TOP PRIORITY)

**Root cause (confidence: high):** `BossEnemySystem` keeps two goal counters that must stay in lockstep — inherited `enemiesReachedGoalCount` (`EnemySystem.js:8`) and own `bossEnemiesReachedGoalCount` (`BossEnemySystem.js:8`). `updateBossEnemies` credits boss-goals from the **delta** between them (`BossEnemySystem.js:48-62`), and the early-return guard means the delta is evaluated the instant a boss **spawns**. `BossEnemySystem.reset()` (`:341`) zeroes only its own counter and **never calls `super.reset()`**, so the inherited counter is **never cleared between plays** (the instance is created once at `EnemyManager.js:9` and mutated forever). On the next play's boss wave, `delta = staleN - 0 > 0` → phantom boss-goals → `EnemyManager.getEnemiesReachedGoal()` multiplies by 3/4/5 (wave 5/10/15) → `GameStateManager` deducts lives instantly for a boss still at the path start. It **compounds** every restart.

**V2 prevention (baked into the architecture):**
1. **Fresh state per game** from a pure `createInitialState(config, seed)` — no object reused across plays, nothing can leak.
2. **One source of truth** for lives lost: derive from entities (`enemy.reachedGoal`), apply `enemy.livesCost` **once** on the `false→true` transition. No cache-and-diff counters.
3. **No subclass counter sharing**: a uniform `Enemy` with an `isBoss` flag, not an inheritance hierarchy.
4. **Lives cost fixed at spawn** on the entity, never recomputed from `currentWave` at read time.

**Regression test:** play N games in a row; on each later boss wave, spawn a boss still on the path and assert lives are unchanged and game stays `playing`. Fails on a naive port, passes in V2.

## 3. BUG #2 — pathfinding onto open tiles

**Root cause (confidence: high):** `EnemySystem.updateEnemyMovement` (`EnemySystem.js:133-136`) low-pass **smooths** the collision position toward the correct path target: `enemy.x += (targetX - enemy.x) * smoothingFactor`. The rendered/collided `enemy.x/y` **lags** the true path point, so at corners it cuts diagonally across the adjacent **open/buildable** tile.

**V2 prevention:** position is **exact per-segment linear interpolation** between consecutive waypoints — `pos = lerp(path[i], path[i+1], progress)`. No low-pass on the collision position. On a contiguous orthogonal path the segment only covers its two endpoint tiles, so `floor(x),floor(y)` is always a path tile.

**Regression test:** step an enemy start→end and assert `floor(x),floor(y)` ∈ path-set every frame; no open-tile visits at corners.

## 4. Towers, projectiles, economy

- **BASIC**: cost 5, dmg 8, range 5, fireRate 1800ms, projSpeed 800. **STRONG**: cost 15, dmg 20, range 2, fireRate 3000ms; **AoE bomb** (bombDamage 40, bombRadius 2.0 tiles, bombSpeed 400).
- **Upgrades ADD dmg/range, SET fireRate/bombDamage** (`TowerSystem.js:74`). Actual end stats: BASIC L1 8/5 → L2 20/11 → L3 38/18; STRONG L1 20/2 → L2 55/5 → L3 110/9 (bombDamage 40→80→120). The towerTypes.js comments describe *intent*, not behavior. Upgrade costs: BASIC L2 50 / L3 100; STRONG L2 60 / L3 120. Max level 3.
- Targeting score = `dist*0.3 + lowHealth*0.4 + type*0.3` (fast 0.8/strong 0.6/basic 0.4). Projectiles home to target center; bombs predictive-lead; speed fixed (no per-level speed). **1% crit ×2** on single-target hits (not bombs).
- **Coins**: drop on death at enemy screen pos, value = scaled `enemy.reward`; lifetime 15s, warning at 5s, **manual click to collect** (60px axis-box), else expire → `coin_expire`. Starting coins easy 40 / hard 30.
- **SELL is NOT implemented** in V1 (TODO stub; a render-only button that depends on `upgradeInfo`, so max-level towers can't even show it). **V2 must build Sell for real** (spec requires it): track invested cost, refund a defined fraction, work at every level, remove tower + refund.
- Carry over: projectile pooling, in-place array compaction (deliberate mobile-GC wins). `fireRate` jitter is random → needs seedable RNG for deterministic tests.

## 5. HUD, menus, input

- Left HUD 400px full-height, 3 fixed sections: top 1/5 = Lives/Coins/Wave info; center = selection (portrait + stats + Upgrade/Sell); bottom 1/5 = 2×2 controls (Pause/Restart/Menu/Sound).
- **#1 maintainability smell**: interactive geometry computed **twice** — once to draw, once (by hand, with a magic `selectionY + 200` guess) to hit-test (`game.js:576`). Start-menu and pause geometry are also duplicated. → V2: **single source of truth for hit-rects** (each draw registers `{id, rect}`; clicks route through the list).
- Placement popup: tile-centered, 3 buttons (place-selected / cycle-type / cancel) + live range circle. Cycle toggles BASIC↔STRONG.
- Start menu V1 = difficulty(Easy/Hard) + Sound + Play. **V2 spec = Play + Sound only** → drop difficulty selector (default to easy/long-paths) and its keybindings.
- Win/lose overlay: dim + title + message + single restart. V2 should **enrich with run stats** (waves cleared, towers built, coins earned, enemies killed, time).
- Input fires on **press** (mousedown/touchstart, unified). Audio unlock wired to first interaction. V2 may move to pointer events; keep audio-unlock-on-first-gesture.

## 6. Visual primitives — the charm to KEEP (rendered minimally)

100% procedural Canvas2D; **no image sprites** in V1.
- **Enemy shape = type**: circle=BASIC, diamond=FAST/BOSS_SPEED, square=STRONG, hexagon=BOSS_SHIELD, octagon=BOSS_REGEN, star=BOSS_SPLIT. **Mean face** (angry eyes, angled eyebrows, frown); hit reaction = squint + open mouth. No idle bob in V1.
- **Tower smiley face** all levels (white eyes+pupils+highlight, big smile, pink cheeks). Size grows L1 0.375 / L2 0.45 / L3 0.6 of tile. Level legibility = concentric rings + gold(L2)/red(L3) glow + rank badge + L3 sparkles. Idle pulse + firing pop.
- **Coin**: gold body r24, orange gradient border, highlight, glow; bounce/sway/rotate; value text; states normal / warning(orange pulse) / expired(grey+red); orbiting sparkles.
- **Projectile**: glowing ball size 12 + fading trail. **Bomb**: orange oval size 18 + fuse + gold spark.
- **Risk**: charm = the two face routines + the shape language + the animations. Lose any and kids stop recognising the game.

## 7. Performance — where V1's frame time goes (the reason for the rebuild)

Measured V1 baseline (locked, fixture 40/12/30, **4× CPU throttle**): **p50 73.1ms · p95 82.9ms · p99 91.4ms** (~12fps). V2 must beat p95 82.9ms.

Biggest costs (perf agent, `RenderSystem.js`):
1. **`ctx.shadowBlur`/`shadowColor` per entity** — every enemy (glow inherited through body + 3 borders + whole face ≈ 9 blurred draws), every coin (+4 sparkles), projectiles, night path tiles. ≈ **700–900 gaussian-blur rasterizations/frame** at the fixture. **#1 cost.** → V2: **ban per-frame shadowBlur**; bake glow into sprites or fake with a flat halo.
2. **Per-frame gradient allocation** (`createRadial/LinearGradient`): per tower body, per upgraded tower, 30 coins, start/end tiles, projectile trails, HUD bg ≈ 50–60 throwaway gradients/frame. → V2: **zero per-frame gradients**; bake into sprites.
3. **`getCurrentColors()`** called per-entity, 5 `interpolateColor` (6 parseInt + 3 string allocs) each ≈ 260 strings/frame, identical for all. → V2: no day/night, compute palette once.
4. **`console.log` in the render hot path** (`:899`, `:4516`). → V2: strip all logging from hot paths.
5. Good pattern to keep & extend: the **offscreen tile-layer cache** (`renderGrid:2389`). V2 bakes **every entity look** (tower×level, enemy×type, coin, projectile) into small offscreen sprites once and `drawImage`s them; animates via transform/alpha. Layer static (tiles + HUD chrome) vs dynamic.

## 8. Audio — 15 wired SFX (reuse exact assets)

`assets/audio/sounds/*.ogg`, base path `assets/audio/`, default vol 0.7, `enemy_death` boosted to 0.9.

| sound | trigger (V1 ref) |
|---|---|
| `tower_place` | tower placed (game.js:647) |
| `tower_upgrade` / `_level2` / `_level3` | upgrade to L? / L2 / L3 (game.js:600-604) |
| `coin_collect` | coin collected (game.js:851) |
| `coin_expire` | coin expires uncollected (ResourceSystem.js:254) |
| `projectile_fire` | tower fires (TowerSystem.js:262) |
| `enemy_hit` | projectile/bomb hit (TowerSystem.js:502,564) |
| `enemy_death` | enemy/boss dies (EnemySystem.js:196, BossEnemySystem.js:370) |
| `enemy_spawn` | enemy spawned (EnemyManager.js:480) |
| `enemy_reach_end` | enemy reaches goal (EnemySystem.js:99) |
| `wave_start` | wave begins (EnemyManager.js:117) |
| `wave_complete` | wave cleared (EnemyManager.js:162) |
| `countdown_thud` | prep countdown tick (EnemyManager.js:109) |
| `button_click` | UI button + audio-unlock (game.js:665) |

Landmines: background music is **disabled** in V1 (`startPreparationMusic` no-ops) and `toggleMute` points at a non-existent `.wav`. `tower_upgrade_level3_alt/_alt2.ogg` are **unused**. V2 ports the 15 working SFX triggers; music stays off (explicit decision) unless re-enabled deliberately.
