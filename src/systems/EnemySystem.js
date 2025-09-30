/**
 * Enemy System - Manages individual enemy behavior and movement
 */
class EnemySystem {
    constructor() {
        this.enemies = [];
        this.removedEnemies = [];
        this.audioManager = null; // Audio manager reference
    }

    /**
     * Create a new enemy instance
     */
    createEnemy(type, startX, startY, path) {
        const enemy = {
            id: Date.now() + Math.random(), // Unique ID
            type: type,
            x: startX,
            y: startY,
            path: [...path], // Copy of path
            pathIndex: 0,
            progress: 0, // Progress along current path segment (0-1)
            health: type.health,
            maxHealth: type.health,
            speed: type.speed,
            color: type.color,
            size: type.size,
            reward: type.reward,
            isAlive: true,
            reachedGoal: false,
            // Animation and visual enhancements
            animationTime: 0, // For animation effects
            lastDamageTime: 0, // For damage flash effect
            isFlashing: false, // Damage flash state
            movementSmoothing: 0.1, // Smoothing factor for movement
            targetX: startX, // Target position for smooth movement
            targetY: startY, // Target position for smooth movement
            // Enhanced visual effects
            damageIndicators: [], // Floating damage numbers
            deathAnimation: null, // Death animation state
            isDying: false, // Death animation flag
            visualEffects: [], // General visual effects array
            spawnAnimation: { // Spawn animation with circle ripples
                active: true,
                time: 0,
                duration: 0.8,
                maxRadius: 40,
                alpha: 1.0
            },
            // Visual properties from type
            shape: type.shape || 'circle',
            borderColor: type.borderColor || type.color,
            borderWidth: type.borderWidth || 2,
            glowColor: type.glowColor || type.color,
            animationSpeed: type.animationSpeed || 1.0
        };

        this.enemies.push(enemy);
        return enemy;
    }

    /**
     * Update all enemies
     */
    update(deltaTime) {
        this.enemies.forEach(enemy => {
            if (enemy.isAlive && !enemy.reachedGoal) {
                this.updateEnemyMovement(enemy, deltaTime);
                this.updateEnemyAnimations(enemy, deltaTime);
                this.updateEnemyEffects(enemy, deltaTime);
            }
        });

        // Remove dead enemies
        this.cleanupDeadEnemies();
    }

    /**
     * Update individual enemy movement along path with improved smoothing
     */
    updateEnemyMovement(enemy, deltaTime) {
        if (enemy.pathIndex >= enemy.path.length - 1) {
            // Reached the end of the path
            enemy.reachedGoal = true;
            // Play enemy reach end sound
            if (this.audioManager) {
                this.audioManager.playSound('enemy_reach_end');
            }
            // Start end reached animation
            this.startEndReachedAnimation(enemy);
            return;
        }

        // Calculate movement for this frame
        const movement = enemy.speed * deltaTime / 1000; // Convert to tiles
        enemy.progress += movement;

        // Check if we've moved to the next path segment
        if (enemy.progress >= 1.0) {
            enemy.pathIndex++;
            enemy.progress = 0;

            // Update enemy position to next path point
            if (enemy.pathIndex < enemy.path.length) {
                const nextPoint = enemy.path[enemy.pathIndex];
                enemy.targetX = nextPoint.x;
                enemy.targetY = nextPoint.y;
            }
        } else {
            // Interpolate position between current and next path points
            if (enemy.pathIndex < enemy.path.length - 1) {
                const currentPoint = enemy.path[enemy.pathIndex];
                const nextPoint = enemy.path[enemy.pathIndex + 1];

                enemy.targetX = currentPoint.x + (nextPoint.x - currentPoint.x) * enemy.progress;
                enemy.targetY = currentPoint.y + (nextPoint.y - currentPoint.y) * enemy.progress;
            }
        }

        // Apply smooth movement interpolation
        const smoothingFactor = enemy.movementSmoothing * deltaTime / 16.67; // Normalize to 60fps
        enemy.x += (enemy.targetX - enemy.x) * smoothingFactor;
        enemy.y += (enemy.targetY - enemy.y) * smoothingFactor;
    }

    /**
     * Update enemy animations
     */
    updateEnemyAnimations(enemy, deltaTime) {
        // Update animation time
        enemy.animationTime += deltaTime * enemy.animationSpeed;

        // Keep animation time within reasonable bounds
        if (enemy.animationTime > 10000) {
            enemy.animationTime = 0;
        }
    }

    /**
     * Update enemy visual effects
     */
    updateEnemyEffects(enemy, deltaTime) {
        const currentTime = Date.now();

        // Handle damage flash effect
        if (enemy.isFlashing) {
            const flashDuration = 200; // 200ms flash
            if (currentTime - enemy.lastDamageTime > flashDuration) {
                enemy.isFlashing = false;
            }
        }
    }

    /**
     * Set audio manager reference
     */
    setAudioManager(audioManager) {
        this.audioManager = audioManager;
    }

