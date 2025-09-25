/**
 * Render System - Handles all rendering operations
 */
class RenderSystem {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        
        // Color palette
        this.colors = {
            background: '#98FB98',
            grid: '#90EE90',
            path: '#8B4513',
            tower: '#FF6B6B',
            debug: '#FF0000'
        };
    }
    
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    renderGrid(gridSystem, debug) {
        const tileSize = gridSystem.tileSize;
        
        // Render tiles
        for (let y = 0; y < gridSystem.rows; y++) {
            for (let x = 0; x < gridSystem.cols; x++) {
                const tile = gridSystem.getTile(x, y);
                if (tile) {
                    this.renderTile(x, y, tile, tileSize);
                }
            }
        }
        
        // Render towers
        gridSystem.getTowers().forEach(tower => {
            this.renderTower(tower, tileSize);
        });
        
        // Render debug elements
        if (debug.enabled) {
            if (debug.showGrid) {
                this.renderGridLines(gridSystem);
            }
            if (debug.showPath) {
                this.renderEnemyPath(gridSystem);
            }
        }
    }
    
    renderTile(gridX, gridY, tile, tileSize) {
        const screenX = gridX * tileSize;
        const screenY = gridY * tileSize;
        
        // Set tile color based on type
        if (tile.type === 'path') {
            this.ctx.fillStyle = this.colors.path;
        } else {
            this.ctx.fillStyle = this.colors.grid;
        }
        
        // Draw tile
        this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
        
        // Draw border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenX, screenY, tileSize, tileSize);
    }
    
    renderTower(tower, tileSize) {
        const screenX = tower.x * tileSize;
        const screenY = tower.y * tileSize;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;
        
        // Draw tower as a circle
        this.ctx.fillStyle = this.colors.tower;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, tileSize * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw tower border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    renderGridLines(gridSystem) {
        this.ctx.strokeStyle = this.colors.debug;
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= gridSystem.cols; x++) {
            const screenX = x * gridSystem.tileSize;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= gridSystem.rows; y++) {
            const screenY = y * gridSystem.tileSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.width, screenY);
            this.ctx.stroke();
        }
    }
    
    renderEnemyPath(gridSystem) {
        const path = gridSystem.getEnemyPath();
        if (path.length < 2) return;
        
        this.ctx.strokeStyle = this.colors.debug;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            const screenX = point.x * gridSystem.tileSize + gridSystem.tileSize / 2;
            const screenY = point.y * gridSystem.tileSize + gridSystem.tileSize / 2;
            
            if (i === 0) {
                this.ctx.moveTo(screenX, screenY);
            } else {
                this.ctx.lineTo(screenX, screenY);
            }
        }
        
        this.ctx.stroke();
    }
    
    renderDebugInfo(debug) {
        // This will be handled by the HTML debug panel
        // Could add additional debug rendering here if needed
    }
}
