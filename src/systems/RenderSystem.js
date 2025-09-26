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
            debug: '#FF0000',
            enemy: '#FF6B6B',
            ui: '#333333',
            waveInfo: '#FFFFFF'
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

        // Towers are now rendered separately in the main game loop
        // This method only handles grid rendering

        // Render debug elements (work independently)
        if (debug.showGrid) {
            this.renderGridLines(gridSystem);
        }
        if (debug.showPath) {
            this.renderEnemyPath(gridSystem);
        }
        if (debug.showCollision) {
            this.renderCollisionAreas(gridSystem);
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

        // Draw tower as a circle with tower-specific color
        this.ctx.fillStyle = tower.color || this.colors.tower;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, (tower.size || tileSize * 0.3), 0, Math.PI * 2);
        this.ctx.fill();

        // Draw tower border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw tower type indicator
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tower.type.charAt(0), centerX, centerY + 4);
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

    renderCollisionAreas(gridSystem) {
        const tileSize = gridSystem.tileSize;

        // Render buildable areas with semi-transparent overlay
        for (let y = 0; y < gridSystem.rows; y++) {
            for (let x = 0; x < gridSystem.cols; x++) {
                const tile = gridSystem.getTile(x, y);
                if (tile) {
                    const screenX = x * tileSize;
                    const screenY = y * tileSize;

                    if (tile.buildable && !gridSystem.hasTowerAt(x, y)) {
                        // Buildable area - green overlay
                        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                        this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
                    } else if (!tile.buildable) {
                        // Non-buildable area (path) - red overlay
                        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                        this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
                    } else if (gridSystem.hasTowerAt(x, y)) {
                        // Tower placement - blue overlay
                        this.ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
                        this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
                    }
                }
            }
        }
    }

    renderEnemies(enemies, tileSize) {
        enemies.forEach(enemy => {
            if (enemy.isAlive && !enemy.reachedGoal) {
                this.renderEnemy(enemy, tileSize);
            }
        });
    }

    renderEnemy(enemy, tileSize) {
        const screenX = enemy.x * tileSize;
        const screenY = enemy.y * tileSize;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;
        const radius = (tileSize * enemy.size) / 2;

        // Draw enemy as a circle
        this.ctx.fillStyle = enemy.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw enemy border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw health bar above enemy
        if (enemy.health < enemy.maxHealth) {
            const barWidth = tileSize * 0.8;
            const barHeight = 4;
            const barX = centerX - barWidth / 2;
            const barY = centerY - radius - 10;

            // Background
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            // Health
            const healthPercent = enemy.health / enemy.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FF9800' : '#F44336';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        }
    }

    renderWaveInfo(waveInfo) {
        // Render wave announcement
        if (waveInfo.announcement) {
            const time = Date.now() / 1000;
            const textX = this.width / 2;
            let textY = this.height / 2 - 50;

            // Split announcement into lines
            const lines = waveInfo.announcement.split('\n');

            // Check if this is the dramatic countdown announcement
            const isCountdown = waveInfo.announcement.includes('STARTS IN');

            if (isCountdown) {
                // Subtle effects only for countdown
                const scale = Math.sin(time * 3) * 0.05 + 1; // Much gentler grow/shrink (5% max)
                const hue = (time * 60) % 360; // Slower color cycling

                // Save context state
                this.ctx.save();

                // Translate to center before scaling to keep text centered
                this.ctx.translate(textX, textY);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-textX, -textY);

                // Larger, dramatic font for countdown
                this.ctx.font = 'bold 36px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.lineWidth = 4;

                lines.forEach((line, index) => {
                    const y = textY + (index * 50);

                    // Subtle color for countdown
                    this.ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                    this.ctx.strokeStyle = '#FFFFFF';

                    // Draw multiple outlines for dramatic effect
                    this.ctx.strokeText(line, textX - 2, y - 2);
                    this.ctx.strokeText(line, textX + 2, y + 2);
                    this.ctx.strokeText(line, textX, y);
                    this.ctx.fillText(line, textX, y);
                });

                // Restore context state
                this.ctx.restore();
            } else {
                // Simple, non-animated text for other announcements
                this.ctx.font = 'bold 24px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillStyle = this.colors.waveInfo;
                this.ctx.strokeStyle = this.colors.ui;
                this.ctx.lineWidth = 2;

                lines.forEach((line, index) => {
                    const y = textY + (index * 30);

                    // Draw text with simple outline
                    this.ctx.strokeText(line, textX, y);
                    this.ctx.fillText(line, textX, y);
                });
            }
        }

        // Render wave stats
        this.ctx.fillStyle = this.colors.ui;
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';

        const statsY = this.height - 60;
        this.ctx.fillText(`Wave: ${waveInfo.currentWave}`, 20, statsY);
        this.ctx.fillText(`Enemies: ${waveInfo.enemiesAlive}/${waveInfo.totalEnemies}`, 20, statsY + 20);

        // Wave state indicator
        this.ctx.fillStyle = this.getWaveStateColor(waveInfo.waveState);
        this.ctx.fillText(`State: ${waveInfo.waveState}`, 20, statsY + 40);
    }

    getWaveStateColor(state) {
        switch (state) {
            case 'preparation': return '#FF9800';
            case 'spawning': return '#F44336';
            case 'active': return '#4CAF50';
            case 'complete': return '#2196F3';
            default: return '#333333';
        }
    }

    renderDebugInfo(debug) {
        // Render additional debug information on canvas
        this.ctx.fillStyle = this.colors.ui;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';

        const debugY = 80;
        let lineHeight = 20;
        let currentY = debugY;

        // Debug mode status
        this.ctx.fillText(`Debug Mode: ${debug.enabled ? 'ON' : 'OFF'}`, 20, currentY);
        currentY += lineHeight;

        // Individual debug flags
        this.ctx.fillText(`Grid Lines: ${debug.showGrid ? 'ON' : 'OFF'}`, 20, currentY);
        currentY += lineHeight;

        this.ctx.fillText(`Enemy Path: ${debug.showPath ? 'ON' : 'OFF'}`, 20, currentY);
        currentY += lineHeight;

        this.ctx.fillText(`Collision Areas: ${debug.showCollision ? 'ON' : 'OFF'}`, 20, currentY);
        currentY += lineHeight;

        // Instructions
        currentY += 10;
        this.ctx.fillText('Debug Keys:', 20, currentY);
        currentY += lineHeight;
        this.ctx.fillText('D - Toggle debug mode', 20, currentY);
        currentY += lineHeight;
        this.ctx.fillText('G - Toggle grid lines', 20, currentY);
        currentY += lineHeight;
        this.ctx.fillText('P - Toggle enemy path', 20, currentY);
        currentY += lineHeight;
        this.ctx.fillText('C - Toggle collision areas', 20, currentY);
    }

    // Render towers from tower system
    renderTowers(towers, tileSize) {
        towers.forEach(tower => {
            this.renderTower(tower, tileSize);
        });
    }

    // Render projectiles
    renderProjectiles(projectiles) {
        projectiles.forEach(projectile => {
            this.renderProjectile(projectile);
        });
    }

    // Render individual projectile
    renderProjectile(projectile) {
        this.ctx.fillStyle = projectile.color;
        this.ctx.beginPath();
        this.ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
        this.ctx.fill();

        // Add sparkle effect
        this.ctx.strokeStyle = '#FFF';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    // Render coins
    renderCoins(coins) {
        coins.forEach(coin => {
            this.renderCoin(coin);
        });
    }

    // Render individual coin
    renderCoin(coin) {
        const bounceY = coin.y + coin.bounceHeight;

        // Draw coin
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(coin.x, bounceY, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw coin border
        this.ctx.strokeStyle = '#FFA500';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw sparkle effect
        if (coin.sparkleTime % 200 < 100) {
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('$', coin.x, bounceY + 4);
        }
    }

    // Render resource info
    renderResourceInfo(resourceInfo) {
        this.ctx.fillStyle = this.colors.ui;
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'right';

        const infoY = 20;
        this.ctx.fillText(`Coins: ${resourceInfo.coins}`, this.width - 20, infoY);
    }
}
