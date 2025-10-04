/**
 * CuteDefense - Main Game Loop
 * Simple tower defense game for kids
 */

// Game configuration - will be set dynamically by ResponsiveScalingSystem
let CONFIG = {
    CANVAS_WIDTH: 2560,  // Will be calculated dynamically
    CANVAS_HEIGHT: 1169, // Will be calculated dynamically
    GRID_SIZE: 64,       // 64px tiles for good visibility
    GRID_COLS: 30,       // 30 columns for better balance
    GRID_ROWS: 12,       // 12 rows (unchanged)
    TILE_SIZE: 64,       // Will be scaled dynamically
    HUD_WIDTH: 400,      // Will be scaled dynamically
    HUD_HEIGHT: 1169,    // Will be scaled dynamically
    GRID_OFFSET_X: 120,  // Will be scaled dynamically
    GRID_OFFSET_Y: 200   // Will be scaled dynamically
};

// Game state
let gameState = {
    isRunning: false,
    showStartMenu: true, // Show start menu before game begins
    soundEnabled: true, // Sound toggle state
    transition: {
        active: false,
        startTime: 0,
        duration: 1000, // 1 second transition
        type: 'fadeOut'
    },
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
    selectedEnemy: null, // Track selected enemy for HUD
    towerPlacementPopup: null, // Track tower placement popup state {x,y,tileSize,selectedType}
    lastPlacedTowerType: 'BASIC', // Remember last placed type for UX
    audioManager: null, // Audio system for sound effects and music
    logger: null, // System logger for centralized logging
    lastDebugSecond: 0, // Debug timing for wave state logging
    responsiveScaling: null // Responsive scaling system for mobile devices
};

