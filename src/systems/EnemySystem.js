/**
 * Enemy System - Manages individual enemy behavior and movement
 */
class EnemySystem {
    constructor() {
        this.enemies = [];
        this.removedEnemies = [];
        this.enemiesReachedGoalCount = 0; // Persistent counter for enemies that reached goal
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

        // Update hit animations for all enemies (alive and dead)
        this.updateHitAnimations(deltaTime);

        // Update visual effects for all enemies (including death animations)
        this.enemies.forEach(enemy => {
            this.updateEnemyVisualEffects(enemy, deltaTime);
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
            if (!enemy.reachedGoal) {
                enemy.reachedGoal = true;
                this.enemiesReachedGoalCount++; // Increment persistent counter
                // Play enemy reach end sound
                if (this.audioManager) {
                    this.audioManager.playSound('enemy_reach_end');
                }
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

            // Start hit face animation (with timer to prevent overlap)
            this.startHitAnimation(enemy);

            if (enemy.health <= 0) {
                enemy.isAlive = false;
                // Play enemy death sound with enhanced volume
                if (this.audioManager) {
                    console.log('🔊 Attempting to play enemy_death sound');
                    this.audioManager.playSound('enemy_death');
                } else {
                    console.log('❌ No audioManager available for death sound');
                }
                // Start dramatic death animation
                this.startDramaticDeathAnimation(enemy);
                console.log('🎆 Death animation started for enemy with', enemy.deathAnimation.sparkleCount, 'particles');
                console.log('🎆 Enemy death animation object:', enemy.deathAnimation);
                console.log('🎆 Enemy isDying:', enemy.isDying);
                return enemy.reward; // Return coins earned
            }
        }
        return 0;
    }

    /**
     * Start hit face animation for enemy
     */
    startHitAnimation(enemy) {
        // Only start new animation if none is active or if current one is almost done
        if (!enemy.hitAnimation || enemy.hitAnimation.progress > 0.8) {
            enemy.hitAnimation = {
                active: true,
                duration: 300, // 300ms animation
                elapsed: 0,
                progress: 0
            };
        }
    }

    /**
     * Update hit animations for all enemies
     */
    updateHitAnimations(deltaTime) {
        this.enemies.forEach(enemy => {
            if (enemy.hitAnimation && enemy.hitAnimation.active) {
                enemy.hitAnimation.elapsed += deltaTime;
                enemy.hitAnimation.progress = Math.min(enemy.hitAnimation.elapsed / enemy.hitAnimation.duration, 1.0);

                // End animation when complete
                if (enemy.hitAnimation.progress >= 1.0) {
                    enemy.hitAnimation.active = false;
                }
            }
        });
    }

    /**
     * Get all alive enemies
     */
    getAliveEnemies() {
        return this.enemies.filter(enemy => enemy.isAlive && !enemy.reachedGoal);
    }

    /**
     * Get all enemies that reached the goal
     * Returns array with length equal to the count for compatibility
     */
    getEnemiesReachedGoal() {
        // Return an array with length matching the count
        // This maintains compatibility with existing code that checks .length
        return Array(this.enemiesReachedGoalCount).fill(null);
    }

    /**
     * Get the count of enemies that reached the goal
     */
    getEnemiesReachedGoalCount() {
        return this.enemiesReachedGoalCount;
    }

    /**
     * Remove dead enemies from the system
     */
    cleanupDeadEnemies() {
        this.removedEnemies = this.enemies.filter(enemy => (!enemy.isAlive && !enemy.isDying) || enemy.reachedGoal);
        this.enemies = this.enemies.filter(enemy => (enemy.isAlive || enemy.isDying) && !enemy.reachedGoal);
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
        this.enemiesReachedGoalCount = 0; // Reset goal counter
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
            size: 24,  // Increased from 16 for better readability
            alpha: 1.0
        };

        if (!enemy.damageIndicators) {
            enemy.damageIndicators = [];
        }
        enemy.damageIndicators.push(indicator);
    }

    /**
     * Start dramatic death animation for enemy
     */
    startDramaticDeathAnimation(enemy) {
        enemy.isDying = true;
        enemy.deathAnimation = {
            time: 0,
            duration: 800, // Shorter, gentler duration (800ms)
            scale: 1.0,
            rotation: 0,
            alpha: 1.0,
            // Gentle dramatic effects
            explosionRadius: 0,
            maxExplosionRadius: 30, // Smaller, gentler explosion radius (30 pixels)
            sparkleCount: 12, // Fewer, smaller particles for gentler effect
            sparkles: []
        };

        // Create sparkle particles for dramatic effect with enhanced randomness
        for (let i = 0; i < enemy.deathAnimation.sparkleCount; i++) {
            const angle = (i / enemy.deathAnimation.sparkleCount) * Math.PI * 2;
            // Add random angle variation for more organic spread
            const angleVariation = (Math.random() - 0.5) * 0.5; // ±0.25 radians variation
            const finalAngle = angle + angleVariation;

            // Gentler explosion speed (60-140 pixels/second)
            const speed = 60 + Math.random() * 80;

            // Pastel colors matching game palette
            const colors = ['#FFB6C1', '#FFC0CB', '#FFE4E1', '#F0E68C', '#DDA0DD', '#98FB98'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            // Smaller, gentler chunks (3-8 pixels)
            const size = 3 + Math.random() * 5;

            // Longer, gentler life (1.0-1.8 seconds)
            const life = 1.0 + Math.random() * 0.8; // 1.0-1.8 seconds

            enemy.deathAnimation.sparkles.push({
                id: Date.now() + Math.random() * 1000, // Unique ID for consistent shape
                x: 0,
                y: 0,
                vx: Math.cos(finalAngle) * speed,
                vy: Math.sin(finalAngle) * speed - 20, // Gentler upward bias
                life: life,
                maxLife: life,
                size: size,
                color: color,
                alpha: 1.0,
                // Add random rotation for sparkle effect
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.5, // Gentler spinning
                // Add gravity for more realistic physics
                gravity: 50 + Math.random() * 30 // Lighter gravity effect
            });
        }
    }

    /**
     * Start death animation for enemy (legacy method)
     */
    startDeathAnimation(enemy) {
        this.startDramaticDeathAnimation(enemy);
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

        // Update dramatic death animation
        if (enemy.deathAnimation) {
            enemy.deathAnimation.time += deltaTime;
            const progress = enemy.deathAnimation.time / enemy.deathAnimation.duration;

            if (progress >= 1) {
                enemy.isDying = false; // Death animation complete
            } else {
                // Original death animation properties
                enemy.deathAnimation.scale = 1 - progress * 0.5;
                enemy.deathAnimation.rotation = progress * Math.PI * 2;
                enemy.deathAnimation.alpha = 1 - progress;

                // Update explosion radius for dramatic effect
                if (enemy.deathAnimation.maxExplosionRadius) {
                    const explosionProgress = Math.min(progress / 0.8, 1); // Explosion phase ends at 80% of animation
                    enemy.deathAnimation.explosionRadius = explosionProgress * enemy.deathAnimation.maxExplosionRadius;
                }
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
