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
     * Update preparation phase with countdown
     */
    updatePreparation(currentTime) {
        const elapsed = currentTime - this.waveStartTime;
        const remaining = Math.ceil((this.waveConfig.PREPARATION_TIME - elapsed) / 1000);

        // Show simple countdown for most of preparation time
        if (remaining > 5) {
            this.waveAnnouncement = `Next Wave in: ${remaining}s`;
        }
        // Show dramatic countdown for last 5 seconds
        else if (remaining > 0) {
            this.waveAnnouncement = `🚨 WAVE ${this.currentWave} STARTS IN ${remaining}! 🚨`;
        }

        if (elapsed >= this.waveConfig.PREPARATION_TIME) {
            this.startSpawning();
        }
    }

    /**
     * Update spawning phase with dynamic spawn intervals
     */
    updateSpawning(currentTime) {
        // Calculate dynamic spawn interval based on wave number
        const scaling = this.waveConfig.DIFFICULTY_SCALING;
        const effectiveWaveNumber = Math.min(this.currentWave, scaling.MAX_SCALING_WAVES);
        const dynamicSpawnInterval = this.waveConfig.SPAWN_INTERVAL * Math.pow(scaling.WAVE_INTERVAL_REDUCTION, effectiveWaveNumber - 1);

        // Spawn enemies at dynamic intervals
        if (currentTime - this.lastSpawnTime >= dynamicSpawnInterval) {
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
     * Apply enhanced difficulty scaling to wave pattern
     */
    applyDifficultyScaling(basePattern) {
        const scaling = this.waveConfig.DIFFICULTY_SCALING;
        const waveNumber = this.currentWave;

        // Cap scaling to prevent impossible difficulty
        const effectiveWaveNumber = Math.min(waveNumber, scaling.MAX_SCALING_WAVES);

        // Check if this is a boss wave (every 5 waves)
        const isBossWave = waveNumber % 5 === 0;
        const bossMultiplier = isBossWave ? scaling.BOSS_WAVE_MULTIPLIER : 1.0;

        return {
            enemies: basePattern.enemies.map(enemyGroup => ({
                type: enemyGroup.type,
                count: Math.floor(enemyGroup.count * Math.pow(scaling.COUNT_MULTIPLIER, effectiveWaveNumber - 1) * bossMultiplier)
            }))
        };
    }

    /**
     * Create scaled enemy type with enhanced progressive difficulty
     */
    createScaledEnemyType(enemyTypeName) {
        const baseType = this.enemyTypes[enemyTypeName.toUpperCase()];
        const scaling = this.waveConfig.DIFFICULTY_SCALING;
        const waveNumber = this.currentWave;

        // Cap scaling to prevent impossible difficulty
        const effectiveWaveNumber = Math.min(waveNumber, scaling.MAX_SCALING_WAVES);

        // Check if this is a boss wave (every 5 waves)
        const isBossWave = waveNumber % 5 === 0;
        const bossMultiplier = isBossWave ? scaling.BOSS_WAVE_MULTIPLIER : 1.0;

        return {
            ...baseType,
            health: Math.floor(baseType.health * Math.pow(scaling.HEALTH_MULTIPLIER, effectiveWaveNumber - 1) * bossMultiplier),
            speed: baseType.speed * Math.pow(scaling.SPEED_MULTIPLIER, effectiveWaveNumber - 1),
            reward: Math.floor(baseType.reward * Math.pow(scaling.REWARD_MULTIPLIER, effectiveWaveNumber - 1) * bossMultiplier)
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
     * Create enhanced kid-friendly wave announcement
     */
    createWaveAnnouncement() {
        const totalEnemies = Object.values(this.waveComposition).reduce((sum, count) => sum + count, 0);
        const enemyTypes = Object.keys(this.waveComposition);
        const scaling = this.waveConfig.DIFFICULTY_SCALING;

        // Check if this is a boss wave
        const isBossWave = this.currentWave % 5 === 0;

        // Enhanced, exciting announcements for kids with more visual flair
        let announcement = '';

        if (isBossWave) {
            announcement = `💪 BOSS WAVE ${this.currentWave}! 💪\n⚡ ${totalEnemies} POWERFUL ENEMIES! ⚡\n🌟 GET READY FOR THE ULTIMATE BATTLE! 🌟`;
        } else if (this.currentWave === 1) {
            announcement = `🎯 WAVE ${this.currentWave} INCOMING! 🎯\n⚡ ${totalEnemies} ENEMIES APPROACHING! ⚡\n🚀 LET'S DEFEND OUR BASE! 🚀`;
        } else if (this.currentWave <= 3) {
            announcement = `🎯 WAVE ${this.currentWave} INCOMING! 🎯\n⚡ ${totalEnemies} ENEMIES APPROACHING! ⚡\n🛡️ TIME TO BUILD YOUR DEFENSES! 🛡️`;
        } else if (this.currentWave <= 6) {
            announcement = `🔥 WAVE ${this.currentWave} - GETTING TOUGH! 🔥\n⚡ ${totalEnemies} ENEMIES APPROACHING! ⚡\n💎 SHOW THEM YOUR POWER! 💎`;
        } else {
            announcement = `🚨 WAVE ${this.currentWave} - ULTIMATE CHALLENGE! 🚨\n⚡ ${totalEnemies} ENEMIES APPROACHING! ⚡\n👑 PROVE YOU'RE THE CHAMPION! 👑`;
        }

        return announcement;
    }

    /**
     * Start spawning enemies
     */
    startSpawning() {
        this.waveState = 'spawning';
        this.waveAnnouncement = ''; // No announcement during spawning
        this.announcementTime = Date.now(); // Set time for fade-out transition
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