// Initialize game
function initGame() {
    // Initialize logger first (debug mode OFF by default)
    gameState.logger = new LoggerSystem();
    gameState.logger.info('Initializing CuteDefense...');

    // Initialize responsive scaling system
    gameState.responsiveScaling = new ResponsiveScalingSystem();
    gameState.responsiveScaling.setLogger(gameState.logger);

    // Update CONFIG with responsive scaling
    const scalingConfig = gameState.responsiveScaling.getConfig();
    CONFIG = {
        CANVAS_WIDTH: scalingConfig.width,
        CANVAS_HEIGHT: scalingConfig.height,
        GRID_SIZE: scalingConfig.gridCols,
        GRID_COLS: scalingConfig.gridCols,
        GRID_ROWS: scalingConfig.gridRows,
        TILE_SIZE: scalingConfig.tileSize,
        HUD_WIDTH: scalingConfig.hudWidth,
        HUD_HEIGHT: scalingConfig.hudHeight,
        GRID_OFFSET_X: scalingConfig.gridOffsetX,
        GRID_OFFSET_Y: scalingConfig.gridOffsetY
    };

    gameState.logger.info('Responsive scaling initialized:', gameState.responsiveScaling.getScalingInfo());

    // Get canvas and context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size based on responsive scaling
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;

    gameState.logger.info(`Canvas size set to: ${canvas.width}x${canvas.height}`);

    // Initialize core systems
    gameState.logger.info('Initializing core systems...');
    gameState.grid = new GridSystem(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TILE_SIZE);
    gameState.logger.info('Grid system initialized');
    gameState.input = new InputSystem(canvas);
    gameState.input.setGridSystem(gameState.grid); // Connect grid system to input system
    gameState.input.setResponsiveScaling(gameState.responsiveScaling); // Connect responsive scaling to input system
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

    // Set grid system references for coordinate conversion
    gameState.towerSystem.setGridSystem(gameState.grid);
    gameState.enemySystem.setGridSystem(gameState.grid);

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

    // Show audio hint if needed - DISABLED (replaced with start menu sound toggle)
    // showAudioHintIfNeeded();

    // Start game loop
    gameState.isRunning = true;
    gameLoop();

    // Add global keyboard listener for start menu and restart
    document.addEventListener('keydown', (e) => {
        if (gameState.showStartMenu) {
            if (e.key === '1') {
                gameState.grid.setDifficulty('easy');
                gameState.showStartMenu = false;
                gameState.logger.info('🎮 Starting game with easy difficulty');
            } else if (e.key === '2') {
                gameState.grid.setDifficulty('hard');
                gameState.showStartMenu = false;
                gameState.logger.info('🎮 Starting game with hard difficulty');
            }
        } else if (e.key === 'r' || e.key === 'R') {
            // Restart to start menu
            gameState.showStartMenu = true;
            gameState.logger.info('🔄 Returning to start menu');
        }
    });

    // Add window resize handler for responsive scaling
    window.addEventListener('resize', () => {
        if (gameState.responsiveScaling) {
            gameState.logger.info('🔄 Window resized - recalculating responsive scaling');
            gameState.responsiveScaling.handleResize();

            // Update CONFIG with new scaling
            const scalingConfig = gameState.responsiveScaling.getConfig();
            CONFIG = {
                CANVAS_WIDTH: scalingConfig.width,
                CANVAS_HEIGHT: scalingConfig.height,
                GRID_SIZE: scalingConfig.gridCols,
                GRID_COLS: scalingConfig.gridCols,
                GRID_ROWS: scalingConfig.gridRows,
                TILE_SIZE: scalingConfig.tileSize,
                HUD_WIDTH: scalingConfig.hudWidth,
                HUD_HEIGHT: scalingConfig.hudHeight,
                GRID_OFFSET_X: scalingConfig.gridOffsetX,
                GRID_OFFSET_Y: scalingConfig.gridOffsetY
            };

            // Update canvas size
            const canvas = document.getElementById('gameCanvas');
            canvas.width = CONFIG.CANVAS_WIDTH;
            canvas.height = CONFIG.CANVAS_HEIGHT;

            // Update InputSystem's responsive scaling reference
            if (gameState.input && gameState.input.setResponsiveScaling) {
                gameState.input.setResponsiveScaling(gameState.responsiveScaling);
            }

            gameState.logger.info('Responsive scaling updated:', gameState.responsiveScaling.getScalingInfo());
        }
    });

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

    // Check if start menu is showing - stop all game systems except rendering
    if (gameState.showStartMenu) {
        return; // Stop all updates when start menu is showing
    }

    // Check if game is paused - stop all game systems except rendering
    if (gameState.gameStateManager.isPaused()) {
        return; // Stop all updates when paused
    }

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

    // Clear enemy selection if selected enemy is dead or no longer alive
    if (gameState.selectedEnemy) {
        // Check if enemy is still in the active enemies list
        const isEnemyStillActive = gameState.enemySystem.getEnemiesForRendering().some(enemy => enemy.id === gameState.selectedEnemy.id);

        if (!isEnemyStillActive || !gameState.selectedEnemy.isAlive || gameState.selectedEnemy.health <= 0) {
            gameState.selectedEnemy = null;
            gameState.logger.info('💀 Selected enemy died or removed, clearing selection');
        }
    }

    // Set enemy manager reference for stopping wave system
    if (!gameState.gameStateManager.enemyManager) {
        gameState.gameStateManager.enemyManager = gameState.enemyManager;
    }
}

// Render game frame
function render() {
    // Show start menu if active
    if (gameState.showStartMenu) {
        gameState.renderer.clear();
        gameState.renderer.renderStartMenu(gameState);

        // Handle transition effect
        if (gameState.transition.active) {
            const elapsed = Date.now() - gameState.transition.startTime;
            const progress = Math.min(elapsed / gameState.transition.duration, 1);

            // Fade out effect
            gameState.renderer.ctx.save();
            gameState.renderer.ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
            gameState.renderer.ctx.fillRect(0, 0, gameState.renderer.width, gameState.renderer.height);
            gameState.renderer.ctx.restore();

            // Complete transition
            if (progress >= 1) {
                gameState.showStartMenu = false;
                gameState.transition.active = false;
            }
        }
        return;
    }

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

    // Render path tiles on separate layer for night visibility
    gameState.renderer.renderPathTiles(gameState.grid);

    // Render enemies
    gameState.renderer.renderEnemies(gameState.enemySystem.getEnemiesForRendering(), CONFIG.TILE_SIZE, gameState.selectedEnemy);

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

    // Render main HUD (always visible) - pass popup info for proposed tower preview
    const resourceInfo = gameState.resourceSystem.getResourceInfo();
    const gameStateInfo = gameState.gameStateManager.getGameStateInfo();
    gameState.renderer.renderMainHUD(gameState.selectedTower, gameState.towerManager, waveInfo, resourceInfo, gameState.selectedEnemy, gameState.towerPlacementPopup, gameStateInfo, gameState.grid);

    // Render tower placement popup if active
    if (gameState.towerPlacementPopup) {
        gameState.renderer.renderTowerPlacementPopup(gameState.towerPlacementPopup);
    }

    // Render game state overlay (game over, victory, etc.)
    gameState.renderer.renderGameStateOverlay(gameState.gameStateManager.getGameStateInfo());

    // Render pause overlay if paused
    if (gameState.gameStateManager.isPaused()) {
        gameState.renderer.renderPauseOverlay();
    }

    // Render phase change transition effects (full screen)
    gameState.renderer.renderPhaseChangeEffect();
}

