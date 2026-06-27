/**
 * CuteDefense V1 — Benchmark Harness (the ONLY V1 addition for the V2 rebuild).
 *
 * This file adds benchmarking capability to V1 without modifying any existing V1
 * file. It is loaded only when the page is opened with ?bench=1 (see index.html
 * router) and is never part of normal play.
 *
 * It builds the locked synthetic fixture — 40 enemies spread along the path, 12
 * towers firing, 30 coins on screen — holds it in a steady state, and times the
 * exact per-frame work (entity update + full render) so V1 and V2 can be compared
 * apples-to-apples under the same Chrome 4x CPU throttle.
 *
 * Driven from Node via CDP: window.__bench.run(frames) returns the frame times.
 */
(function () {
    // Locked fixture counts — mirrored by the V2 config benchmark fixture.
    const FIXTURE = { enemies: 40, towers: 12, coins: 30 };
    const FROZEN_HEALTH = 1e9; // towers can't kill -> count stays at 40 during the window

    function waitForGame() {
        return new Promise((resolve) => {
            const tick = () => {
                if (typeof gameState !== 'undefined' && gameState.grid && gameState.renderer &&
                    gameState.enemySystem && gameState.towerManager && gameState.resourceSystem &&
                    gameState.grid.getEnemyPath && gameState.grid.getEnemyPath().length > 1) {
                    resolve();
                } else {
                    setTimeout(tick, 30);
                }
            };
            tick();
        });
    }

    function buildFixture() {
        // Stop the live rAF loop so the bench fully controls stepping.
        gameState.isRunning = false;
        gameState.showStartMenu = false;
        if (gameState.gameStateManager) gameState.gameStateManager.gameState = 'playing';

        const grid = gameState.grid;
        const path = grid.getEnemyPath();
        const types = [window.ENEMY_TYPES.BASIC, window.ENEMY_TYPES.FAST, window.ENEMY_TYPES.STRONG];

        // --- 40 enemies spread evenly along the path, frozen in place ---
        gameState.enemySystem.enemies = [];
        for (let i = 0; i < FIXTURE.enemies; i++) {
            // Spread across interior path points (avoid the very last point = goal).
            const t = (i + 1) / (FIXTURE.enemies + 1);
            const idx = Math.max(0, Math.min(path.length - 2, Math.floor(t * (path.length - 1))));
            const p = path[idx];
            const type = types[i % types.length];
            const e = gameState.enemySystem.createEnemy(type, p.x, p.y, path);
            e.pathIndex = idx;
            e.progress = 0;
            e.x = p.x;
            e.y = p.y;
            e.targetX = p.x;
            e.targetY = p.y;
            e.speed = 0;                 // frozen: stable count, none reach goal
            e.health = FROZEN_HEALTH;
            e.maxHealth = FROZEN_HEALTH;
            e.spawnAnimation.active = false;
        }

        // --- 12 towers on buildable tiles near the path, varied types/levels ---
        gameState.towerManager.clearAllTowers();
        const buildable = [];
        for (let y = 0; y < grid.rows; y++) {
            for (let x = 0; x < grid.cols; x++) {
                if (grid.canPlaceTower(x, y)) buildable.push({ x, y });
            }
        }
        // Prefer tiles adjacent to the path so towers actually have targets in range.
        const onPath = (x, y) => path.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) <= 2);
        buildable.sort((a, b) => (onPath(b.x, b.y) ? 1 : 0) - (onPath(a.x, a.y) ? 1 : 0));
        gameState.resourceSystem.addCoins(100000); // fund upgrades for render variety
        let placed = 0;
        for (const cell of buildable) {
            if (placed >= FIXTURE.towers) break;
            const type = placed % 2 === 0 ? 'BASIC' : 'STRONG';
            const tower = gameState.towerSystem.addTower(cell.x, cell.y, type);
            if (tower) {
                // Vary levels for render variety (rings, glow, rank badge, sparkles).
                const extra = placed % 3; // 0,1,2 extra upgrades -> levels 1,2,3
                for (let u = 0; u < extra; u++) {
                    try { gameState.towerManager.tryUpgradeTower(cell.x, cell.y); } catch (_) { /* ignore */ }
                }
                placed++;
            }
        }

        // --- 30 coins spread across the board, mixed states ---
        gameState.resourceSystem.coins = [];
        const offX = 400, tile = gameState.grid.tileSize; // V1 world->screen: gridX*tile + 400
        for (let i = 0; i < FIXTURE.coins; i++) {
            const gx = i % grid.cols;
            const gy = Math.floor(i / grid.cols) % grid.rows;
            const sx = gx * tile + offX + tile / 2;
            const sy = gy * tile + tile / 2;
            gameState.resourceSystem.spawnCoin(sx, sy, (i % 5) + 1);
        }
    }

    // One measured frame: the representative entity-sim + full render work.
    // A 1x1 getImageData read after render forces the canvas to rasterize the
    // queued draw commands every frame (headless Chrome defers rasterization
    // without a compositor, which would otherwise hide the true per-frame cost).
    function stepFrame(dt) {
        gameState.enemySystem.update(dt);
        const enemies = gameState.enemySystem.getEnemiesForRendering();
        gameState.towerManager.update(dt, enemies, gameState.enemySystem,
            gameState.enemyManager ? gameState.enemyManager.bossEnemySystem : null);
        gameState.resourceSystem.update(dt);
        render(); // global V1 render()
        gameState.renderer.ctx.getImageData(0, 0, 1, 1); // force rasterization flush
    }

    function percentile(sorted, p) {
        if (!sorted.length) return 0;
        const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
        return sorted[idx];
    }

    async function run(frames = 300, warmup = 60) {
        await waitForGame();
        buildFixture();
        const dt = 1000 / 60;

        // Warm up (JIT, first-frame anomalies) — not measured.
        for (let i = 0; i < warmup; i++) stepFrame(dt);

        const times = [];
        for (let i = 0; i < frames; i++) {
            const t0 = performance.now();
            stepFrame(dt);
            times.push(performance.now() - t0);
        }
        const sorted = times.slice().sort((a, b) => a - b);
        const sum = times.reduce((a, b) => a + b, 0);
        return {
            version: 'v1',
            fixture: FIXTURE,
            frames,
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            p99: percentile(sorted, 99),
            mean: sum / times.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            counts: {
                enemies: gameState.enemySystem.getEnemiesForRendering().length,
                towers: gameState.towerManager.getTowersForRendering().length,
                coins: gameState.resourceSystem.getCoinsForRendering().length,
            },
        };
    }

    window.__bench = { run, buildFixture, FIXTURE };
    if (gameState && gameState.logger) gameState.logger.info('🏁 BenchHarness ready (window.__bench)');
})();
