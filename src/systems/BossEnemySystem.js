/**
 * Boss Enemy System - Handles boss enemy behavior and special abilities
 */
class BossEnemySystem extends EnemySystem {
    constructor() {
        super();
        this.bossEnemies = []; // Track boss enemies separately
        this.bossEnemiesReachedGoalCount = 0; // Track boss enemies that reached goal
    }

    /**
     * Create a boss enemy with special abilities
     */
    createBossEnemy(type, startX, startY, path) {
        const bossEnemy = this.createEnemy(type, startX, startY, path);

        // Add boss-specific properties
        bossEnemy.isBoss = true;
        bossEnemy.bossType = type.bossType;
        bossEnemy.specialAbilities = { ...type.specialAbilities };
        bossEnemy.bossEffects = []; // Visual effects for boss abilities
        bossEnemy.abilityCooldowns = {}; // Track ability cooldowns
        bossEnemy.abilityStates = {}; // Track active ability states

        // Initialize ability states
        Object.keys(bossEnemy.specialAbilities).forEach(abilityName => {
            bossEnemy.abilityStates[abilityName] = {
                active: false,
                startTime: 0,
                duration: 0
            };
        });

        this.bossEnemies.push(bossEnemy);
        return bossEnemy;
    }

    /**
     * Update boss enemies with special abilities
     */
    updateBossEnemies(deltaTime) {
        // Only update if there are actually boss enemies
        if (this.bossEnemies.length === 0) {
            return;
        }

        // Temporarily replace the enemies array with boss enemies for parent update
        const originalEnemies = this.enemies;
        this.enemies = this.bossEnemies;

        // Call parent class update method for movement and animations
        this.update(deltaTime);

        // The parent update method will have incremented this.enemiesReachedGoalCount for boss enemies
        // Transfer this count to our separate boss counter
        const newBossGoals = this.enemiesReachedGoalCount - this.bossEnemiesReachedGoalCount;
        if (newBossGoals > 0) {
            this.bossEnemiesReachedGoalCount += newBossGoals;
            if (this.logger) {
                this.logger.info(`🎯 Boss enemy reached goal: ${newBossGoals} bosses - Total boss goals: ${this.bossEnemiesReachedGoalCount}`);
            }
        }

        // Restore original enemies array
        this.enemies = originalEnemies;

        // Update boss-specific abilities
        this.bossEnemies.forEach(boss => {
            if (boss.isAlive && !boss.reachedGoal) {
                this.updateBossAbilities(boss, deltaTime);
                this.updateBossEffects(boss, deltaTime);
            }
        });
    }

    /**
     * Update boss special abilities
     */
    updateBossAbilities(boss, deltaTime) {
        const currentTime = Date.now();

        switch (boss.bossType) {
            case 'shield':
                this.updateShieldAbility(boss, currentTime);
                break;
            case 'speed':
                this.updateSpeedAbility(boss, currentTime);
                break;
            case 'regenerate':
                this.updateRegenerationAbility(boss, currentTime);
                break;
            case 'split':
                // Split ability is handled on death, no active ability to update
                break;
        }
    }

    /**
     * Update shield boss ability
     */
    updateShieldAbility(boss, currentTime) {
        const shield = boss.specialAbilities.shield;
        const state = boss.abilityStates.shield;

        // Check if shield should activate (random chance every few seconds)
        if (!state.active && (currentTime - shield.lastUsed) > shield.cooldown) {
            const shouldActivate = Math.random() < 0.3; // 30% chance per check
            if (shouldActivate) {
                state.active = true;
                state.startTime = currentTime;
                state.duration = shield.duration;
                shield.lastUsed = currentTime;

                // Add shield visual effect
                boss.bossEffects.push({
                    type: 'shield',
                    startTime: currentTime,
                    duration: shield.duration,
                    radius: 40
                });

                if (this.logger) {
                    this.logger.info(`🛡️ Shield Boss activated shield ability`);
                }
            }
        }

        // Check if shield should deactivate
        if (state.active && (currentTime - state.startTime) > state.duration) {
            state.active = false;

            if (this.logger) {
                this.logger.info(`🛡️ Shield Boss shield expired`);
            }
        }
    }

