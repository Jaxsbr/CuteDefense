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
        this.startTile = null;
        this.endTile = null;
        this.logger = null; // Logger reference

        // Path template system
        this.pathTemplates = this.initializePathTemplates();

        this.initializeGrid();
        this.generateEnemyPath();
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
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
        // Clear existing path tiles
        this.clearPathTiles();

        // Select a random path template
        const template = this.selectRandomTemplate();

        // Apply the template to create the path
        this.applyPathTemplate(template);

        // Mark path tiles as non-buildable
        this.markPathTiles();
    }

    clearPathTiles() {
        // Reset all tiles to empty and buildable
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.tiles[y][x].type = 'empty';
                this.tiles[y][x].buildable = true;
            }
        }
    }





    createPathSegment(start, end) {
        // Create orthogonal path between two points (no diagonal movement)
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // Move horizontally first, then vertically (or vice versa)
        if (Math.abs(dx) > 0) {
            // Move horizontally first
            const stepX = dx > 0 ? 1 : -1;
            for (let x = start.x; x !== end.x; x += stepX) {
                if (!this.enemyPath.some(point => point.x === x && point.y === start.y)) {
                    this.enemyPath.push({ x, y: start.y });
                }
            }
        }

        if (Math.abs(dy) > 0) {
            // Move vertically second
            const stepY = dy > 0 ? 1 : -1;
            for (let y = start.y; y !== end.y; y += stepY) {
                if (!this.enemyPath.some(point => point.x === end.x && point.y === y)) {
                    this.enemyPath.push({ x: end.x, y });
                }
            }
        }

        // Add the end point
        if (!this.enemyPath.some(point => point.x === end.x && point.y === end.y)) {
            this.enemyPath.push({ x: end.x, y: end.y });
        }
    }



    markPathTiles() {
        // Mark all path tiles as non-buildable
        this.enemyPath.forEach(point => {
            if (this.isValidPosition(point.x, point.y)) {
                // Check if this is start or end tile
                const isStart = this.startTile && point.x === this.startTile.x && point.y === this.startTile.y;
                const isEnd = this.endTile && point.x === this.endTile.x && point.y === this.endTile.y;

                if (isStart) {
                    this.tiles[point.y][point.x].type = 'start';
                } else if (isEnd) {
                    this.tiles[point.y][point.x].type = 'end';
                } else {
                    this.tiles[point.y][point.x].type = 'path';
                }

                this.tiles[point.y][point.x].buildable = false;
            }
        });
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


    // Initialize path templates
    initializePathTemplates() {
        return [
            // Template 1: Horizontal Snake with proper connectivity
            {
                name: "Horizontal Snake",
                start: { x: 0, y: 6 },
                end: { x: 15, y: 6 },
                path: [
                    { x: 0, y: 6 },   // Start
                    { x: 1, y: 6 },   // Right
                    { x: 2, y: 6 },   // Right
                    { x: 3, y: 6 },   // Right
                    { x: 3, y: 5 },   // Up
                    { x: 3, y: 4 },   // Up
                    { x: 3, y: 3 },   // Up
                    { x: 4, y: 3 },   // Right
                    { x: 5, y: 3 },   // Right
                    { x: 6, y: 3 },   // Right
                    { x: 6, y: 4 },   // Down
                    { x: 6, y: 5 },   // Down
                    { x: 6, y: 6 },   // Down
                    { x: 6, y: 7 },   // Down
                    { x: 6, y: 8 },   // Down
                    { x: 6, y: 9 },   // Down
                    { x: 7, y: 9 },   // Right
                    { x: 8, y: 9 },   // Right
                    { x: 9, y: 9 },   // Right
                    { x: 9, y: 8 },   // Up
                    { x: 9, y: 7 },   // Up
                    { x: 9, y: 6 },   // Up
                    { x: 9, y: 5 },   // Up
                    { x: 9, y: 4 },   // Up
                    { x: 9, y: 3 },   // Up
                    { x: 10, y: 3 },  // Right
                    { x: 11, y: 3 },  // Right
                    { x: 12, y: 3 },  // Right
                    { x: 12, y: 4 },  // Down
                    { x: 12, y: 5 },  // Down
                    { x: 12, y: 6 },  // Down
                    { x: 13, y: 6 },  // Right
                    { x: 14, y: 6 },  // Right
                    { x: 15, y: 6 }   // End
                ]
            },

            // Template 2: Vertical Snake with proper connectivity
            {
                name: "Vertical Snake",
                start: { x: 8, y: 0 },
                end: { x: 8, y: 11 },
                path: [
                    { x: 8, y: 0 },   // Start
                    { x: 8, y: 1 },   // Down
                    { x: 8, y: 2 },   // Down
                    { x: 7, y: 2 },   // Left
                    { x: 6, y: 2 },   // Left
                    { x: 5, y: 2 },   // Left
                    { x: 5, y: 3 },   // Down
                    { x: 5, y: 4 },   // Down
                    { x: 5, y: 5 },   // Down
                    { x: 6, y: 5 },   // Right
                    { x: 7, y: 5 },   // Right
                    { x: 8, y: 5 },   // Right
                    { x: 9, y: 5 },   // Right
                    { x: 10, y: 5 },  // Right
                    { x: 11, y: 5 },  // Right
                    { x: 11, y: 6 },  // Down
                    { x: 11, y: 7 },  // Down
                    { x: 11, y: 8 },  // Down
                    { x: 10, y: 8 },  // Left
                    { x: 9, y: 8 },   // Left
                    { x: 8, y: 8 },   // Left
                    { x: 7, y: 8 },   // Left
                    { x: 6, y: 8 },   // Left
                    { x: 5, y: 8 },   // Left
                    { x: 5, y: 9 },   // Down
                    { x: 5, y: 10 },  // Down
                    { x: 5, y: 11 },  // Down
                    { x: 6, y: 11 },  // Right
                    { x: 7, y: 11 },  // Right
                    { x: 8, y: 11 }   // End
                ]
            },

            // Template 3: Spiral with proper connectivity
            {
                name: "Spiral",
                start: { x: 0, y: 6 },
                end: { x: 15, y: 6 },
                path: [
                    { x: 0, y: 6 },   // Start
                    { x: 1, y: 6 },   // Right
                    { x: 2, y: 6 },   // Right
                    { x: 3, y: 6 },   // Right
                    { x: 4, y: 6 },   // Right
                    { x: 4, y: 5 },   // Up
                    { x: 4, y: 4 },   // Up
                    { x: 4, y: 3 },   // Up
                    { x: 4, y: 2 },   // Up
                    { x: 5, y: 2 },   // Right
                    { x: 6, y: 2 },   // Right
                    { x: 7, y: 2 },   // Right
                    { x: 8, y: 2 },   // Right
                    { x: 8, y: 3 },   // Down
                    { x: 8, y: 4 },   // Down
                    { x: 8, y: 5 },   // Down
                    { x: 8, y: 6 },   // Down
                    { x: 8, y: 7 },   // Down
                    { x: 8, y: 8 },   // Down
                    { x: 9, y: 8 },   // Right
                    { x: 10, y: 8 },  // Right
                    { x: 11, y: 8 },  // Right
                    { x: 12, y: 8 },  // Right
                    { x: 12, y: 7 },  // Up
                    { x: 12, y: 6 },  // Up
                    { x: 12, y: 5 },  // Up
                    { x: 12, y: 4 },  // Up
                    { x: 13, y: 4 },  // Right
                    { x: 14, y: 4 },  // Right
                    { x: 15, y: 4 },  // Right
                    { x: 15, y: 5 },  // Down
                    { x: 15, y: 6 }   // End
                ]
            },

            // Template 4: Zigzag with proper connectivity
            {
                name: "Zigzag",
                start: { x: 0, y: 6 },
                end: { x: 15, y: 6 },
                path: [
                    { x: 0, y: 6 },   // Start
                    { x: 1, y: 6 },   // Right
                    { x: 2, y: 6 },   // Right
                    { x: 2, y: 5 },   // Up
                    { x: 2, y: 4 },   // Up
                    { x: 2, y: 3 },   // Up
                    { x: 3, y: 3 },   // Right
                    { x: 4, y: 3 },   // Right
                    { x: 4, y: 4 },   // Down
                    { x: 4, y: 5 },   // Down
                    { x: 4, y: 6 },   // Down
                    { x: 4, y: 7 },   // Down
                    { x: 4, y: 8 },   // Down
                    { x: 4, y: 9 },   // Down
                    { x: 5, y: 9 },   // Right
                    { x: 6, y: 9 },   // Right
                    { x: 6, y: 8 },   // Up
                    { x: 6, y: 7 },   // Up
                    { x: 6, y: 6 },   // Up
                    { x: 6, y: 5 },   // Up
                    { x: 6, y: 4 },   // Up
                    { x: 6, y: 3 },   // Up
                    { x: 7, y: 3 },   // Right
                    { x: 8, y: 3 },   // Right
                    { x: 8, y: 4 },   // Down
                    { x: 8, y: 5 },   // Down
                    { x: 8, y: 6 },   // Down
                    { x: 8, y: 7 },   // Down
                    { x: 8, y: 8 },   // Down
                    { x: 8, y: 9 },   // Down
                    { x: 9, y: 9 },   // Right
                    { x: 10, y: 9 },  // Right
                    { x: 10, y: 8 },  // Up
                    { x: 10, y: 7 },  // Up
                    { x: 10, y: 6 },  // Up
                    { x: 10, y: 5 },  // Up
                    { x: 10, y: 4 },  // Up
                    { x: 10, y: 3 },  // Up
                    { x: 11, y: 3 },  // Right
                    { x: 12, y: 3 },  // Right
                    { x: 12, y: 4 },  // Down
                    { x: 12, y: 5 },  // Down
                    { x: 12, y: 6 },  // Down
                    { x: 13, y: 6 },  // Right
                    { x: 14, y: 6 },  // Right
                    { x: 15, y: 6 }   // End
                ]
            },

            // Template 5: Complex Winding with proper connectivity
            {
                name: "Complex Winding",
                start: { x: 0, y: 6 },
                end: { x: 15, y: 6 },
                path: [
                    { x: 0, y: 6 },   // Start
                    { x: 1, y: 6 },   // Right
                    { x: 1, y: 5 },   // Up
                    { x: 1, y: 4 },   // Up
                    { x: 2, y: 4 },   // Right
                    { x: 3, y: 4 },   // Right
                    { x: 3, y: 5 },   // Down
                    { x: 3, y: 6 },   // Down
                    { x: 3, y: 7 },   // Down
                    { x: 3, y: 8 },   // Down
                    { x: 4, y: 8 },   // Right
                    { x: 5, y: 8 },   // Right
                    { x: 5, y: 7 },   // Up
                    { x: 5, y: 6 },   // Up
                    { x: 5, y: 5 },   // Up
                    { x: 5, y: 4 },   // Up
                    { x: 5, y: 3 },   // Up
                    { x: 5, y: 2 },   // Up
                    { x: 6, y: 2 },   // Right
                    { x: 7, y: 2 },   // Right
                    { x: 7, y: 3 },   // Down
                    { x: 7, y: 4 },   // Down
                    { x: 7, y: 5 },   // Down
                    { x: 7, y: 6 },   // Down
                    { x: 7, y: 7 },   // Down
                    { x: 7, y: 8 },   // Down
                    { x: 7, y: 9 },   // Down
                    { x: 7, y: 10 },  // Down
                    { x: 8, y: 10 },  // Right
                    { x: 9, y: 10 },  // Right
                    { x: 9, y: 9 },   // Up
                    { x: 9, y: 8 },   // Up
                    { x: 9, y: 7 },   // Up
                    { x: 9, y: 6 },   // Up
                    { x: 9, y: 5 },   // Up
                    { x: 9, y: 4 },   // Up
                    { x: 9, y: 3 },   // Up
                    { x: 9, y: 2 },   // Up
                    { x: 9, y: 1 },   // Up
                    { x: 10, y: 1 },  // Right
                    { x: 11, y: 1 },  // Right
                    { x: 11, y: 2 },  // Down
                    { x: 11, y: 3 },  // Down
                    { x: 11, y: 4 },  // Down
                    { x: 11, y: 5 },  // Down
                    { x: 11, y: 6 },  // Down
                    { x: 11, y: 7 },  // Down
                    { x: 11, y: 8 },  // Down
                    { x: 11, y: 9 },  // Down
                    { x: 11, y: 10 }, // Down
                    { x: 11, y: 11 }, // Down
                    { x: 12, y: 11 }, // Right
                    { x: 13, y: 11 }, // Right
                    { x: 13, y: 10 }, // Up
                    { x: 13, y: 9 },  // Up
                    { x: 13, y: 8 },  // Up
                    { x: 13, y: 7 },  // Up
                    { x: 13, y: 6 },  // Up
                    { x: 13, y: 5 },  // Up
                    { x: 13, y: 4 },  // Up
                    { x: 13, y: 3 },  // Up
                    { x: 14, y: 3 },  // Right
                    { x: 15, y: 3 },  // Right
                    { x: 15, y: 4 },  // Down
                    { x: 15, y: 5 },  // Down
                    { x: 15, y: 6 }   // End
                ]
            }
        ];
    }

    // Select a random path template
    selectRandomTemplate() {
        const randomIndex = Math.floor(Math.random() * this.pathTemplates.length);
        return this.pathTemplates[randomIndex];
    }

    // Apply a path template to create the actual path
    applyPathTemplate(template) {
        this.enemyPath = [];

        // Validate template before applying
        if (!this.validateTemplate(template)) {
            if (this.logger) this.logger.error(`Invalid template: ${template.name}. Using fallback path.`);
            this.generateFallbackPath();
            return;
        }

        // Set start and end tiles
        this.startTile = template.start;
        this.endTile = template.end;

        // Create path from template
        for (let i = 0; i < template.path.length; i++) {
            const point = template.path[i];
            this.enemyPath.push({ x: point.x, y: point.y });
        }

        if (this.logger) this.logger.info(`Applied path template: ${template.name}`);
    }

    // Validate a path template
    validateTemplate(template) {
        // Check if template has required properties
        if (!template.name || !template.start || !template.end || !template.path) {
            if (this.logger) this.logger.error('Template missing required properties: name, start, end, path');
            return false;
        }

        // Check if path array is not empty
        if (!Array.isArray(template.path) || template.path.length === 0) {
            if (this.logger) this.logger.error('Template path must be a non-empty array');
            return false;
        }

        // Validate start and end coordinates
        if (!this.isValidPosition(template.start.x, template.start.y)) {
            if (this.logger) this.logger.error(`Template start coordinates (${template.start.x}, ${template.start.y}) are out of bounds`);
            return false;
        }

        if (!this.isValidPosition(template.end.x, template.end.y)) {
            if (this.logger) this.logger.error(`Template end coordinates (${template.end.x}, ${template.end.y}) are out of bounds`);
            return false;
        }

        // Validate all path coordinates
        for (let i = 0; i < template.path.length; i++) {
            const point = template.path[i];
            if (!this.isValidPosition(point.x, point.y)) {
                if (this.logger) this.logger.error(`Template path point ${i} coordinates (${point.x}, ${point.y}) are out of bounds`);
                return false;
            }
        }

        // Check if path starts and ends with start/end tiles
        const firstPoint = template.path[0];
        const lastPoint = template.path[template.path.length - 1];

        if (firstPoint.x !== template.start.x || firstPoint.y !== template.start.y) {
            if (this.logger) this.logger.error('Template path must start with the start coordinates');
            return false;
        }

        if (lastPoint.x !== template.end.x || lastPoint.y !== template.end.y) {
            if (this.logger) this.logger.error('Template path must end with the end coordinates');
            return false;
        }

        // Check for path connectivity (orthogonal movement only)
        for (let i = 0; i < template.path.length - 1; i++) {
            const current = template.path[i];
            const next = template.path[i + 1];

            const dx = Math.abs(next.x - current.x);
            const dy = Math.abs(next.y - current.y);

            // Should be adjacent (distance of 1) and orthogonal (not diagonal)
            if (dx + dy !== 1) {
                if (this.logger) this.logger.error(`Template path has non-orthogonal connection between points ${i} and ${i + 1}`);
                return false;
            }
        }

        return true;
    }

    // Generate a simple fallback path if template validation fails
    generateFallbackPath() {
        this.enemyPath = [];

        // Simple fallback - straight line across the middle
        const startY = Math.floor(this.rows / 2);
        this.startTile = { x: 0, y: startY };
        this.endTile = { x: this.cols - 1, y: startY };

        // Create simple straight path
        for (let x = 0; x < this.cols; x++) {
            this.enemyPath.push({ x, y: startY });
        }

        if (this.logger) this.logger.info('Applied fallback path: straight line');
    }

    // Add a new path template
    addPathTemplate(template) {
        // Validate template before adding
        if (!this.validateTemplate(template)) {
            if (this.logger) this.logger.error('Cannot add invalid template. Please fix the template and try again.');
            return false;
        }

        this.pathTemplates.push(template);
        if (this.logger) this.logger.info(`Added new path template: ${template.name}`);
        return true;
    }

    // Get all available path templates
    getPathTemplates() {
        return this.pathTemplates.map(t => ({ name: t.name, start: t.start, end: t.end }));
    }
}
