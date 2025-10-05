/**
 * Game State Manager - Handles win/lose conditions and game flow
 */
class GameStateManager {
    constructor() {
        this.gameState = 'playing'; // 'playing', 'gameOver', 'victory', 'paused'
        this.gameOverReason = null; // 'enemiesReachedGoal', 'timeout', etc.
        this.victoryCondition = null; // 'wavesCompleted', 'scoreReached', etc.
        this.maxWaves = 15; // Extended victory condition to include all boss waves
        this.enemiesReachedGoal = 0;
        this.maxEnemiesAllowed = 5; // Game over if this many enemies reach goal
        this.gameStartTime = Date.now();
        this.gameOverTime = null;
        this.victoryTime = null;
        this.logger = null; // Logger reference
        this.enemyManager = null; // Enemy manager reference for stopping wave system
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Update game state based on current game conditions
     */
    update(enemyManager, resourceSystem) {
        if (this.gameState !== 'playing') return;

        // Check for game over conditions
        if (this.checkGameOverConditions(enemyManager)) {
            this.setGameOver('enemiesReachedGoal');
            return;
        }

        // Check for victory conditions
        if (this.checkVictoryConditions(enemyManager)) {
            this.setVictory('wavesCompleted');
            return;
        }

        // Update enemy goal tracking
        this.updateEnemyGoalTracking(enemyManager);
    }

    /**
     * Check if game over conditions are met
     */
    checkGameOverConditions(enemyManager) {
        // Check if too many enemies reached the goal
        if (this.enemiesReachedGoal >= this.maxEnemiesAllowed) {
            return true;
        }

        // Could add other game over conditions here
        // - Time limit reached
        // - No resources and no towers
        // - etc.

        return false;
    }

    /**
     * Check if victory conditions are met
     */
    checkVictoryConditions(enemyManager) {
        // Check if all waves completed - victory should trigger when the final wave is complete
        const waveInfo = enemyManager.getWaveInfo();
        if (waveInfo.currentWave >= this.maxWaves && waveInfo.waveState === 'complete') {
            return true;
        }

        // Could add other victory conditions here
        // - Score threshold reached
        // - Specific objectives completed
        // - etc.

        return false;
    }

    /**
     * Update tracking of enemies that reached the goal
     */
    updateEnemyGoalTracking(enemyManager) {
        // Get count of enemies that reached the goal
        const enemiesReached = enemyManager.getEnemiesReachedGoal();
        this.enemiesReachedGoal = enemiesReached; // enemiesReached is already a count, not an array
        
        // Debug: Log lives tracking
        if (this.logger && enemiesReached > 0) {
            this.logger.info(`🎮 Lives: ${this.maxEnemiesAllowed - this.enemiesReachedGoal}/${this.maxEnemiesAllowed} (${enemiesReached} enemies reached goal)`);
        }
    }

    /**
     * Set game over state
     */
    setGameOver(reason) {
        this.gameState = 'gameOver';
        this.gameOverReason = reason;
        this.gameOverTime = Date.now();
        if (this.logger) this.logger.info(`🎮 Game Over! Reason: ${reason}`);

        // Stop wave system when game ends
        if (this.enemyManager) {
            this.enemyManager.stopWaveSystem();
        }
    }

    /**
     * Set victory state
     */
    setVictory(reason) {
        this.gameState = 'victory';
        this.victoryCondition = reason;
        this.victoryTime = Date.now();
        if (this.logger) this.logger.info(`🏆 Victory! Reason: ${reason}`);

        // Stop wave system when game ends
        if (this.enemyManager) {
            this.enemyManager.stopWaveSystem();
        }
    }

    /**
     * Reset game to initial state
     */
    reset() {
        this.gameState = 'playing';
        this.gameOverReason = null;
        this.victoryCondition = null;
        this.enemiesReachedGoal = 0;
        this.gameStartTime = Date.now();
        this.gameOverTime = null;
        this.victoryTime = null;
        if (this.logger) this.logger.info('🎮 Game reset to playing state');
    }

    /**
     * Pause/unpause game
     */
    setPaused(paused) {
        // Allow toggling between playing and paused states
        if (this.gameState === 'playing' || this.gameState === 'paused') {
            this.gameState = paused ? 'paused' : 'playing';
        }
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        if (this.gameState === 'playing') {
            this.setPaused(true);
        } else if (this.gameState === 'paused') {
            this.setPaused(false);
        }
    }

    /**
     * Get current game state information
     */
    getGameStateInfo() {
        return {
            gameState: this.gameState,
            gameOverReason: this.gameOverReason,
            victoryCondition: this.victoryCondition,
            enemiesReachedGoal: this.enemiesReachedGoal,
            maxEnemiesAllowed: this.maxEnemiesAllowed,
            gameStartTime: this.gameStartTime,
            gameOverTime: this.gameOverTime,
            victoryTime: this.victoryTime,
            gameDuration: this.getGameDuration()
        };
    }

    /**
     * Get game duration in milliseconds
     */
    getGameDuration() {
        const endTime = this.gameOverTime || this.victoryTime || Date.now();
        return endTime - this.gameStartTime;
    }

    /**
     * Check if game is in a terminal state (game over or victory)
     */
    isTerminalState() {
        return this.gameState === 'gameOver' || this.gameState === 'victory';
    }

    /**
     * Check if game is currently playing
     */
    isPlaying() {
        return this.gameState === 'playing';
    }

    /**
     * Check if game is paused
     */
    isPaused() {
        return this.gameState === 'paused';
    }

    /**
     * Get restart instructions for the player
     */
    getRestartInstructions() {
        if (this.gameState === 'gameOver') {
            return {
                title: 'Game Over!',
                message: `Too many enemies reached the goal! (${this.enemiesReachedGoal}/${this.maxEnemiesAllowed})`,
                buttonText: 'Try Again',
                buttonAction: 'restart'
            };
        } else if (this.gameState === 'victory') {
            return {
                title: 'Victory!',
                message: `Congratulations! You completed ${this.maxWaves} waves!`,
                buttonText: 'Play Again',
                buttonAction: 'restart'
            };
        }
        return null;
    }
}