    /**
     * Update speed boss ability
     */
    updateSpeedAbility(boss, currentTime) {
        const speedBoost = boss.specialAbilities.speedBoost;
        const state = boss.abilityStates.speedBoost;

        // Check if speed boost should activate
        if (!state.active && (currentTime - speedBoost.lastUsed) > speedBoost.cooldown) {
            const shouldActivate = Math.random() < 0.25; // 25% chance per check
            if (shouldActivate) {
                state.active = true;
                state.startTime = currentTime;
                state.duration = speedBoost.duration;
                speedBoost.lastUsed = currentTime;

                // Apply speed boost
                boss.currentSpeed = boss.speed * speedBoost.multiplier;

                // Add speed boost visual effect
                boss.bossEffects.push({
                    type: 'speedBoost',
                    startTime: currentTime,
                    duration: speedBoost.duration,
                    intensity: 1.0
                });

                if (this.logger) {
                    this.logger.info(`⚡ Speed Boss activated speed boost`);
                }
            }
        }

        // Check if speed boost should deactivate
        if (state.active && (currentTime - state.startTime) > state.duration) {
            state.active = false;
            boss.currentSpeed = boss.speed; // Reset to normal speed

            if (this.logger) {
                this.logger.info(`⚡ Speed Boss speed boost expired`);
            }
        }
    }

    /**
     * Update regeneration boss ability
     */
    updateRegenerationAbility(boss, currentTime) {
        const regen = boss.specialAbilities.regeneration;

        // Heal boss periodically
        if ((currentTime - regen.lastTick) > regen.interval) {
            if (boss.health < boss.maxHealth) {
                boss.health = Math.min(boss.maxHealth, boss.health + regen.rate);
                regen.lastTick = currentTime;

                // Add healing visual effect
                boss.bossEffects.push({
                    type: 'healing',
                    startTime: currentTime,
                    duration: 500,
                    amount: regen.rate
                });

                if (this.logger) {
                    this.logger.info(`💚 Regenerate Boss healed +${regen.rate} health (${boss.health}/${boss.maxHealth})`);
                }
            }
        }
    }

    /**
     * Update boss visual effects
     */
    updateBossEffects(boss, deltaTime) {
        boss.bossEffects = boss.bossEffects.filter(effect => {
            effect.age = (effect.age || 0) + deltaTime;
            return effect.age < effect.duration;
        });
    }

    /**
     * Handle boss death and special abilities
     */
    handleBossDeath(boss) {
        switch (boss.bossType) {
            case 'split':
                this.handleSplitBossDeath(boss);
                break;
        }

        // Remove from boss enemies list
        const index = this.bossEnemies.indexOf(boss);
        if (index > -1) {
            this.bossEnemies.splice(index, 1);
        }
    }

    /**
     * Handle split boss death - create smaller enemies
     */
    handleSplitBossDeath(boss) {
        const split = boss.specialAbilities.split;

        // Create split enemies at boss location
        for (let i = 0; i < split.splitCount; i++) {
            const angle = (i * Math.PI * 2) / split.splitCount;
            const offset = 30; // Distance from boss center

            const splitX = boss.x + Math.cos(angle) * offset;
            const splitY = boss.y + Math.sin(angle) * offset;

            // Create split enemy
            const splitEnemy = this.createEnemy(
                window.ENEMY_TYPES[split.splitType.toUpperCase()],
                splitX,
                splitY,
                boss.path
            );

            // Modify split enemy properties
            splitEnemy.health = split.splitHealth;
            splitEnemy.maxHealth = split.splitHealth;
            splitEnemy.reward = split.splitReward;
            splitEnemy.pathIndex = boss.pathIndex; // Continue from boss position

            if (this.logger) {
                this.logger.info(`⭐ Split Boss created ${split.splitCount} split enemies`);
            }
        }
    }

    /**
     * Check if enemy should take damage (considering shield)
     */
    shouldTakeDamage(enemy, damage) {
        if (enemy.isBoss && enemy.abilityStates.shield && enemy.abilityStates.shield.active) {
            // Shield is active - no damage taken
            return false;
        }
        return true;
    }