// Handle HUD clicks
function handleHUDClick(clickX, clickY) {
    // Left-docked HUD layout - use responsive CONFIG values
    const hudWidth = CONFIG.HUD_WIDTH; // Responsive width
    const hudHeight = CONFIG.HUD_HEIGHT; // Responsive height
    const hudX = 0; // Left edge
    const hudY = 0; // Top edge

    // Debug logging for HUD click detection
    gameState.logger.info(`🎯 HUD Click Debug: click(${clickX}, ${clickY}) HUD bounds: (${hudX}, ${hudY}) to (${hudX + hudWidth}, ${hudY + hudHeight})`);
    gameState.logger.info(`🎯 HUD Click Debug: CONFIG.HUD_WIDTH=${CONFIG.HUD_WIDTH}, CONFIG.HUD_HEIGHT=${CONFIG.HUD_HEIGHT}`);

    // Check if click is within HUD bounds
    if (clickX >= hudX && clickX <= hudX + hudWidth &&
        clickY >= hudY && clickY <= hudY + hudHeight) {

        gameState.logger.info('✅ Click is within HUD bounds');

        // Calculate section layout (5 equal sections VERTICAL) - use responsive padding
        const scaleFactor = gameState.responsiveScaling ? gameState.responsiveScaling.getScaleFactor() : 1.0;
        const padding = Math.floor(20 * scaleFactor); // Match renderer padding
        const sectionHeight = (hudHeight - (padding * 6)) / 5; // 5 sections with 5 gaps (match renderer)
        const sectionWidth = hudWidth - (padding * 2);

        // Section 1: Compact Wave Info (no clickable elements)
        const waveInfoY = hudY + padding;
        
        // Section 2: Mobile Controls (dedicated section)
        const controlsY = waveInfoY + sectionHeight + padding;
        
        // Check for mobile control button clicks in Mobile Controls section
        if (gameState.renderer.mobileButtonBounds && 
            clickX >= hudX + padding && clickX <= hudX + padding + sectionWidth &&
            clickY >= controlsY && clickY <= controlsY + sectionHeight) {
            
            // Check each mobile button
            for (const button of gameState.renderer.mobileButtonBounds) {
                const bounds = button.bounds;
                if (clickX >= bounds.x && clickX <= bounds.x + bounds.width &&
                    clickY >= bounds.y && clickY <= bounds.y + bounds.height) {
                    
                    gameState.logger.info(`🎯 Mobile button clicked: ${button.action}`);
                    
                    switch (button.action) {
                        case 'pause':
                            gameState.gameStateManager.togglePause();
                            gameState.logger.info('⏸️ Game paused/unpaused');
                            break;
                        case 'restart':
                            gameState.showStartMenu = true;
                            gameState.logger.info('🔄 Returning to start menu');
                            break;
                        case 'menu':
                            gameState.showStartMenu = true;
                            gameState.logger.info('🏠 Returning to main menu');
                            break;
                        case 'sound':
                            gameState.soundEnabled = !gameState.soundEnabled;
                            if (gameState.audioManager) {
                                gameState.audioManager.setMuted(!gameState.soundEnabled);
                            }
                            gameState.logger.info(`🔊 Sound ${gameState.soundEnabled ? 'enabled' : 'disabled'}`);
                            break;
                    }
                    return true;
                }
            }
        }

        // Section 3: Combined Selection (no clickable elements)
        const selectionY = controlsY + sectionHeight + padding;

        // Section 4: Selection Actions (upgrade button) - THIS IS THE IMPORTANT ONE
        const actionsY = selectionY + sectionHeight + padding;
        if (gameState.selectedTower &&
            clickX >= hudX + padding && clickX <= hudX + padding + sectionWidth &&
            clickY >= actionsY && clickY <= actionsY + sectionHeight) {

            // Check if clicking upgrade button - use responsive dimensions (scaleFactor already declared above)
            const buttonWidth = sectionWidth - Math.floor(20 * scaleFactor);
            const buttonHeight = Math.floor(30 * scaleFactor);
            const buttonX = hudX + padding + Math.floor(10 * scaleFactor);
            const buttonY = actionsY + Math.floor(35 * scaleFactor);

            gameState.logger.info(`🎯 Upgrade Button Debug: button bounds: (${buttonX}, ${buttonY}) to (${buttonX + buttonWidth}, ${buttonY + buttonHeight})`);
            gameState.logger.info(`🎯 Upgrade Button Debug: click(${clickX}, ${clickY}) scaleFactor=${scaleFactor}`);

            if (clickX >= buttonX && clickX <= buttonX + buttonWidth &&
                clickY >= buttonY && clickY <= buttonY + buttonHeight) {

                gameState.logger.info('✅ Click is within upgrade button bounds - attempting upgrade');
                // Try to upgrade the selected tower
                const upgradeResult = gameState.towerManager.tryUpgradeTower(gameState.selectedTower.x, gameState.selectedTower.y);
                if (upgradeResult) {
                    gameState.logger.info(`⬆️ Tower upgraded via HUD!`);

                    // Play single dramatic upgrade sound based on tower level
                    const towerLevel = typeof upgradeResult === 'number' ? upgradeResult : 1;
                    if (towerLevel === 2) {
                        gameState.audioManager.playSound('tower_upgrade_level2'); // "Wow" zoomy sound
                    } else if (towerLevel === 3) {
                        gameState.audioManager.playSound('tower_upgrade_level3'); // "Super wow" zoomy sound
                    } else {
                        gameState.audioManager.playSound('tower_upgrade'); // Default zoomy sound
                    }

                    // Update selected tower reference
                    const updatedTower = gameState.towerManager.getTowerAt(gameState.selectedTower.x, gameState.selectedTower.y);
                    gameState.selectedTower = updatedTower;
                }
                return true;
            }
        }

        return true; // Click was in HUD area
    }
    return false;
}

