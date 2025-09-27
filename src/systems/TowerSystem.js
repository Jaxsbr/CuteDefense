/**
 * CuteDefense - Tower System
 * Handles individual tower behavior, targeting, and shooting
 */

class TowerSystem {
    constructor() {
        this.towers = [];
        this.projectiles = [];
        this.lastUpdateTime = 0;
    }

    // Add a new tower
    addTower(x, y, type) {
        const tower = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            type: type,
            level: 1,
            lastShot: 0,
            target: null,
            ...TOWER_TYPES[type]
        };

        this.towers.push(tower);
        console.log(`Tower placed: ${type} at (${x}, ${y})`);
        return tower;
    }

    // Upgrade a tower
    upgradeTower(towerId, resourceSystem) {
        const tower = this.towers.find(t => t.id === towerId);
        if (!tower) {
            console.log(`Tower ${towerId} not found for upgrade`);
            return false;
        }

        const upgradeKey = `level${tower.level + 1}`;
        const upgradeConfig = TOWER_UPGRADES[tower.type]?.[upgradeKey];

        if (!upgradeConfig) {
            console.log(`No upgrade available for ${tower.type} level ${tower.level + 1}`);
            return false;
        }

        // Check if player can afford upgrade
        if (!resourceSystem.canAfford(upgradeConfig.cost)) {
            console.log(`Not enough coins for upgrade (cost: ${upgradeConfig.cost}, have: ${resourceSystem.getCoins()})`);
            return false;
        }

        // Apply upgrade
        tower.level += 1;
        tower.damage += upgradeConfig.damage;
        tower.range += upgradeConfig.range;
        tower.fireRate = Math.max(100, tower.fireRate - upgradeConfig.fireRate); // Faster firing
        tower.color = upgradeConfig.color;
        tower.size = Math.min(80, tower.size + 8); // Slightly larger

        // Keep projectile speed consistent across all towers and levels for guaranteed hits
        // No speed increase - all projectiles maintain 800 pixels/second for consistent hit rate

        // Add upgrade particle effect
        tower.upgradeParticles = this.createUpgradeParticles(tower);

        // Deduct cost
        resourceSystem.spend(upgradeConfig.cost);

        console.log(`Tower upgraded to level ${tower.level}: ${tower.type} at (${tower.x}, ${tower.y}) - projectile speed: ${tower.projectileSpeed}`);
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
            console.log(`TowerSystem: ${enemies.length} enemies available for targeting`);
        }

        // Update each tower
        this.towers.forEach(tower => {
            this.updateTower(tower, enemies, deltaTime);
            this.updateUpgradeParticles(tower, deltaTime);
        });

        // Update projectiles with damage system
        this.updateProjectiles(deltaTime, enemySystem, resourceSystem);
    }

    // Update individual tower
    updateTower(tower, enemies, deltaTime) {
        // Find target if none or target is out of range/dead
        if (!tower.target || !this.isTargetValid(tower, tower.target, enemies)) {
            tower.target = this.findTarget(tower, enemies);
            if (tower.target) {
                console.log(`Tower at (${tower.x}, ${tower.y}) found target at (${tower.target.x}, ${tower.target.y})`);
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

    // Shoot at target
    shoot(tower, target) {
        // Calculate direction vector for projectile
        const startX = tower.x * 64 + 32;
        const startY = tower.y * 64 + 32;
        const targetX = target.x * 64 + 32;
        const targetY = target.y * 64 + 32;

        const dx = targetX - startX;
        const dy = targetY - startY;
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
            speed: tower.projectileSpeed,
            damage: tower.damage,
            color: tower.color,
            size: 8, // Balanced size for good visibility without being too large
            // TTL (Time To Live) in milliseconds
            ttl: 3000, // 3 seconds max flight time
            maxDistance: tower.range * 64 * 1.5, // Max distance based on tower range
            distanceTraveled: 0,
            // Visual effects
            trail: [], // Trail effect for better visibility
            maxTrailLength: 5
        };

        this.projectiles.push(projectile);
        tower.lastShot = this.lastUpdateTime;

        console.log(`Tower ${tower.type} shoots projectile with direction (${dirX.toFixed(2)}, ${dirY.toFixed(2)})`);
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
                    // Deal damage and check if enemy dies
                    const coinsEarned = enemySystem.damageEnemy(enemy.id, projectile.damage);
                    if (coinsEarned > 0) {
                        // Spawn coin at enemy's current position
                        const coinX = enemy.x * 64 + 32;
                        const coinY = enemy.y * 64 + 32;
                        resourceSystem.spawnCoin(coinX, coinY, coinsEarned);
                        console.log(`Enemy killed! Earned ${coinsEarned} coins at (${coinX}, ${coinY})`);
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
        const enemyScreenX = enemy.x * 64 + 32;
        const enemyScreenY = enemy.y * 64 + 32;

        const dx = projectile.x - enemyScreenX;
        const dy = projectile.y - enemyScreenY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Use enemy size for collision radius, with some tolerance for fast enemies
        const collisionRadius = (64 * enemy.size) / 2 + 8; // Add 8px tolerance for better hit detection

        return distance <= collisionRadius;
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
        const centerX = tower.x * 64 + 32;
        const centerY = tower.y * 64 + 32;

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
                size: 4 + Math.random() * 4, // Random size between 4-8
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

    // Get towers for rendering
    getTowersForRendering() {
        return this.towers;
    }

    // Get projectiles for rendering
    getProjectilesForRendering() {
        return this.projectiles;
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
        console.log('🗑️ All towers and projectiles cleared');
    }
}