    /**
     * Damage an enemy with visual feedback
     */
    damageEnemy(enemyId, damage) {
        const enemy = this.enemies.find(e => e.id === enemyId);
        if (enemy && enemy.isAlive) {
            enemy.health -= damage;
            enemy.lastDamageTime = Date.now();
            enemy.isFlashing = true;

            if (enemy.health <= 0) {
                enemy.isAlive = false;
                // Play enemy death sound
                if (this.audioManager) {
                    this.audioManager.playSound('enemy_death');
                }
                return enemy.reward; // Return coins earned
            }
        }
        return 0;
    }

    /**
     * Get all alive enemies
     */
    getAliveEnemies() {
        return this.enemies.filter(enemy => enemy.isAlive && !enemy.reachedGoal);
    }

    /**
     * Get all enemies that reached the goal
     */
    getEnemiesReachedGoal() {
        return this.enemies.filter(enemy => enemy.reachedGoal);
    }

    /**
     * Remove dead enemies from the system
     */
    cleanupDeadEnemies() {
        this.removedEnemies = this.enemies.filter(enemy => !enemy.isAlive || enemy.reachedGoal);
        this.enemies = this.enemies.filter(enemy => enemy.isAlive && !enemy.reachedGoal);
    }

    /**
     * Get total enemies count
     */
    getEnemyCount() {
        return this.enemies.length;
    }

    /**
     * Clear all enemies (for wave reset)
     */
    clearAllEnemies() {
        this.enemies = [];
        this.removedEnemies = [];
    }

    /**
     * Get enemies for rendering
     */
    getEnemiesForRendering() {
        return this.enemies;
    }

    /**
     * Get enemy at specific screen position
     */
    getEnemyAtPosition(screenX, screenY) {
        const tileSize = 64; // Should match CONFIG.TILE_SIZE
        const tolerance = tileSize * 0.4; // 40% of tile size for click tolerance

        for (let enemy of this.enemies) {
            if (!enemy.isAlive || enemy.reachedGoal) continue;

            // Convert enemy position to screen coordinates
            const enemyScreenX = enemy.x * tileSize + tileSize / 2;
            const enemyScreenY = enemy.y * tileSize + tileSize / 2;

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
     * Add damage indicator to enemy
     */
    addDamageIndicator(enemy, damage) {
        const indicator = {
            x: enemy.x,
            y: enemy.y - 20,
            text: `-${damage}`,
            life: 1.0,
            maxLife: 1.0,
            velocityY: -30,
            color: '#FF4444',
            size: 16,
            alpha: 1.0
        };

        if (!enemy.damageIndicators) {
            enemy.damageIndicators = [];
        }
        enemy.damageIndicators.push(indicator);
    }

    /**
     * Start death animation for enemy
     */
    startDeathAnimation(enemy) {
        enemy.isDying = true;
        enemy.deathAnimation = {
            time: 0,
            duration: 0.5,
            scale: 1.0,
            rotation: 0,
            alpha: 1.0
        };
    }

    /**
     * Start end reached animation for enemy
     */
    startEndReachedAnimation(enemy) {
        enemy.endReachedAnimation = {
            active: true,
            time: 0,
            duration: 1.0,
            maxRadius: 60,
            alpha: 1.0
        };
    }

    /**
     * Update enemy visual effects
     */
    updateEnemyVisualEffects(enemy, deltaTime) {
        // Update spawn animation
        if (enemy.spawnAnimation && enemy.spawnAnimation.active) {
            enemy.spawnAnimation.time += deltaTime;
            const progress = enemy.spawnAnimation.time / enemy.spawnAnimation.duration;

            if (progress >= 1) {
                enemy.spawnAnimation.active = false;
            } else {
                enemy.spawnAnimation.alpha = 1 - progress;
            }
        }

        // Update damage indicators
        if (enemy.damageIndicators) {
            for (let i = enemy.damageIndicators.length - 1; i >= 0; i--) {
                const indicator = enemy.damageIndicators[i];
                indicator.life -= deltaTime * 2;
                indicator.y += indicator.velocityY * deltaTime;
                indicator.velocityY += 50 * deltaTime; // Gravity
                indicator.alpha = indicator.life;

                if (indicator.life <= 0) {
                    enemy.damageIndicators.splice(i, 1);
                }
            }
        }

        // Update death animation
        if (enemy.deathAnimation) {
            enemy.deathAnimation.time += deltaTime;
            const progress = enemy.deathAnimation.time / enemy.deathAnimation.duration;

            if (progress >= 1) {
                enemy.isAlive = false;
            } else {
                enemy.deathAnimation.scale = 1 - progress * 0.5;
                enemy.deathAnimation.rotation = progress * Math.PI * 2;
                enemy.deathAnimation.alpha = 1 - progress;
            }
        }

        // Update end reached animation
        if (enemy.endReachedAnimation && enemy.endReachedAnimation.active) {
            enemy.endReachedAnimation.time += deltaTime;
            const progress = enemy.endReachedAnimation.time / enemy.endReachedAnimation.duration;

            if (progress >= 1) {
                enemy.endReachedAnimation.active = false;
            } else {
                enemy.endReachedAnimation.alpha = 1 - progress;
            }
        }
    }

    /**
     * Get damage indicators for rendering
     */
    getDamageIndicatorsForRendering() {
        const indicators = [];
        this.enemies.forEach(enemy => {
            if (enemy.damageIndicators) {
                indicators.push(...enemy.damageIndicators);
            }
        });
        return indicators;
    }
}