    /**
     * Get boss enemies for rendering
     */
    getBossEnemies() {
        return this.bossEnemies;
    }

    /**
     * Get boss enemy at specific screen position - with size-appropriate tolerance
     */
    getEnemyAtPosition(screenX, screenY) {
        const tileSize = 64; // Should match CONFIG.TILE_SIZE

        for (let enemy of this.bossEnemies) {
            if (!enemy.isAlive || enemy.reachedGoal) continue;

            // Convert enemy position to screen coordinates using grid system
            const enemyScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(enemy.x, enemy.y) : { x: enemy.x * tileSize, y: enemy.y * tileSize };
            const enemyScreenX = enemyScreenPos.x + tileSize / 2;
            const enemyScreenY = enemyScreenPos.y + tileSize / 2;

            // Calculate tolerance based on enemy size (boss enemies are larger)
            const baseTolerance = tileSize * 0.4; // Base tolerance for regular enemies
            const sizeMultiplier = enemy.size || 1.0; // Boss enemies have size 1.3, regular enemies have 0.8
            const tolerance = baseTolerance * sizeMultiplier;

            // Check if click is within enemy bounds
            const distance = Math.sqrt(
                Math.pow(screenX - enemyScreenX, 2) +
                Math.pow(screenY - enemyScreenY, 2)
            );

            if (distance <= tolerance) {
                return enemy;
            }
        }
        return null;
    }

    /**
     * Get count of boss enemies that reached the goal
     */
    getBossEnemiesReachedGoalCount() {
        return this.bossEnemiesReachedGoalCount;
    }

    /**
     * Clear all boss enemies (for wave transitions)
     */
    clearAllBossEnemies() {
        this.bossEnemies = [];
        // Keep bossEnemiesReachedGoalCount persistent across waves - lives should not reset
        if (this.logger) {
            this.logger.info('🗑️ All boss enemies cleared');
        }
    }

    /**
     * Reset the boss enemy system completely (for game restart)
     */
    reset() {
        this.bossEnemies = [];
        this.bossEnemiesReachedGoalCount = 0; // Reset goal counter only on full game restart
        if (this.logger) {
            this.logger.info('🔄 Boss enemy system reset');
        }
    }

    /**
     * Damage a boss enemy with visual feedback
     */
    damageBossEnemy(enemyId, damage) {
        const boss = this.bossEnemies.find(b => b.id === enemyId);
        if (boss && boss.isAlive) {
            boss.health -= damage;
            boss.lastDamageTime = Date.now();
            boss.isFlashing = true;

            // Start hit face animation (with timer to prevent overlap)
            this.startHitAnimation(boss);

            // Check if boss is dead
            if (boss.health <= 0) {
                boss.isAlive = false;
                boss.isDying = true;
                boss.deathTime = Date.now();

                // Play death sound
                if (this.audioManager) {
                    this.audioManager.playSound('enemy_death');
                }

                // Return coin reward
                return boss.reward || 10; // Default reward if not set
            }
        }
        return 0; // No coins earned
    }

    /**
     * Get all enemies including boss enemies
     */
    getAllEnemies() {
        return [...this.enemies, ...this.bossEnemies];
    }

    /**
     * Clean up dead boss enemies and bosses that reached the goal
     */
    cleanupDeadBossEnemies() {
        this.bossEnemies.forEach(boss => {
            if (!boss.isAlive && !boss.isDying) {
                this.handleBossDeath(boss);
            }
        });

        // Remove bosses that reached the goal (similar to regular enemy cleanup)
        this.bossEnemies = this.bossEnemies.filter(boss =>
            (boss.isAlive || boss.isDying) && !boss.reachedGoal
        );
    }

    /**
     * Set logger reference
     */
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Override parent cleanup to handle boss enemies
     */
    cleanupDeadEnemies() {
        // Call parent cleanup first
        super.cleanupDeadEnemies();

        // Clean up dead boss enemies
        this.cleanupDeadBossEnemies();
    }
}
