/**
 * CuteDefense - Main Game Loop
 * Simple tower defense game for kids
 */

// Game configuration
const CONFIG = {
    CANVAS_WIDTH: 1024,
    CANVAS_HEIGHT: 900,  // Increased to accommodate HUD below tilemap
    GRID_SIZE: 64,  // Back to 64 for proper collision and HUD
    GRID_COLS: 16,  // Back to 16 columns
    GRID_ROWS: 12,  // Back to 12 rows
    TILE_SIZE: 64   // Back to 64px tiles
};

// Game state
let gameState = {
    isRunning: false,
    debug: {
        enabled: false,
        showGrid: false,
        showPath: false,
        showCollision: false
    },
    grid: null,
    input: null,
    renderer: null,
    enemySystem: null,
    enemyManager: null,
    towerSystem: null,
    towerManager: null,
    resourceSystem: null,
    gameStateManager: null, // Track game state (win/lose/restart)
    selectedTower: null, // Track selected tower for HUD
    towerPlacementPopup: null, // Track tower placement popup state
    audioManager: null, // Audio system for sound effects and music
    logger: null, // System logger for centralized logging
    lastDebugSecond: 0 // Debug timing for wave state logging
};

// Initialize game
function initGame() {
    // Initialize logger first (debug mode OFF by default)
    gameState.logger = new LoggerSystem();
    gameState.logger.info('Initializing CuteDefense...');

    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Initialize core systems
    gameState.logger.info('Initializing core systems...');
    gameState.grid = new GridSystem(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TILE_SIZE);
    gameState.logger.info('Grid system initialized');
    gameState.input = new InputSystem(canvas);
    gameState.logger.info('Input system initialized');
    gameState.renderer = new RenderSystem(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    gameState.logger.info('Render system initialized');
    gameState.enemySystem = new EnemySystem();
    gameState.logger.info('Enemy system initialized');
    gameState.enemyManager = new EnemyManager(gameState.enemySystem, gameState.grid);
    gameState.logger.info('Enemy manager initialized');
    gameState.towerSystem = new TowerSystem();
    gameState.logger.info('Tower system initialized');
    gameState.resourceSystem = new ResourceSystem();
    gameState.logger.info('Resource system initialized');
    gameState.towerManager = new TowerManager(gameState.towerSystem, gameState.grid, gameState.resourceSystem);
    gameState.logger.info('Tower manager initialized');
    gameState.gameStateManager = new GameStateManager();
    gameState.logger.info('Game state manager initialized');

    // Debug: Check if GameStateManager was created properly
    if (!gameState.gameStateManager) {
        gameState.logger.error('GameStateManager failed to initialize!');
    } else {
        gameState.logger.info('GameStateManager created successfully');
    }
    gameState.audioManager = new SimpleAudioManager();
    gameState.logger.info('Audio manager initialized');

    // Set resource system reference in render system
    gameState.renderer.setResourceSystem(gameState.resourceSystem);

    // Set audio manager references in systems
    gameState.towerSystem.setAudioManager(gameState.audioManager);
    gameState.enemySystem.setAudioManager(gameState.audioManager);
    gameState.enemyManager.setAudioManager(gameState.audioManager);
    gameState.resourceSystem.setAudioManager(gameState.audioManager);

    // Set logger references in systems
    gameState.audioManager.setLogger(gameState.logger);
    gameState.towerSystem.setLogger(gameState.logger);
    gameState.resourceSystem.setLogger(gameState.logger);
    gameState.towerManager.setLogger(gameState.logger);
    gameState.grid.setLogger(gameState.logger);
    gameState.renderer.setLogger(gameState.logger);

    // Safety check for GameStateManager
    if (gameState.gameStateManager && typeof gameState.gameStateManager.setLogger === 'function') {
        gameState.gameStateManager.setLogger(gameState.logger);
        gameState.logger.info('GameStateManager logger set successfully');
    } else {
        gameState.logger.error('GameStateManager or setLogger method not available!');
    }

    // Set up input handlers
    setupInputHandlers();

    // Start wave system
    gameState.enemyManager.startWaveSystem();

    // Start background music
    gameState.audioManager.startPreparationMusic();

    // Show audio hint if needed
    showAudioHintIfNeeded();

    // Start game loop
    gameState.isRunning = true;
    gameLoop();

    gameState.logger.info('Game initialized successfully!');
    gameState.logger.info('Game state:', gameState);
    gameState.logger.info('TowerManager:', gameState.towerManager);
    gameState.logger.info('ResourceSystem:', gameState.resourceSystem);
}

// Main game loop
function gameLoop() {
    if (!gameState.isRunning) return;

    // Update systems
    update();

    // Render frame
    render();

    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Track last frame time for delta time calculation
let lastFrameTime = 0;

// Update game state
function update() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Handle input events first (before updating input system)
    handleInput();

    // Update input system
    gameState.input.update();

    // Check if game is in terminal state - stop all game systems
    if (gameState.gameStateManager.isTerminalState()) {
        // Only update game state manager to maintain state
        gameState.gameStateManager.update(gameState.enemyManager, gameState.resourceSystem);
        return; // Stop all other updates
    }

    // Update enemy systems
    gameState.enemySystem.update(deltaTime);
    gameState.enemyManager.update(deltaTime);

    // Update tower systems with damage integration
    gameState.towerManager.update(deltaTime, gameState.enemySystem.getEnemiesForRendering(), gameState.enemySystem);
    gameState.resourceSystem.update(deltaTime);

    // Update game state management
    gameState.gameStateManager.update(gameState.enemyManager, gameState.resourceSystem);

    // Set enemy manager reference for stopping wave system
    if (!gameState.gameStateManager.enemyManager) {
        gameState.gameStateManager.enemyManager = gameState.enemyManager;
    }
}

// Render game frame
function render() {
    // Update day/night phase based on wave state
    const currentWaveInfo = gameState.enemyManager.getWaveInfo();
    // Debug: Log wave state every 60 frames (1 second at 60fps)
    if (Math.floor(Date.now() / 1000) !== gameState.lastDebugSecond) {
        gameState.lastDebugSecond = Math.floor(Date.now() / 1000);
        if (gameState.logger) {
            gameState.logger.info(`🌊 Wave State: ${currentWaveInfo.waveState}, Current Wave: ${currentWaveInfo.currentWave}`);
        }
    }
    gameState.renderer.updateDayNightPhase(currentWaveInfo.waveState, currentWaveInfo);

    // Clear canvas
    gameState.renderer.clear();

    // Render grid with day/night lighting
    gameState.renderer.renderGrid(gameState.grid, gameState.debug);

    // Render day/night tile lighting overlay (only affects tiles)
    gameState.renderer.renderDayNightTileLighting();

    // Render start and end tiles on layer 3 (after day/night lighting)
    gameState.renderer.renderStartEndTiles(gameState.grid);

    // Render enemies
    gameState.renderer.renderEnemies(gameState.enemySystem.getEnemiesForRendering(), CONFIG.TILE_SIZE);

    // Render towers
    gameState.renderer.renderTowers(gameState.towerManager.getTowersForRendering(), CONFIG.TILE_SIZE, gameState.towerManager, gameState.selectedTower);

    // Render projectiles
    gameState.renderer.renderProjectiles(gameState.towerManager.getProjectilesForRendering());

    // Render impact effects
    gameState.renderer.renderImpactEffects(gameState.towerManager.getImpactEffectsForRendering());

    // Render coins
    gameState.renderer.renderCoins(gameState.resourceSystem.getCoinsForRendering());

    // Render collection effects
    gameState.renderer.renderCollectionEffects(gameState.resourceSystem.getCollectionEffectsForRendering());

    // Render damage indicators
    gameState.renderer.renderDamageIndicators(gameState.enemyManager.getDamageIndicatorsForRendering());

    // Render debug info
    if (gameState.debug.enabled) {
        gameState.renderer.renderDebugInfo(gameState.debug);
    }

    // Render wave announcements (full-screen dramatic announcements)
    const waveInfo = gameState.enemyManager.getWaveInfo();
    if (waveInfo.announcement) {
        gameState.renderer.renderWaveInfo(waveInfo);
    }

    // Render main HUD (always visible)
    const resourceInfo = gameState.resourceSystem.getResourceInfo();
    gameState.renderer.renderMainHUD(gameState.selectedTower, gameState.towerManager, waveInfo, resourceInfo);

    // Render tower placement popup if active
    if (gameState.towerPlacementPopup) {
        gameState.renderer.renderTowerPlacementPopup(gameState.towerPlacementPopup);
    }

    // Render game state overlay (game over, victory, etc.)
    gameState.renderer.renderGameStateOverlay(gameState.gameStateManager.getGameStateInfo());

    // Render phase change transition effects (full screen)
    gameState.renderer.renderPhaseChangeEffect();
}

// Handle HUD clicks
function handleHUDClick(clickX, clickY) {
    // Calculate HUD area below tilemap
    const tilemapHeight = 12 * 64; // 12 rows * 64px tile size
    const hudHeight = 120;
    const hudY = tilemapHeight + 10;
    const hudWidth = CONFIG.CANVAS_WIDTH - 20;
    const hudX = 10;

    // Check if click is within HUD bounds
    if (clickX >= hudX && clickX <= hudX + hudWidth &&
        clickY >= hudY && clickY <= hudY + hudHeight) {

        // Calculate section layout (5 equal sections)
        const padding = 15;
        const contentHeight = hudHeight - (padding * 2);
        const contentY = hudY + padding;
        const sectionWidth = (hudWidth - (padding * 6)) / 5; // 5 sections with 6 gaps

        // Section 1: Wave Info (no clickable elements)
        const waveInfoX = hudX + padding;

        // Section 2: Selection Portrait (no clickable elements)
        const portraitX = waveInfoX + sectionWidth + padding;

        // Section 3: Selection Info (no clickable elements)
        const infoX = portraitX + sectionWidth + padding;

        // Section 4: Selection Actions (upgrade button)
        const actionsX = infoX + sectionWidth + padding;
        if (gameState.selectedTower &&
            clickX >= actionsX && clickX <= actionsX + sectionWidth &&
            clickY >= contentY && clickY <= contentY + contentHeight) {

            // Check if clicking upgrade button
            const buttonWidth = sectionWidth - 20;
            const buttonHeight = 30;
            const buttonX = actionsX + 10;
            const buttonY = contentY + 35;

            if (clickX >= buttonX && clickX <= buttonX + buttonWidth &&
                clickY >= buttonY && clickY <= buttonY + buttonHeight) {
                // Try to upgrade the selected tower
                const success = gameState.towerManager.tryUpgradeTower(gameState.selectedTower.x, gameState.selectedTower.y);
                if (success) {
                    gameState.logger.info(`⬆️ Tower upgraded via HUD!`);
                    // Play upgrade sound
                    gameState.audioManager.playSound('tower_upgrade');
                    // Update selected tower reference
                    const updatedTower = gameState.towerManager.getTowerAt(gameState.selectedTower.x, gameState.selectedTower.y);
                    gameState.selectedTower = updatedTower;
                }
                return true;
            }
        }

        // Section 5: Coin Info (no clickable elements)
        const coinX = actionsX + sectionWidth + padding;

        return true; // Click was in HUD area
    }
    return false;
}

// Handle tower placement popup clicks
function handleTowerPlacementPopupClick(clickX, clickY) {
    if (!gameState.renderer.placementPopupBounds) return false;

    const bounds = gameState.renderer.placementPopupBounds;

    // Check + button (place tower)
    if (clickX >= bounds.plus.x && clickX <= bounds.plus.x + bounds.plus.width &&
        clickY >= bounds.plus.y && clickY <= bounds.plus.y + bounds.plus.height) {

        gameState.logger.info('🏗️ Place tower button clicked!');
        const gridPos = gameState.towerPlacementPopup;
        const placementSuccess = gameState.towerManager.tryPlaceTower(gridPos.x, gridPos.y);
        if (placementSuccess) {
            gameState.logger.info(`🏗️ Tower placed at (${gridPos.x}, ${gridPos.y})`);
            // Play tower placement sound
            gameState.audioManager.playSound('tower_place');

            // Select the newly placed tower
            const newTower = gameState.towerManager.getTowerAt(gridPos.x, gridPos.y);
            gameState.selectedTower = newTower;
        }
        // Clear popup
        gameState.towerPlacementPopup = null;
        return true;
    }

    // Check X button (cancel)
    if (clickX >= bounds.cancel.x && clickX <= bounds.cancel.x + bounds.cancel.width &&
        clickY >= bounds.cancel.y && clickY <= bounds.cancel.y + bounds.cancel.height) {

        gameState.logger.info('❌ Cancel tower placement');
        // Clear popup
        gameState.towerPlacementPopup = null;
        return true;
    }

    return false;
}

// Handle restart button click
function handleRestartButtonClick(clickX, clickY) {
    if (!gameState.renderer.restartButtonBounds) return false;

    const bounds = gameState.renderer.restartButtonBounds;
    if (clickX >= bounds.x && clickX <= bounds.x + bounds.width &&
        clickY >= bounds.y && clickY <= bounds.y + bounds.height) {

        gameState.logger.info('🔄 Restart button clicked!');
        restartGame();
        return true;
    }
    return false;
}

// Restart the game
function restartGame() {
    gameState.logger.info('🔄 Restarting game...');

    // Reset game state manager
    gameState.gameStateManager.reset();

    // Clear all enemies
    gameState.enemySystem.clearAllEnemies();

    // Clear all towers
    gameState.towerManager.clearAllTowers();

    // Reset resource system
    gameState.resourceSystem.reset();

    // Clear tower selection
    gameState.selectedTower = null;

    // Restart wave system
    gameState.enemyManager.startWaveSystem();

    gameState.logger.info('✅ Game restarted successfully!');
}

// Show audio hint if needed
function showAudioHintIfNeeded() {
    // Show hint after a short delay to see if audio is working
    setTimeout(() => {
        const audioHint = document.getElementById('audio-hint');
        if (audioHint) {
            audioHint.style.display = 'block';
            // Hide hint after 3 seconds
            setTimeout(() => {
                audioHint.style.display = 'none';
            }, 3000);
        }
    }, 1000);
}

// Handle input events
function handleInput() {
    if (gameState.input.wasClicked()) {
        gameState.logger.info('🎯 Click detected!');

        // Hide audio hint on first click
        const audioHint = document.getElementById('audio-hint');
        if (audioHint) {
            audioHint.style.display = 'none';
        }

        // Try to unlock audio on first interaction
        if (gameState.audioManager) {
            gameState.audioManager.checkAndUnlockAudio();
        }

        const clickPos = gameState.input.getClickPosition();

        gameState.logger.info(`📍 Clicked at screen (${clickPos.x}, ${clickPos.y})`);

        // Check if game is in terminal state and restart button was clicked
        if (gameState.gameStateManager.isTerminalState()) {
            if (handleRestartButtonClick(clickPos.x, clickPos.y)) {
                return; // Restart button click handled
            }
        }

        // If game is not playing, don't handle other input
        if (!gameState.gameStateManager.isPlaying()) {
            return;
        }

        // First, try to collect a coin (coins take priority over tower placement)
        if (gameState.resourceSystem.tryCollectCoin(clickPos.x, clickPos.y)) {
            gameState.logger.info('💰 Coin collected!');
            // Play coin collection sound
            gameState.audioManager.playSound('coin_collect');
            return; // Don't try to place tower if coin was collected
        }

        // Check if clicking on HUD (always check, regardless of selection)
        if (handleHUDClick(clickPos.x, clickPos.y)) {
            gameState.logger.info('🎯 HUD click handled');
            return; // HUD click handled
        }

        // Check if clicking on tower placement popup
        if (gameState.towerPlacementPopup && handleTowerPlacementPopupClick(clickPos.x, clickPos.y)) {
            return; // Popup click handled
        }

        // If no coin was collected, check for tower upgrade or placement
        const gridPos = gameState.grid.screenToGrid(clickPos.x, clickPos.y);
        gameState.logger.info(`📍 Screen (${clickPos.x}, ${clickPos.y}) -> grid (${gridPos.x}, ${gridPos.y})`);

        // Check if tower manager exists
        if (!gameState.towerManager) {
            gameState.logger.error('❌ TowerManager not initialized!');
            return;
        }

        gameState.logger.info('✅ TowerManager exists, checking for tower selection, upgrade, or placement...');

        // Check if there's a tower at this position
        const towerAtPosition = gameState.towerManager.getTowerAt(gridPos.x, gridPos.y);

        if (towerAtPosition) {
            // Tower exists - select it for HUD display
            gameState.selectedTower = towerAtPosition;
            gameState.logger.info(`🎯 Tower selected at (${gridPos.x}, ${gridPos.y}) - Level ${towerAtPosition.level}`);
            // Clear any popup
            gameState.towerPlacementPopup = null;
            return;
        }

        // No tower at position - show placement popup if buildable
        if (gameState.grid.canPlaceTower(gridPos.x, gridPos.y)) {
            // Clear any existing tower selection when showing placement popup
            gameState.selectedTower = null;
            gameState.towerPlacementPopup = {
                x: gridPos.x,
                y: gridPos.y,
                tileSize: CONFIG.TILE_SIZE
            };
            gameState.logger.info(`🏗️ Show placement popup at (${gridPos.x}, ${gridPos.y}) - cleared tower selection`);
        } else {
            gameState.logger.info(`❌ Cannot build at (${gridPos.x}, ${gridPos.y})`);
            // Clear selection and popup if clicking non-buildable space
            gameState.selectedTower = null;
            gameState.towerPlacementPopup = null;
        }
    }
}

// Set up input handlers
function setupInputHandlers() {
    // Debug key handlers
    document.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'd':
                gameState.debug.enabled = !gameState.debug.enabled;
                gameState.logger.setDebugMode(gameState.debug.enabled);
                // Add 2000 coins when entering debug mode
                if (gameState.debug.enabled) {
                    gameState.resourceSystem.addCoins(2000);
                    gameState.logger.info('Debug mode: Added 2000 coins for testing');
                }
                break;
            case 'g':
                gameState.debug.showGrid = !gameState.debug.showGrid;
                gameState.logger.info('Grid display:', gameState.debug.showGrid);
                break;
            case 'p':
                gameState.debug.showPath = !gameState.debug.showPath;
                gameState.logger.info('Path display:', gameState.debug.showPath);
                break;
            case 'c':
                gameState.debug.showCollision = !gameState.debug.showCollision;
                gameState.logger.info('Collision display:', gameState.debug.showCollision);
                break;
            case 'm':
                const muted = gameState.audioManager.toggleMute();
                gameState.logger.info('Audio muted:', muted);
                break;
            case 'n':
                // Skip to next wave (debug feature)
                if (gameState.debug.enabled) {
                    gameState.logger.info('🚀 Debug: Skipping to next wave');
                    gameState.enemyManager.skipToNextWave();
                } else {
                    gameState.logger.info('Debug mode required for wave skip (press D first)');
                }
                break;
            case 'l':
                // Test lose condition (debug feature)
                if (gameState.debug.enabled) {
                    gameState.logger.info('💀 Debug: Testing lose condition');
                    gameState.gameStateManager.setGameOver('debugTest');
                } else {
                    gameState.logger.info('Debug mode required for lose test (press D first)');
                }
                break;
            case 'w':
                // Test win condition (debug feature)
                if (gameState.debug.enabled) {
                    gameState.logger.info('🏆 Debug: Testing win condition');
                    gameState.gameStateManager.setVictory('debugTest');
                } else {
                    gameState.logger.info('Debug mode required for win test (press D first)');
                }
                break;
        }
    });
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Note: Logger not available yet, using console for DOM loaded message
    console.log('DOM loaded, starting game initialization...');
    initGame();
});
