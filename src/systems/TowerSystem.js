/**
 * CuteDefense - Tower System
 * Handles individual tower behavior, targeting, and shooting
 */

class TowerSystem {
    constructor() {
        this.towers = [];
        this.projectiles = [];
        this.impactEffects = []; // Store impact effect particles
        this.lastUpdateTime = 0;
        this.audioManager = null; // Audio manager reference
        this.logger = null; // Logger reference
        this.gridSystem = null; // Grid system reference for coordinate conversion
    }

    // Add a new tower
    addTower(x, y, type) {
        const baseTower = TOWER_TYPES[type];

        // Add shoot rate variability (±50ms for level 1, ±100ms for level 2, ±150ms for level 3)
        const variability = 50; // Base variability
        const randomVariation = (Math.random() - 0.5) * 2 * variability; // -variability to +variability
        const actualFireRate = Math.max(500, baseTower.fireRate + randomVariation); // Minimum 500ms

        const tower = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            type: type,
            level: 1,
            lastShot: 0,
            target: null,
            baseFireRate: baseTower.fireRate, // Store original rate for reference
            fireRate: actualFireRate, // Use variable rate
            ...baseTower,
            fireRate: actualFireRate // Override the base fireRate
        };

        this.towers.push(tower);
        if (this.logger) this.logger.info(`Tower placed: ${type} at (${x}, ${y}) with fire rate ${actualFireRate.toFixed(0)}ms`);
        return tower;
    }

    // Upgrade a tower
    upgradeTower(towerId, resourceSystem) {
        const tower = this.towers.find(t => t.id === towerId);
        if (!tower) {
            if (this.logger) this.logger.info(`Tower ${towerId} not found for upgrade`);
            return false;
        }

        const upgradeKey = `level${tower.level + 1}`;
        const upgradeConfig = TOWER_UPGRADES[tower.type]?.[upgradeKey];

        if (!upgradeConfig) {
            if (this.logger) this.logger.info(`No upgrade available for ${tower.type} level ${tower.level + 1}`);
            return false;
        }

        // Check if player can afford upgrade
        if (!resourceSystem.canAfford(upgradeConfig.cost)) {
            if (this.logger) this.logger.info(`Not enough coins for upgrade (cost: ${upgradeConfig.cost}, have: ${resourceSystem.getCoins()})`);
            return false;
        }

        // Apply upgrade
        tower.level += 1;
        tower.damage += upgradeConfig.damage;
        tower.range += upgradeConfig.range;

        // Update bomb damage for strong towers
        if (tower.type === 'STRONG' && upgradeConfig.bombDamage) {
            tower.bombDamage = upgradeConfig.bombDamage;
        }

        // Add shoot rate variability for upgrades (more variability for higher levels)
        const variability = 50 + (tower.level * 25); // 50ms for level 2, 75ms for level 3
        const randomVariation = (Math.random() - 0.5) * 2 * variability;
        const actualFireRate = Math.max(300, upgradeConfig.fireRate + randomVariation); // Minimum 300ms

        tower.baseFireRate = upgradeConfig.fireRate; // Store base rate
        tower.fireRate = actualFireRate; // Use variable rate
        tower.color = upgradeConfig.color;
        tower.size = Math.min(80, tower.size + 8); // Slightly larger

        // Keep projectile speed consistent across all towers and levels for guaranteed hits
        // No speed increase - all projectiles maintain 800 pixels/second for consistent hit rate

        // Add upgrade particle effect
        tower.upgradeParticles = this.createUpgradeParticles(tower);

        // Deduct cost
        resourceSystem.spend(upgradeConfig.cost);

        if (this.logger) this.logger.info(`Tower upgraded to level ${tower.level}: ${tower.type} at (${tower.x}, ${tower.y}) - projectile speed: ${tower.projectileSpeed}`);
        return true;
    }

    // Get upgrade info for a tower
    getTowerUpgradeInfo(towerId) {
        const tower = this.towers.find(t => t.id === towerId);
        if (!tower) return null;

        const upgradeKey = `level${tower.level + 1}`;
        const upgradeConfig = TOWER_UPGRADES[tower.type]?.[upgradeKey];

        if (!upgradeConfig) return null;

        return {
            towerId: towerId,
            currentLevel: tower.level,
            nextLevel: tower.level + 1,
            cost: upgradeConfig.cost,
            damageIncrease: upgradeConfig.damage,
            rangeIncrease: upgradeConfig.range,
            fireRateImprovement: upgradeConfig.fireRate,
            newColor: upgradeConfig.color
        };
    }

    // Update all towers
    update(deltaTime, enemies, enemySystem, resourceSystem) {
        this.lastUpdateTime += deltaTime;

        // Debug: Check if enemies are being passed
        if (enemies && enemies.length > 0) {
            // Log commented out, excessive
            //if (this.logger) this.logger.info(`TowerSystem: ${enemies.length} enemies available for targeting`);
        }

        // Update each tower
        this.towers.forEach(tower => {
            this.updateTower(tower, enemies, deltaTime);
            this.updateUpgradeParticles(tower, deltaTime);
            this.updatePlacementAnimations(tower, deltaTime);
            this.updateTowerIdleAnimation(tower, deltaTime);
            this.updateTowerFiringAnimation(tower, deltaTime);
        });

        // Update projectiles with damage system
        this.updateProjectiles(deltaTime, enemySystem, resourceSystem);

        // Update impact effects
        this.updateImpactEffects(deltaTime);
    }

    // Update individual tower
    updateTower(tower, enemies, deltaTime) {
        // Find target if none or target is out of range/dead
        if (!tower.target || !this.isTargetValid(tower, tower.target, enemies)) {
            tower.target = this.findTarget(tower, enemies);
            if (tower.target) {
                if (this.logger) this.logger.info(`Tower at (${tower.x}, ${tower.y}) found target at (${tower.target.x}, ${tower.target.y})`);
            }
        }

        // Shoot at target if ready
        if (tower.target && this.canShoot(tower)) {
            this.shoot(tower, tower.target);
        }
    }

    // Find best target for tower with improved targeting logic
    findTarget(tower, enemies) {
        let bestTarget = null;
        let bestScore = -1;

        enemies.forEach(enemy => {
            const distance = this.getDistance(tower, enemy);
            if (distance <= tower.range) {
                // Calculate targeting score based on multiple factors
                const score = this.calculateTargetScore(tower, enemy, distance);
                if (score > bestScore) {
                    bestTarget = enemy;
                    bestScore = score;
                }
            }
        });

        return bestTarget;
    }

    // Calculate targeting score for enemy prioritization
    calculateTargetScore(tower, enemy, distance) {
        let score = 0;

        // Distance factor (closer enemies get higher score)
        const distanceScore = (tower.range - distance) / tower.range;
        score += distanceScore * 0.3;

        // Health factor (lower health enemies get higher score for quick kills)
        const healthScore = 1 - (enemy.health / enemy.maxHealth);
        score += healthScore * 0.4;

        // Enemy type factor (prioritize fast enemies, then strong, then basic)
        let typeScore = 0;
        switch (enemy.type.id) {
            case 'fast':
                typeScore = 0.8; // High priority for fast enemies
                break;
            case 'strong':
                typeScore = 0.6; // Medium priority for strong enemies
                break;
            case 'basic':
                typeScore = 0.4; // Lower priority for basic enemies
                break;
        }
        score += typeScore * 0.3;

        return score;
    }

    // Check if target is still valid
    isTargetValid(tower, target, enemies) {
        if (!target) return false;

        // Check if target still exists in enemy list
        const targetExists = enemies.some(enemy => enemy.id === target.id);
        if (!targetExists) return false;

        // Check if target is still in range
        const distance = this.getDistance(tower, target);
        return distance <= tower.range;
    }

    // Check if tower can shoot
    canShoot(tower) {
        return (this.lastUpdateTime - tower.lastShot) >= tower.fireRate;
    }

    // Set audio manager reference
    setAudioManager(audioManager) {
        this.audioManager = audioManager;
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
    }

    // Set grid system reference for coordinate conversion
    setGridSystem(gridSystem) {
        this.gridSystem = gridSystem;
    }

    // Shoot at target
    shoot(tower, target) {
        // Play projectile fire sound
        if (this.audioManager) {
            this.audioManager.playSound('projectile_fire');
        }

        // Trigger firing animation
        if (!tower.firingAnimation) {
            tower.firingAnimation = {
                active: false,
                time: 0,
                scale: 1.0,
                duration: 200
            };
        }
        tower.firingAnimation.active = true;
        tower.firingAnimation.time = 0;

        // Calculate direction vector for projectile using grid system coordinate conversion
        const startScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(tower.x, tower.y) : { x: tower.x * 64, y: tower.y * 64 };
        const targetScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(target.x, target.y) : { x: target.x * 64, y: target.y * 64 };

        const startX = startScreenPos.x + 32; // Add half tile size for center
        const startY = startScreenPos.y + 32; // Add half tile size for center
        const targetX = targetScreenPos.x + 32; // Add half tile size for center
        const targetY = targetScreenPos.y + 32; // Add half tile size for center


        // Check if this is a strong tower with bomb capability
        const isBomb = tower.type === 'STRONG' && tower.bombDamage;

        let finalTargetX = targetX;
        let finalTargetY = targetY;

        // Predictive targeting for bombs - calculate where enemy will be
        if (isBomb) {
            const bombSpeed = tower.bombSpeed;
            const enemySpeed = target.speed * 64; // Convert tiles/sec to pixels/sec

            // Calculate time for bomb to reach current enemy position
            const dx = targetX - startX;
            const dy = targetY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const timeToReach = distance / bombSpeed;

            // Get enemy movement direction more accurately
            let enemyDirX = 0;
            let enemyDirY = 0;

            // Try to get direction from enemy's path or movement
            if (target.dirX !== undefined && target.dirY !== undefined) {
                enemyDirX = target.dirX;
                enemyDirY = target.dirY;
            } else if (target.path && target.pathIndex !== undefined && target.pathIndex < target.path.length - 1) {
                // Calculate direction from path
                const currentPath = target.path[target.pathIndex];
                const nextPath = target.path[target.pathIndex + 1];
                if (currentPath && nextPath) {
                    const pathDx = nextPath.x - currentPath.x;
                    const pathDy = nextPath.y - currentPath.y;
                    const pathDistance = Math.sqrt(pathDx * pathDx + pathDy * pathDy);
                    if (pathDistance > 0) {
                        enemyDirX = pathDx / pathDistance;
                        enemyDirY = pathDy / pathDistance;
                    }
                }
            }

            // If we still don't have direction, estimate from current movement
            if (enemyDirX === 0 && enemyDirY === 0 && target.lastX !== undefined && target.lastY !== undefined) {
                const moveDx = target.x - target.lastX;
                const moveDy = target.y - target.lastY;
                const moveDistance = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
                if (moveDistance > 0) {
                    enemyDirX = moveDx / moveDistance;
                    enemyDirY = moveDy / moveDistance;
                }
            }

            // Use more accurate lead time calculation
            const leadTime = timeToReach * 1.5; // 50% extra lead time for better accuracy

            finalTargetX = targetX + enemyDirX * enemySpeed * leadTime;
            finalTargetY = targetY + enemyDirY * enemySpeed * leadTime;

            if (this.logger) this.logger.info(`Bomb prediction: enemy at (${targetX}, ${targetY}) -> predicted (${finalTargetX.toFixed(1)}, ${finalTargetY.toFixed(1)}) in ${timeToReach.toFixed(2)}s, dir(${enemyDirX.toFixed(2)}, ${enemyDirY.toFixed(2)})`);
        }

        const dx = finalTargetX - startX;
        const dy = finalTargetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize direction vector
        const dirX = dx / distance;
        const dirY = dy / distance;

        const projectile = {
            id: Date.now() + Math.random(),
            x: startX,
            y: startY,
            // Direction-based movement instead of target-based
            dirX: dirX,
            dirY: dirY,
            speed: isBomb ? tower.bombSpeed : tower.projectileSpeed,
            damage: isBomb ? tower.bombDamage : tower.damage,
            color: isBomb ? tower.bombColor : tower.color,
            size: isBomb ? 18 : 12, // Larger bombs for visibility (scaled for 96px tiles)
            // TTL (Time To Live) in milliseconds
            ttl: isBomb ? 4000 : 3000, // Bombs last longer
            maxDistance: tower.range * 64 * 1.5, // Max distance based on tower range
            distanceTraveled: 0,
            // Visual effects
            trail: [], // Trail effect for better visibility
            maxTrailLength: 5,
            // Bomb properties
            isBomb: isBomb,
            bombRadius: isBomb ? tower.bombRadius : 0,
            targetX: finalTargetX,
            targetY: finalTargetY
        };

        this.projectiles.push(projectile);
        tower.lastShot = this.lastUpdateTime;

        if (this.logger) this.logger.info(`Tower ${tower.type} shoots ${isBomb ? 'bomb' : 'projectile'} with direction (${dirX.toFixed(2)}, ${dirY.toFixed(2)})`);
    }

    // Update all projectiles with TTL and collision detection
    updateProjectiles(deltaTime, enemySystem, resourceSystem) {
        this.projectiles = this.projectiles.filter(projectile => {
            // Update TTL
            projectile.ttl -= deltaTime;

            // Remove projectile if TTL expired
            if (projectile.ttl <= 0) {
                return false;
            }

            // Move projectile in its direction (speed is already in pixels per second)
            const moveDistance = projectile.speed * (deltaTime / 1000);

            // Add current position to trail
            projectile.trail.push({ x: projectile.x, y: projectile.y });
            if (projectile.trail.length > projectile.maxTrailLength) {
                projectile.trail.shift();
            }

            projectile.x += projectile.dirX * moveDistance;
            projectile.y += projectile.dirY * moveDistance;
            projectile.distanceTraveled += moveDistance;


            // Remove projectile if it has traveled too far
            if (projectile.distanceTraveled >= projectile.maxDistance) {
                return false;
            }

            // Check collision with all alive enemies
            const aliveEnemies = enemySystem.getEnemiesForRendering();
            for (const enemy of aliveEnemies) {
                if (this.checkProjectileCollision(projectile, enemy)) {
                    // Handle bomb explosion
                    if (projectile.isBomb) {
                        this.handleBombExplosion(projectile, aliveEnemies, enemySystem, resourceSystem);
                    } else {
                        // Regular projectile hit
                        this.handleProjectileHit(projectile, enemy, enemySystem, resourceSystem);
                    }
                    // Remove projectile after hit
                    return false;
                }
            }

            return true;
        });
    }

    // Calculate distance between tower and target (in grid units)
    getDistance(tower, target) {
        const dx = tower.x - target.x;
        const dy = tower.y - target.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Enhanced collision detection for projectiles
    checkProjectileCollision(projectile, enemy) {
        // Convert enemy position to screen coordinates
        const enemyScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(enemy.x, enemy.y) : { x: enemy.x * 64, y: enemy.y * 64 };
        const enemyScreenX = enemyScreenPos.x + 32;
        const enemyScreenY = enemyScreenPos.y + 32;

        const dx = projectile.x - enemyScreenX;
        const dy = projectile.y - enemyScreenY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Use enemy size for collision radius, with some tolerance for fast enemies
        const collisionRadius = (64 * enemy.size) / 2 + 8; // Add 8px tolerance for better hit detection

        return distance <= collisionRadius;
    }

    // Handle bomb explosion with area damage
    handleBombExplosion(projectile, enemies, enemySystem, resourceSystem) {
        // Play bomb explosion sound
        if (this.audioManager) {
            this.audioManager.playSound('enemy_hit'); // Use existing sound for now
        }

        // Create bomb explosion effect
        if (this.logger) this.logger.info(`Creating bomb explosion at (${projectile.x.toFixed(1)}, ${projectile.y.toFixed(1)}) with radius ${projectile.bombRadius}`);
        if (this.logger) this.logger.info(`Projectile coordinates: x=${projectile.x}, y=${projectile.y}, dirX=${projectile.dirX}, dirY=${projectile.dirY}`);


        this.createBombExplosionEffect(projectile.x, projectile.y, projectile.bombRadius);

        // Damage all enemies within bomb radius
        const bombRadiusPixels = projectile.bombRadius * 64; // Convert tiles to pixels
        let enemiesHit = 0;

        enemies.forEach(enemy => {
            const enemyScreenX = enemy.x * 64 + 32;
            const enemyScreenY = enemy.y * 64 + 32;

            const dx = projectile.x - enemyScreenX;
            const dy = projectile.y - enemyScreenY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= bombRadiusPixels) {
                enemiesHit++;
                // Add damage indicator to enemy
                enemySystem.addDamageIndicator(enemy, projectile.damage);

                // Create bomb damage text
                const enemyScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(enemy.x, enemy.y) : { x: enemy.x * 64, y: enemy.y * 64 };
                this.createBombDamageText(enemyScreenPos.x + 32, enemyScreenPos.y + 32, projectile.damage);

                // Deal damage and check if enemy dies
                const coinsEarned = enemySystem.damageEnemy(enemy.id, projectile.damage);
                if (coinsEarned > 0) {
                    // Start death animation
                    enemySystem.startDeathAnimation(enemy);

                    // Spawn coin at enemy's current position
                    const enemyScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(enemy.x, enemy.y) : { x: enemy.x * 64, y: enemy.y * 64 };
                    const coinX = enemyScreenPos.x + 32;
                    const coinY = enemyScreenPos.y + 32;
                    resourceSystem.spawnCoin(coinX, coinY, coinsEarned);
                    if (this.logger) this.logger.info(`Enemy killed by bomb! Earned ${coinsEarned} coins at (${coinX}, ${coinY})`);
                }
            }
        });

        if (this.logger) this.logger.info(`Bomb explosion hit ${enemiesHit} enemies with ${projectile.damage} damage each`);
    }

    // Handle regular projectile hit
    handleProjectileHit(projectile, enemy, enemySystem, resourceSystem) {
        // Play enemy hit sound
        if (this.audioManager) {
            this.audioManager.playSound('enemy_hit');
        }

        // Check for critical hit (1% chance for basic towers)
        const isCritical = Math.random() < 0.01;
        const finalDamage = isCritical ? projectile.damage * 2 : projectile.damage;

        // Create impact effect at collision point
        this.createImpactEffect(projectile.x, projectile.y, finalDamage, projectile.color);

        // Add damage indicator to enemy
        enemySystem.addDamageIndicator(enemy, finalDamage);

        // Create damage text (larger for crits)
        this.createDamageText(projectile.x, projectile.y, finalDamage, isCritical);

        // Deal damage and check if enemy dies
        const coinsEarned = enemySystem.damageEnemy(enemy.id, finalDamage);
        if (coinsEarned > 0) {
            // Start death animation
            enemySystem.startDeathAnimation(enemy);

            // Spawn coin at enemy's current position
            const enemyScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(enemy.x, enemy.y) : { x: enemy.x * 64, y: enemy.y * 64 };
            const coinX = enemyScreenPos.x + 32;
            const coinY = enemyScreenPos.y + 32;
            resourceSystem.spawnCoin(coinX, coinY, coinsEarned);
            if (this.logger) this.logger.info(`Enemy killed! Earned ${coinsEarned} coins at (${coinX}, ${coinY})`);
        }
    }

    // Create damage text for regular hits
    createDamageText(x, y, damage, isCritical = false) {
        const damageText = {
            id: Date.now() + Math.random(),
            x: x + (Math.random() - 0.5) * 20,
            y: y - 10,
            vx: (Math.random() - 0.5) * 30,
            vy: -50, // Float upward
            life: isCritical ? 2000 : 1200, // Longer for crits
            maxLife: isCritical ? 2000 : 1200,
            text: damage.toString(),
            alpha: 1.0,
            size: isCritical ? 30 : 21, // Larger for crits (scaled for 96px tiles)
            isCritical: isCritical
        };
        this.impactEffects.push(damageText);
    }

    // Create bomb damage text
    createBombDamageText(x, y, damage) {
        const damageText = {
            id: Date.now() + Math.random(),
            x: x + (Math.random() - 0.5) * 20,
            y: y - 10,
            vx: (Math.random() - 0.5) * 30,
            vy: -50, // Float upward
            life: 1500, // Slightly longer for bomb damage
            maxLife: 1500,
            text: damage.toString(),
            alpha: 1.0,
            size: 24, // Slightly larger than regular damage (scaled for 96px tiles)
            isBomb: true
        };
        this.impactEffects.push(damageText);
    }

    // Create bomb explosion visual effect
    createBombExplosionEffect(x, y, radius) {
        if (this.logger) this.logger.info(`Bomb explosion effect: x=${x.toFixed(1)}, y=${y.toFixed(1)}, radius=${radius}`);


        // Create large explosion particles
        const particleCount = 20;
        const radiusPixels = radius * 64; // Convert tiles to pixels

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
            const speed = 80 + Math.random() * 60;
            const particle = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 30, // Slight upward bias
                life: 1000 + Math.random() * 500, // 1-1.5 seconds
                maxLife: 1000 + Math.random() * 500,
                size: 6 + Math.random() * 6, // Larger particles for bomb
                color: '#FF4500', // Orange for bomb explosion
                alpha: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            };
            this.impactEffects.push(particle);
        }

        // Create explosion ring effect (faster, more violent)
        // TEMPORARY FLAG: Set to true to enable ring effect for testing
        const RING_EFFECT_ENABLED = true;

        if (RING_EFFECT_ENABLED) {
            const ringEffect = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                radius: 0,
                maxRadius: radiusPixels,
                life: 400, // Faster explosion (reduced from 800)
                maxLife: 400,
                color: '#FF4500',
                alpha: 1.0, // More intense
                thickness: 12 // Thicker ring
            };


            this.impactEffects.push(ringEffect);
        }
    }

    // Get collision bounds for tower range visualization
    getTowerRangeBounds(tower, tileSize) {
        const centerX = tower.x * tileSize + tileSize / 2;
        const centerY = tower.y * tileSize + tileSize / 2;
        const rangePixels = tower.range * tileSize;

        return {
            centerX: centerX,
            centerY: centerY,
            radius: rangePixels
        };
    }

    // Create upgrade particle effect
    createUpgradeParticles(tower) {
        const particles = [];
        const towerScreenPos = this.gridSystem ? this.gridSystem.gridToScreen(tower.x, tower.y) : { x: tower.x * 64, y: tower.y * 64 };
        const centerX = towerScreenPos.x + 32;
        const centerY = towerScreenPos.y + 32;

        // Create 12 particles in a circle around the tower
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const particle = {
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * 2, // Velocity in X direction
                vy: Math.sin(angle) * 2, // Velocity in Y direction
                life: 1.0, // Life remaining (0-1)
                maxLife: 1.0,
                size: 6 + Math.random() * 6, // Random size between 6-12 (scaled for 96px tiles)
                color: tower.color,
                alpha: 1.0
            };
            particles.push(particle);
        }

        return particles;
    }

    // Update upgrade particles
    updateUpgradeParticles(tower, deltaTime) {
        if (!tower.upgradeParticles) return;

        tower.upgradeParticles = tower.upgradeParticles.filter(particle => {
            // Update particle position
            particle.x += particle.vx * (deltaTime / 16.67); // Normalize to 60fps
            particle.y += particle.vy * (deltaTime / 16.67);

            // Update particle life
            particle.life -= (deltaTime / 1000); // Decrease life over time
            particle.alpha = particle.life;

            // Remove dead particles
            return particle.life > 0;
        });

        // Remove particle system if all particles are dead
        if (tower.upgradeParticles.length === 0) {
            tower.upgradeParticles = null;
        }
    }

    // Update placement animations for towers
    updatePlacementAnimations(tower, deltaTime) {
        // Update growth animation
        if (tower.growthAnimation && tower.growthAnimation.active) {
            const anim = tower.growthAnimation;
            anim.elapsed += deltaTime / 1000; // Convert to seconds

            // Ease out animation (starts fast, slows down)
            const progress = Math.min(anim.elapsed / anim.duration, 1.0);
            const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out
            anim.scale = anim.targetScale * easeOut;

            // End animation when complete
            if (progress >= 1.0) {
                anim.active = false;
                anim.scale = anim.targetScale;
            }
        }

        // Update placement effect particles
        if (tower.placementEffects) {
            tower.placementEffects = tower.placementEffects.filter(effect => {
                // Update particle position
                effect.x += effect.vx * (deltaTime / 16.67);
                effect.y += effect.vy * (deltaTime / 16.67);

                // Update particle life
                effect.life -= (deltaTime / 1000);
                effect.alpha = effect.life;

                // Fade out and slow down over time
                effect.vx *= 0.98;
                effect.vy *= 0.98;

                // Return true to keep particle alive
                return effect.life > 0;
            });
        }
    }

    // Get towers for rendering
    getTowersForRendering() {
        return this.towers;
    }

    // Get projectiles for rendering
    getProjectilesForRendering() {
        return this.projectiles;
    }

    // Get impact effects for rendering
    getImpactEffectsForRendering() {
        return this.impactEffects;
    }

    // Create impact effect particles when projectile hits enemy
    createImpactEffect(x, y, damage, projectileColor) {
        // Create impact sparkle particles
        const particleCount = 8 + Math.min(damage * 2, 6); // More particles for higher damage

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
            const speed = 60 + Math.random() * 40;
            const particle = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20, // Slight upward bias
                life: 800 + Math.random() * 400, // 0.8-1.2 seconds
                maxLife: 800 + Math.random() * 400,
                size: 3 + Math.random() * 4,
                color: projectileColor || '#FFD700',
                alpha: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            };
            this.impactEffects.push(particle);
        }

        // Create damage number floating text
        const damageText = {
            id: Date.now() + Math.random(),
            x: x + (Math.random() - 0.5) * 20,
            y: y - 10,
            vx: (Math.random() - 0.5) * 30,
            vy: -50, // Float upward
            life: 1200,
            maxLife: 1200,
            text: damage.toString(),
            alpha: 1.0,
            size: 21 + Math.min(damage * 3, 9) // Larger text for higher damage (scaled for 96px tiles)
        };
        this.impactEffects.push(damageText);
    }

    // Update impact effect particles
    updateImpactEffects(deltaTime) {
        this.impactEffects = this.impactEffects.filter(effect => {
            // Only update position for effects that have velocity properties
            if (effect.vx !== undefined && effect.vy !== undefined) {
                effect.x += effect.vx * (deltaTime / 1000);
                effect.y += effect.vy * (deltaTime / 1000);
            }
            effect.life -= deltaTime;

            // Apply gravity to particles (only for non-text particles)
            if (!effect.text) {
                effect.vy += 80 * (deltaTime / 1000);

                // Update rotation for sparkle particles
                if (effect.rotation !== undefined) {
                    effect.rotation += effect.rotationSpeed;
                }

                // Fade out over time
                effect.alpha = effect.life / effect.maxLife;
            } else {
                // Floating text particles fade out more slowly
                effect.alpha = effect.life / effect.maxLife;
            }

            return effect.life > 0;
        });
    }

    // Remove tower
    removeTower(towerId) {
        this.towers = this.towers.filter(tower => tower.id !== towerId);
    }

    // Get tower at position
    getTowerAt(x, y) {
        return this.towers.find(tower => tower.x === x && tower.y === y);
    }

    // Check if position has tower
    hasTowerAt(x, y) {
        return this.getTowerAt(x, y) !== undefined;
    }

    // Clear all towers (for game restart)
    clearAllTowers() {
        this.towers = [];
        this.projectiles = [];
        if (this.logger) this.logger.info('🗑️ All towers and projectiles cleared');
    }

    // Update tower idle animation (subtle pulsing)
    updateTowerIdleAnimation(tower, deltaTime) {
        // Initialize idle animation if not present
        if (!tower.idleAnimation) {
            tower.idleAnimation = {
                active: true,
                time: 0,
                scale: 1.0,
                speed: 0.002 // Slow pulsing
            };
        }

        // Update animation
        if (tower.idleAnimation.active) {
            tower.idleAnimation.time += deltaTime;
            // Subtle pulsing: 0.95 to 1.05 scale
            tower.idleAnimation.scale = 1.0 + Math.sin(tower.idleAnimation.time * tower.idleAnimation.speed) * 0.05;
        }
    }

    // Update tower firing animation (brief flash when shooting)
    updateTowerFiringAnimation(tower, deltaTime) {
        // Initialize firing animation if not present
        if (!tower.firingAnimation) {
            tower.firingAnimation = {
                active: false,
                time: 0,
                scale: 1.0,
                duration: 200 // 200ms flash
            };
        }

        // Update animation
        if (tower.firingAnimation.active) {
            tower.firingAnimation.time += deltaTime;

            if (tower.firingAnimation.time >= tower.firingAnimation.duration) {
                // Animation complete
                tower.firingAnimation.active = false;
                tower.firingAnimation.time = 0;
                tower.firingAnimation.scale = 1.0;
            } else {
                // Brief flash effect: 1.0 to 1.2 scale
                const progress = tower.firingAnimation.time / tower.firingAnimation.duration;
                tower.firingAnimation.scale = 1.0 + (Math.sin(progress * Math.PI) * 0.2);
            }
        }
    }
}
