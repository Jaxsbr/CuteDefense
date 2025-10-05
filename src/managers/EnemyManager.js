/**
 * Enemy Manager - Handles wave spawning and enemy management
 */
class EnemyManager {
    constructor(enemySystem, gridSystem) {
        this.enemySystem = enemySystem;
        this.gridSystem = gridSystem;
        this.audioManager = null; // Audio manager reference
        this.bossEnemySystem = new BossEnemySystem(); // Boss enemy system

        // Wave state
        this.currentWave = 0;
        this.waveState = 'preparation'; // 'preparation', 'spawning', 'active', 'complete'
        this.waveStartTime = 0;
        this.lastSpawnTime = 0;
        this.enemiesToSpawn = [];
        this.enemiesSpawned = 0;
        this.totalEnemiesInWave = 0;
        this.lastCountdownSecond = 0; // Track countdown for thud sounds

        // Wave configuration
        this.waveConfig = window.WAVE_CONFIG;
        this.enemyTypes = window.ENEMY_TYPES;

        // Game state
        this.isActive = false;
        this.waveAnnouncement = '';
        this.announcementTime = 0;
        this.bossAnnouncementShown = false;
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
     * Stop the wave system
     */
    stopWaveSystem() {
        this.isActive = false;
        if (this.logger) this.logger.info('🛑 Wave system stopped');
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

        // Update boss enemies
        this.bossEnemySystem.updateBossEnemies(deltaTime);
    }

    /**
     * Update preparation phase with countdown
     */
    updatePreparation(currentTime) {
        const elapsed = currentTime - this.waveStartTime;
        const remaining = Math.ceil((this.waveConfig.PREPARATION_TIME - elapsed) / 1000);

        // Show simple countdown for most of preparation time
        if (remaining > 5) {
            const isBossWave = this.currentWave % 5 === 0;
            const countdownText = remaining.toString().padStart(2, '0');

            if (isBossWave) {
                this.waveAnnouncement = `BOSS in: ${countdownText}`;
            } else {
                this.waveAnnouncement = `Next in: ${countdownText}`;
            }
        }
        // Show dramatic countdown for last 5 seconds
        else if (remaining > 0) {
            const isBossWave = this.currentWave % 5 === 0;
            const countdownText = remaining.toString().padStart(2, '0');

            if (isBossWave) {
                this.waveAnnouncement = `BOSS in: ${countdownText}`;
            } else {
                this.waveAnnouncement = `Next in: ${countdownText}`;
            }

            // Play countdown thud for last 5 seconds
            if (remaining <= 5 && remaining !== this.lastCountdownSecond) {
                this.lastCountdownSecond = remaining;
                if (this.audioManager) {
                    this.audioManager.playSound('countdown_thud');
                }
            }
        }

        if (elapsed >= this.waveConfig.PREPARATION_TIME) {
            // Play wave start sound
            if (this.audioManager) {
                this.audioManager.playSound('wave_start');
                // Stop background music during waves (silent combat)
                this.audioManager.startWaveMusic();
            }
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
        // Check both regular enemies and boss enemies
        const aliveRegularEnemies = this.enemySystem.getAliveEnemies().length;
        const aliveBossEnemies = this.bossEnemySystem.getBossEnemies().filter(boss => boss.isAlive && !boss.reachedGoal).length;
        const totalAliveEnemies = aliveRegularEnemies + aliveBossEnemies;

        if (totalAliveEnemies === 0) {
            this.waveState = 'complete';
            this.waveAnnouncement = `Wave ${this.currentWave} Complete!`;
            this.announcementTime = currentTime;
            // Play wave completion sound
            if (this.audioManager) {
                this.audioManager.playSound('wave_complete');
            }
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

        // Clear any remaining enemies (both regular and boss)
        this.enemySystem.clearAllEnemies();
        this.bossEnemySystem.clearAllBossEnemies();

        // Prepare wave pattern
        this.prepareWavePattern();

        // Resume background music for preparation phase
        if (this.audioManager) {
            this.audioManager.startPreparationMusic();
        }

        // Reset countdown tracker for new wave
        this.lastCountdownSecond = 0;
        this.bossAnnouncementShown = false;

        // Don't set initial announcement here - let updatePreparation() handle it
        // This prevents the flash of the initial announcement before countdown
        this.waveAnnouncement = '';
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

        // Convert pattern to spawn queue with formation support
        scaledWavePattern.enemies.forEach(enemyGroup => {
            const formation = enemyGroup.formation || 'single';
            const baseSpawnTime = this.waveStartTime + this.waveConfig.PREPARATION_TIME + (this.enemiesToSpawn.length * this.waveConfig.SPAWN_INTERVAL);

            // Create formation spawn pattern
            const formationSpawns = this.createFormationSpawns(enemyGroup, baseSpawnTime);
            this.enemiesToSpawn.push(...formationSpawns);
        });

        this.totalEnemiesInWave = this.enemiesToSpawn.length;

        // Store wave composition for enhanced announcements
        this.waveComposition = this.getWaveComposition(scaledWavePattern);
    }

    /**
     * Create formation spawn patterns for enemy groups
     */
    createFormationSpawns(enemyGroup, baseSpawnTime) {
        const formation = enemyGroup.formation || 'single';
        const count = enemyGroup.count;
        const enemyType = this.createScaledEnemyType(enemyGroup.type);
        const spawns = [];

        switch (formation) {
            case 'single':
                // Spawn enemies individually with normal intervals
                for (let i = 0; i < count; i++) {
                    spawns.push({
                        type: enemyType,
                        spawnTime: baseSpawnTime + (i * this.waveConfig.SPAWN_INTERVAL),
                        formation: 'single'
                    });
                }
                break;

            case 'line':
                // Spawn enemies in a line formation (close together)
                for (let i = 0; i < count; i++) {
                    spawns.push({
                        type: enemyType,
                        spawnTime: baseSpawnTime + (i * 200), // 200ms between each enemy in line
                        formation: 'line',
                        formationIndex: i
                    });
                }
                break;

            case 'wedge':
                // Spawn enemies in a wedge formation (V-shape)
                for (let i = 0; i < count; i++) {
                    spawns.push({
                        type: enemyType,
                        spawnTime: baseSpawnTime + (i * 300), // 300ms between each enemy in wedge
                        formation: 'wedge',
                        formationIndex: i
                    });
                }
                break;

            case 'phalanx':
                // Spawn enemies in a tight phalanx formation
                for (let i = 0; i < count; i++) {
                    spawns.push({
                        type: enemyType,
                        spawnTime: baseSpawnTime + (i * 150), // 150ms between each enemy in phalanx
                        formation: 'phalanx',
                        formationIndex: i
                    });
                }
                break;

            case 'swarm':
                // Spawn enemies in a swarm (very close together)
                for (let i = 0; i < count; i++) {
                    spawns.push({
                        type: enemyType,
                        spawnTime: baseSpawnTime + (i * 100), // 100ms between each enemy in swarm
                        formation: 'swarm',
                        formationIndex: i
                    });
                }
                break;

            default:
                // Fallback to single formation
                for (let i = 0; i < count; i++) {
                    spawns.push({
                        type: enemyType,
                        spawnTime: baseSpawnTime + (i * this.waveConfig.SPAWN_INTERVAL),
                        formation: 'single'
                    });
                }
        }

        return spawns;
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

        // Apply progressive coin scaling from the start to prevent too much money
        let rewardMultiplier = Math.pow(scaling.REWARD_MULTIPLIER, effectiveWaveNumber - 1) * bossMultiplier;
        // Reduce coin rewards progressively from wave 1 to prevent economic snowballing
        const coinReduction = Math.pow(0.95, waveNumber - 1); // 5% reduction per wave
        rewardMultiplier *= coinReduction;

        return {
            ...baseType,
            health: Math.floor(baseType.health * Math.pow(scaling.HEALTH_MULTIPLIER, effectiveWaveNumber - 1) * bossMultiplier),
            speed: baseType.speed * Math.pow(scaling.SPEED_MULTIPLIER, effectiveWaveNumber - 1),
            reward: Math.floor(baseType.reward * rewardMultiplier)
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
            announcement = `BOSS WAVE ${this.currentWave}!\n${totalEnemies} POWERFUL ENEMIES!\nGET READY FOR THE ULTIMATE BATTLE!`;
        } else if (this.currentWave === 1) {
            announcement = `WAVE ${this.currentWave} INCOMING!\n${totalEnemies} ENEMIES APPROACHING!\nLET'S DEFEND OUR BASE!`;
        } else if (this.currentWave <= 3) {
            announcement = `WAVE ${this.currentWave} INCOMING!\n${totalEnemies} ENEMIES APPROACHING!\nTIME TO BUILD YOUR DEFENSES!`;
        } else if (this.currentWave <= 6) {
            announcement = `WAVE ${this.currentWave} - GETTING TOUGH!\n${totalEnemies} ENEMIES APPROACHING!\nSHOW THEM YOUR POWER!`;
        } else {
            announcement = `WAVE ${this.currentWave} - ULTIMATE CHALLENGE!\n${totalEnemies} ENEMIES APPROACHING!\nPROVE YOU'RE THE CHAMPION!`;
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
     * Set audio manager reference
     */
    setAudioManager(audioManager) {
        this.audioManager = audioManager;
        // Set audio manager for boss enemy system
        this.bossEnemySystem.audioManager = audioManager;
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

                // Create enemy with formation data (check if it's a boss)
                let enemy;
                if (enemyToSpawn.type.isBoss) {
                    // Create boss enemy
                    enemy = this.bossEnemySystem.createBossEnemy(
                        enemyToSpawn.type,
                        spawnPoint.x,
                        spawnPoint.y,
                        path
                    );

                    if (this.logger) {
                        this.logger.info(`👑 Spawning ${enemyToSpawn.type.name} (Boss Wave ${this.currentWave})`);
                    }
                } else {
                    // Create regular enemy
                    enemy = this.enemySystem.createEnemy(
                        enemyToSpawn.type,
                        spawnPoint.x,
                        spawnPoint.y,
                        path
                    );
                }

                // Add formation behavior to enemy
                if (enemyToSpawn.formation && enemyToSpawn.formation !== 'single') {
                    this.addFormationBehavior(enemy, enemyToSpawn.formation, enemyToSpawn.formationIndex);
                }

                // Play enemy spawn sound
                if (this.audioManager) {
                    this.audioManager.playSound('enemy_spawn');
                }

                this.enemiesSpawned++;
            }
        }
    }

    /**
     * Add formation behavior to an enemy
     */
    addFormationBehavior(enemy, formation, formationIndex) {
        // Add formation properties to enemy
        enemy.formation = formation;
        enemy.formationIndex = formationIndex;
        enemy.formationOffset = this.calculateFormationOffset(formation, formationIndex);

        // Add formation-specific behaviors
        switch (formation) {
            case 'line':
                enemy.formationSpeed = enemy.speed * 0.9; // Slightly slower in formation
                enemy.formationCohesion = 0.8; // How much they stick together
                break;
            case 'wedge':
                enemy.formationSpeed = enemy.speed * 0.85; // Slower in wedge
                enemy.formationCohesion = 0.9; // High cohesion for wedge
                break;
            case 'phalanx':
                enemy.formationSpeed = enemy.speed * 0.8; // Slower in phalanx
                enemy.formationCohesion = 0.95; // Very high cohesion
                break;
            case 'swarm':
                enemy.formationSpeed = enemy.speed * 1.1; // Faster in swarm
                enemy.formationCohesion = 0.7; // Lower cohesion for swarm
                break;
        }
    }

    /**
     * Calculate formation offset for enemy positioning
     */
    calculateFormationOffset(formation, formationIndex) {
        const tileSize = 64; // Grid tile size
        const spacing = 16; // Spacing between enemies in formation

        switch (formation) {
            case 'line':
                return { x: formationIndex * spacing, y: 0 };
            case 'wedge':
                const wedgeOffset = (formationIndex - Math.floor(formationIndex / 2)) * spacing;
                return { x: wedgeOffset, y: formationIndex * 8 };
            case 'phalanx':
                const phalanxX = (formationIndex % 3) * spacing;
                const phalanxY = Math.floor(formationIndex / 3) * spacing;
                return { x: phalanxX, y: phalanxY };
            case 'swarm':
                const angle = (formationIndex * 2 * Math.PI) / 8; // 8 enemies per swarm
                const radius = 12;
                return {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius
                };
            default:
                return { x: 0, y: 0 };
        }
    }

    /**
     * Skip to next wave (debug feature)
     */
    skipToNextWave() {
        if (!this.isActive) return;

        // Clear all current enemies (both regular and boss)
        this.enemySystem.clearAllEnemies();
        this.bossEnemySystem.clearAllBossEnemies();

        // Reset wave state
        this.waveState = 'complete';
        this.waveAnnouncement = `Wave ${this.currentWave} Complete! (Skipped)`;
        this.announcementTime = Date.now();

        // Force immediate transition to next wave
        setTimeout(() => {
            this.startNextWave();
        }, 1000); // Brief delay to show the "skipped" message

        if (this.logger) {
            this.logger.info(`🚀 Debug: Skipped to next wave (${this.currentWave + 1})`);
        }
    }

    /**
     * Get current wave information
     */
    getWaveInfo() {
        const aliveRegularEnemies = this.enemySystem.getAliveEnemies().length;
        const aliveBossEnemies = this.bossEnemySystem.getBossEnemies().filter(boss => boss.isAlive && !boss.reachedGoal).length;

        return {
            currentWave: this.currentWave,
            waveState: this.waveState,
            enemiesAlive: aliveRegularEnemies + aliveBossEnemies,
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
        // Count regular enemies that reached the goal (each counts as 1 life)
        const regularEnemiesReached = this.enemySystem.getEnemiesReachedGoalCount();

        // Count boss enemies that reached the goal (each counts as multiple lives based on wave)
        const bossEnemiesReached = this.bossEnemySystem.getBossEnemiesReachedGoalCount();
        let bossLivesLost = 0;


        // Calculate lives lost from boss enemies based on current wave
        if (bossEnemiesReached > 0) {
            // Boss waves are every 5th wave: 5, 10, 15
            // Wave 5 boss = 3 lives, Wave 10 boss = 4 lives, Wave 15 boss = 5 lives
            if (this.currentWave >= 15) {
                bossLivesLost = bossEnemiesReached * 5; // Wave 15+ boss = 5 lives each
            } else if (this.currentWave >= 10) {
                bossLivesLost = bossEnemiesReached * 4; // Wave 10+ boss = 4 lives each
            } else if (this.currentWave >= 5) {
                bossLivesLost = bossEnemiesReached * 3; // Wave 5+ boss = 3 lives each
            }

            // Debug logging for boss lives calculation
            if (this.logger) {
                this.logger.info(`🎯 Boss lives calculation: Wave ${this.currentWave}, ${bossEnemiesReached} bosses reached, ${bossLivesLost} lives lost`);
            }
        }

        return regularEnemiesReached + bossLivesLost;
    }

    /**
     * Get damage indicators for rendering
     */
    getDamageIndicatorsForRendering() {
        return this.enemySystem.getDamageIndicatorsForRendering();
    }
}