// Handle tower placement popup clicks
function handleTowerPlacementPopupClick(clickX, clickY) {
    if (!gameState.renderer.placementPopupBounds) return false;

    const bounds = gameState.renderer.placementPopupBounds;

    // Selected button: place tower of current selectedType
    if (bounds.selected && clickX >= bounds.selected.x && clickX <= bounds.selected.x + bounds.selected.width &&
        clickY >= bounds.selected.y && clickY <= bounds.selected.y + bounds.selected.height) {

        const gridPos = gameState.towerPlacementPopup;
        const type = gridPos.selectedType || 'BASIC';
        gameState.logger.info(`🏗️ Place selected tower: ${type}`);
        const placementSuccess = gameState.towerManager.tryPlaceTower(gridPos.gridX, gridPos.gridY, type);
        if (placementSuccess) {
            // Play SFX and select new tower
            gameState.audioManager.playSound('tower_place');
            const newTower = gameState.towerManager.getTowerAt(gridPos.gridX, gridPos.gridY);
            gameState.selectedTower = newTower;
            gameState.lastPlacedTowerType = type;
        }
        gameState.towerPlacementPopup = null;
        return true;
    }

    // Cycle button: toggle selectedType between BASIC and STRONG
    if (bounds.cycle && clickX >= bounds.cycle.x && clickX <= bounds.cycle.x + bounds.cycle.width &&
        clickY >= bounds.cycle.y && clickY <= bounds.cycle.y + bounds.cycle.height) {
        if (gameState.towerPlacementPopup) {
            const current = gameState.towerPlacementPopup.selectedType || 'BASIC';
            const next = current === 'BASIC' ? 'STRONG' : 'BASIC';
            gameState.towerPlacementPopup.selectedType = next;
            gameState.logger.info(`🔁 Cycle tower type: ${current} -> ${next}`);
            // Soft click sound
            if (gameState.audioManager) gameState.audioManager.playSound('button_click');
        }
        return true;
    }

    // Cancel button
    if (bounds.cancel && clickX >= bounds.cancel.x && clickX <= bounds.cancel.x + bounds.cancel.width &&
        clickY >= bounds.cancel.y && clickY <= bounds.cancel.y + bounds.cancel.height) {
        gameState.logger.info('❌ Cancel tower placement');
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

    // Clear selections
    gameState.selectedTower = null;
    gameState.selectedEnemy = null;

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

        // Audio hint removed - sound control now in start menu

        // Try to unlock audio on first interaction
        if (gameState.audioManager) {
            gameState.audioManager.checkAndUnlockAudio();
        }

        const clickPos = gameState.input.getClickPosition();

        // Handle start menu clicks
        if (gameState.showStartMenu) {
            const result = gameState.input.handleStartMenuClick(clickPos.x, clickPos.y);
            if (result === 'sound_toggle') {
                gameState.soundEnabled = !gameState.soundEnabled;
                if (gameState.audioManager) {
                    gameState.audioManager.setMuted(!gameState.soundEnabled);
                }
                gameState.logger.info(`🔊 Sound ${gameState.soundEnabled ? 'enabled' : 'disabled'}`);
            } else if (result === 'easy' || result === 'hard') {
                gameState.grid.setDifficulty(result);
                gameState.logger.info(`📋 Difficulty set to ${result}`);
            } else if (result === 'play') {
                // Start transition effect
                gameState.transition.active = true;
                gameState.transition.startTime = Date.now();
                gameState.logger.info(`🎮 Starting game with ${gameState.grid.getDifficulty()} difficulty`);
            }
            return;
        }

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
            gameState.selectedEnemy = null; // Clear enemy selection
            gameState.logger.info(`🎯 Tower selected at (${gridPos.x}, ${gridPos.y}) - Level ${towerAtPosition.level}`);
            // Clear any popup
            gameState.towerPlacementPopup = null;
            return;
        }

        // Check if there's an enemy at this position
        const enemyAtPosition = gameState.enemySystem.getEnemyAtPosition(clickPos.x, clickPos.y);
        if (enemyAtPosition) {
            // Enemy exists - select it for HUD display
            gameState.selectedEnemy = enemyAtPosition;
            gameState.selectedTower = null; // Clear tower selection
            gameState.logger.info(`🎯 Enemy selected: ${enemyAtPosition.type} - Health: ${enemyAtPosition.health}`);
            // Clear any popup
            gameState.towerPlacementPopup = null;
            return;
        }

        // No tower at position - show placement popup if buildable
        if (gameState.grid.canPlaceTower(gridPos.x, gridPos.y)) {
            // Clear any existing selections when showing placement popup
            gameState.selectedTower = null;
            gameState.selectedEnemy = null;

            // Convert grid coordinates to screen coordinates for popup positioning
            const screenPos = gameState.grid.gridToScreen(gridPos.x, gridPos.y);
            gameState.towerPlacementPopup = {
                x: screenPos.x,  // Use screen coordinates
                y: screenPos.y,  // Use screen coordinates
                gridX: gridPos.x, // Keep grid coordinates for tower placement
                gridY: gridPos.y, // Keep grid coordinates for tower placement
                tileSize: CONFIG.TILE_SIZE,
                selectedType: gameState.lastPlacedTowerType || 'BASIC'
            };
            gameState.logger.info(`🏗️ Show placement popup at grid (${gridPos.x}, ${gridPos.y}) -> screen (${screenPos.x}, ${screenPos.y}) - cleared selections`);
        } else {
            gameState.logger.info(`❌ Cannot build at (${gridPos.x}, ${gridPos.y})`);
            // Clear all selections and popup if clicking non-buildable space
            gameState.selectedTower = null;
            gameState.selectedEnemy = null;
            gameState.towerPlacementPopup = null;
        }
    }
}

// Set up input handlers
function setupInputHandlers() {
    // Debug key handlers
    document.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'escape':
                // Toggle pause (only if not in terminal state)
                if (!gameState.gameStateManager.isTerminalState()) {
                    const isPaused = gameState.gameStateManager.isPaused();
                    gameState.gameStateManager.setPaused(!isPaused);
                    gameState.logger.info(isPaused ? '▶️ Game resumed' : '⏸️ Game paused');
                }
                break;
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
