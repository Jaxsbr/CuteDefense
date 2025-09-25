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
    enemyManager: null
};

// Initialize game
function initGame() {
    console.log('Initializing CuteDefense...');
    
    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Initialize core systems
    gameState.grid = new GridSystem(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TILE_SIZE);
    gameState.input = new InputSystem(canvas);
    gameState.renderer = new RenderSystem(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    gameState.enemySystem = new EnemySystem();
    gameState.enemyManager = new EnemyManager(gameState.enemySystem, gameState.grid);
    
    // Set up input handlers
    setupInputHandlers();
    
    // Start wave system
    gameState.enemyManager.startWaveSystem();
    
    // Start game loop
    gameState.isRunning = true;
    gameLoop();
    
    console.log('Game initialized successfully!');
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
    
    // Update input system
    gameState.input.update();
    
    // Update enemy systems
    gameState.enemySystem.update(deltaTime);
    gameState.enemyManager.update(deltaTime);
    
    // Handle input events
    handleInput();
}

// Render game frame
function render() {
    // Clear canvas
    gameState.renderer.clear();
    
    // Render grid
    gameState.renderer.renderGrid(gameState.grid, gameState.debug);
    
    // Render enemies
    gameState.renderer.renderEnemies(gameState.enemySystem.getEnemiesForRendering(), CONFIG.TILE_SIZE);
    
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
        const clickPos = gameState.input.getClickPosition();
        const gridPos = gameState.grid.screenToGrid(clickPos.x, clickPos.y);
        
        console.log(`Clicked at screen (${clickPos.x}, ${clickPos.y}) -> grid (${gridPos.x}, ${gridPos.y})`);
        
        // Place placeholder tower
        if (gameState.grid.canPlaceTower(gridPos.x, gridPos.y)) {
            gameState.grid.placeTower(gridPos.x, gridPos.y);
            console.log(`Tower placed at (${gridPos.x}, ${gridPos.y})`);
        } else {
            console.log(`Cannot place tower at (${gridPos.x}, ${gridPos.y})`);
        }
    }
}

// Set up input handlers
function setupInputHandlers() {
    // Debug key handlers
    document.addEventListener('keydown', (e) => {
        switch(e.key.toLowerCase()) {
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
document.addEventListener('DOMContentLoaded', initGame);
