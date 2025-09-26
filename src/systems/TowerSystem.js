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

    // Update all towers
    update(deltaTime, enemies) {
        this.lastUpdateTime += deltaTime;

        // Debug: Check if enemies are being passed
        if (enemies && enemies.length > 0) {
            console.log(`TowerSystem: ${enemies.length} enemies available for targeting`);
        }

        // Update each tower
        this.towers.forEach(tower => {
            this.updateTower(tower, enemies, deltaTime);
        });

        // Update projectiles
        this.updateProjectiles(deltaTime);
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

    // Find best target for tower
    findTarget(tower, enemies) {
        let bestTarget = null;
        let bestDistance = tower.range; // Grid range

        enemies.forEach(enemy => {
            const distance = this.getDistance(tower, enemy);
            if (distance <= bestDistance) {
                bestTarget = enemy;
                bestDistance = distance;
            }
        });

        return bestTarget;
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
        const projectile = {
            id: Date.now() + Math.random(),
            x: tower.x * 32 + 16, // Center of tower (screen coordinates)
            y: tower.y * 32 + 16,
            targetX: target.x * 32 + 16, // Convert enemy grid position to screen coordinates
            targetY: target.y * 32 + 16,
            targetId: target.id,
            speed: tower.projectileSpeed,
            damage: tower.damage,
            color: tower.color,
            size: 4
        };

        this.projectiles.push(projectile);
        tower.lastShot = this.lastUpdateTime;

        console.log(`Tower ${tower.type} shoots at enemy ${target.id}`);
    }

    // Update all projectiles
    updateProjectiles(deltaTime) {
        this.projectiles = this.projectiles.filter(projectile => {
            // Move projectile towards target
            const dx = projectile.targetX - projectile.x;
            const dy = projectile.targetY - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 5) {
                // Hit target - remove projectile
                return false;
            }

            // Move projectile
            const moveDistance = projectile.speed * (deltaTime / 1000);
            const moveX = (dx / distance) * moveDistance;
            const moveY = (dy / distance) * moveDistance;

            projectile.x += moveX;
            projectile.y += moveY;

            return true;
        });
    }

    // Calculate distance between tower and target (in grid units)
    getDistance(tower, target) {
        const dx = tower.x - target.x;
        const dy = tower.y - target.y;
        return Math.sqrt(dx * dx + dy * dy);
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
}
