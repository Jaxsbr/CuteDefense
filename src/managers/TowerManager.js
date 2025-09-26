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
    }

    // Try to place a tower at the given position
    tryPlaceTower(x, y, towerType = null) {
        const type = towerType || this.selectedTowerType;
        const towerConfig = TOWER_TYPES[type];
        
        console.log(`Attempting to place ${type} tower at (${x}, ${y})`);
        console.log(`Tower config:`, towerConfig);
        console.log(`Current coins: ${this.resourceSystem.getCoins()}`);
        
        // Check if position is valid for tower placement
        if (!this.canPlaceTower(x, y)) {
            console.log(`Cannot place tower at (${x}, ${y}) - position invalid`);
            return false;
        }
        
        // Check if player has enough resources
        if (!this.resourceSystem.canAfford(towerConfig.cost)) {
            console.log(`Not enough coins to place ${type} tower (cost: ${towerConfig.cost}, have: ${this.resourceSystem.getCoins()})`);
            return false;
        }
        
        // Place the tower
        const tower = this.towerSystem.addTower(x, y, type);
        
        // Deduct cost from resources
        this.resourceSystem.spend(towerConfig.cost);
        
        console.log(`Tower placed successfully: ${type} at (${x}, ${y})`);
        console.log(`Remaining coins: ${this.resourceSystem.getCoins()}`);
        return true;
    }

    // Check if tower can be placed at position
    canPlaceTower(x, y) {
        console.log(`Checking tower placement at (${x}, ${y})`);
        
        // Check if position is within grid bounds
        if (!this.gridSystem.isValidPosition(x, y)) {
            console.log(`Position (${x}, ${y}) is out of bounds`);
            return false;
        }
        
        // Check if position is not on enemy path
        if (this.gridSystem.isOnEnemyPath(x, y)) {
            console.log(`Position (${x}, ${y}) is on enemy path`);
            return false;
        }
        
        // Check if position is not already occupied by a tower
        if (this.towerSystem.hasTowerAt(x, y)) {
            console.log(`Position (${x}, ${y}) already has a tower`);
            return false;
        }
        
        console.log(`Position (${x}, ${y}) is valid for tower placement`);
        return true;
    }

    // Set selected tower type
    setSelectedTowerType(type) {
        if (TOWER_TYPES[type]) {
            this.selectedTowerType = type;
            console.log(`Selected tower type: ${type}`);
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
            console.log(`No tower found at (${x}, ${y}) for upgrade`);
            return false;
        }

        // Check if upgrade is available
        const upgradeInfo = this.towerSystem.getTowerUpgradeInfo(tower.id);
        if (!upgradeInfo) {
            console.log(`No upgrade available for tower at (${x}, ${y})`);
            return false;
        }

        // Try to upgrade the tower
        const success = this.towerSystem.upgradeTower(tower.id, this.resourceSystem);
        if (success) {
            console.log(`Tower upgraded successfully at (${x}, ${y})`);
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
}
