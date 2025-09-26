/**
 * CuteDefense - Main Game Loop
 * Simple tower defense game for kids
 */

// Game configuration
const CONFIG = {
    CANVAS_WIDTH: 1024,
    CANVAS_HEIGHT: 768,
    GRID_SIZE: 32,
    GRID_COLS: 32,
    GRID_ROWS: 24,
    TILE_SIZE: 32
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
    resourceSystem: null
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

    // Update tower systems
    gameState.towerManager.update(deltaTime, gameState.enemySystem.getEnemiesForRendering());
    gameState.resourceSystem.update(deltaTime);
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
    gameState.renderer.renderTowers(gameState.towerManager.getTowersForRendering(), CONFIG.TILE_SIZE);

    // Render projectiles
    gameState.renderer.renderProjectiles(gameState.towerManager.getProjectilesForRendering());

    // Render coins
    gameState.renderer.renderCoins(gameState.resourceSystem.getCoinsForRendering());

    // Render resource info
    gameState.renderer.renderResourceInfo(gameState.resourceSystem.getResourceInfo());

    // Render debug info
    if (gameState.debug.enabled) {
        gameState.renderer.renderDebugInfo(gameState.debug);
    }

    // Render wave info
    gameState.renderer.renderWaveInfo(gameState.enemyManager.getWaveInfo());
}

// Handle input events
function handleInput() {
    if (gameState.input.wasClicked()) {
        console.log('🎯 Click detected!');
        const clickPos = gameState.input.getClickPosition();
        const gridPos = gameState.grid.screenToGrid(clickPos.x, clickPos.y);

        console.log(`📍 Clicked at screen (${clickPos.x}, ${clickPos.y}) -> grid (${gridPos.x}, ${gridPos.y})`);

        // Check if tower manager exists
        if (!gameState.towerManager) {
            console.error('❌ TowerManager not initialized!');
            return;
        }

        console.log('✅ TowerManager exists, attempting tower placement...');

        // Try to place tower using tower manager
        const success = gameState.towerManager.tryPlaceTower(gridPos.x, gridPos.y);
        if (success) {
            console.log(`🏗️ Tower placed at (${gridPos.x}, ${gridPos.y})`);
        } else {
            console.log(`❌ Cannot place tower at (${gridPos.x}, ${gridPos.y})`);
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
