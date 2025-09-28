/**
 * CuteDefense - Tower Manager
 * Handles tower placement, management, and integration with other systems
 */

class TowerManager {
    constructor(towerSystem, gridSystem, resourceSystem) {
        this.towerSystem = towerSystem;
        this.gridSystem = gridSystem;
        this.resourceSystem = resourceSystem;
        this.selectedTowerType = 'BASIC';
        this.logger = null; // Logger reference
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
    }

    // Try to place a tower at the given position
    tryPlaceTower(x, y, towerType = null) {
        const type = towerType || this.selectedTowerType;
        const towerConfig = TOWER_TYPES[type];

        if (this.logger) this.logger.info(`Attempting to place ${type} tower at (${x}, ${y})`);
        if (this.logger) this.logger.info(`Tower config:`, towerConfig);
        if (this.logger) this.logger.info(`Current coins: ${this.resourceSystem.getCoins()}`);

        // Check if position is valid for tower placement
        if (!this.canPlaceTower(x, y)) {
            if (this.logger) this.logger.info(`Cannot place tower at (${x}, ${y}) - position invalid`);
            return false;
        }

        // Check if player has enough resources
        if (!this.resourceSystem.canAfford(towerConfig.cost)) {
            if (this.logger) this.logger.info(`Not enough coins to place ${type} tower (cost: ${towerConfig.cost}, have: ${this.resourceSystem.getCoins()})`);
            return false;
        }

        // Deduct cost from resources first
        this.resourceSystem.spend(towerConfig.cost);

        // Place the tower with placement animation
        const tower = this.towerSystem.addTower(x, y, type);

        // Add placement animation effect
        this.addPlacementAnimation(x, y, tower);

        if (this.logger) this.logger.info(`Tower placed successfully: ${type} at (${x}, ${y})`);
        if (this.logger) this.logger.info(`Remaining coins: ${this.resourceSystem.getCoins()}`);
        return true;
    }

    // Check if tower can be placed at position
    canPlaceTower(x, y) {
        if (this.logger) this.logger.info(`Checking tower placement at (${x}, ${y})`);

        // Check if position is within grid bounds
        if (!this.gridSystem.isValidPosition(x, y)) {
            if (this.logger) this.logger.info(`Position (${x}, ${y}) is out of bounds`);
            return false;
        }

        // Check if position is not on enemy path
        if (this.gridSystem.isOnEnemyPath(x, y)) {
            if (this.logger) this.logger.info(`Position (${x}, ${y}) is on enemy path`);
            return false;
        }

        // Check if position is not already occupied by a tower
        if (this.towerSystem.hasTowerAt(x, y)) {
            if (this.logger) this.logger.info(`Position (${x}, ${y}) already has a tower`);
            return false;
        }

        if (this.logger) this.logger.info(`Position (${x}, ${y}) is valid for tower placement`);
        return true;
    }

    // Set selected tower type
    setSelectedTowerType(type) {
        if (TOWER_TYPES[type]) {
            this.selectedTowerType = type;
            if (this.logger) this.logger.info(`Selected tower type: ${type}`);
        }
    }

    // Get selected tower type
    getSelectedTowerType() {
        return this.selectedTowerType;
    }

    // Get tower info for UI
    getTowerInfo() {
        return {
            selectedType: this.selectedTowerType,
            selectedCost: TOWER_TYPES[this.selectedTowerType].cost,
            availableTypes: Object.keys(TOWER_TYPES),
            towerCount: this.towerSystem.towers.length
        };
    }

    // Update tower manager
    update(deltaTime, enemies, enemySystem) {
        // Update tower system with damage system integration
        this.towerSystem.update(deltaTime, enemies, enemySystem, this.resourceSystem);
    }

    // Get towers for rendering
    getTowersForRendering() {
        return this.towerSystem.getTowersForRendering();
    }

    // Get projectiles for rendering
    getProjectilesForRendering() {
        return this.towerSystem.getProjectilesForRendering();
    }

    // Get impact effects for rendering
    getImpactEffectsForRendering() {
        return this.towerSystem.getImpactEffectsForRendering();
    }

    // Add placement animation effect
    addPlacementAnimation(x, y, tower) {
        // Create placement animation particles
        const centerX = x * this.gridSystem.tileSize + this.gridSystem.tileSize / 2;
        const centerY = y * this.gridSystem.tileSize + this.gridSystem.tileSize / 2;

        // Add sparkle effect particles around the tower placement
        const sparkleCount = 8;
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (i / sparkleCount) * Math.PI * 2;
            const distance = 20 + Math.random() * 15;
            const sparkleX = centerX + Math.cos(angle) * distance;
            const sparkleY = centerY + Math.sin(angle) * distance;

            // Create sparkle particle
            const sparkle = {
                x: sparkleX,
                y: sparkleY,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                life: 1.0,
                maxLife: 1.0,
                size: 3 + Math.random() * 2,
                color: '#FFD700',
                alpha: 1.0
            };

            // Add to tower's placement effects (we'll need to add this property)
            if (!tower.placementEffects) {
                tower.placementEffects = [];
            }
            tower.placementEffects.push(sparkle);
        }

        // Add tower growth animation
        if (!tower.growthAnimation) {
            tower.growthAnimation = {
                scale: 0.1,
                targetScale: 1.0,
                duration: 0.5, // 500ms growth animation
                elapsed: 0.0,
                active: true
            };
        }
    }

    // Remove tower
    removeTower(towerId) {
        this.towerSystem.removeTower(towerId);
    }

    // Get tower at position
    getTowerAt(x, y) {
        return this.towerSystem.getTowerAt(x, y);
    }

    // Try to upgrade a tower at the given position
    tryUpgradeTower(x, y) {
        const tower = this.towerSystem.getTowerAt(x, y);
        if (!tower) {
            if (this.logger) this.logger.info(`No tower found at (${x}, ${y}) for upgrade`);
            return false;
        }

        // Check if upgrade is available
        const upgradeInfo = this.towerSystem.getTowerUpgradeInfo(tower.id);
        if (!upgradeInfo) {
            if (this.logger) this.logger.info(`No upgrade available for tower at (${x}, ${y})`);
            return false;
        }

        // Try to upgrade the tower
        const success = this.towerSystem.upgradeTower(tower.id, this.resourceSystem);
        if (success) {
            if (this.logger) this.logger.info(`Tower upgraded successfully at (${x}, ${y})`);
        }
        return success;
    }

    // Get upgrade info for tower at position
    getTowerUpgradeInfo(x, y) {
        const tower = this.towerSystem.getTowerAt(x, y);
        if (!tower) return null;
        return this.towerSystem.getTowerUpgradeInfo(tower.id);
    }

    // Check if tower can be upgraded at position
    canUpgradeTower(x, y) {
        const upgradeInfo = this.getTowerUpgradeInfo(x, y);
        if (!upgradeInfo) return false;
        return this.resourceSystem.canAfford(upgradeInfo.cost);
    }

    // Clear all towers (for game restart)
    clearAllTowers() {
        this.towerSystem.clearAllTowers();
        if (this.logger) this.logger.info('🗑️ All towers cleared');
    }
}
