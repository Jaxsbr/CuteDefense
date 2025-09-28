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
    audioManager: null // Audio system for sound effects and music
};

// Initialize game
function initGame() {
    console.log('Initializing CuteDefense...');

    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Initialize core systems
    console.log('Initializing core systems...');
    gameState.grid = new GridSystem(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TILE_SIZE);
    console.log('Grid system initialized');
    gameState.input = new InputSystem(canvas);
    console.log('Input system initialized');
    gameState.renderer = new RenderSystem(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    console.log('Render system initialized');
    gameState.enemySystem = new EnemySystem();
    console.log('Enemy system initialized');
    gameState.enemyManager = new EnemyManager(gameState.enemySystem, gameState.grid);
    console.log('Enemy manager initialized');
    gameState.towerSystem = new TowerSystem();
    console.log('Tower system initialized');
    gameState.resourceSystem = new ResourceSystem();
    console.log('Resource system initialized');
    gameState.towerManager = new TowerManager(gameState.towerSystem, gameState.grid, gameState.resourceSystem);
    console.log('Tower manager initialized');
    gameState.gameStateManager = new GameStateManager();
    console.log('Game state manager initialized');
    gameState.audioManager = new SimpleAudioManager();
    console.log('Audio manager initialized');

    // Set resource system reference in render system
    gameState.renderer.setResourceSystem(gameState.resourceSystem);

    // Set audio manager references in systems
    gameState.towerSystem.setAudioManager(gameState.audioManager);
    gameState.enemySystem.setAudioManager(gameState.audioManager);
    gameState.enemyManager.setAudioManager(gameState.audioManager);

    // Set up input handlers
    setupInputHandlers();

    // Start wave system
    gameState.enemyManager.startWaveSystem();

    // Start background music
    gameState.audioManager.startPreparationMusic();

    // Start game loop
    gameState.isRunning = true;
    gameLoop();

    console.log('Game initialized successfully!');
    console.log('Game state:', gameState);
    console.log('TowerManager:', gameState.towerManager);
    console.log('ResourceSystem:', gameState.resourceSystem);
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

    // Update enemy systems
    gameState.enemySystem.update(deltaTime);
    gameState.enemyManager.update(deltaTime);

    // Update tower systems with damage integration
    gameState.towerManager.update(deltaTime, gameState.enemySystem.getEnemiesForRendering(), gameState.enemySystem);
    gameState.resourceSystem.update(deltaTime);

    // Update game state management
    gameState.gameStateManager.update(gameState.enemyManager, gameState.resourceSystem);
}

// Render game frame
function render() {
    // Clear canvas
    gameState.renderer.clear();

    // Render grid
    gameState.renderer.renderGrid(gameState.grid, gameState.debug);

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
                    console.log(`⬆️ Tower upgraded via HUD!`);
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

        console.log('🏗️ Place tower button clicked!');
        const gridPos = gameState.towerPlacementPopup;
        const placementSuccess = gameState.towerManager.tryPlaceTower(gridPos.x, gridPos.y);
        if (placementSuccess) {
            console.log(`🏗️ Tower placed at (${gridPos.x}, ${gridPos.y})`);
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

        console.log('❌ Cancel tower placement');
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

        console.log('🔄 Restart button clicked!');
        restartGame();
        return true;
    }
    return false;
}

// Restart the game
function restartGame() {
    console.log('🔄 Restarting game...');

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

    console.log('✅ Game restarted successfully!');
}

// Handle input events
function handleInput() {
    if (gameState.input.wasClicked()) {
        console.log('🎯 Click detected!');
        const clickPos = gameState.input.getClickPosition();

        console.log(`📍 Clicked at screen (${clickPos.x}, ${clickPos.y})`);

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
            console.log('💰 Coin collected!');
            // Play coin collection sound
            gameState.audioManager.playSound('coin_collect');
            return; // Don't try to place tower if coin was collected
        }

        // Check if clicking on HUD (always check, regardless of selection)
        if (handleHUDClick(clickPos.x, clickPos.y)) {
            console.log('🎯 HUD click handled');
            return; // HUD click handled
        }

        // Check if clicking on tower placement popup
        if (gameState.towerPlacementPopup && handleTowerPlacementPopupClick(clickPos.x, clickPos.y)) {
            return; // Popup click handled
        }

        // If no coin was collected, check for tower upgrade or placement
        const gridPos = gameState.grid.screenToGrid(clickPos.x, clickPos.y);
        console.log(`📍 Screen (${clickPos.x}, ${clickPos.y}) -> grid (${gridPos.x}, ${gridPos.y})`);

        // Check if tower manager exists
        if (!gameState.towerManager) {
            console.error('❌ TowerManager not initialized!');
            return;
        }

        console.log('✅ TowerManager exists, checking for tower selection, upgrade, or placement...');

        // Check if there's a tower at this position
        const towerAtPosition = gameState.towerManager.getTowerAt(gridPos.x, gridPos.y);

        if (towerAtPosition) {
            // Tower exists - select it for HUD display
            gameState.selectedTower = towerAtPosition;
            console.log(`🎯 Tower selected at (${gridPos.x}, ${gridPos.y}) - Level ${towerAtPosition.level}`);
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
            console.log(`🏗️ Show placement popup at (${gridPos.x}, ${gridPos.y}) - cleared tower selection`);
        } else {
            console.log(`❌ Cannot build at (${gridPos.x}, ${gridPos.y})`);
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
                console.log('Debug mode:', gameState.debug.enabled);
                break;
            case 'g':
                gameState.debug.showGrid = !gameState.debug.showGrid;
                console.log('Grid display:', gameState.debug.showGrid);
                break;
            case 'p':
                gameState.debug.showPath = !gameState.debug.showPath;
                console.log('Path display:', gameState.debug.showPath);
                break;
            case 'c':
                gameState.debug.showCollision = !gameState.debug.showCollision;
                console.log('Collision display:', gameState.debug.showCollision);
                break;
            case 'm':
                const muted = gameState.audioManager.toggleMute();
                console.log('Audio muted:', muted);
                break;
        }
    });
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting game initialization...');
    initGame();
});
