/**
 * Boss Enemy System - Handles boss enemy behavior and special abilities
 */
class BossEnemySystem extends EnemySystem {
    constructor() {
        super();
        this.bossEnemies = []; // Track boss enemies separately
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
     * Get all enemies including boss enemies
     */
    getAllEnemies() {
        return [...this.enemies, ...this.bossEnemies];
    }

    /**
     * Clean up dead boss enemies
     */
    cleanupDeadBossEnemies() {
        this.bossEnemies.forEach(boss => {
            if (!boss.isAlive && !boss.isDying) {
                this.handleBossDeath(boss);
            }
        });
    }
}
