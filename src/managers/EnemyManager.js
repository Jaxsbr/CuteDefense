/**
 * Enemy Manager - Handles wave spawning and enemy management
 */
class EnemyManager {
    constructor(enemySystem, gridSystem) {
        this.enemySystem = enemySystem;
        this.gridSystem = gridSystem;

        // Wave state
        this.currentWave = 0;
        this.waveState = 'preparation'; // 'preparation', 'spawning', 'active', 'complete'
        this.waveStartTime = 0;
        this.lastSpawnTime = 0;
        this.enemiesToSpawn = [];
        this.enemiesSpawned = 0;
        this.totalEnemiesInWave = 0;

        // Wave configuration
        this.waveConfig = window.WAVE_CONFIG;
        this.enemyTypes = window.ENEMY_TYPES;

        // Game state
        this.isActive = false;
        this.waveAnnouncement = '';
        this.announcementTime = 0;
    }

    /**
     * Start the wave system
     */
    startWaveSystem() {
        this.isActive = true;
        this.currentWave = 0;
        this.startNextWave();
    }

    /**
     * Update the wave manager
     */
    update(deltaTime) {
        if (!this.isActive) return;

        const currentTime = Date.now();

        switch (this.waveState) {
            case 'preparation':
                this.updatePreparation(currentTime);
                break;
            case 'spawning':
                this.updateSpawning(currentTime);
                break;
            case 'active':
                this.updateActiveWave(currentTime);
                break;
            case 'complete':
                this.updateWaveComplete(currentTime);
                break;
        }
    }

    /**
     * Update preparation phase
     */
    updatePreparation(currentTime) {
        const elapsed = currentTime - this.waveStartTime;

        if (elapsed >= this.waveConfig.PREPARATION_TIME) {
            this.startSpawning();
        }
    }

    /**
     * Update spawning phase
     */
    updateSpawning(currentTime) {
        // Spawn enemies at intervals
        if (currentTime - this.lastSpawnTime >= this.waveConfig.SPAWN_INTERVAL) {
            this.spawnNextEnemy();
            this.lastSpawnTime = currentTime;
        }

        // Check if all enemies spawned
        if (this.enemiesSpawned >= this.totalEnemiesInWave) {
            this.waveState = 'active';
            this.waveAnnouncement = '';
        }
    }

    /**
     * Update active wave phase
     */
    updateActiveWave(currentTime) {
        const aliveEnemies = this.enemySystem.getAliveEnemies().length;

        if (aliveEnemies === 0) {
            this.waveState = 'complete';
            this.waveAnnouncement = `Wave ${this.currentWave} Complete!`;
            this.announcementTime = currentTime;
        }
    }

    /**
     * Update wave complete phase
     */
    updateWaveComplete(currentTime) {
        const elapsed = currentTime - this.announcementTime;

        // Show completion message for 3 seconds, then start next wave
        if (elapsed >= 3000) {
            this.startNextWave();
        }
    }

    /**
     * Start the next wave
     */
    startNextWave() {
        this.currentWave++;
        this.waveState = 'preparation';
        this.waveStartTime = Date.now();
        this.enemiesSpawned = 0;
        this.totalEnemiesInWave = 0;

        // Clear any remaining enemies
        this.enemySystem.clearAllEnemies();

        // Prepare wave pattern
        this.prepareWavePattern();

        // Set wave announcement
        this.waveAnnouncement = `Wave ${this.currentWave} Starting Soon!`;
        this.announcementTime = Date.now();
    }

    /**
     * Prepare the wave pattern
     */
    prepareWavePattern() {
        this.enemiesToSpawn = [];

        // Get wave pattern (repeat last pattern if we exceed defined waves)
        const waveIndex = Math.min(this.currentWave - 1, this.waveConfig.WAVE_PATTERNS.length - 1);
        const wavePattern = this.waveConfig.WAVE_PATTERNS[waveIndex];

        // Convert pattern to spawn queue
        wavePattern.enemies.forEach(enemyGroup => {
            for (let i = 0; i < enemyGroup.count; i++) {
                this.enemiesToSpawn.push({
                    type: this.enemyTypes[enemyGroup.type.toUpperCase()],
                    spawnTime: this.waveStartTime + this.waveConfig.PREPARATION_TIME + (this.enemiesToSpawn.length * this.waveConfig.SPAWN_INTERVAL)
                });
            }
        });

        this.totalEnemiesInWave = this.enemiesToSpawn.length;
    }

    /**
     * Start spawning enemies
     */
    startSpawning() {
        this.waveState = 'spawning';
        this.waveAnnouncement = `Wave ${this.currentWave} - Defend!`;
        this.announcementTime = Date.now();
        this.lastSpawnTime = Date.now();
    }

    /**
     * Spawn the next enemy in the queue
     */
    spawnNextEnemy() {
        if (this.enemiesSpawned < this.totalEnemiesInWave) {
            const enemyToSpawn = this.enemiesToSpawn[this.enemiesSpawned];

            // Get spawn position (first point of enemy path)
            const path = this.gridSystem.getEnemyPath();
            if (path.length > 0) {
                const spawnPoint = path[0];
                this.enemySystem.createEnemy(
                    enemyToSpawn.type,
                    spawnPoint.x,
                    spawnPoint.y,
                    path
                );

                this.enemiesSpawned++;
            }
        }
    }

    /**
     * Get current wave information
     */
    getWaveInfo() {
        return {
            currentWave: this.currentWave,
            waveState: this.waveState,
            enemiesAlive: this.enemySystem.getAliveEnemies().length,
            enemiesSpawned: this.enemiesSpawned,
            totalEnemies: this.totalEnemiesInWave,
            announcement: this.waveAnnouncement
        };
    }

    /**
     * Pause/resume wave system
     */
    setActive(active) {
        this.isActive = active;
    }

    /**
     * Get enemies that reached the goal (for game over detection)
     */
    getEnemiesReachedGoal() {
        return this.enemySystem.getEnemiesReachedGoal();
    }
}
