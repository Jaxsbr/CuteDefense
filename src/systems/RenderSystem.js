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

    // Calculate tilemap height based on grid configuration
    getTilemapHeight() {
        // This should match the grid system's actual height
        // For now, we'll calculate based on standard grid size
        return 12 * 64; // 12 rows * 64px tile size
    }

    // Render main HUD panel - always visible below tilemap with cartoony styling
    renderMainHUD(selectedTower, towerManager, waveInfo = null, resourceInfo = null) {
        // Calculate HUD area below tilemap
        const tilemapHeight = this.getTilemapHeight();
        const hudHeight = 120; // Fixed height for HUD
        const hudY = tilemapHeight + 10; // 10px gap below tilemap
        const hudWidth = this.width - 20; // Full width minus margins
        const hudX = 10; // 10px margin from left

        // Clean HUD background with rounded corners
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(hudX, hudY, hudWidth, hudHeight, 15); // Rounded corners
        this.ctx.clip();
        
        // Static gradient background (no pulsing)
        const gradient = this.ctx.createLinearGradient(hudX, hudY, hudX, hudY + hudHeight);
        gradient.addColorStop(0, 'rgba(40, 40, 40, 0.95)');
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0.9)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(hudX, hudY, hudWidth, hudHeight);
        this.ctx.restore();

        // Clean border with subtle glow
        this.ctx.save();
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 4;
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.roundRect(hudX, hudY, hudWidth, hudHeight, 15);
        this.ctx.stroke();
        this.ctx.restore();

        // Inner border
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(hudX + 2, hudY + 2, hudWidth - 4, hudHeight - 4, 13);
        this.ctx.stroke();
        this.ctx.restore();

        // Subtle sparkle effects (reduced)
        this.renderHUDSparkles(hudX, hudY, hudWidth, hudHeight, time);

        // Render the five HUD sections
        this.renderHUDSections(hudX, hudY, hudWidth, hudHeight, selectedTower, towerManager, waveInfo, resourceInfo);
    }

    // Render subtle sparkle effects around HUD
    renderHUDSparkles(hudX, hudY, hudWidth, hudHeight, time) {
        this.ctx.save();
        
        // Create subtle sparkles (reduced count and intensity)
        for (let i = 0; i < 4; i++) {
            const angle = (time * 0.2 + i * Math.PI / 2) % (Math.PI * 2);
            const distance = 20 + Math.sin(time * 0.5 + i) * 3;
            const sparkleX = hudX + hudWidth / 2 + Math.cos(angle) * (hudWidth / 2 + distance);
            const sparkleY = hudY + hudHeight / 2 + Math.sin(angle) * (hudHeight / 2 + distance);
            
            const sparkleSize = 1 + Math.sin(time * 1 + i) * 0.5;
            const sparkleAlpha = Math.sin(time * 0.5 + i) * 0.3 + 0.2;
            
            this.ctx.globalAlpha = sparkleAlpha;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    // Render the five HUD sections: Wave Info, Selection Portrait, Selection Info, Selection Actions, Coin Info
    renderHUDSections(hudX, hudY, hudWidth, hudHeight, selectedTower, towerManager, waveInfo, resourceInfo) {
        const padding = 15;
        const contentHeight = hudHeight - (padding * 2);
        const contentY = hudY + padding;

        // Calculate section widths (5 equal sections)
        const sectionWidth = (hudWidth - (padding * 6)) / 5; // 5 sections with 6 gaps

        // Section 1: Wave Info
        const waveInfoX = hudX + padding;
        this.renderWaveInfoSection(waveInfoX, contentY, sectionWidth, contentHeight, waveInfo);

        // Section 2: Selection Portrait
        const portraitX = waveInfoX + sectionWidth + padding;
        this.renderSelectionPortraitSection(portraitX, contentY, sectionWidth, contentHeight, selectedTower);

        // Section 3: Selection Info
        const infoX = portraitX + sectionWidth + padding;
        this.renderSelectionInfoSection(infoX, contentY, sectionWidth, contentHeight, selectedTower);

        // Section 4: Selection Actions
        const actionsX = infoX + sectionWidth + padding;
        this.renderSelectionActionsSection(actionsX, contentY, sectionWidth, contentHeight, selectedTower, towerManager);

        // Section 5: Coin Info
        const coinX = actionsX + sectionWidth + padding;
        this.renderCoinInfoSection(coinX, contentY, sectionWidth, contentHeight, resourceInfo);
    }

    // Render wave info section with cartoony styling
    renderWaveInfoSection(x, y, width, height, waveInfo) {
        this.ctx.save();

        const time = Date.now() / 1000;

        // Cartoony section background with rounded corners
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.clip();

        // Static gradient background
        const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, 'rgba(0, 100, 200, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 80, 180, 0.2)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.restore();

        // Cartoony border with glow
        this.ctx.save();
        this.ctx.shadowColor = '#4CAF50';
        this.ctx.shadowBlur = 4;
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

        // Static title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🌊 Wave Info', x + width / 2, y + 20);
        
        // Display wave data (no pulsing)
        this.ctx.font = '14px Arial';
        this.ctx.globalAlpha = 1.0;

        if (waveInfo) {
            this.ctx.fillText(`Wave: ${waveInfo.currentWave || 1}`, x + width / 2, y + 40);
            this.ctx.fillText(`Enemies: ${waveInfo.enemiesSpawned || 0}/${waveInfo.totalEnemies || 0}`, x + width / 2, y + 60);
            this.ctx.fillText(`Status: ${waveInfo.waveState || 'preparation'}`, x + width / 2, y + 80);
        } else {
            this.ctx.fillText('Wave: 1', x + width / 2, y + 40);
            this.ctx.fillText('Enemies: 0/0', x + width / 2, y + 60);
            this.ctx.fillText('Status: preparation', x + width / 2, y + 80);
        }

        this.ctx.restore();
    }

    // Render selection portrait section with cartoony styling
    renderSelectionPortraitSection(x, y, width, height, selectedTower) {
        this.ctx.save();

        const time = Date.now() / 1000;

        // Cartoony section background with rounded corners
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.clip();

        // Static gradient background
        const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, 'rgba(200, 100, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(180, 80, 0, 0.2)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.restore();

        // Cartoony border with glow
        this.ctx.save();
        this.ctx.shadowColor = '#FF9800';
        this.ctx.shadowBlur = 4;
        this.ctx.strokeStyle = '#FF9800';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

        // Static portrait title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🎯 Selection', x + width / 2, y + 20);
        
        if (selectedTower) {
            // Render tower portrait (no animation)
            const portraitSize = Math.min(width - 20, height - 40, 60);
            const portraitX = x + (width - portraitSize) / 2;
            const portraitY = y + 30;
            
            this.renderTowerPortrait(portraitX, portraitY, portraitSize, selectedTower);
        } else {
            // Show empty selection (no pulsing)
            this.ctx.font = '14px Arial';
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillText('No Selection', x + width / 2, y + height / 2);
        }

        this.ctx.restore();
    }

    // Render selection info section
    renderSelectionInfoSection(x, y, width, height, selectedTower) {
        this.ctx.save();

        // Section background
        this.ctx.fillStyle = 'rgba(100, 0, 200, 0.3)';
        this.ctx.fillRect(x, y, width, height);

        // Section border
        this.ctx.strokeStyle = '#9C27B0';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Info title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Details', x + width / 2, y + 20);

        if (selectedTower) {
            // Render tower details
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${selectedTower.type} Tower`, x + 10, y + 40);
            this.ctx.fillText(`Level: ${selectedTower.level}`, x + 10, y + 55);
            this.ctx.fillText(`Damage: ${selectedTower.damage}`, x + 10, y + 70);
            this.ctx.fillText(`Range: ${selectedTower.range}`, x + 10, y + 85);
        } else {
            // Show empty info
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('No Selection', x + width / 2, y + height / 2);
        }

        this.ctx.restore();
    }

    // Render selection actions section
    renderSelectionActionsSection(x, y, width, height, selectedTower, towerManager) {
        this.ctx.save();

        // Section background
        this.ctx.fillStyle = 'rgba(0, 200, 100, 0.3)';
        this.ctx.fillRect(x, y, width, height);

        // Section border
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Actions title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Actions', x + width / 2, y + 20);

        if (selectedTower) {
            // Render upgrade button
            const upgradeInfo = towerManager.getTowerUpgradeInfo(selectedTower.x, selectedTower.y);
            if (upgradeInfo) {
                const buttonWidth = width - 20;
                const buttonHeight = 30;
                const buttonX = x + 10;
                const buttonY = y + 35;

                const canAfford = this.resourceSystem && this.resourceSystem.canAfford(upgradeInfo.cost);

                // Button background
                this.ctx.fillStyle = canAfford ? '#4CAF50' : '#9E9E9E';
                this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

                // Button border
                this.ctx.strokeStyle = canAfford ? '#2E7D32' : '#424242';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

                // Button text
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('⬆️ Upgrade', buttonX + buttonWidth / 2, buttonY + 20);

                // Cost text
                this.ctx.font = '12px Arial';
                this.ctx.fillText(`💰 ${upgradeInfo.cost}`, buttonX + buttonWidth / 2, buttonY + 35);
            }
        } else {
            // Show no actions
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('No Actions', x + width / 2, y + height / 2);
        }

        this.ctx.restore();
    }

    // Render coin info section with cartoony styling and animations
    renderCoinInfoSection(x, y, width, height, resourceInfo) {
        this.ctx.save();

        const time = Date.now() / 1000;

        // Cartoony section background with rounded corners
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.clip();

        // Static gradient background
        const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, 'rgba(200, 200, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(180, 180, 0, 0.2)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.restore();

        // Cartoony border with glow
        this.ctx.save();
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 6;
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

        // Static coin title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('💰 Coins', x + width / 2, y + 20);
        
        // Display coin count (no pulsing)
        this.ctx.font = 'bold 18px Arial';
        const coinCount = resourceInfo ? (resourceInfo.coins || 0) : 0;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${coinCount}`, x + width / 2, y + 50);

        // Static coin icon (no rotation or bounce)
        const coinX = x + width / 2;
        const coinY = y + 70;
        
        this.ctx.save();
        this.ctx.translate(coinX, coinY);

        // Coin with glow effect
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // Coin border
        this.ctx.strokeStyle = '#B8860B';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Coin sparkle effect (removed excessive sparkles)
        this.ctx.restore();

        this.ctx.restore();
    }

    // Render sparkle effects around coin
    renderCoinSparkles(coinX, coinY, time) {
        this.ctx.save();

        // Create sparkles around the coin
        for (let i = 0; i < 4; i++) {
            const angle = (time * 2 + i * Math.PI / 2) % (Math.PI * 2);
            const distance = 20 + Math.sin(time * 3 + i) * 5;
            const sparkleX = coinX + Math.cos(angle) * distance;
            const sparkleY = coinY + Math.sin(angle) * distance;

            const sparkleSize = 1 + Math.sin(time * 4 + i) * 0.5;
            const sparkleAlpha = Math.sin(time * 3 + i) * 0.5 + 0.5;

            this.ctx.globalAlpha = sparkleAlpha;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    // Legacy method for backward compatibility - now calls main HUD
    renderTowerHUD(selectedTower, towerManager, waveInfo = null, resourceInfo = null) {
        this.renderMainHUD(selectedTower, towerManager, waveInfo, resourceInfo);

        // Calculate HUD area below tilemap
        const tilemapHeight = this.getTilemapHeight();
        const hudHeight = 120; // Fixed height for HUD
        const hudY = tilemapHeight + 10; // 10px gap below tilemap
        const hudWidth = this.width - 20; // Full width minus margins
        const hudX = 10; // 10px margin from left

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

        // Implement flexible layout: fill | portrait | info | upgrade | fill
        this.renderFlexibleHUDLayout(hudX, hudY, hudWidth, hudHeight, selectedTower, towerManager, waveInfo, resourceInfo);
    }

    // Render flexible HUD layout: fill | portrait | info | upgrade | fill
    renderFlexibleHUDLayout(hudX, hudY, hudWidth, hudHeight, selectedTower, towerManager, waveInfo = null, resourceInfo = null) {
        const padding = 15;
        const contentHeight = hudHeight - (padding * 2);
        const contentY = hudY + padding;

        // Calculate flexible layout sections
        const portraitSize = 80;
        const infoWidth = 200;
        const upgradeWidth = 140; // Reduced from 180
        const fillWidth = (hudWidth - portraitSize - infoWidth - upgradeWidth - (padding * 4)) / 2;

        // Section 1: Fill (left) - Restore margin
        const fill1X = hudX + padding;
        const fill1Width = fillWidth;

        // Section 2: Portrait
        const portraitX = fill1X + fill1Width + padding;
        const portraitY = contentY + (contentHeight - portraitSize) / 2;

        // Section 3: Info
        const infoX = portraitX + portraitSize + padding;
        const infoY = contentY + 10;

        // Section 4: Upgrade - Move closer to info section
        const upgradeX = infoX + infoWidth + (padding / 2); // Reduced spacing
        const upgradeY = contentY + 10;

        // Section 5: Fill (right) - Shorter coin display
        const fill2X = upgradeX + upgradeWidth + padding;
        const fill2Width = Math.min(fillWidth, hudX + hudWidth - fill2X - padding); // Ensure it doesn't exceed HUD bounds

        // Render portrait
        this.renderTowerPortrait(portraitX, portraitY, portraitSize, selectedTower);

        // Render tower info
        this.renderTowerInfo(infoX, infoY, selectedTower);

        // Render upgrade options
        const upgradeInfo = towerManager.getTowerUpgradeInfo(selectedTower.x, selectedTower.y);
        if (upgradeInfo) {
            this.renderUpgradeOptions(upgradeX, upgradeY, upgradeInfo);
        }

        // Render wave info in left fill section
        this.renderWaveInfoInHUD(fill1X, contentY, fill1Width, contentHeight, waveInfo);

        // Render coin display in right fill section
        this.renderCoinDisplayInHUD(fill2X, contentY, fill2Width, contentHeight, resourceInfo);
    }

    // Render tower information section
    renderTowerInfo(x, y, tower) {
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${tower.type} Tower`, x, y);

        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Level: ${tower.level}`, x, y + 25);
        this.ctx.fillText(`Damage: ${tower.damage}`, x, y + 45);
        this.ctx.fillText(`Range: ${tower.range}`, x, y + 65);
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
        const buttonWidth = 120; // Reduced to match new layout
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
        this.ctx.fillText(`⬆️ Upgrade`, x + buttonWidth / 2, y + 20);

        // Cost text
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`💰 ${upgradeInfo.cost}`, x + buttonWidth / 2, y + 35);

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

        // Draw level rings (visual indicator for tower level) - no pulsing
        this.renderTowerLevelRings(centerX, centerY, towerRadius, tower.level);

        // Draw tower as a circle with tower-specific color
        this.ctx.fillStyle = tower.color || this.colors.tower;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, towerRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw tower border (thicker if selected, darker for better contrast)
        this.ctx.strokeStyle = isSelected ? '#2C3E50' : '#1A1A1A'; // Darker colors for better contrast
        this.ctx.lineWidth = isSelected ? 4 : 2;
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

        // Draw selection indicator if selected (only for selected towers)
        if (isSelected) {
            this.renderSelectionIndicator(centerX, centerY, towerRadius);
        }
    }

    renderTowerLevelRings(centerX, centerY, radius, level) {
        // Draw concentric rings to indicate tower level - no pulsing, better contrast
        for (let i = 1; i < level; i++) {
            const ringRadius = radius + (i * 3);
            const alpha = 0.4 + (i * 0.15); // Slightly more visible

            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.strokeStyle = '#34495E'; // Darker color for better contrast with grass
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
        // Draw darker, more subtle selection ring for better contrast
        const time = Date.now() / 1000;
        const pulseRadius = radius + 6 + Math.sin(time * 2) * 2; // Slower, smaller pulse
        const alpha = 0.7 + Math.sin(time * 2) * 0.2; // More subtle alpha change

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = '#2C3E50'; // Darker color for better contrast with grass
        this.ctx.lineWidth = 4; // Thicker for better visibility
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

        // Save context state
        this.ctx.save();

        // Apply damage flash effect
        if (enemy.isFlashing) {
            this.ctx.globalAlpha = 0.7;
        }

        // Draw glow effect
        if (enemy.glowColor) {
            this.ctx.shadowColor = enemy.glowColor;
            this.ctx.shadowBlur = 8;
        }

        // Draw enemy based on shape
        this.ctx.fillStyle = enemy.color;
        this.ctx.beginPath();

        switch (enemy.shape) {
            case 'circle':
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                break;
            case 'diamond':
                this.drawDiamond(centerX, centerY, radius);
                break;
            case 'square':
                this.drawSquare(centerX, centerY, radius);
                break;
            default:
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        }

        this.ctx.fill();

        // Draw border
        if (enemy.borderColor && enemy.borderWidth) {
            this.ctx.strokeStyle = enemy.borderColor;
            this.ctx.lineWidth = enemy.borderWidth;
            this.ctx.stroke();
        }

        // Draw health bar for damaged enemies
        if (enemy.health < enemy.maxHealth) {
            this.renderEnemyHealthBar(enemy, centerX, centerY, radius, tileSize);
        }

        // Restore context state
        this.ctx.restore();
    }

    drawDiamond(centerX, centerY, radius) {
        this.ctx.moveTo(centerX, centerY - radius);
        this.ctx.lineTo(centerX + radius, centerY);
        this.ctx.lineTo(centerX, centerY + radius);
        this.ctx.lineTo(centerX - radius, centerY);
        this.ctx.closePath();
    }

    drawSquare(centerX, centerY, radius) {
        const halfSize = radius * 0.8; // Slightly smaller for better visual balance
        this.ctx.rect(centerX - halfSize, centerY - halfSize, halfSize * 2, halfSize * 2);
    }

    renderEnemyHealthBar(enemy, centerX, centerY, radius, tileSize) {
        const barWidth = radius * 2;
        const barHeight = 4;
        const barY = centerY - radius - 8;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(centerX - barWidth / 2, barY, barWidth, barHeight);

        // Health
        const healthPercent = enemy.health / enemy.maxHealth;
        const healthWidth = barWidth * healthPercent;

        // Color based on health percentage
        if (healthPercent > 0.6) {
            this.ctx.fillStyle = '#4CAF50'; // Green
        } else if (healthPercent > 0.3) {
            this.ctx.fillStyle = '#FF9800'; // Orange
        } else {
            this.ctx.fillStyle = '#F44336'; // Red
        }

        this.ctx.fillRect(centerX - barWidth / 2, barY, healthWidth, barHeight);

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

            // Render upgrade particles if they exist
            if (tower.upgradeParticles) {
                this.renderUpgradeParticles(tower.upgradeParticles);
            }
        });
    }

    // Render projectiles
    renderProjectiles(projectiles) {
        projectiles.forEach(projectile => {
            this.renderProjectile(projectile);
        });
    }

    // Render individual projectile with trail effect
    renderProjectile(projectile) {
        // Save context state
        this.ctx.save();

        // Render trail effect
        if (projectile.trail && projectile.trail.length > 1) {
            this.ctx.strokeStyle = projectile.color;
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.6;
            this.ctx.beginPath();
            this.ctx.moveTo(projectile.trail[0].x, projectile.trail[0].y);
            for (let i = 1; i < projectile.trail.length; i++) {
                this.ctx.lineTo(projectile.trail[i].x, projectile.trail[i].y);
            }
            this.ctx.stroke();
        }

        // Reset alpha for main projectile
        this.ctx.globalAlpha = 1.0;

        // Render main projectile with glow effect
        this.ctx.shadowColor = projectile.color;
        this.ctx.shadowBlur = 8;

        this.ctx.fillStyle = projectile.color;
        this.ctx.beginPath();
        this.ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
        this.ctx.fill();

        // Add bright center
        this.ctx.fillStyle = '#FFF';
        this.ctx.beginPath();
        this.ctx.arc(projectile.x, projectile.y, projectile.size * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        // Add border
        this.ctx.strokeStyle = '#FFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Restore context state
        this.ctx.restore();
    }

    // Render upgrade particles
    renderUpgradeParticles(particles) {
        particles.forEach(particle => {
            this.ctx.save();

            // Set alpha for fading effect
            this.ctx.globalAlpha = particle.alpha;

            // Draw particle with glow effect
            this.ctx.shadowColor = particle.color;
            this.ctx.shadowBlur = 6;

            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Add bright center
            this.ctx.fillStyle = '#FFF';
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
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

    // Render tower placement popup
    renderTowerPlacementPopup(popupInfo) {
        if (!popupInfo) return;

        const { x, y, tileSize } = popupInfo;
        const popupSize = 60;
        const popupX = x * tileSize + (tileSize - popupSize) / 2;
        const popupY = y * tileSize + (tileSize - popupSize) / 2;

        // Popup background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(popupX, popupY, popupSize, popupSize);

        // Popup border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(popupX, popupY, popupSize, popupSize);

        // + button (place tower)
        const plusButtonSize = 20;
        const plusButtonX = popupX + 10;
        const plusButtonY = popupY + 10;

        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(plusButtonX, plusButtonY, plusButtonSize, plusButtonSize);
        this.ctx.strokeStyle = '#2E7D32';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(plusButtonX, plusButtonY, plusButtonSize, plusButtonSize);

        // + symbol
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('+', plusButtonX + plusButtonSize / 2, plusButtonY + plusButtonSize / 2 + 5);

        // X button (cancel)
        const xButtonSize = 20;
        const xButtonX = popupX + 30;
        const xButtonY = popupY + 10;

        this.ctx.fillStyle = '#F44336';
        this.ctx.fillRect(xButtonX, xButtonY, xButtonSize, xButtonSize);
        this.ctx.strokeStyle = '#D32F2F';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(xButtonX, xButtonY, xButtonSize, xButtonSize);

        // X symbol
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('×', xButtonX + xButtonSize / 2, xButtonY + xButtonSize / 2 + 5);

        // Store button bounds for click detection
        this.placementPopupBounds = {
            plus: {
                x: plusButtonX,
                y: plusButtonY,
                width: plusButtonSize,
                height: plusButtonSize
            },
            cancel: {
                x: xButtonX,
                y: xButtonY,
                width: xButtonSize,
                height: xButtonSize
            }
        };
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

    // Render wave info in HUD left fill section
    renderWaveInfoInHUD(x, y, width, height, waveInfo = null) {
        this.ctx.save();

        // Background for wave info
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x, y, width, height);

        // Wave info text
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Wave Info', x + width / 2, y + 25);

        // Display actual wave data
        this.ctx.font = '14px Arial';
        if (waveInfo) {
            this.ctx.fillText(`Wave: ${waveInfo.currentWave || 1}`, x + width / 2, y + 45);
            this.ctx.fillText(`Enemies: ${waveInfo.enemiesRemaining || 0}`, x + width / 2, y + 65);
        } else {
            this.ctx.fillText('Wave: 1', x + width / 2, y + 45);
            this.ctx.fillText('Enemies: 0', x + width / 2, y + 65);
        }

        this.ctx.restore();
    }

    // Render coin display in HUD right fill section
    renderCoinDisplayInHUD(x, y, width, height, resourceInfo = null) {
        this.ctx.save();

        // Background for coin display
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x, y, width, height);

        // Coin display
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('💰 Coins', x + width / 2, y + 25);

        // Display actual coin count
        this.ctx.font = '14px Arial';
        if (resourceInfo) {
            this.ctx.fillText(`${resourceInfo.coins || 0}`, x + width / 2, y + 45);
        } else {
            this.ctx.fillText('0', x + width / 2, y + 45);
        }

        this.ctx.restore();
    }
}
