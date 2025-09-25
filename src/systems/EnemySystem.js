/**
 * Enemy System - Manages individual enemy behavior and movement
 */
class EnemySystem {
    constructor() {
        this.enemies = [];
        this.removedEnemies = [];
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
            reachedGoal: false
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
            }
        });
        
        // Remove dead enemies
        this.cleanupDeadEnemies();
    }
    
    /**
     * Update individual enemy movement along path
     */
    updateEnemyMovement(enemy, deltaTime) {
        if (enemy.pathIndex >= enemy.path.length - 1) {
            // Reached the end of the path
            enemy.reachedGoal = true;
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
                enemy.x = nextPoint.x;
                enemy.y = nextPoint.y;
            }
        } else {
            // Interpolate position between current and next path points
            if (enemy.pathIndex < enemy.path.length - 1) {
                const currentPoint = enemy.path[enemy.pathIndex];
                const nextPoint = enemy.path[enemy.pathIndex + 1];
                
                enemy.x = currentPoint.x + (nextPoint.x - currentPoint.x) * enemy.progress;
                enemy.y = currentPoint.y + (nextPoint.y - currentPoint.y) * enemy.progress;
            }
        }
    }
    
    /**
     * Damage an enemy
     */
    damageEnemy(enemyId, damage) {
        const enemy = this.enemies.find(e => e.id === enemyId);
        if (enemy && enemy.isAlive) {
            enemy.health -= damage;
            if (enemy.health <= 0) {
                enemy.isAlive = false;
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
}
