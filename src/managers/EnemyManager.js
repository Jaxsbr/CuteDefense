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

        // Set enhanced wave announcement with enemy composition
        this.waveAnnouncement = this.createWaveAnnouncement();
        this.announcementTime = Date.now();
    }

    /**
     * Prepare the wave pattern with progressive difficulty scaling
     */
    prepareWavePattern() {
        this.enemiesToSpawn = [];

        // Get base wave pattern (repeat last pattern if we exceed defined waves)
        const waveIndex = Math.min(this.currentWave - 1, this.waveConfig.BASE_WAVE_PATTERNS.length - 1);
        const baseWavePattern = this.waveConfig.BASE_WAVE_PATTERNS[waveIndex];

        // Apply difficulty scaling
        const scaledWavePattern = this.applyDifficultyScaling(baseWavePattern);

        // Convert pattern to spawn queue
        scaledWavePattern.enemies.forEach(enemyGroup => {
            for (let i = 0; i < enemyGroup.count; i++) {
                this.enemiesToSpawn.push({
                    type: this.createScaledEnemyType(enemyGroup.type),
                    spawnTime: this.waveStartTime + this.waveConfig.PREPARATION_TIME + (this.enemiesToSpawn.length * this.waveConfig.SPAWN_INTERVAL)
                });
            }
        });

        this.totalEnemiesInWave = this.enemiesToSpawn.length;
        
        // Store wave composition for enhanced announcements
        this.waveComposition = this.getWaveComposition(scaledWavePattern);
    }

    /**
     * Apply difficulty scaling to wave pattern
     */
    applyDifficultyScaling(basePattern) {
        const scaling = this.waveConfig.DIFFICULTY_SCALING;
        const waveNumber = this.currentWave;
        
        return {
            enemies: basePattern.enemies.map(enemyGroup => ({
                type: enemyGroup.type,
                count: Math.floor(enemyGroup.count * Math.pow(scaling.COUNT_MULTIPLIER, waveNumber - 1))
            }))
        };
    }

    /**
     * Create scaled enemy type with progressive difficulty
     */
    createScaledEnemyType(enemyTypeName) {
        const baseType = this.enemyTypes[enemyTypeName.toUpperCase()];
        const scaling = this.waveConfig.DIFFICULTY_SCALING;
        const waveNumber = this.currentWave;
        
        return {
            ...baseType,
            health: Math.floor(baseType.health * Math.pow(scaling.HEALTH_MULTIPLIER, waveNumber - 1)),
            speed: baseType.speed * Math.pow(scaling.SPEED_MULTIPLIER, waveNumber - 1),
            reward: Math.floor(baseType.reward * Math.pow(scaling.REWARD_MULTIPLIER, waveNumber - 1))
        };
    }

    /**
     * Get wave composition for enhanced announcements
     */
    getWaveComposition(wavePattern) {
        const composition = {};
        wavePattern.enemies.forEach(enemyGroup => {
            const enemyType = this.enemyTypes[enemyGroup.type.toUpperCase()];
            if (!composition[enemyType.name]) {
                composition[enemyType.name] = 0;
            }
            composition[enemyType.name] += enemyGroup.count;
        });
        return composition;
    }

    /**
     * Create enhanced wave announcement with enemy composition
     */
    createWaveAnnouncement() {
        const enemyTypes = Object.keys(this.waveComposition);
        const totalEnemies = Object.values(this.waveComposition).reduce((sum, count) => sum + count, 0);
        
        let announcement = `Wave ${this.currentWave} - ${totalEnemies} Enemies Incoming!`;
        
        if (enemyTypes.length > 1) {
            const enemyList = enemyTypes.map(type => `${this.waveComposition[type]}x ${type}`).join(', ');
            announcement += `\n${enemyList}`;
        }
        
        return announcement;
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
