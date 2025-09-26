/**
 * Render System - Handles all rendering operations
 */
class RenderSystem {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.resourceSystem = null; // Will be set by game

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

    // Set resource system reference
    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }

    // Render tower HUD pane with enhanced styling
    renderTowerHUD(selectedTower, towerManager) {
        if (!selectedTower) return;

        const hudWidth = 320;
        const hudHeight = 220;
        const hudX = this.width - hudWidth - 20;
        const hudY = 20;

        // Enhanced HUD background with gradient
        const gradient = this.ctx.createLinearGradient(hudX, hudY, hudX, hudY + hudHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0.9)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(hudX, hudY, hudWidth, hudHeight);

        // Enhanced HUD border with glow effect
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(hudX, hudY, hudWidth, hudHeight);
        
        // Inner border for depth
        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(hudX + 2, hudY + 2, hudWidth - 4, hudHeight - 4);

        // Tower portrait area with enhanced styling
        const portraitSize = 90;
        const portraitX = hudX + 20;
        const portraitY = hudY + 20;

        // Portrait background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(portraitX - 5, portraitY - 5, portraitSize + 10, portraitSize + 10);

        // Animated tower portrait
        this.renderTowerPortrait(portraitX, portraitY, portraitSize, selectedTower);

        // Enhanced tower info with better typography
        const infoX = portraitX + portraitSize + 20;
        const infoY = portraitY + 20;

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${selectedTower.type} Tower`, infoX, infoY);

        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Level: ${selectedTower.level}`, infoX, infoY + 25);
        this.ctx.fillText(`Damage: ${selectedTower.damage}`, infoX, infoY + 45);
        this.ctx.fillText(`Range: ${selectedTower.range}`, infoX, infoY + 65);

        // Upgrade options with enhanced styling
        const upgradeInfo = towerManager.getTowerUpgradeInfo(selectedTower.x, selectedTower.y);
        if (upgradeInfo) {
            this.renderUpgradeOptions(hudX + 20, hudY + 130, upgradeInfo);
        }
    }

    renderTowerPortrait(x, y, size, tower) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size / 2 - 5;

        // Animated background
        const time = Date.now() / 1000;
        const pulseRadius = radius + Math.sin(time * 2) * 2;

        // Background glow
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = tower.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        // Tower circle
        this.ctx.fillStyle = tower.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Tower border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Level rings in portrait
        this.renderTowerLevelRings(centerX, centerY, radius, tower.level);

        // Tower type indicator
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tower.type.charAt(0), centerX, centerY + 7);

        // Rank badge in portrait
        if (tower.level > 1) {
            this.renderRankBadge(centerX, centerY - radius - 5, tower.level);
        }
    }

    renderUpgradeOptions(x, y, upgradeInfo) {
        const buttonWidth = 140;
        const buttonHeight = 45;
        const buttonSpacing = 10;

        // Enhanced upgrade button with gradient
        const canAfford = this.resourceSystem && this.resourceSystem.canAfford(upgradeInfo.cost);
        
        // Button background with gradient
        const gradient = this.ctx.createLinearGradient(x, y, x, y + buttonHeight);
        if (canAfford) {
            gradient.addColorStop(0, '#4CAF50');
            gradient.addColorStop(1, '#45A049');
        } else {
            gradient.addColorStop(0, '#9E9E9E');
            gradient.addColorStop(1, '#757575');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, buttonWidth, buttonHeight);

        // Enhanced button border
        this.ctx.strokeStyle = canAfford ? '#2E7D32' : '#424242';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, buttonWidth, buttonHeight);
        
        // Inner highlight
        this.ctx.strokeStyle = canAfford ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 1, y + 1, buttonWidth - 2, buttonHeight - 2);

        // Enhanced button text
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`⬆️ Upgrade`, x + buttonWidth/2, y + 20);
        
        // Cost text
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`💰 ${upgradeInfo.cost}`, x + buttonWidth/2, y + 35);

        // Upgrade stats preview
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`+${upgradeInfo.damageIncrease} damage`, x + buttonWidth + buttonSpacing, y + 15);
        this.ctx.fillText(`+${upgradeInfo.rangeIncrease} range`, x + buttonWidth + buttonSpacing, y + 30);
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

    renderTower(tower, tileSize, upgradeInfo = null, isSelected = false) {
        const screenX = tower.x * tileSize;
        const screenY = tower.y * tileSize;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;

        // Limit tower size to fit within tile bounds
        const maxRadius = tileSize * 0.4; // 40% of tile size to prevent overlap
        const towerRadius = Math.min(tower.size || tileSize * 0.3, maxRadius);

        // Draw level rings (visual indicator for tower level)
        this.renderTowerLevelRings(centerX, centerY, towerRadius, tower.level);

        // Draw tower as a circle with tower-specific color
        this.ctx.fillStyle = tower.color || this.colors.tower;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, towerRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw tower border (thicker if selected)
        this.ctx.strokeStyle = isSelected ? '#FFD700' : '#333';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.stroke();

        // Draw tower type indicator
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tower.type.charAt(0), centerX, centerY + 4);

        // Draw rank badge above tower (within tile bounds)
        if (tower.level > 1) {
            this.renderRankBadge(centerX, centerY - towerRadius - 8, tower.level);
        }

        // Draw selection indicator if selected
        if (isSelected) {
            this.renderSelectionIndicator(centerX, centerY, towerRadius);
        }
    }

    renderTowerLevelRings(centerX, centerY, radius, level) {
        // Draw concentric rings to indicate tower level
        for (let i = 1; i < level; i++) {
            const ringRadius = radius + (i * 3);
            const alpha = 0.3 + (i * 0.1);
            
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    renderRankBadge(centerX, badgeY, level) {
        // Draw rank badge above tower
        const badgeWidth = 20;
        const badgeHeight = 12;
        const badgeX = centerX - badgeWidth / 2;

        // Badge background
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);

        // Badge border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

        // Rank number
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(level.toString(), centerX, badgeY + 9);
    }

    renderSelectionIndicator(centerX, centerY, radius) {
        // Draw pulsing selection ring
        const time = Date.now() / 1000;
        const pulseRadius = radius + 8 + Math.sin(time * 4) * 3;
        const alpha = 0.5 + Math.sin(time * 4) * 0.3;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
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
        // Render wave announcement with enhanced visual effects
        if (waveInfo.announcement) {
            const time = Date.now() / 1000;
            const textX = this.width / 2;
            let textY = this.height / 2 - 50;

            // Split announcement into lines
            const lines = waveInfo.announcement.split('\n');

            // Check announcement type for different visual effects
            const isCountdown = waveInfo.announcement.includes('STARTS IN');
            const isWaveStart = waveInfo.announcement.includes('WAVE') && waveInfo.announcement.includes('INCOMING');
            const isWaveComplete = waveInfo.announcement.includes('Complete');
            const isBossWave = waveInfo.announcement.includes('BOSS WAVE');

            if (isCountdown) {
                // Dramatic countdown with pulsing and color cycling
                const scale = Math.sin(time * 4) * 0.1 + 1; // More dramatic pulsing
                const hue = (time * 120) % 360; // Faster color cycling
                const alpha = Math.sin(time * 2) * 0.3 + 0.7; // Pulsing opacity

                this.ctx.save();
                this.ctx.translate(textX, textY);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-textX, -textY);

                this.ctx.font = 'bold 48px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.lineWidth = 6;

                lines.forEach((line, index) => {
                    const y = textY + (index * 60);

                    // Bright, pulsing colors for countdown
                    this.ctx.fillStyle = `hsla(${hue}, 90%, 70%, ${alpha})`;
                    this.ctx.strokeStyle = '#FFFFFF';

                    // Multiple outlines for dramatic effect
                    for (let i = -3; i <= 3; i++) {
                        for (let j = -3; j <= 3; j++) {
                            this.ctx.strokeText(line, textX + i, y + j);
                        }
                    }
                    this.ctx.fillText(line, textX, y);
                });

                this.ctx.restore();
            } else if (isWaveStart) {
                // Exciting wave start announcement with zoom and sparkle effects
                const scale = Math.sin(time * 2) * 0.05 + 1;
                const hue = (time * 30) % 360;
                
                this.ctx.save();
                this.ctx.translate(textX, textY);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-textX, -textY);

                this.ctx.font = 'bold 42px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.lineWidth = 5;

                lines.forEach((line, index) => {
                    const y = textY + (index * 55);

                    // Bright, exciting colors
                    this.ctx.fillStyle = `hsl(${hue}, 85%, 65%)`;
                    this.ctx.strokeStyle = '#FFD700'; // Gold outline

                    // Thick outline for impact
                    this.ctx.strokeText(line, textX - 2, y - 2);
                    this.ctx.strokeText(line, textX + 2, y + 2);
                    this.ctx.strokeText(line, textX, y);
                    this.ctx.fillText(line, textX, y);
                });

                this.ctx.restore();
            } else if (isBossWave) {
                // Special boss wave announcement with intense effects
                const scale = Math.sin(time * 3) * 0.08 + 1;
                const hue = (time * 180) % 360;
                
                this.ctx.save();
                this.ctx.translate(textX, textY);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-textX, -textY);

                this.ctx.font = 'bold 44px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.lineWidth = 6;

                lines.forEach((line, index) => {
                    const y = textY + (index * 60);

                    // Intense red-orange colors for boss waves
                    this.ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
                    this.ctx.strokeStyle = '#FF0000'; // Red outline

                    // Multiple thick outlines
                    for (let i = -4; i <= 4; i += 2) {
                        for (let j = -4; j <= 4; j += 2) {
                            this.ctx.strokeText(line, textX + i, y + j);
                        }
                    }
                    this.ctx.fillText(line, textX, y);
                });

                this.ctx.restore();
            } else if (isWaveComplete) {
                // Celebration for wave completion
                const scale = Math.sin(time * 1.5) * 0.03 + 1;
                const hue = (time * 45) % 360;
                
                this.ctx.font = 'bold 32px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.lineWidth = 4;

                lines.forEach((line, index) => {
                    const y = textY + (index * 40);

                    // Bright, celebratory colors
                    this.ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
                    this.ctx.strokeStyle = '#00FF00'; // Green outline

                    this.ctx.strokeText(line, textX - 2, y - 2);
                    this.ctx.strokeText(line, textX + 2, y + 2);
                    this.ctx.strokeText(line, textX, y);
                    this.ctx.fillText(line, textX, y);
                });
            } else {
                // Default announcement styling
                this.ctx.font = 'bold 28px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillStyle = this.colors.waveInfo;
                this.ctx.strokeStyle = this.colors.ui;
                this.ctx.lineWidth = 3;

                lines.forEach((line, index) => {
                    const y = textY + (index * 35);

                    this.ctx.strokeText(line, textX, y);
                    this.ctx.fillText(line, textX, y);
                });
            }
        }

        // Render wave announcement effects (particles, sparkles, etc.)
        if (waveInfo.announcement) {
            this.renderWaveAnnouncementEffects(waveInfo);
        }

        // Render wave stats with enhanced UI
        this.renderWaveStatsPanel(waveInfo);
    }

    renderWaveStatsPanel(waveInfo) {
        const panelWidth = 250;
        const panelHeight = 100;
        const panelX = 20;
        const panelY = this.height - panelHeight - 20;

        // Panel background with gradient
        const gradient = this.ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        // Panel border
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        // Wave number
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Wave ${waveInfo.currentWave}`, panelX + 15, panelY + 25);

        // Enemy count with progress bar - show spawned vs total, not alive vs total
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Enemies: ${waveInfo.enemiesSpawned}/${waveInfo.totalEnemies}`, panelX + 15, panelY + 50);
        
        // Progress bar for enemies - show spawning progress
        const barWidth = 200;
        const barHeight = 8;
        const barX = panelX + 15;
        const barY = panelY + 60;
        
        // Background bar
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progress bar - show how many enemies have been spawned
        const progress = waveInfo.totalEnemies > 0 ? waveInfo.enemiesSpawned / waveInfo.totalEnemies : 0;
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        // Wave state indicator with color coding
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = this.getWaveStateColor(waveInfo.waveState);
        this.ctx.fillText(`Status: ${waveInfo.waveState.toUpperCase()}`, panelX + 15, panelY + 85);
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

    renderWaveAnnouncementEffects(waveInfo) {
        const time = Date.now() / 1000;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const isCountdown = waveInfo.announcement.includes('STARTS IN');
        const isWaveStart = waveInfo.announcement.includes('WAVE') && waveInfo.announcement.includes('INCOMING');
        const isBossWave = waveInfo.announcement.includes('BOSS WAVE');
        const isWaveComplete = waveInfo.announcement.includes('Complete');

        if (isCountdown) {
            // No pulsing ring effect for countdown - text animation is enough
        } else if (isWaveStart) {
            // Sparkle effects for wave start
            this.renderSparkleEffects(centerX, centerY, time);
        } else if (isBossWave) {
            // Intense particle effects for boss waves
            this.renderBossWaveEffects(centerX, centerY, time);
        } else if (isWaveComplete) {
            // Celebration particles for wave completion
            this.renderCelebrationEffects(centerX, centerY, time);
        }
    }

    renderSparkleEffects(centerX, centerY, time) {
        // Create sparkles around the announcement
        for (let i = 0; i < 8; i++) {
            const angle = (time * 2 + i * Math.PI / 4) % (Math.PI * 2);
            const distance = 80 + Math.sin(time * 3 + i) * 20;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            this.ctx.save();
            this.ctx.fillStyle = `hsla(${(time * 60 + i * 45) % 360}, 90%, 80%, 0.8)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3 + Math.sin(time * 4 + i) * 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    renderBossWaveEffects(centerX, centerY, time) {
        // Intense particle effects for boss waves
        for (let i = 0; i < 12; i++) {
            const angle = (time * 3 + i * Math.PI / 6) % (Math.PI * 2);
            const distance = 60 + Math.sin(time * 4 + i) * 30;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            this.ctx.save();
            this.ctx.fillStyle = `hsla(${(time * 180 + i * 30) % 360}, 95%, 70%, 0.9)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4 + Math.sin(time * 5 + i) * 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    renderCelebrationEffects(centerX, centerY, time) {
        // Celebration particles for wave completion
        for (let i = 0; i < 6; i++) {
            const angle = (time * 1.5 + i * Math.PI / 3) % (Math.PI * 2);
            const distance = 70 + Math.sin(time * 2 + i) * 15;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            this.ctx.save();
            this.ctx.fillStyle = `hsla(${(time * 45 + i * 60) % 360}, 85%, 75%, 0.7)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2 + Math.sin(time * 3 + i) * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    renderGameStateOverlay(gameStateInfo) {
        // Only render overlay for terminal states
        if (!gameStateInfo.gameState || (gameStateInfo.gameState !== 'gameOver' && gameStateInfo.gameState !== 'victory')) {
            return;
        }

        // Semi-transparent overlay
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();

        // Get restart instructions
        const instructions = this.getGameStateInstructions(gameStateInfo);
        if (!instructions) return;

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Render title
        this.ctx.save();
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = gameStateInfo.gameState === 'victory' ? '#4CAF50' : '#F44336';
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 4;
        
        this.ctx.strokeText(instructions.title, centerX, centerY - 60);
        this.ctx.fillText(instructions.title, centerX, centerY - 60);
        this.ctx.restore();

        // Render message
        this.ctx.save();
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        
        this.ctx.strokeText(instructions.message, centerX, centerY);
        this.ctx.fillText(instructions.message, centerX, centerY);
        this.ctx.restore();

        // Render restart button
        this.renderRestartButton(centerX, centerY + 80, instructions.buttonText);
    }

    getGameStateInstructions(gameStateInfo) {
        if (gameStateInfo.gameState === 'gameOver') {
            return {
                title: 'Game Over!',
                message: `Too many enemies reached the goal! (${gameStateInfo.enemiesReachedGoal}/${gameStateInfo.maxEnemiesAllowed})`,
                buttonText: 'Try Again'
            };
        } else if (gameStateInfo.gameState === 'victory') {
            return {
                title: 'Victory!',
                message: `Congratulations! You completed all waves!`,
                buttonText: 'Play Again'
            };
        }
        return null;
    }

    renderRestartButton(centerX, centerY, buttonText) {
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonX = centerX - buttonWidth / 2;
        const buttonY = centerY - buttonHeight / 2;

        // Button background
        this.ctx.save();
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Button border
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Button text
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText(buttonText, centerX, centerY + 8);
        this.ctx.restore();

        // Store button bounds for click detection
        this.restartButtonBounds = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };
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
    renderTowers(towers, tileSize, towerManager = null, selectedTower = null) {
        towers.forEach(tower => {
            let upgradeInfo = null;
            if (towerManager) {
                upgradeInfo = towerManager.getTowerUpgradeInfo(tower.x, tower.y);
            }
            const isSelected = selectedTower && selectedTower.id === tower.id;
            this.renderTower(tower, tileSize, upgradeInfo, isSelected);
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

    // Render collection effect particles
    renderCollectionEffects(effects) {
        effects.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life / particle.maxLife;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }


    // Render individual coin
    renderCoin(coin) {
        const bounceY = coin.y + coin.bounceHeight;

        // Draw coin (scaled for 64px tiles)
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(coin.x, bounceY, 16, 0, Math.PI * 2);  // Increased from 8 to 16 for better visibility
        this.ctx.fill();

        // Draw coin border
        this.ctx.strokeStyle = '#FFA500';
        this.ctx.lineWidth = 3;  // Increased from 2 to 3 for better visibility
        this.ctx.stroke();

        // Draw sparkle effect
        if (coin.sparkleTime % 200 < 100) {
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '20px Arial';  // Increased from 12px to 20px
            this.ctx.textAlign = 'center';
            this.ctx.fillText('$', coin.x, bounceY + 6);  // Adjusted position
        }
    }

    // Render resource info with enhanced UI
    renderResourceInfo(resourceInfo, pulseAnimation = null) {
        this.ctx.save();

        // Create a nice background panel for resource info
        const panelWidth = 200;
        const panelHeight = 60;
        const panelX = this.width - panelWidth - 20;
        const panelY = 10;

        // Panel background with gradient effect
        const gradient = this.ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(240, 240, 240, 0.9)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        // Panel border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        // Apply pulse animation if active
        if (pulseAnimation && pulseAnimation.active) {
            const progress = pulseAnimation.time / pulseAnimation.duration;
            const pulseScale = 1 + Math.sin(progress * Math.PI) * 0.2; // Gentler scaling
            const pulseAlpha = 1 + Math.sin(progress * Math.PI) * 0.3; // More noticeable brightness

            this.ctx.globalAlpha = pulseAlpha;
            this.ctx.font = `bold ${18 * pulseScale}px Arial`;
        } else {
            this.ctx.font = 'bold 18px Arial';
        }

        // Coin icon and text
        this.ctx.fillStyle = '#FFD700'; // Gold color for coins
        this.ctx.textAlign = 'left';
        
        // Draw coin icon (simple circle)
        const coinX = panelX + 15;
        const coinY = panelY + 25;
        this.ctx.beginPath();
        this.ctx.arc(coinX, coinY, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Coin border
        this.ctx.strokeStyle = '#B8860B';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Coin text
        this.ctx.fillStyle = '#333333';
        this.ctx.fillText(`Coins: ${resourceInfo.coins}`, coinX + 25, coinY + 5);

        this.ctx.restore();
    }
}
