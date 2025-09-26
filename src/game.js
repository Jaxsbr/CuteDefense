/**
 * CuteDefense - Main Game Loop
 * Simple tower defense game for kids
 */

// Game configuration
const CONFIG = {
    CANVAS_WIDTH: 1024,
    CANVAS_HEIGHT: 768,
    GRID_SIZE: 64,  // Doubled from 32 to 64 for better visibility
    GRID_COLS: 16,  // Halved from 32 to 16
    GRID_ROWS: 12,  // Halved from 24 to 12
    TILE_SIZE: 64   // Doubled from 32 to 64
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
    selectedTower: null // Track selected tower for HUD
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

    // Set resource system reference in render system
    gameState.renderer.setResourceSystem(gameState.resourceSystem);

    // Set up input handlers
    setupInputHandlers();

    // Start wave system
    gameState.enemyManager.startWaveSystem();

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

    // Render coins
    gameState.renderer.renderCoins(gameState.resourceSystem.getCoinsForRendering());

    // Render collection effects
    gameState.renderer.renderCollectionEffects(gameState.resourceSystem.getCollectionEffectsForRendering());

    // Render resource info with pulse animation
    gameState.renderer.renderResourceInfo(
        gameState.resourceSystem.getResourceInfo(),
        gameState.resourceSystem.getCoinTotalPulse()
    );

    // Render debug info
    if (gameState.debug.enabled) {
        gameState.renderer.renderDebugInfo(gameState.debug);
    }

    // Render wave info
    gameState.renderer.renderWaveInfo(gameState.enemyManager.getWaveInfo());

    // Render tower HUD if tower is selected
    if (gameState.selectedTower) {
        gameState.renderer.renderTowerHUD(gameState.selectedTower, gameState.towerManager);
    }

    // Render game state overlay (game over, victory, etc.)
    gameState.renderer.renderGameStateOverlay(gameState.gameStateManager.getGameStateInfo());
}

// Handle HUD clicks
function handleHUDClick(clickX, clickY) {
    if (!gameState.selectedTower) return false;

    const hudWidth = 300;
    const hudHeight = 200;
    const hudX = CONFIG.CANVAS_WIDTH - hudWidth - 20;
    const hudY = 20;

    // Check if click is within HUD bounds
    if (clickX >= hudX && clickX <= hudX + hudWidth && 
        clickY >= hudY && clickY <= hudY + hudHeight) {
        
        // Check if clicking upgrade button
        const upgradeButtonX = hudX + 20;
        const upgradeButtonY = hudY + 120;
        const upgradeButtonWidth = 120;
        const upgradeButtonHeight = 40;

        if (clickX >= upgradeButtonX && clickX <= upgradeButtonX + upgradeButtonWidth &&
            clickY >= upgradeButtonY && clickY <= upgradeButtonY + upgradeButtonHeight) {
            
            // Try to upgrade the selected tower
            const success = gameState.towerManager.tryUpgradeTower(gameState.selectedTower.x, gameState.selectedTower.y);
            if (success) {
                console.log(`⬆️ Tower upgraded via HUD!`);
                // Update selected tower reference
                gameState.selectedTower = gameState.towerManager.getTowerAt(gameState.selectedTower.x, gameState.selectedTower.y);
            }
            return true;
        }
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
            return; // Don't try to place tower if coin was collected
        }

        // Check if clicking on HUD upgrade button
        if (gameState.selectedTower && handleHUDClick(clickPos.x, clickPos.y)) {
            return; // HUD click handled
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
            return;
        }

        // No tower at position - try to place a new tower
        const placementSuccess = gameState.towerManager.tryPlaceTower(gridPos.x, gridPos.y);
        if (placementSuccess) {
            console.log(`🏗️ Tower placed at (${gridPos.x}, ${gridPos.y})`);
            // Select the newly placed tower
            gameState.selectedTower = gameState.towerManager.getTowerAt(gridPos.x, gridPos.y);
        } else {
            console.log(`❌ Cannot place tower at (${gridPos.x}, ${gridPos.y})`);
            // Clear selection if clicking empty space
            gameState.selectedTower = null;
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
        }
    });
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting game initialization...');
    initGame();
});
