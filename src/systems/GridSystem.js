/**
 * Grid System - Manages the game grid and tile placement
 */
class GridSystem {
    constructor(cols, rows, tileSize) {
        this.cols = cols;
        this.rows = rows;
        this.tileSize = tileSize;
        this.tiles = [];
        this.towers = [];
        this.enemyPath = [];

        this.initializeGrid();
        this.generateEnemyPath();
    }

    initializeGrid() {
        // Initialize empty grid
        for (let y = 0; y < this.rows; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.tiles[y][x] = {
                    type: 'empty',
                    buildable: true,
                    x: x,
                    y: y
                };
            }
        }
    }

    generateEnemyPath() {
        // Simple path generation - start from left, go to right
        this.enemyPath = [];

        // Start from left side
        const startY = Math.floor(this.rows / 2);
        this.enemyPath.push({ x: 0, y: startY });

        // Add some turns for variety
        let currentX = 0;
        let currentY = startY;

        while (currentX < this.cols - 1) {
            // Mark path tiles as non-buildable
            this.tiles[currentY][currentX].type = 'path';
            this.tiles[currentY][currentX].buildable = false;

            // Move forward
            currentX++;

            // Add to path
            this.enemyPath.push({ x: currentX, y: currentY });
        }

        // Mark final tile
        this.tiles[currentY][currentX].type = 'path';
        this.tiles[currentY][currentX].buildable = false;
    }

    screenToGrid(screenX, screenY) {
        return {
            x: Math.floor(screenX / this.tileSize),
            y: Math.floor(screenY / this.tileSize)
        };
    }

    gridToScreen(gridX, gridY) {
        return {
            x: gridX * this.tileSize,
            y: gridY * this.tileSize
        };
    }

    canPlaceTower(gridX, gridY) {
        // Check bounds
        if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
            return false;
        }

        // Check if tile is buildable
        if (!this.tiles[gridY][gridX].buildable) {
            return false;
        }

        // Check if tower already exists
        return !this.hasTowerAt(gridX, gridY);
    }

    hasTowerAt(gridX, gridY) {
        // This method is now handled by TowerManager
        // Keep for backward compatibility but delegate to external system
        return false;
    }
    
    placeTower(gridX, gridY) {
        // This method is now handled by TowerManager
        // Keep for backward compatibility but delegate to external system
        return false;
    }
    
    getTowers() {
        // This method is now handled by TowerManager
        // Return empty array for backward compatibility
        return [];
    }

    getEnemyPath() {
        return this.enemyPath;
    }

    getTile(gridX, gridY) {
        if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
            return null;
        }
        return this.tiles[gridY][gridX];
    }

    // Check if position is valid
    isValidPosition(x, y) {
        return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    // Check if position is on enemy path
    isOnEnemyPath(x, y) {
        return this.enemyPath.some(point => point.x === x && point.y === y);
    }
}
