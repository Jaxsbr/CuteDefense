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

        // Day/night cycle system
        this.dayNightSystem = {
            currentPhase: 'night', // Start as night, will change to day on first update
            transitionProgress: 0, // 0-1 for smooth transitions
            initialized: false, // Track if system has been initialized
            transitionStartTime: 0, // Track when transition started
            transitionDuration: 4000, // 4 seconds in milliseconds
            phaseChangeEffect: {
                active: false,
                duration: 1000, // 1 second
                startTime: 0,
                type: 'fade' // 'fade' or 'flash'
            },
            phaseColors: {
                day: {
                    background: '#98FB98',  // Light green grass
                    grid: '#90EE90',       // Slightly darker green
                    path: '#8B4513',
                    tower: '#FF6B6B',
                    enemy: '#FF6B6B',
                    ambientLight: 1.0
                },
                night: {
                    background: '#2C3E50',
                    grid: '#34495E',
                    path: '#5D4E37',
                    tower: '#E74C3C',
                    enemy: '#E74C3C',
                    ambientLight: 0.3
                }
            }
        };
    }

    // Set resource system reference
    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
    }

    // Render start menu with animations and parallax
    renderStartMenu(gameState) {
        this.ctx.save();

        // Bright animated parallax background
        this.renderParallaxBackground();

        // Menu background with animation
        const menuWidth = 500;
        const menuHeight = 400;
        const menuX = (this.width - menuWidth) / 2;
        const menuY = (this.height - menuHeight) / 2;

        // Menu background (no pulsing)
        const time = Date.now() / 1000;

        // Cartoony menu background with gradient
        this.ctx.beginPath();
        this.ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 20);
        this.ctx.clip();

        // Gradient background
        const gradient = this.ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuHeight);
        gradient.addColorStop(0, '#FFB6C1'); // Light pink
        gradient.addColorStop(0.5, '#FFC0CB'); // Pink
        gradient.addColorStop(1, '#FFB6C1'); // Light pink
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
        this.ctx.restore();

        // Menu border with subtle glow
        this.ctx.save();
        this.ctx.strokeStyle = '#FF69B4';
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = '#FF69B4';
        this.ctx.shadowBlur = 5;
        this.ctx.beginPath();
        this.ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 20);
        this.ctx.stroke();
        this.ctx.restore();

        // Animated title with bounce effect
        const titleBounce = Math.sin(time * 3) * 2;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 42px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = '#FF69B4';
        this.ctx.shadowBlur = 5;
        this.ctx.fillText('🎮 CuteDefense', menuX + menuWidth / 2, menuY + 60 + titleBounce);

        // Difficulty selection with checkboxes
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#333333';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillText('Choose Difficulty:', menuX + menuWidth / 2, menuY + 100);

        // Easy checkbox
        const easyCheckX = menuX + 80;
        const easyCheckY = menuY + 120;
        const checkboxSize = 20;
        const isEasySelected = gameState.grid && gameState.grid.getDifficulty() === 'easy';

        // Checkbox background
        this.ctx.fillStyle = isEasySelected ? '#90EE90' : '#FFFFFF';
        this.ctx.fillRect(easyCheckX, easyCheckY, checkboxSize, checkboxSize);
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(easyCheckX, easyCheckY, checkboxSize, checkboxSize);

        // Checkmark if selected
        if (isEasySelected) {
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(easyCheckX + 4, easyCheckY + 10);
            this.ctx.lineTo(easyCheckX + 8, easyCheckY + 14);
            this.ctx.lineTo(easyCheckX + 16, easyCheckY + 6);
            this.ctx.stroke();
        }

        // Easy label
        this.ctx.fillStyle = '#333333';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Easy (Long Paths)', easyCheckX + 30, easyCheckY + 15);

        // Hard checkbox
        const hardCheckX = menuX + 280;
        const hardCheckY = menuY + 120;
        const isHardSelected = gameState.grid && gameState.grid.getDifficulty() === 'hard';

        // Checkbox background - use green like easy when selected
        this.ctx.fillStyle = isHardSelected ? '#90EE90' : '#FFFFFF';
        this.ctx.fillRect(hardCheckX, hardCheckY, checkboxSize, checkboxSize);
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(hardCheckX, hardCheckY, checkboxSize, checkboxSize);

        // Checkmark if selected
        if (isHardSelected) {
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(hardCheckX + 4, hardCheckY + 10);
            this.ctx.lineTo(hardCheckX + 8, hardCheckY + 14);
            this.ctx.lineTo(hardCheckX + 16, hardCheckY + 6);
            this.ctx.stroke();
        }

        // Hard label - keep black when selected
        this.ctx.fillStyle = '#333333'; // Always black
        this.ctx.fillText('Hard (Short Paths)', hardCheckX + 30, hardCheckY + 15);

        // Sound toggle switch
        const soundToggleX = menuX + 80;
        const soundToggleY = menuY + 180;
        const toggleWidth = 60;
        const toggleHeight = 30;
        const toggleRadius = 15;

        // Toggle track
        this.ctx.fillStyle = gameState.soundEnabled ? '#90EE90' : '#CCCCCC';
        this.ctx.beginPath();
        this.ctx.roundRect(soundToggleX, soundToggleY, toggleWidth, toggleHeight, toggleRadius);
        this.ctx.fill();

        // Toggle knob
        const knobX = gameState.soundEnabled ? soundToggleX + toggleWidth - toggleHeight + 2 : soundToggleX + 2;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(knobX + toggleRadius, soundToggleY + toggleRadius, toggleRadius - 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Sound label
        this.ctx.fillStyle = '#333333';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText('🔊 Sound', soundToggleX + 80, soundToggleY + 20);

        // Animated Play button
        const playButtonX = menuX + 150;
        const playButtonY = menuY + 250;
        const playButtonWidth = 200;
        const playButtonHeight = 60;
        const playButtonPulse = Math.sin(time * 4) * 3 + 3;

        // Play button background with gradient
        const playGradient = this.ctx.createLinearGradient(playButtonX, playButtonY, playButtonX, playButtonY + playButtonHeight);
        playGradient.addColorStop(0, '#4CAF50');
        playGradient.addColorStop(1, '#45A049');
        this.ctx.fillStyle = playGradient;
        this.ctx.beginPath();
        this.ctx.roundRect(playButtonX, playButtonY, playButtonWidth, playButtonHeight, 30);
        this.ctx.fill();

        // Play button border with glow
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = '#4CAF50';
        this.ctx.shadowBlur = playButtonPulse;
        this.ctx.stroke();

        // Play button text
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🎮 PLAY', playButtonX + playButtonWidth / 2, playButtonY + 38);

        // Instructions
        this.ctx.fillStyle = '#666666';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Press R during game to restart', menuX + menuWidth / 2, menuY + 350);

        this.ctx.restore();
    }

    // Render dynamic day/night parallax background
    renderParallaxBackground() {
        const time = Date.now() / 1000;

        // Day/night cycle (30 second cycle)
        const cycleTime = (time % 30) / 30; // 0 to 1 over 30 seconds
        const isDay = cycleTime < 0.5;
        const dayNightProgress = isDay ? cycleTime * 2 : (1 - cycleTime) * 2; // 0 to 1

        // Interpolate between day and night colors
        const dayColors = {
            bg1: '#B8E6B8', // Light green
            bg2: '#E6F3FF', // Light blue  
            bg3: '#FFE6F3', // Light pink
            bg4: '#FFF0E6', // Light orange
            flower: '#FFB6C1',
            tower: '#FF6B6B',
            enemy: '#FF6B6B',
            sparkle: '#FFD700'
        };

        const nightColors = {
            bg1: '#1A1A2E', // Dark blue
            bg2: '#16213E', // Darker blue
            bg3: '#0F3460', // Darkest blue
            bg4: '#533483', // Purple
            flower: '#FF00FF', // Neon pink
            tower: '#00FFFF', // Neon cyan
            enemy: '#FF4500', // Neon orange
            sparkle: '#FFFF00' // Neon yellow
        };

        // Interpolate colors
        const colors = {
            bg1: this.interpolateColor(dayColors.bg1, nightColors.bg1, dayNightProgress),
            bg2: this.interpolateColor(dayColors.bg2, nightColors.bg2, dayNightProgress),
            bg3: this.interpolateColor(dayColors.bg3, nightColors.bg3, dayNightProgress),
            bg4: this.interpolateColor(dayColors.bg4, nightColors.bg4, dayNightProgress),
            flower: this.interpolateColor(dayColors.flower, nightColors.flower, dayNightProgress),
            tower: this.interpolateColor(dayColors.tower, nightColors.tower, dayNightProgress),
            enemy: this.interpolateColor(dayColors.enemy, nightColors.enemy, dayNightProgress),
            sparkle: this.interpolateColor(dayColors.sparkle, nightColors.sparkle, dayNightProgress)
        };

        // Dynamic gradient background
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        bgGradient.addColorStop(0, colors.bg1);
        bgGradient.addColorStop(0.3, colors.bg2);
        bgGradient.addColorStop(0.7, colors.bg3);
        bgGradient.addColorStop(1, colors.bg4);
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Animated flowers
        for (let i = 0; i < 8; i++) {
            const x = (i * 200 + Math.sin(time * 0.3 + i) * 100) % (this.width + 150);
            const y = (i * 150 + Math.cos(time * 0.4 + i) * 80) % (this.height + 150);
            const size = 12 + Math.sin(time * 0.6 + i) * 6;
            const rotation = time * 0.2 + i;

            this.ctx.save();
            this.ctx.globalAlpha = 0.4;
            this.ctx.translate(x, y);
            this.ctx.rotate(rotation);

            // Draw flower
            this.ctx.fillStyle = i % 3 === 0 ? '#FFB6C1' : i % 3 === 1 ? '#FFC0CB' : '#FFA0E0';
            for (let petal = 0; petal < 5; petal++) {
                this.ctx.save();
                this.ctx.rotate((petal * Math.PI * 2) / 5);
                this.ctx.beginPath();
                this.ctx.ellipse(0, -size / 2, size / 3, size / 2, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }
            // Flower center
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size / 4, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }

        // Animated towers
        for (let i = 0; i < 6; i++) {
            const x = (i * 250 + Math.sin(time * 0.2 + i) * 120) % (this.width + 200);
            const y = (i * 200 + Math.cos(time * 0.25 + i) * 100) % (this.height + 200);
            const size = 20 + Math.sin(time * 0.4 + i) * 8;

            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.translate(x, y);

            // Tower base
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(-size / 3, size / 3, size * 2 / 3, size * 2 / 3);

            // Tower top
            this.ctx.fillStyle = '#FF6B6B';
            this.ctx.beginPath();
            this.ctx.moveTo(-size / 2, size / 3);
            this.ctx.lineTo(0, -size / 3);
            this.ctx.lineTo(size / 2, size / 3);
            this.ctx.closePath();
            this.ctx.fill();

            // Tower flag
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(-size / 6, -size / 2, size / 3, size / 4);

            this.ctx.restore();
        }

        // Animated enemies
        for (let i = 0; i < 10; i++) {
            const x = (i * 180 + Math.sin(time * 0.6 + i) * 90) % (this.width + 100);
            const y = (i * 130 + Math.cos(time * 0.5 + i) * 70) % (this.height + 100);
            const size = 8 + Math.sin(time * 0.8 + i) * 4;
            const bob = Math.sin(time * 2 + i) * 3;

            this.ctx.save();
            this.ctx.globalAlpha = 0.35;
            this.ctx.translate(x, y + bob);

            // Enemy body
            this.ctx.fillStyle = i % 2 === 0 ? '#FF6B6B' : '#FF8C69';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size, 0, Math.PI * 2);
            this.ctx.fill();

            // Enemy eyes
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(-size / 3, -size / 3, size / 4, 0, Math.PI * 2);
            this.ctx.arc(size / 3, -size / 3, size / 4, 0, Math.PI * 2);
            this.ctx.fill();

            // Eye pupils
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(-size / 3, -size / 3, size / 8, 0, Math.PI * 2);
            this.ctx.arc(size / 3, -size / 3, size / 8, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }

        // More floating sparkles (bigger)
        for (let i = 0; i < 25; i++) {
            const x = (i * 100 + Math.sin(time * 0.8 + i) * 80) % (this.width + 100);
            const y = (i * 60 + Math.cos(time * 0.7 + i) * 60) % (this.height + 100);
            const size = 6 + Math.sin(time * 1.2 + i) * 4; // Bigger sparkles
            const alpha = 0.7 + Math.sin(time * 1.5 + i) * 0.3;

            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        // Add floating coins
        for (let i = 0; i < 12; i++) {
            const x = (i * 180 + Math.sin(time * 0.4 + i) * 90) % (this.width + 100);
            const y = (i * 120 + Math.cos(time * 0.3 + i) * 70) % (this.height + 100);
            const size = 12 + Math.sin(time * 0.9 + i) * 6;
            const rotation = time * 0.5 + i;

            this.ctx.save();
            this.ctx.globalAlpha = 0.4;
            this.ctx.translate(x, y);
            this.ctx.rotate(rotation);

            // Coin
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size, 0, Math.PI * 2);
            this.ctx.fill();

            // Coin inner circle
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }
    }

    // Helper function to interpolate between colors
    interpolateColor(color1, color2, factor) {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');

        const r1 = parseInt(hex1.substr(0, 2), 16);
        const g1 = parseInt(hex1.substr(2, 2), 16);
        const b1 = parseInt(hex1.substr(4, 2), 16);

        const r2 = parseInt(hex2.substr(0, 2), 16);
        const g2 = parseInt(hex2.substr(2, 2), 16);
        const b2 = parseInt(hex2.substr(4, 2), 16);

        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // Update day/night phase based on wave state
    updateDayNightPhase(waveState, waveInfo = null) {
        let targetPhase = 'day'; // Default to day

        // Determine target phase based on wave state
        if (waveState === 'preparation') {
            // Check if we're in the last 5 seconds of countdown
            if (waveInfo && waveInfo.announcement && waveInfo.announcement.includes('STARTS IN')) {
                targetPhase = 'night'; // Start transitioning to night during last 5 seconds
            } else {
                targetPhase = 'day';
            }
        } else if (waveState === 'spawning' || waveState === 'active') {
            targetPhase = 'night';
        } else if (waveState === 'complete') {
            targetPhase = 'day';
        }

        // Force initial phase change on first update
        if (!this.dayNightSystem.initialized) {
            this.dayNightSystem.initialized = true;
            this.dayNightSystem.currentPhase = targetPhase;
            this.dayNightSystem.transitionProgress = 1.0; // Start fully transitioned
            if (this.logger) {
                this.logger.info(`🌅🌙 Initial phase: ${targetPhase} (waveState: ${waveState})`);
            }
            return;
        }

        // Debug logging
        if (this.dayNightSystem.currentPhase !== targetPhase) {
            if (this.logger) {
                this.logger.info(`🌅🌙 Phase change: ${this.dayNightSystem.currentPhase} → ${targetPhase} (waveState: ${waveState})`);
            }
        }

        if (this.dayNightSystem.currentPhase !== targetPhase) {
            this.dayNightSystem.currentPhase = targetPhase;
            this.dayNightSystem.transitionProgress = 0;
            this.dayNightSystem.transitionStartTime = Date.now();

            // Set transition duration based on target phase
            this.dayNightSystem.transitionDuration = targetPhase === 'night' ? 4000 : 2000; // 4s for night, 2s for day

            // Trigger phase change effect
            this.dayNightSystem.phaseChangeEffect.active = true;
            this.dayNightSystem.phaseChangeEffect.startTime = Date.now();
            this.dayNightSystem.phaseChangeEffect.type = targetPhase === 'night' ? 'flash' : 'fade';
        }

        // Time-based transition calculation
        if (this.dayNightSystem.transitionProgress < 1.0) {
            const elapsed = Date.now() - this.dayNightSystem.transitionStartTime;
            const progress = Math.min(1.0, elapsed / this.dayNightSystem.transitionDuration);
            this.dayNightSystem.transitionProgress = progress;

            // Debug logging for transition progress
            if (this.logger && targetPhase === 'night' && Math.floor(progress * 100) % 20 === 0) {
                this.logger.info(`🌙 Night transition progress: ${Math.floor(progress * 100)}% (${elapsed}ms)`);
            }
        }

        // Update phase change effect
        this.updatePhaseChangeEffect();
    }

    // Get current colors based on day/night phase
    getCurrentColors() {
        const dayColors = this.dayNightSystem.phaseColors.day;
        const nightColors = this.dayNightSystem.phaseColors.night;
        const progress = this.dayNightSystem.transitionProgress;

        // Determine which phase we're transitioning to
        const targetPhase = this.dayNightSystem.currentPhase;

        // If we're in day phase, show day colors (progress = 0 means day, progress = 1 means night)
        // If we're in night phase, show night colors
        const isNightPhase = targetPhase === 'night';
        const colorProgress = isNightPhase ? progress : (1 - progress);

        // Interpolate between day and night colors
        return {
            background: this.interpolateColor(dayColors.background, nightColors.background, colorProgress),
            grid: this.interpolateColor(dayColors.grid, nightColors.grid, colorProgress),
            path: this.interpolateColor(dayColors.path, nightColors.path, colorProgress),
            tower: this.interpolateColor(dayColors.tower, nightColors.tower, colorProgress),
            enemy: this.interpolateColor(dayColors.enemy, nightColors.enemy, colorProgress),
            ambientLight: dayColors.ambientLight + (nightColors.ambientLight - dayColors.ambientLight) * colorProgress
        };
    }

    // Helper method to interpolate between two hex colors
    interpolateColor(color1, color2, progress) {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');

        const r1 = parseInt(hex1.substr(0, 2), 16);
        const g1 = parseInt(hex1.substr(2, 2), 16);
        const b1 = parseInt(hex1.substr(4, 2), 16);

        const r2 = parseInt(hex2.substr(0, 2), 16);
        const g2 = parseInt(hex2.substr(2, 2), 16);
        const b2 = parseInt(hex2.substr(4, 2), 16);

        const r = Math.round(r1 + (r2 - r1) * progress);
        const g = Math.round(g1 + (g2 - g1) * progress);
        const b = Math.round(b1 + (b2 - b1) * progress);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // Update phase change effect
    updatePhaseChangeEffect() {
        if (!this.dayNightSystem.phaseChangeEffect.active) return;

        const elapsed = Date.now() - this.dayNightSystem.phaseChangeEffect.startTime;
        const progress = Math.min(1.0, elapsed / this.dayNightSystem.phaseChangeEffect.duration);

        if (progress >= 1.0) {
            this.dayNightSystem.phaseChangeEffect.active = false;
        }
    }


    // Calculate tilemap height based on grid configuration
    getTilemapHeight() {
        // This should match the grid system's actual height
        // For now, we'll calculate based on standard grid size
        return 12 * 96;//64; // 12 rows * 64px tile size
    }

    // Calculate game area offset for left-docked HUD
    getGameAreaOffset() {
        return 400; // HUD width - matches CONFIG.HUD_WIDTH
    }

    // Calculate grid offset for centering
    getGridOffsetX() {
        return 400;// + 120; // HUD width + horizontal margin
    }

    getGridOffsetY() {
        return 0;//200; // Vertical margin for centering
    }

    // Render main HUD panel - left-docked layout for tablet optimization
    renderMainHUD(selectedTower, towerManager, waveInfo = null, resourceInfo = null, selectedEnemy = null, popupInfo = null, gameStateInfo = null, gridSystem = null) {
        // Left-docked HUD layout - use responsive CONFIG values
        const hudWidth = CONFIG.HUD_WIDTH; // Responsive HUD width
        const hudHeight = CONFIG.HUD_HEIGHT; // Responsive HUD height
        const hudX = 0; // Left edge
        const hudY = 0; // Top edge

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

        // Clean border without glow
        this.ctx.save();
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

        // No sparkle effects for clean appearance

        // Render the five HUD sections (pass popupInfo for proposed tower preview and gameStateInfo for lives)
        this.renderHUDSections(hudX, hudY, hudWidth, hudHeight, selectedTower, towerManager, waveInfo, resourceInfo, selectedEnemy, popupInfo, gameStateInfo, gridSystem);
    }

    // Removed sparkle effects for clean HUD appearance

    // Render the four HUD sections: Wave Info, Combined Selection (Portrait+Info), Selection Actions, Coin Info
    renderHUDSections(hudX, hudY, hudWidth, hudHeight, selectedTower, towerManager, waveInfo, resourceInfo, selectedEnemy, popupInfo, gameStateInfo, gridSystem) {
        // Use responsive scaling for padding
        const scaleFactor = window.gameState && window.gameState.responsiveScaling ? window.gameState.responsiveScaling.getScaleFactor() : 1.0;
        const padding = Math.floor(20 * scaleFactor);
        const sectionHeight = (hudHeight - (padding * 5)) / 4; // 4 sections with 4 gaps

        // Vertical layout for left-docked HUD
        const sectionWidth = hudWidth - (padding * 2);

        // Section 1: Wave Info (top)
        const waveInfoY = hudY + padding;
        this.renderWaveInfoSection(hudX + padding, waveInfoY, sectionWidth, sectionHeight, waveInfo, gameStateInfo, gridSystem);

        // Section 2: Combined Selection (second)
        const selectionY = waveInfoY + sectionHeight + padding;
        this.renderCombinedSelectionSection(hudX + padding, selectionY, sectionWidth, sectionHeight, selectedTower, selectedEnemy, popupInfo);

        // Section 3: Selection Actions (third)
        const actionsY = selectionY + sectionHeight + padding;
        this.renderSelectionActionsSection(hudX + padding, actionsY, sectionWidth, sectionHeight, selectedTower, towerManager);

        // Section 4: Coin Info (bottom)
        const coinY = actionsY + sectionHeight + padding;
        this.renderCoinInfoSection(hudX + padding, coinY, sectionWidth, sectionHeight, resourceInfo);
    }

    // Render combined selection section (portrait + info) with more space
    renderCombinedSelectionSection(x, y, width, height, selectedTower, selectedEnemy, popupInfo) {
        // Priority: Enemy selection overrides tower selection
        if (selectedEnemy) {
            this.renderEnemySelection(x, y, width, height, selectedEnemy);
            return;
        }

        // Show proposed tower preview when placement popup is open
        if (popupInfo && !selectedTower && !selectedEnemy) {
            const proposedType = popupInfo.selectedType || 'BASIC';
            this.renderProposedTowerPreview(x, y, width, height, proposedType);
            return;
        }

        if (!selectedTower) {
            // Show placeholder when no selection
            this.ctx.save();
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(x, y, width, height);
            this.ctx.fillStyle = '#666';
            this.ctx.font = '20px Arial';  // Increased from 16px
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Select a tower or enemy', x + width / 2, y + height / 2);
            this.ctx.restore();
            return;
        }

        // Split the combined section: portrait on left, info on right
        const portraitWidth = 80;
        const infoWidth = width - portraitWidth - 10; // 10px gap
        const portraitX = x;
        const infoX = x + portraitWidth + 10;

        // Render portrait
        this.renderTowerPortrait(portraitX, y, portraitWidth, selectedTower);

        // Render tower info with more space and slight margin from top
        this.renderTowerInfo(infoX, y + 5, selectedTower);
    }

    // Render wave info section with cartoony styling
    renderWaveInfoSection(x, y, width, height, waveInfo, gameStateInfo, gridSystem = null) {
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

        // Clean border without glow
        this.ctx.save();
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

        // Static title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 22px Arial';  // Increased from 18px
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🌊 Wave Info', x + width / 2, y + 20);

        // Display lives with hearts (kid-friendly)
        this.ctx.font = 'bold 20px Arial';  // Increased from 16px
        if (gameStateInfo) {
            const livesRemaining = gameStateInfo.maxEnemiesAllowed - gameStateInfo.enemiesReachedGoal;
            const hearts = '❤️'.repeat(Math.max(0, livesRemaining));
            const emptyHearts = '🖤'.repeat(Math.max(0, gameStateInfo.enemiesReachedGoal));

            // Color text based on lives remaining
            if (livesRemaining <= 1) {
                this.ctx.fillStyle = '#FF4444'; // Red - critical
            } else if (livesRemaining <= 2) {
                this.ctx.fillStyle = '#FFA500'; // Orange - warning
            } else {
                this.ctx.fillStyle = '#4CAF50'; // Green - safe
            }

            this.ctx.fillText(`Lives: ${hearts}${emptyHearts}`, x + width / 2, y + 40);
        }

        // Display wave data (no pulsing)
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '18px Arial';  // Increased from 14px
        this.ctx.globalAlpha = 1.0;

        if (waveInfo) {
            this.ctx.fillText(`Wave: ${waveInfo.currentWave || 1}`, x + width / 2, y + 60);
            this.ctx.fillText(`Enemies: ${waveInfo.enemiesSpawned || 0}/${waveInfo.totalEnemies || 0}`, x + width / 2, y + 80);
        } else {
            this.ctx.fillText('Wave: 1', x + width / 2, y + 60);
            this.ctx.fillText('Enemies: 0/0', x + width / 2, y + 80);
        }

        // Add difficulty indicator
        this.ctx.fillStyle = '#FFD700'; // Golden color for difficulty
        this.ctx.font = 'bold 16px Arial';
        const difficulty = gridSystem ? gridSystem.getDifficulty() : 'easy';
        const difficultyText = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        this.ctx.fillText(`Difficulty: ${difficultyText}`, x + width / 2, y + 100);

        // Add pause and restart instructions
        this.ctx.fillStyle = '#FFD700'; // Golden color for instruction
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText('Press ESC to pause', x + width / 2, y + 120);
        this.ctx.fillText('Press R to restart', x + width / 2, y + 140);

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

        // Clean border without glow
        this.ctx.save();
        this.ctx.strokeStyle = '#FF9800';
        this.ctx.lineWidth = 2;
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
            // Show clean empty selection
            this.ctx.font = '14px Arial';
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillStyle = '#CCC';
            this.ctx.fillText('No Selection', x + width / 2, y + height / 2);
        }

        this.ctx.restore();
    }

    // Render selection info section
    renderSelectionInfoSection(x, y, width, height, selectedTower) {
        this.ctx.save();

        // Section background with rounded corners
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.clip();
        this.ctx.fillStyle = 'rgba(100, 0, 200, 0.3)';
        this.ctx.fillRect(x, y, width, height);
        this.ctx.restore();

        // Section border with rounded corners
        this.ctx.save();
        this.ctx.strokeStyle = '#9C27B0';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

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
            // Show clean empty info
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillStyle = '#CCC';
            this.ctx.fillText('No Selection', x + width / 2, y + height / 2);
        }

        this.ctx.restore();
    }

    // Render selection actions section
    renderSelectionActionsSection(x, y, width, height, selectedTower, towerManager) {
        this.ctx.save();

        // Section background with rounded corners
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.clip();
        this.ctx.fillStyle = 'rgba(0, 200, 100, 0.3)';
        this.ctx.fillRect(x, y, width, height);
        this.ctx.restore();

        // Section border with rounded corners
        this.ctx.save();
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

        // Actions title with responsive font size
        const scaleFactor = window.gameState && window.gameState.responsiveScaling ? window.gameState.responsiveScaling.getScaleFactor() : 1.0;
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = `bold ${Math.floor(16 * scaleFactor)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Actions', x + width / 2, y + Math.floor(20 * scaleFactor));

        if (selectedTower) {
            // Render upgrade button with responsive scaling
            const upgradeInfo = towerManager.getTowerUpgradeInfo(selectedTower.x, selectedTower.y);
            if (upgradeInfo) {
                // Use responsive scaling for button dimensions (scaleFactor already declared above)
                const buttonWidth = width - Math.floor(20 * scaleFactor);
                const buttonHeight = Math.floor(30 * scaleFactor);
                const buttonX = x + Math.floor(10 * scaleFactor);
                const buttonY = y + Math.floor(35 * scaleFactor);

                const canAfford = this.resourceSystem && this.resourceSystem.canAfford(upgradeInfo.cost);

                // Button background
                this.ctx.fillStyle = canAfford ? '#4CAF50' : '#9E9E9E';
                this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

                // Button border
                this.ctx.strokeStyle = canAfford ? '#2E7D32' : '#424242';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

                // Button text with responsive font size
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = `bold ${Math.floor(14 * scaleFactor)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText('⬆️ Upgrade', buttonX + buttonWidth / 2, buttonY + Math.floor(20 * scaleFactor));

                // Cost text with responsive font size
                this.ctx.font = `${Math.floor(12 * scaleFactor)}px Arial`;
                this.ctx.fillText(`💰 ${upgradeInfo.cost}`, buttonX + buttonWidth / 2, buttonY + Math.floor(35 * scaleFactor));
            }
        } else {
            // Show clean no actions with responsive font
            this.ctx.font = `${Math.floor(14 * scaleFactor)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillStyle = '#CCC';
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

        // Clean border without glow
        this.ctx.save();
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        this.ctx.restore();

        // Static coin title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 22px Arial';  // Increased from 16px
        this.ctx.textAlign = 'center';
        this.ctx.fillText('💰 Coins', x + width / 2, y + 20);

        // Display coin count (no pulsing)
        this.ctx.font = 'bold 28px Arial';  // Increased from 18px
        const coinCount = resourceInfo ? (resourceInfo.coins || 0) : 0;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${coinCount}`, x + width / 2, y + 50);

        // Static coin icon (no rotation or bounce)
        const coinX = x + width / 2;
        const coinY = y + 70;

        this.ctx.save();
        this.ctx.translate(coinX, coinY);

        // Coin without glow effect
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

    // Render tower information section (now with more space)
    renderTowerInfo(x, y, tower) {
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${tower.type} Tower`, x, y);

        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Level: ${tower.level}`, x, y + 25);
        this.ctx.fillText(`Damage: ${tower.damage}`, x, y + 45);
        this.ctx.fillText(`Range: ${tower.range}`, x, y + 65);

        // Display fire rate as clear text stats (now has space)
        const fireRateMs = Math.round(tower.fireRate);
        const baseRateMs = Math.round(tower.baseFireRate || tower.fireRate);
        const isFaster = fireRateMs < baseRateMs;
        const isSlower = fireRateMs > baseRateMs;

        // Show fire rate with inline status indicator
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '16px Arial';

        if (isFaster || isSlower) {
            const diff = baseRateMs - fireRateMs;
            const sign = diff > 0 ? '+' : '';
            const status = isFaster ? 'FAST' : 'SLOW';

            // Render fire rate and status on same line
            this.ctx.fillText(`Fire: ${fireRateMs}ms`, x, y + 85);

            // Color code the status text inline
            this.ctx.fillStyle = isFaster ? '#4CAF50' : '#FF9800';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`${status} ${sign}${Math.abs(diff)}ms`, x + 120, y + 85);
        } else {
            // Just show fire rate if no variation
            this.ctx.fillText(`Fire: ${fireRateMs}ms`, x, y + 85);
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

        // Tower circle with 3D gradient (same as main tower rendering)
        const towerColor = tower.color;

        // Create 3D gradient effect
        const gradient = this.ctx.createRadialGradient(
            centerX - radius * 0.3, centerY - radius * 0.3, 0,
            centerX, centerY, radius
        );

        // Convert hex color to RGB for gradient calculations
        const hex = towerColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Create lighter and darker shades
        const lightR = Math.min(255, r + 60);
        const lightG = Math.min(255, g + 60);
        const lightB = Math.min(255, b + 60);
        const darkR = Math.max(0, r - 40);
        const darkG = Math.max(0, g - 40);
        const darkB = Math.max(0, b - 40);

        gradient.addColorStop(0, `rgb(${lightR}, ${lightG}, ${lightB})`);
        gradient.addColorStop(0.7, towerColor);
        gradient.addColorStop(1, `rgb(${darkR}, ${darkG}, ${darkB})`);

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Tower border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Level rings in portrait
        this.renderTowerLevelRings(centerX, centerY, radius, tower.level);

        // Use new organic tower details instead of character indicator
        this.renderTowerOrganicDetails(centerX, centerY, radius, tower.level, tower.type);

        // Rank badge in portrait
        if (tower.level > 1) {
            this.renderRankBadge(centerX, centerY - radius - 5, tower.level);
        }
    }

    // Render enemy selection with portrait and stats
    renderEnemySelection(x, y, width, height, enemy) {
        // Split the section: portrait on left, info on right
        const portraitWidth = 80;
        const infoWidth = width - portraitWidth - 10; // 10px gap
        const portraitX = x;
        const infoX = x + portraitWidth + 10;

        // Render enemy portrait
        this.renderEnemyPortrait(portraitX, y, portraitWidth, enemy);

        // Render enemy info
        this.renderEnemyInfo(infoX, y, infoWidth, height, enemy);
    }

    // Render enemy portrait
    renderEnemyPortrait(x, y, size, enemy) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size / 2 - 5;

        // Animated background with pulsing effect
        const time = Date.now() / 1000;
        const pulseRadius = radius + Math.sin(time * 3) * 2;

        // Background glow
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = enemy.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        // Enemy shape based on type
        this.ctx.save();
        this.ctx.fillStyle = enemy.color;
        this.ctx.strokeStyle = enemy.borderColor || '#FFD700';
        this.ctx.lineWidth = 3;

        if (enemy.type.shape === 'diamond') {
            // Diamond shape for fast enemies
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY - radius);
            this.ctx.lineTo(centerX + radius, centerY);
            this.ctx.lineTo(centerX, centerY + radius);
            this.ctx.lineTo(centerX - radius, centerY);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        } else if (enemy.type.shape === 'square') {
            // Square shape for strong enemies
            this.ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
            this.ctx.strokeRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        } else {
            // Circle shape for basic enemies
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
        this.ctx.restore();

        // Draw enemy mean face
        this.renderEnemyMeanFace(enemy, centerX, centerY, radius);

        // Cartoony health bar overlay
        const healthPercent = enemy.health / enemy.maxHealth;
        const barWidth = radius * 1.6; // Reduced width (was 2.0)
        const barHeight = 14; // Increased height (was 10)
        const barX = centerX - barWidth / 2;
        const barY = centerY + radius + 10;

        // Cartoony health bar background with rounded corners
        this.ctx.save();
        this.ctx.fillStyle = '#444444';
        this.ctx.strokeStyle = '#222222';
        this.ctx.lineWidth = 2;
        this.roundedRect(barX, barY, barWidth, barHeight, 5);
        this.ctx.fill();
        this.ctx.stroke();

        // Health bar fill with cartoony colors
        const healthWidth = barWidth * healthPercent;
        if (healthWidth > 0) {
            // Cartoony health colors
            let healthColor = '#FF6B6B'; // Bright red for low health
            if (healthPercent > 0.6) {
                healthColor = '#4ECDC4'; // Bright teal for high health
            } else if (healthPercent > 0.3) {
                healthColor = '#FFE66D'; // Bright yellow for medium health
            }

            this.ctx.fillStyle = healthColor;
            this.roundedRect(barX, barY, healthWidth, barHeight, 5);
            this.ctx.fill();

            // Add a subtle glow effect
            this.ctx.shadowColor = healthColor;
            this.ctx.shadowBlur = 4;
            this.ctx.fillStyle = healthColor;
            this.roundedRect(barX, barY, healthWidth, barHeight, 5);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    // Render enemy information
    renderEnemyInfo(x, y, width, height, enemy) {
        this.ctx.save();
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';

        // Enemy name (use the name from the type object)
        this.ctx.fillText(enemy.type.name.toUpperCase(), x, y + 20);

        // Health info
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Health: ${Math.ceil(enemy.health)}/${enemy.maxHealth}`, x, y + 40);

        // Speed info
        this.ctx.fillText(`Speed: ${enemy.speed.toFixed(1)}`, x, y + 60);

        // Reward info
        this.ctx.fillText(`Reward: ${enemy.reward} coins`, x, y + 80);

        // Special abilities (if any) - check the type id
        if (enemy.type.id === 'fast') {
            this.ctx.fillStyle = '#4ECDC4';
            this.ctx.fillText('⚡ Quick Movement', x, y + 100);
        } else if (enemy.type.id === 'strong') {
            this.ctx.fillStyle = '#45B7D1';
            this.ctx.fillText('🛡️ High Defense', x, y + 100);
        }

        this.ctx.restore();
    }

    // Render proposed tower preview when placement popup is shown
    renderProposedTowerPreview(x, y, width, height, towerType) {
        const time = Date.now() / 1000;
        const typeCfg = TOWER_TYPES[towerType];

        if (!typeCfg) return;

        // Split the section: portrait on left, info on right
        const portraitWidth = 80;
        const infoWidth = width - portraitWidth - 10; // 10px gap
        const portraitX = x;
        const infoX = x + portraitWidth + 10;

        // Render proposed tower portrait with special styling
        this.renderProposedTowerPortrait(portraitX, y, portraitWidth, typeCfg, time);

        // Render proposed tower info
        this.renderProposedTowerInfo(infoX, y, infoWidth, height, typeCfg, towerType, time);
    }

    // Render proposed tower portrait with pulsing animation
    renderProposedTowerPortrait(x, y, size, typeCfg, time) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size / 2 - 5;

        // Dimmed background with pulsing effect (~1Hz)
        const pulseAlpha = 0.15 + Math.sin(time * 2 * Math.PI) * 0.1; // 1Hz blink
        this.ctx.save();
        this.ctx.globalAlpha = pulseAlpha;
        this.ctx.fillStyle = typeCfg.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        // Dimmed tower circle
        this.ctx.save();
        this.ctx.globalAlpha = 0.5; // Dimmed appearance
        this.ctx.fillStyle = typeCfg.color;
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        // "PROPOSED" label at bottom
        this.ctx.save();
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PROPOSED', centerX, y + size - 5);
        this.ctx.restore();
    }

    // Render proposed tower info with descriptors
    renderProposedTowerInfo(x, y, width, height, typeCfg, towerType, time) {
        this.ctx.save();

        // Pulsing title (~1Hz)
        const titleAlpha = 0.7 + Math.sin(time * 2 * Math.PI) * 0.3; // 1Hz blink
        this.ctx.globalAlpha = titleAlpha;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('PROPOSED TOWER', x, y + 20);
        this.ctx.restore();

        // Tower type name
        this.ctx.save();
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(typeCfg.name, x, y + 40);
        this.ctx.restore();

        // Brief descriptor based on tower type
        this.ctx.save();
        this.ctx.fillStyle = '#AAA';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';

        let descriptor = '';
        if (towerType === 'BASIC') {
            descriptor = 'Simple bullets | Very cheap';
        } else if (towerType === 'STRONG') {
            descriptor = 'High damage | Slow fire';
        }

        this.ctx.fillText(descriptor, x, y + 58);
        this.ctx.restore();

        // Tower stats (dimmed)
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = '#CCC';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Cost: ${typeCfg.cost} coins`, x, y + 76);
        this.ctx.fillText(`Range: ${typeCfg.range} tiles`, x, y + 92);
        this.ctx.restore();
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
        const currentColors = this.getCurrentColors();
        this.ctx.fillStyle = currentColors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    renderGrid(gridSystem, debug) {
        const tileSize = gridSystem.tileSize;
        const gameOffsetX = this.getGameAreaOffset(); // Offset for left-docked HUD

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
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin
        const screenX = gridX * tileSize + gridOffsetX;
        const screenY = gridY * tileSize + gridOffsetY;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;
        const time = Date.now() / 1000;

        // Save context for transformations
        this.ctx.save();

        if (tile.type === 'start') {
            // Enhanced start tile with gradient and pattern
            const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, tileSize / 2);
            gradient.addColorStop(0, '#00FF88');
            gradient.addColorStop(0.7, '#00CC66');
            gradient.addColorStop(1, '#00AA44');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.fill();

            // Add animated sparkle effect
            this.renderTileSparkles(centerX, centerY, time, gridX + gridY);

        } else if (tile.type === 'end') {
            // Enhanced end tile with softer gradient and pattern
            const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, tileSize / 2);
            gradient.addColorStop(0, '#FF8888');
            gradient.addColorStop(0.7, '#DD6666');
            gradient.addColorStop(1, '#BB4444');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.fill();

            // Add animated warning effect
            this.renderTileWarningEffect(centerX, centerY, time, gridX + gridY);

        } else if (tile.type === 'path') {
            // Enhanced path tile with lighter texture
            const currentColors = this.getCurrentColors();
            const gradient = this.ctx.createLinearGradient(screenX, screenY, screenX + tileSize, screenY + tileSize);
            gradient.addColorStop(0, currentColors.path);
            gradient.addColorStop(0.5, this.interpolateColor(currentColors.path, '#DEB887', 0.3));
            gradient.addColorStop(1, currentColors.path);
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.fill();

            // Add path texture pattern
            this.renderPathTexture(screenX, screenY, tileSize, time, gridX + gridY);

        } else {
            // Enhanced grass tile with pattern and subtle animation
            const currentColors = this.getCurrentColors();
            const gradient = this.ctx.createLinearGradient(screenX, screenY, screenX, screenY + tileSize);
            // Use grid color as main grass color for better saturation
            gradient.addColorStop(0, currentColors.grid);
            gradient.addColorStop(0.5, currentColors.background);
            gradient.addColorStop(1, this.interpolateColor(currentColors.grid, '#87CEEB', 0.3));
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.fill();

            // Add grass texture pattern
            this.renderGrassTexture(screenX, screenY, tileSize, time, gridX + gridY);
        }

        // Draw enhanced borders
        this.renderTileBorder(screenX, screenY, tileSize, tile.type);

        this.ctx.restore();
    }

    renderTileSparkles(centerX, centerY, time, seed) {
        // Create sparkles around start tile
        for (let i = 0; i < 3; i++) {
            const angle = (time * 2 + i * Math.PI / 1.5 + seed * 0.1) % (Math.PI * 2);
            const distance = 20 + Math.sin(time * 3 + i) * 5;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            const sparkleSize = 1 + Math.sin(time * 4 + i) * 0.5;
            const alpha = 0.6 + Math.sin(time * 3 + i) * 0.3;

            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.shadowColor = '#00FF88';
            this.ctx.shadowBlur = 4;
            this.ctx.beginPath();
            this.ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    renderTileWarningEffect(centerX, centerY, time, seed) {
        // Create pulsing warning effect for end tile
        const pulseIntensity = Math.sin(time * 4) * 0.3 + 0.7;
        const pulseRadius = 15 + pulseIntensity * 5;

        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.strokeStyle = '#FF8888';
        this.ctx.lineWidth = 2 + pulseIntensity;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }

    renderPathTexture(screenX, screenY, tileSize, time, seed) {
        // Add animated path texture with more visible effects
        this.ctx.save();
        this.ctx.globalAlpha = 0.6;
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;

        // Draw animated texture lines with more movement
        for (let i = 0; i < 4; i++) {
            const offset = (seed + i) * 0.1;
            const y = screenY + (tileSize / 5) * (i + 1) + Math.sin(time * 2 + offset) * 4;
            const wave = Math.sin(time * 3 + offset) * 3;

            this.ctx.beginPath();
            this.ctx.moveTo(screenX + 3 + wave, y);
            this.ctx.lineTo(screenX + tileSize - 3 + wave, y);
            this.ctx.stroke();
        }

        // Add animated pebbles/stones
        for (let i = 0; i < 3; i++) {
            const pebbleX = screenX + 8 + (i * 15) + Math.sin(time * 1.5 + seed + i) * 2;
            const pebbleY = screenY + 8 + (i * 12) + Math.cos(time * 1.2 + seed + i) * 1;
            const pebbleSize = 2 + Math.sin(time * 2 + i) * 0.5;

            this.ctx.fillStyle = '#4A4A4A';
            this.ctx.beginPath();
            this.ctx.arc(pebbleX, pebbleY, pebbleSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    renderGrassTexture(screenX, screenY, tileSize, time, seed) {
        // Add grass texture with more visible animation
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.ctx.strokeStyle = '#7CCD7C';
        this.ctx.lineWidth = 2;

        // Draw animated grass blades with more movement
        for (let i = 0; i < 5; i++) {
            const x = screenX + (tileSize / 6) * (i + 1);
            const sway = Math.sin(time * 1.5 + seed * 0.1 + i) * 4;
            const height = 10 + Math.sin(time * 2 + seed + i) * 4;
            const wave = Math.sin(time * 3 + i) * 2;

            this.ctx.beginPath();
            this.ctx.moveTo(x + sway, screenY + tileSize);
            this.ctx.lineTo(x + sway + wave, screenY + tileSize - height);
            this.ctx.stroke();
        }

        // Add larger, more visible flower variants for environmental detail
        const flowerVariants = [
            { color: '#FFB6C1', size: 3.5, type: 'pink' },    // Pink flowers (much larger)
            { color: '#FFC0CB', size: 3.0, type: 'light-pink' }, // Light pink
            { color: '#FFE4B5', size: 4.0, type: 'yellow' },  // Yellow flowers
            { color: '#DDA0DD', size: 3.2, type: 'purple' },  // Purple flowers
            { color: '#F0E68C', size: 3.8, type: 'gold' },    // Gold flowers
            { color: '#FFA07A', size: 3.3, type: 'orange' }   // Orange flowers
        ];

        // Randomly select 2-3 flowers per tile based on seed
        const numFlowers = 2 + (seed % 2); // 2 or 3 flowers

        for (let i = 0; i < numFlowers; i++) {
            const flowerVariant = flowerVariants[(seed + i) % flowerVariants.length];
            const flowerX = screenX + 10 + (i * 20) + Math.sin(time * 2 + seed + i) * 5;
            const flowerY = screenY + 8 + Math.cos(time * 1.5 + seed + i) * 4;
            const flowerSize = flowerVariant.size + Math.sin(time * 3 + i) * 0.5;

            // Draw flower with variant color (larger and more visible)
            this.ctx.fillStyle = flowerVariant.color;
            this.ctx.beginPath();
            this.ctx.arc(flowerX, flowerY, flowerSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Add white center dot for flower detail (larger)
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(flowerX, flowerY, flowerSize * 0.4, 0, Math.PI * 2);
            this.ctx.fill();

            // Add flower petal details for more realistic look
            this.ctx.fillStyle = flowerVariant.color;
            this.ctx.globalAlpha = 0.8;

            // Draw 4 petals around the center
            for (let p = 0; p < 4; p++) {
                const petalAngle = (p * Math.PI) / 2;
                const petalX = flowerX + Math.cos(petalAngle) * flowerSize * 0.6;
                const petalY = flowerY + Math.sin(petalAngle) * flowerSize * 0.6;

                this.ctx.beginPath();
                this.ctx.arc(petalX, petalY, flowerSize * 0.3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.globalAlpha = 1.0; // Reset alpha
        }
        this.ctx.restore();
    }

    renderTileBorder(screenX, screenY, tileSize, tileType) {
        if (tileType === 'start' || tileType === 'end') {
            // Enhanced borders for special tiles with rounded corners
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.stroke();

            // Inner glow effect
            this.ctx.strokeStyle = tileType === 'start' ? '#00FF88' : '#FF8888';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX + 2, screenY + 2, tileSize - 4, tileSize - 4, 3);
            this.ctx.stroke();
        } else {
            // Dark cartoony outline for regular tiles
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.stroke();
        }
    }

    renderTower(tower, tileSize, upgradeInfo = null, isSelected = false) {
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin
        const screenX = tower.x * tileSize + gridOffsetX;
        const screenY = tower.y * tileSize + gridOffsetY;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;

        // Scale tower size based on level (specific percentages)
        let towerRadius;
        if (tower.level >= 3) {
            towerRadius = tileSize * 0.6; // Level 3: 60% of tile
        } else if (tower.level >= 2) {
            towerRadius = tileSize * 0.45; // Level 2: 45% of tile (slightly larger for visual distinction)
        } else {
            // Level 1: Normalize size for both BASIC and STRONG towers (same size for level 1)
            towerRadius = tileSize * 0.375; // 24px radius for all level 1 towers
        }

        // Apply growth animation scaling
        if (tower.growthAnimation && tower.growthAnimation.active) {
            towerRadius *= tower.growthAnimation.scale;
        }

        // Apply idle animation (subtle pulsing)
        if (tower.idleAnimation && tower.idleAnimation.active) {
            towerRadius *= tower.idleAnimation.scale;
        }

        // Apply firing animation (brief flash)
        if (tower.firingAnimation && tower.firingAnimation.active) {
            towerRadius *= tower.firingAnimation.scale;
        }

        // Draw level rings (visual indicator for tower level) - no pulsing
        this.renderTowerLevelRings(centerX, centerY, towerRadius, tower.level);

        // Add upgrade glow effects for higher levels
        if (tower.level > 1) {
            this.renderTowerUpgradeGlow(centerX, centerY, towerRadius, tower.level);
        }

        // Draw tower as a circle with 3D gradient
        const currentColors = this.getCurrentColors();
        const towerColor = tower.color || currentColors.tower;

        // Create 3D gradient effect
        const gradient = this.ctx.createRadialGradient(
            centerX - towerRadius * 0.3, centerY - towerRadius * 0.3, 0,
            centerX, centerY, towerRadius
        );

        // Convert hex color to RGB for gradient calculations
        const hex = towerColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Create lighter and darker shades
        const lightR = Math.min(255, r + 60);
        const lightG = Math.min(255, g + 60);
        const lightB = Math.min(255, b + 60);
        const darkR = Math.max(0, r - 40);
        const darkG = Math.max(0, g - 40);
        const darkB = Math.max(0, b - 40);

        gradient.addColorStop(0, `rgb(${lightR}, ${lightG}, ${lightB})`);
        gradient.addColorStop(0.7, towerColor);
        gradient.addColorStop(1, `rgb(${darkR}, ${darkG}, ${darkB})`);

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, towerRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw tower border (thicker if selected, darker for better contrast)
        this.ctx.strokeStyle = isSelected ? '#2C3E50' : '#1A1A1A'; // Darker colors for better contrast
        this.ctx.lineWidth = isSelected ? 4 : 2;
        this.ctx.stroke();

        // Draw organic growth details (spikes/knobs) based on tower level
        this.renderTowerOrganicDetails(centerX, centerY, towerRadius, tower.level, tower.type);

        // Tower type indicator removed - replaced with 3D dome effect in organic details

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

    renderTowerOrganicDetails(centerX, centerY, radius, level, towerType) {
        // Add visual details ON the tower face that are visible at small scale
        this.ctx.save();

        // All levels: Add smiley face for friendly appearance
        this.renderTowerSmileyFace(centerX, centerY, radius, level);

        // Knobs removed - they looked stupid

        // Level 3: Add sparkle effects around the face
        if (level >= 3) {
            this.renderTowerLevel3Sparkles(centerX, centerY, radius);
        }

        this.ctx.restore();
    }

    renderTowerLevel1Detail(centerX, centerY, radius) {
        // Draw a small 3D dome effect in the center for Level 1 towers
        const domeRadius = radius * 0.25;
        const domeColor = GENERIC_ACCENT_COLORS.metal;
        const domeHighlight = GENERIC_ACCENT_COLORS.metalLight;
        const domeShadow = GENERIC_ACCENT_COLORS.metalDark;

        // Create gradient for 3D dome effect
        const gradient = this.ctx.createRadialGradient(
            centerX - domeRadius * 0.3, centerY - domeRadius * 0.3, 0,
            centerX, centerY, domeRadius
        );
        gradient.addColorStop(0, domeHighlight);
        gradient.addColorStop(0.7, domeColor);
        gradient.addColorStop(1, domeShadow);

        // Draw dome
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, domeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Add subtle border
        this.ctx.strokeStyle = domeShadow;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    // Render upgrade glow effects for higher level towers
    renderTowerUpgradeGlow(centerX, centerY, radius, level) {
        this.ctx.save();

        // Create pulsing glow effect
        const time = Date.now() / 1000;
        const pulseIntensity = Math.sin(time * 3) * 0.3 + 0.7;
        const glowRadius = radius + (level * 8) + (pulseIntensity * 5);

        // Create radial gradient for glow
        const glowGradient = this.ctx.createRadialGradient(
            centerX, centerY, radius,
            centerX, centerY, glowRadius
        );

        // Different glow colors for different levels
        let glowColor = '#FFD700'; // Gold for level 2
        if (level >= 3) {
            glowColor = '#FF6B6B'; // Red for level 3
        }

        glowGradient.addColorStop(0, glowColor + '00'); // Transparent at center
        glowGradient.addColorStop(0.7, glowColor + '40'); // Semi-transparent
        glowGradient.addColorStop(1, glowColor + '00'); // Transparent at edge

        this.ctx.fillStyle = glowGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Add sparkle effects for level 3
        if (level >= 3) {
            this.renderTowerLevel3Sparkles(centerX, centerY, radius);
        }

        this.ctx.restore();
    }

    // Knobs removed - they looked stupid

    // Render cartoony smiley face for all tower levels
    renderTowerSmileyFace(centerX, centerY, radius, level) {
        const eyeColor = '#000000'; // Black eyes
        const smileColor = '#000000'; // Black smile

        this.ctx.save();

        // Draw larger, more cartoony eyes with white highlights
        this.ctx.fillStyle = '#FFFFFF'; // White eye base
        const eyeRadius = radius * 0.18; // Much larger eyes (was 0.12)
        const eyeOffset = radius * 0.3; // Increased eye spacing

        // Left eye base (white)
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeOffset, centerY - eyeOffset, eyeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Right eye base (white)
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeOffset, centerY - eyeOffset, eyeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // All levels: Friendly round eyes (same as level 1)
        this.ctx.fillStyle = eyeColor;
        const pupilRadius = radius * 0.12; // Larger pupils (was 0.08)

        // Left pupil
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeOffset, centerY - eyeOffset, pupilRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Right pupil
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeOffset, centerY - eyeOffset, pupilRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Add white eye highlights for cartoony look (all levels now)
        if (true) {
            this.ctx.fillStyle = '#FFFFFF';
            const highlightRadius = radius * 0.03;

            // Left eye highlight
            this.ctx.beginPath();
            this.ctx.arc(centerX - eyeOffset - pupilRadius * 0.3, centerY - eyeOffset - pupilRadius * 0.3, highlightRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Right eye highlight
            this.ctx.beginPath();
            this.ctx.arc(centerX + eyeOffset - pupilRadius * 0.3, centerY - eyeOffset - pupilRadius * 0.3, highlightRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw bigger, more expressive smile
        this.ctx.strokeStyle = smileColor;
        this.ctx.lineWidth = Math.max(3, radius * 0.08); // Thicker smile
        this.ctx.lineCap = 'round';

        const smileRadius = radius * 0.4; // Bigger smile
        const smileStartAngle = 0.2 * Math.PI; // Wider smile
        const smileEndAngle = 0.8 * Math.PI;

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + radius * 0.05, smileRadius, smileStartAngle, smileEndAngle);
        this.ctx.stroke();

        // Add cheek blushes for extra cartoony look (all levels now)
        if (true) {
            this.ctx.fillStyle = '#FFB6C1'; // Light pink
            const cheekRadius = radius * 0.08;

            // Left cheek
            this.ctx.beginPath();
            this.ctx.arc(centerX - radius * 0.5, centerY + radius * 0.1, cheekRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Right cheek
            this.ctx.beginPath();
            this.ctx.arc(centerX + radius * 0.5, centerY + radius * 0.1, cheekRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    // Render sparkle effects for Level 3 towers
    renderTowerLevel3Sparkles(centerX, centerY, radius) {
        const smileyColor = '#FFD700'; // Golden yellow for sparkles

        this.ctx.save();
        this.ctx.fillStyle = smileyColor;
        const sparkleSize = radius * 0.05;

        // Draw 4 sparkles around the face
        const sparklePositions = [
            { x: centerX - radius * 0.7, y: centerY - radius * 0.7 },
            { x: centerX + radius * 0.7, y: centerY - radius * 0.7 },
            { x: centerX - radius * 0.7, y: centerY + radius * 0.7 },
            { x: centerX + radius * 0.7, y: centerY + radius * 0.7 }
        ];

        sparklePositions.forEach(pos => {
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.restore();
    }

    renderRankBadge(centerX, badgeY, level) {
        // Draw rank badge with vertical bars instead of text
        const barWidth = 4;      // Increased from 3
        const barHeight = 10;    // Increased from 8
        const barSpacing = 3;    // Increased from 2
        const barPadding = 3;    // Increased from 2

        // Calculate total width needed for all bars with spacing
        const totalWidth = (level * barWidth) + ((level - 1) * barSpacing) + (2 * barPadding);
        const startX = centerX - totalWidth / 2;

        // Badge background (yellow rectangle)
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(startX, badgeY, totalWidth, barHeight + (2 * barPadding));

        // Badge border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX, badgeY, totalWidth, barHeight + (2 * barPadding));

        // Draw vertical bars for each level
        this.ctx.fillStyle = '#333';
        for (let i = 0; i < level; i++) {
            const barX = startX + barPadding + (i * (barWidth + barSpacing));
            const barY = badgeY + barPadding;
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
        }
    }

    renderSelectionIndicator(centerX, centerY, radius) {
        // Enhanced prominent selection effect for towers
        const time = Date.now() / 1000;
        const pulseScale = 1.0 + Math.sin(time * 3) * 0.1;
        const selectionRadius = radius * 1.6 * pulseScale;

        this.ctx.save();

        // Outer glowing ring
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 5;
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, selectionRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Inner bright ring
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, selectionRadius * 0.85, 0, Math.PI * 2);
        this.ctx.stroke();

        // Corner markers for towers (different from enemies)
        const markerSize = 6;
        const markerDistance = selectionRadius + 8;
        const angles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]; // Diagonal positions

        this.ctx.fillStyle = '#FFD700';
        this.ctx.shadowBlur = 4;
        angles.forEach((angle, index) => {
            const markerX = centerX + Math.cos(angle + time * 1.5) * markerDistance;
            const markerY = centerY + Math.sin(angle + time * 1.5) * markerDistance;

            this.ctx.beginPath();
            this.ctx.arc(markerX, markerY, markerSize, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.restore();
    }


    renderGridLines(gridSystem) {
        this.ctx.strokeStyle = this.colors.debug;
        this.ctx.lineWidth = 1;

        // Vertical lines
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin
        for (let x = 0; x <= gridSystem.cols; x++) {
            const screenX = x * gridSystem.tileSize + gridOffsetX;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, gridOffsetY);
            this.ctx.lineTo(screenX, gridOffsetY + (gridSystem.rows * gridSystem.tileSize));
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= gridSystem.rows; y++) {
            const screenY = y * gridSystem.tileSize + gridOffsetY;
            this.ctx.beginPath();
            this.ctx.moveTo(gridOffsetX, screenY);
            this.ctx.lineTo(gridOffsetX + (gridSystem.cols * gridSystem.tileSize), screenY);
            this.ctx.stroke();
        }
    }

    renderEnemyPath(gridSystem) {
        const path = gridSystem.getEnemyPath();
        if (path.length < 2) return;

        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin
        this.ctx.strokeStyle = this.colors.debug;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            const screenX = point.x * gridSystem.tileSize + gridSystem.tileSize / 2 + gridOffsetX;
            const screenY = point.y * gridSystem.tileSize + gridSystem.tileSize / 2 + gridOffsetY;

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
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin

        // Render buildable areas with semi-transparent overlay
        for (let y = 0; y < gridSystem.rows; y++) {
            for (let x = 0; x < gridSystem.cols; x++) {
                const tile = gridSystem.getTile(x, y);
                if (tile) {
                    const screenX = x * tileSize + gridOffsetX;
                    const screenY = y * tileSize + gridOffsetY;

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

    renderEnemies(enemies, tileSize, selectedEnemy = null) {
        enemies.forEach(enemy => {
            // Render alive enemies OR dying enemies (for death animations)
            if (enemy.isAlive || enemy.isDying) {
                const isSelected = selectedEnemy && selectedEnemy.id === enemy.id;
                this.renderEnemy(enemy, tileSize, isSelected);
            }
        });
    }

    renderEnemy(enemy, tileSize, isSelected = false) {
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin
        const screenX = enemy.x * tileSize + gridOffsetX;
        const screenY = enemy.y * tileSize + gridOffsetY;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;
        const radius = (tileSize * enemy.size) / 2;

        // Save context state
        this.ctx.save();

        // Apply spawn animation if spawning
        if (enemy.spawnAnimation && enemy.spawnAnimation.active) {
            this.renderSpawnAnimation(centerX, centerY, enemy.spawnAnimation);
        }

        // Apply end reached animation if enemy reached goal
        if (enemy.endReachedAnimation && enemy.endReachedAnimation.active) {
            this.renderEndReachedAnimation(centerX, centerY, enemy.endReachedAnimation);
        }

        // Apply death animation if dying
        if (enemy.isDying && enemy.deathAnimation) {
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(enemy.deathAnimation.rotation);
            this.ctx.scale(enemy.deathAnimation.scale, enemy.deathAnimation.scale);
            this.ctx.globalAlpha = enemy.deathAnimation.alpha;
            this.ctx.translate(-centerX, -centerY);
        }

        // Apply damage flash effect
        if (enemy.isFlashing) {
            this.ctx.globalAlpha = 0.7;
        }

        // Enhanced glow effect for better visibility
        if (enemy.glowColor) {
            this.ctx.shadowColor = enemy.glowColor;
            this.ctx.shadowBlur = 12; // Increased from 8 for better visibility
        }

        // Draw enemy based on shape
        const currentColors = this.getCurrentColors();
        this.ctx.fillStyle = enemy.color || currentColors.enemy;
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

        // Enhanced border for better contrast
        if (enemy.borderColor && enemy.borderWidth) {
            // Draw thicker, more visible border
            this.ctx.strokeStyle = enemy.borderColor;
            this.ctx.lineWidth = enemy.borderWidth + 1; // Slightly thicker
            this.ctx.stroke();

            // Add inner dark outline for extra contrast
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        } else {
            // Add default dark border for enemies without defined borders
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Draw mean face on enemy
        this.renderEnemyMeanFace(enemy, centerX, centerY, radius);

        // Draw health bar for damaged enemies
        if (enemy.health < enemy.maxHealth) {
            this.renderEnemyHealthBar(enemy, centerX, centerY, radius, tileSize);
        }

        // Draw selection effect for selected enemies
        if (isSelected) {
            this.renderEnemySelectionEffect(centerX, centerY, radius);
        }

        // Render dramatic death effects (explosion and sparkles)
        if (enemy.isDying && enemy.deathAnimation) {
            console.log('🎆 Rendering death effects for enemy');
            this.renderDramaticDeathEffects(enemy, centerX, centerY);
        } else {
            // Debug why death effects aren't rendering
            if (enemy.isDying) {
                console.log('🎆 Enemy isDying=true but no deathAnimation:', enemy.deathAnimation);
            }
            if (enemy.deathAnimation) {
                console.log('🎆 Enemy has deathAnimation but isDying=false:', enemy.isDying);
            }
        }

        // Restore context state
        this.ctx.restore();
    }

    // Helper function to draw rounded rectangles
    roundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    // Render mean face on enemy for visual enhancement
    renderEnemyMeanFace(enemy, centerX, centerY, radius) {
        this.ctx.save();

        // Check if enemy has hit animation active
        const isHitAnimation = enemy.hitAnimation && enemy.hitAnimation.active;
        const hitProgress = isHitAnimation ? enemy.hitAnimation.progress : 0;

        // Draw larger angry eyes (moved down to center)
        this.ctx.fillStyle = '#000000'; // Black eyes
        const eyeRadius = radius * 0.12; // Increased from 0.08 (50% larger)
        const eyeOffset = radius * 0.25;
        const faceYOffset = radius * 0.1; // Move face features down to center

        // Adjust eye size for hit animation (squint effect)
        const currentEyeRadius = isHitAnimation ? eyeRadius * (0.3 + 0.7 * (1 - hitProgress)) : eyeRadius;

        // Left eye (angry) - moved down
        this.ctx.beginPath();
        this.ctx.arc(centerX - eyeOffset, centerY - eyeOffset + faceYOffset, currentEyeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Right eye (angry) - moved down
        this.ctx.beginPath();
        this.ctx.arc(centerX + eyeOffset, centerY - eyeOffset + faceYOffset, currentEyeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw larger angry eyebrows (angled lines above eyes)
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = Math.max(3, radius * 0.08); // Increased from 0.05 (60% thicker)
        this.ctx.lineCap = 'round';

        // Left eyebrow (angry angle) - moved down
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - eyeOffset - eyeRadius, centerY - eyeOffset - eyeRadius + faceYOffset);
        this.ctx.lineTo(centerX - eyeOffset + eyeRadius, centerY - eyeOffset - eyeRadius * 1.5 + faceYOffset);
        this.ctx.stroke();

        // Right eyebrow (angry angle) - moved down
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + eyeOffset - eyeRadius, centerY - eyeOffset - eyeRadius * 1.5 + faceYOffset);
        this.ctx.lineTo(centerX + eyeOffset + eyeRadius, centerY - eyeOffset - eyeRadius + faceYOffset);
        this.ctx.stroke();

        // Draw mouth - different for hit animation (open mouth) vs normal (frown)
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = Math.max(3, radius * 0.08); // Increased from 0.06 (33% thicker)
        this.ctx.lineCap = 'round';

        const mouthRadius = radius * 0.3; // Increased from 0.25 (20% larger)
        const mouthY = centerY + radius * 0.2 + faceYOffset;

        if (isHitAnimation) {
            // Hit animation: Open mouth (oval shape)
            const openMouthWidth = mouthRadius * 0.8;
            const openMouthHeight = mouthRadius * 1.5 * hitProgress; // Grows during animation

            this.ctx.beginPath();
            this.ctx.ellipse(centerX, mouthY, openMouthWidth, openMouthHeight, 0, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            // Normal: Mean frown mouth (upside-down curve)
            const mouthStartAngle = 1.2 * Math.PI; // Start angle for frown
            const mouthEndAngle = 1.8 * Math.PI;   // End angle for frown

            this.ctx.beginPath();
            this.ctx.arc(centerX, mouthY, mouthRadius, mouthStartAngle, mouthEndAngle);
            this.ctx.stroke();
        }

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

        // Draw cartoony health bar above enemy
        if (enemy.health < enemy.maxHealth) {
            const barWidth = tileSize * 0.9; // Reduced width (was 1.2)
            const barHeight = 12; // Increased height (was 8)
            const barX = centerX - barWidth / 2;
            const barY = centerY - radius - 15; // Moved up a bit

            // Cartoony background with rounded corners
            this.ctx.save();
            this.ctx.fillStyle = '#444444';
            this.ctx.strokeStyle = '#222222';
            this.ctx.lineWidth = 2;
            this.roundedRect(barX, barY, barWidth, barHeight, 4);
            this.ctx.fill();
            this.ctx.stroke();

            // Health with cartoony colors and rounded corners
            const healthPercent = enemy.health / enemy.maxHealth;
            const healthWidth = barWidth * healthPercent;

            if (healthWidth > 0) {
                // Cartoony health colors
                let healthColor = '#FF6B6B'; // Bright red for low health
                if (healthPercent > 0.6) {
                    healthColor = '#4ECDC4'; // Bright teal for high health
                } else if (healthPercent > 0.3) {
                    healthColor = '#FFE66D'; // Bright yellow for medium health
                }

                this.ctx.fillStyle = healthColor;
                this.roundedRect(barX, barY, healthWidth, barHeight, 4);
                this.ctx.fill();

                // Add a subtle glow effect
                this.ctx.shadowColor = healthColor;
                this.ctx.shadowBlur = 4;
                this.ctx.fillStyle = healthColor;
                this.roundedRect(barX, barY, healthWidth, barHeight, 4);
                this.ctx.fill();
            }

            this.ctx.restore();
        }
    }

    // Render prominent selection effect for selected enemies
    renderEnemySelectionEffect(centerX, centerY, radius) {
        this.ctx.save();

        const time = Date.now() / 1000;
        const pulseScale = 1.0 + Math.sin(time * 4) * 0.1; // Subtle pulsing
        const selectionRadius = radius * 1.8 * pulseScale;

        // Outer glowing ring
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, selectionRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Inner bright ring
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, selectionRadius * 0.8, 0, Math.PI * 2);
        this.ctx.stroke();

        // Animated corner markers
        const markerSize = 8;
        const markerDistance = selectionRadius + 10;
        const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

        this.ctx.fillStyle = '#FFD700';
        this.ctx.shadowBlur = 6;
        angles.forEach((angle, index) => {
            const markerX = centerX + Math.cos(angle + time * 2) * markerDistance;
            const markerY = centerY + Math.sin(angle + time * 2) * markerDistance;

            this.ctx.beginPath();
            this.ctx.arc(markerX, markerY, markerSize, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.restore();
    }

    // Render dramatic death effects (explosion and sparkles)
    renderDramaticDeathEffects(enemy, centerX, centerY) {
        this.ctx.save();

        const animation = enemy.deathAnimation;
        const progress = animation.time / animation.duration;

        // Render violent explosion ring with multiple waves
        if (progress < 0.6) {
            const explosionProgress = progress / 0.6; // Scale to 0-1 for explosion phase
            const explosionRadius = animation.explosionRadius + (explosionProgress * animation.maxExplosionRadius);

            // Outer violent explosion ring - red/orange
            this.ctx.strokeStyle = '#FFB6C1';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#FFB6C1';
            this.ctx.shadowBlur = 12;
            this.ctx.globalAlpha = (1 - explosionProgress) * 0.6;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, explosionRadius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Middle ring - light yellow
            this.ctx.strokeStyle = '#F0E68C';
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = '#F0E68C';
            this.ctx.shadowBlur = 8;
            this.ctx.globalAlpha = (1 - explosionProgress) * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, explosionRadius * 0.8, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inner core ring - soft lavender
            this.ctx.strokeStyle = '#DDA0DD';
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#DDA0DD';
            this.ctx.shadowBlur = 6;
            this.ctx.globalAlpha = (1 - explosionProgress) * 0.4;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, explosionRadius * 0.6, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Render enhanced sparkle particles
        if (animation.sparkles && animation.sparkles.length > 0) {
            animation.sparkles.forEach(sparkle => {
                // Update chunk position with gravity physics
                const deltaTime = animation.time / 1000;
                sparkle.x += sparkle.vx * deltaTime;
                sparkle.y += sparkle.vy * deltaTime;
                // Apply gravity to make chunks fall realistically
                if (sparkle.gravity) {
                    sparkle.vy += sparkle.gravity * deltaTime;
                }
                sparkle.life -= deltaTime;
                sparkle.rotation += sparkle.rotationSpeed * deltaTime;

                if (sparkle.life > 0) {
                    // Calculate alpha based on remaining life
                    const lifeProgress = sparkle.life / sparkle.maxLife;
                    this.ctx.globalAlpha = lifeProgress * (1 - progress); // Fade out over time

                    this.ctx.save();
                    this.ctx.translate(centerX + sparkle.x, centerY + sparkle.y);
                    this.ctx.rotate(sparkle.rotation);

                    // Draw gentle sparkles with soft edges
                    this.ctx.fillStyle = sparkle.color;
                    this.ctx.shadowColor = sparkle.color;
                    this.ctx.shadowBlur = 4; // Gentler glow

                    // Draw simple circular sparkles
                    this.ctx.beginPath();
                    const sparkleSize = sparkle.size;

                    // Draw simple circular sparkles
                    this.ctx.arc(0, 0, sparkleSize, 0, Math.PI * 2);
                    this.ctx.fill();

                    this.ctx.restore();
                }
            });
        }

        this.ctx.restore();
    }

    renderWaveInfo(waveInfo) {
        // Render enhanced wave announcement with dramatic effects
        if (waveInfo.announcement) {
            const textX = this.width / 2;
            let textY = this.height / 2 - 50;

            // Split announcement into lines
            const lines = waveInfo.announcement.split('\n');

            // Enhanced announcement type detection
            const isCountdown = waveInfo.announcement.includes('in:') && !waveInfo.announcement.includes('BOSS');
            const isBossWave = waveInfo.announcement.includes('BOSS in:');
            const isWaveComplete = waveInfo.announcement.includes('Complete');
            const isWaveStart = waveInfo.announcement.includes('INCOMING');

            // Check if this is the dramatic last 5 seconds
            const isLast5Seconds = (isCountdown || isBossWave) && (
                waveInfo.announcement.includes('05') ||
                waveInfo.announcement.includes('04') ||
                waveInfo.announcement.includes('03') ||
                waveInfo.announcement.includes('02') ||
                waveInfo.announcement.includes('01')
            );

            // Dynamic font sizing based on announcement type
            let fontSize, textColor, outlineColor;
            if (isCountdown && isLast5Seconds) {
                fontSize = 'bold 72px Impact';
                textColor = '#FF4444'; // Red for dramatic countdown
                outlineColor = '#FFFFFF';
            } else if (isBossWave && isLast5Seconds) {
                fontSize = 'bold 68px Impact';
                textColor = '#FF6B00'; // Orange for dramatic boss waves
                outlineColor = '#000000';
            } else if (isCountdown || isBossWave) {
                fontSize = 'bold 32px Arial';
                textColor = '#FFFFFF'; // White for normal countdown
                outlineColor = '#000000';
            } else if (isWaveComplete) {
                fontSize = 'bold 48px Arial';
                textColor = '#44FF44'; // Green for completion
                outlineColor = '#000000';
            } else if (isWaveStart) {
                fontSize = 'bold 40px Arial';
                textColor = '#FFD700'; // Gold for wave start
                outlineColor = '#000000';
            } else {
                fontSize = 'bold 32px Arial';
                textColor = '#FFFFFF';
                outlineColor = '#000000';
            }

            // Apply dramatic visual effects
            this.ctx.font = fontSize;
            this.ctx.textAlign = 'center';
            this.ctx.lineWidth = 4;

            // Add pulsing effect for countdown (only last 5 seconds)
            if (isCountdown && isLast5Seconds) {
                const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
                this.ctx.shadowColor = textColor;
                this.ctx.shadowBlur = 20 * pulseIntensity;
            }

            // Add glow effect for boss waves (only last 5 seconds)
            if (isBossWave && isLast5Seconds) {
                this.ctx.shadowColor = textColor;
                this.ctx.shadowBlur = 30;
            }

            lines.forEach((line, index) => {
                const y = textY + (index * (isCountdown ? 80 : 50));

                // Enhanced text rendering with effects
                this.ctx.strokeStyle = outlineColor;
                this.ctx.fillStyle = textColor;

                this.ctx.strokeText(line, textX, y);
                this.ctx.fillText(line, textX, y);
            });

            // Reset shadow effects
            this.ctx.shadowBlur = 0;
        }

        // Wave stats are already shown in the HUD, no need for redundant panel
    }

    renderWaveStatsPanel(waveInfo) {
        const panelWidth = 280;
        const panelHeight = 120;
        const panelX = 20;
        const panelY = 20; // Move to top left to avoid HUD overlap

        // Enhanced panel background with animated gradient
        const time = Date.now() * 0.001;
        const gradient = this.ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${0.9 + Math.sin(time) * 0.1})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${0.7 + Math.sin(time * 1.5) * 0.1})`);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        // Dynamic border color based on wave state
        const borderColor = this.getWaveStateColor(waveInfo.waveState);
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        // Add subtle glow effect
        this.ctx.shadowColor = borderColor;
        this.ctx.shadowBlur = 10;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        this.ctx.shadowBlur = 0;

        // Enhanced wave number with icon
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`🌊 Wave ${waveInfo.currentWave}`, panelX + 15, panelY + 30);

        // Enhanced enemy count with progress visualization
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillText(`Enemies: ${waveInfo.enemiesSpawned}/${waveInfo.totalEnemies}`, panelX + 15, panelY + 55);

        // Enhanced progress bar for enemies with animation
        const barWidth = 220;
        const barHeight = 12;
        const barX = panelX + 15;
        const barY = panelY + 70;

        // Animated background bar with gradient
        const bgGradient = this.ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        bgGradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress bar with animated gradient
        const progress = waveInfo.totalEnemies > 0 ? waveInfo.enemiesSpawned / waveInfo.totalEnemies : 0;
        const progressGradient = this.ctx.createLinearGradient(barX, barY, barX + barWidth * progress, barY);
        progressGradient.addColorStop(0, '#4CAF50');
        progressGradient.addColorStop(1, '#8BC34A');
        this.ctx.fillStyle = progressGradient;
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        // Add animated glow to progress bar
        if (progress > 0) {
            this.ctx.shadowColor = '#4CAF50';
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
            this.ctx.shadowBlur = 0;
        }

        // Enhanced wave state indicator with icon and animation
        this.ctx.font = 'bold 16px Arial';
        const stateColor = this.getWaveStateColor(waveInfo.waveState);
        this.ctx.fillStyle = stateColor;

        // Add pulsing effect for active states
        if (waveInfo.waveState === 'spawning' || waveInfo.waveState === 'active') {
            const pulseIntensity = Math.sin(time * 8) * 0.3 + 0.7;
            this.ctx.shadowColor = stateColor;
            this.ctx.shadowBlur = 5 * pulseIntensity;
        }

        const stateIcon = this.getWaveStateIcon(waveInfo.waveState);
        this.ctx.fillText(`${stateIcon} ${waveInfo.waveState.toUpperCase()}`, panelX + 15, panelY + 95);
        this.ctx.shadowBlur = 0;
    }

    getWaveStateIcon(state) {
        switch (state) {
            case 'preparation': return '⏰';
            case 'spawning': return '🚀';
            case 'active': return '⚔️';
            case 'complete': return '✅';
            default: return '❓';
        }
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

    // Render dramatic warning effect for wave announcements
    renderDramaticWarningEffect(waveInfo) {
        const time = Date.now() / 1000;
        const isCountdown = waveInfo.announcement.includes('STARTS IN');
        const isBossWave = waveInfo.announcement.includes('BOSS WAVE');

        if (isCountdown || isBossWave) {
            // Create dramatic corner blur pulse effect
            const intensity = isBossWave ? 0.8 : 0.6;
            const pulseSpeed = isBossWave ? 8 : 6;
            const pulseIntensity = Math.sin(time * pulseSpeed) * 0.5 + 0.5;

            // Calculate fade-out transition
            let fadeMultiplier = 1.0;
            if (waveInfo.waveState === 'spawning' && waveInfo.announcementTime) {
                const elapsed = Date.now() - waveInfo.announcementTime;
                const fadeDuration = 1000; // 1 second fade-out
                if (elapsed > 0) {
                    fadeMultiplier = Math.max(0, 1.0 - (elapsed / fadeDuration));
                }
            }

            // Apply blur effect to corners of the screen
            this.ctx.save();

            // Create radial gradient for corner blur effect
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

            // Increased opacity for better visibility
            const cornerOpacity = pulseIntensity * 0.6 * fadeMultiplier; // Increased from 0.3 to 0.6
            const borderOpacity = pulseIntensity * 0.8 * fadeMultiplier; // Increased from 0.6 to 0.8

            // Top-left corner blur
            const gradient1 = this.ctx.createRadialGradient(0, 0, 0, 0, 0, maxDistance * 0.4);
            gradient1.addColorStop(0, `rgba(255, 100, 100, ${cornerOpacity})`);
            gradient1.addColorStop(1, 'rgba(255, 100, 100, 0)');
            this.ctx.fillStyle = gradient1;
            this.ctx.fillRect(0, 0, this.width * 0.3, this.height * 0.3);

            // Top-right corner blur
            const gradient2 = this.ctx.createRadialGradient(this.width, 0, 0, this.width, 0, maxDistance * 0.4);
            gradient2.addColorStop(0, `rgba(255, 100, 100, ${cornerOpacity})`);
            gradient2.addColorStop(1, 'rgba(255, 100, 100, 0)');
            this.ctx.fillStyle = gradient2;
            this.ctx.fillRect(this.width * 0.7, 0, this.width * 0.3, this.height * 0.3);

            // Bottom-left corner blur
            const gradient3 = this.ctx.createRadialGradient(0, this.height, 0, 0, this.height, maxDistance * 0.4);
            gradient3.addColorStop(0, `rgba(255, 100, 100, ${cornerOpacity})`);
            gradient3.addColorStop(1, 'rgba(255, 100, 100, 0)');
            this.ctx.fillStyle = gradient3;
            this.ctx.fillRect(0, this.height * 0.7, this.width * 0.3, this.height * 0.3);

            // Bottom-right corner blur
            const gradient4 = this.ctx.createRadialGradient(this.width, this.height, 0, this.width, this.height, maxDistance * 0.4);
            gradient4.addColorStop(0, `rgba(255, 100, 100, ${cornerOpacity})`);
            gradient4.addColorStop(1, 'rgba(255, 100, 100, 0)');
            this.ctx.fillStyle = gradient4;
            this.ctx.fillRect(this.width * 0.7, this.height * 0.7, this.width * 0.3, this.height * 0.3);

            // Add subtle border pulse effect
            this.ctx.strokeStyle = `rgba(255, 100, 100, ${borderOpacity})`;
            this.ctx.lineWidth = 3 + pulseIntensity * 2;
            this.ctx.strokeRect(0, 0, this.width, this.height);

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

    renderPauseOverlay() {
        // Semi-transparent dark overlay
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Render "PAUSED" title
        this.ctx.save();
        this.ctx.font = 'bold 72px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#FFD700'; // Gold color
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 5;

        this.ctx.strokeText('PAUSED', centerX, centerY - 40);
        this.ctx.fillText('PAUSED', centerX, centerY - 40);
        this.ctx.restore();

        // Render instructions
        this.ctx.save();
        this.ctx.font = '28px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;

        this.ctx.strokeText('Press ESC to resume', centerX, centerY + 40);
        this.ctx.fillText('Press ESC to resume', centerX, centerY + 40);
        this.ctx.restore();
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

            // Render placement effect particles if they exist
            if (tower.placementEffects) {
                this.renderPlacementEffects(tower.placementEffects);
            }
        });
    }

    // Render projectiles
    renderProjectiles(projectiles) {
        projectiles.forEach(projectile => {
            this.renderProjectile(projectile);
        });
    }

    // Render individual projectile with enhanced trail and bouncy effects
    renderProjectile(projectile) {
        const time = Date.now() / 1000;

        // Save context state
        this.ctx.save();

        // Enhanced trail effect with gradient
        if (projectile.trail && projectile.trail.length > 1) {
            // Create gradient trail that fades from projectile color to transparent
            const gradient = this.ctx.createLinearGradient(
                projectile.trail[0].x, projectile.trail[0].y,
                projectile.trail[projectile.trail.length - 1].x,
                projectile.trail[projectile.trail.length - 1].y
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            gradient.addColorStop(1, projectile.color + 'CC'); // 80% opacity

            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(projectile.trail[0].x, projectile.trail[0].y);
            for (let i = 1; i < projectile.trail.length; i++) {
                this.ctx.lineTo(projectile.trail[i].x, projectile.trail[i].y);
            }
            this.ctx.stroke();
        }

        // Different animations for bombs vs regular projectiles
        this.ctx.translate(projectile.x, projectile.y);

        if (projectile.isBomb) {
            // Bomb: slower, more dramatic bobbing
            const bombRotation = Math.sin(time * 4 + projectile.id * 0.1) * 0.2;
            this.ctx.rotate(bombRotation);

            // Enhanced glow effect for bombs
            const pulseIntensity = Math.sin(time * 4) * 0.4 + 0.6;
            this.ctx.shadowColor = projectile.color;
            this.ctx.shadowBlur = 15 + pulseIntensity * 8;

            // Draw bomb with distinctive oval shape
            this.ctx.fillStyle = projectile.color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, projectile.size, projectile.size * 0.8, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Bomb fuse
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -projectile.size);
            this.ctx.lineTo(0, -projectile.size - 15);
            this.ctx.stroke();

            // Bomb sparkle on fuse
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(0, -projectile.size - 15, 4, 0, Math.PI * 2);
            this.ctx.fill();

            // Bomb border
            this.ctx.strokeStyle = '#FFF';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, projectile.size, projectile.size * 0.8, 0, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            // Regular projectile: bouncy rotation animation
            const bounceRotation = Math.sin(time * 8 + projectile.id * 0.1) * 0.1;
            this.ctx.rotate(bounceRotation);

            // Enhanced glow effect with pulsing for better visibility
            const pulseIntensity = Math.sin(time * 6) * 0.3 + 0.7;
            this.ctx.shadowColor = projectile.color;
            this.ctx.shadowBlur = 12 + pulseIntensity * 6; // Increased from 8+4

            // Main projectile body with enhanced colors
            this.ctx.fillStyle = projectile.color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, projectile.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Add bright center with pulsing effect
            this.ctx.fillStyle = '#FFF';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, projectile.size * (0.3 + pulseIntensity * 0.2), 0, Math.PI * 2);
            this.ctx.fill();

            // Enhanced border system for maximum contrast
            this.ctx.strokeStyle = '#FFF';
            this.ctx.lineWidth = 3 + pulseIntensity; // Increased from 2
            this.ctx.stroke();

            // Add dark inner outline for contrast
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Add sparkle effect around fast-moving projectiles
            if (projectile.speed > 200) {
                this.renderProjectileSparkles(0, 0, time, projectile.id);
            }
        }

        // Restore context state
        this.ctx.restore();
    }

    // Render sparkles around fast projectiles
    renderProjectileSparkles(centerX, centerY, time, projectileId) {
        this.ctx.save();

        // Create 2-3 sparkles around the projectile
        const sparkleCount = 3;
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (time * 4 + i * Math.PI / 1.5 + projectileId * 0.1) % (Math.PI * 2);
            const distance = 12 + Math.sin(time * 8 + i) * 3;
            const sparkleX = centerX + Math.cos(angle) * distance;
            const sparkleY = centerY + Math.sin(angle) * distance;

            const sparkleSize = 1 + Math.sin(time * 6 + i) * 0.5;
            const sparkleAlpha = 0.6 + Math.sin(time * 8 + i) * 0.3;

            this.ctx.globalAlpha = sparkleAlpha;
            this.ctx.fillStyle = '#FFF';
            this.ctx.shadowColor = '#FFF';
            this.ctx.shadowBlur = 4;
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    // Render upgrade particles with enhanced contrast
    renderUpgradeParticles(particles) {
        particles.forEach(particle => {
            this.ctx.save();

            // Set alpha for fading effect
            this.ctx.globalAlpha = particle.alpha;

            // Enhanced glow effect for better visibility
            this.ctx.shadowColor = particle.color;
            this.ctx.shadowBlur = 10; // Increased from 6

            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Enhanced bright center with border for contrast
            this.ctx.fillStyle = '#FFF';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.restore();
        });
    }

    // Render placement effect particles with enhanced contrast
    renderPlacementEffects(effects) {
        effects.forEach(effect => {
            this.ctx.save();

            // Set alpha for fading effect
            this.ctx.globalAlpha = effect.alpha;

            // Enhanced glow effect for better visibility
            this.ctx.shadowColor = effect.color;
            this.ctx.shadowBlur = 12; // Increased from 8

            this.ctx.fillStyle = effect.color;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Enhanced bright center with border for contrast
            this.ctx.fillStyle = '#FFF';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, effect.size * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

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
            this.ctx.globalAlpha = particle.alpha || (particle.life / particle.maxLife);

            if (particle.text) {
                // Render floating text with appropriate color
                const isNegative = particle.text.startsWith('-');
                this.ctx.fillStyle = isNegative ? '#FF4444' : '#FFD700';
                this.ctx.font = `bold ${particle.size}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.strokeStyle = isNegative ? '#AA0000' : '#000';
                this.ctx.lineWidth = isNegative ? 3 : 2; // Thicker outline for negative text
                this.ctx.strokeText(particle.text, particle.x, particle.y);
                this.ctx.fillText(particle.text, particle.x, particle.y);
            } else {
                // Render sparkle particles with rotation and glow
                this.ctx.translate(particle.x, particle.y);
                if (particle.rotation !== undefined) {
                    this.ctx.rotate(particle.rotation);
                }

                // Add glow effect
                this.ctx.shadowColor = particle.color;
                this.ctx.shadowBlur = 6;

                this.ctx.fillStyle = particle.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                this.ctx.fill();

                // Add bright center
                this.ctx.fillStyle = '#FFF';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, particle.size * 0.6, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        });
    }

    // Render impact effects from projectile hits
    renderImpactEffects(effects) {

        effects.forEach(effect => {
            this.ctx.save();
            this.ctx.globalAlpha = effect.alpha || (effect.life / effect.maxLife);

            if (effect.text) {
                // Render damage number floating text
                if (effect.isCritical) {
                    // Critical hit styling - larger, golden, more dramatic
                    this.ctx.fillStyle = '#FFD700'; // Gold for crits
                    this.ctx.font = `bold ${effect.size}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.strokeStyle = '#FF8C00'; // Orange outline
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeText(effect.text, effect.x, effect.y);
                    this.ctx.fillText(effect.text, effect.x, effect.y);
                } else if (effect.isBomb) {
                    // Bomb damage styling - orange
                    this.ctx.fillStyle = '#FF4500'; // Orange for bomb damage
                    this.ctx.font = `bold ${effect.size}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.strokeStyle = '#CC3300'; // Darker orange outline
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeText(effect.text, effect.x, effect.y);
                    this.ctx.fillText(effect.text, effect.x, effect.y);
                } else {
                    // Regular damage styling - red
                    this.ctx.fillStyle = '#FF4444'; // Red for damage numbers
                    this.ctx.font = `bold ${effect.size}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.strokeStyle = '#AA0000';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeText(effect.text, effect.x, effect.y);
                    this.ctx.fillText(effect.text, effect.x, effect.y);
                }
            } else if (effect.radius !== undefined) {
                // Render bomb explosion ring effect
                if (this.logger) this.logger.info(`Rendering ring effect at (${effect.x.toFixed(1)}, ${effect.y.toFixed(1)}) with radius ${effect.radius}, maxRadius ${effect.maxRadius}, life ${effect.life}/${effect.maxLife}`);


                // Use actual ring effect coordinates
                this.ctx.translate(effect.x, effect.y);

                // Calculate ring expansion
                const progress = 1 - (effect.life / effect.maxLife);
                const currentRadius = effect.radius + (effect.maxRadius - effect.radius) * progress;

                // Draw expanding ring
                this.ctx.strokeStyle = effect.color;
                this.ctx.lineWidth = effect.thickness;
                this.ctx.globalAlpha = effect.alpha * (1 - progress); // Fade out as ring expands

                this.ctx.beginPath();
                this.ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
                this.ctx.stroke();

                // Add inner glow
                this.ctx.shadowColor = effect.color;
                this.ctx.shadowBlur = 15;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2);
                this.ctx.stroke();
            } else {
                // Render impact sparkle particles with rotation and glow
                this.ctx.translate(effect.x, effect.y);
                if (effect.rotation !== undefined) {
                    this.ctx.rotate(effect.rotation);
                }

                // Add glow effect
                this.ctx.shadowColor = effect.color;
                this.ctx.shadowBlur = 8;

                this.ctx.fillStyle = effect.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, effect.size, 0, Math.PI * 2);
                this.ctx.fill();

                // Add bright center
                this.ctx.fillStyle = '#FFF';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, effect.size * 0.6, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        });
    }

    // Render individual coin
    renderCoin(coin) {
        const bounceY = coin.y + coin.bounceHeight;
        const swayX = coin.x + (coin.swayOffset || 0);
        const time = Date.now() / 1000;

        // Add subtle rotation animation
        const rotation = Math.sin(time * 2 + coin.id * 0.1) * 0.1;

        // Handle collection and expiration animation scaling
        let scale = 1.0;
        if (coin.collected && coin.collectionProgress !== undefined) {
            scale = Math.max(0.1, 1.0 - coin.collectionProgress);
        } else if (coin.expired && coin.expirationProgress !== undefined) {
            scale = Math.max(0.1, 1.0 - coin.expirationProgress);
        }

        this.ctx.save();
        this.ctx.translate(swayX, bounceY);
        this.ctx.scale(scale, scale);
        this.ctx.rotate(rotation);

        // Determine coin visual state
        let coinColor = '#FFD700';
        let glowColor = '#FFD700';
        let borderColor = '#FFA500';
        let innerColor = '#FFF8DC';
        let shadowBlur = 8;

        if (coin.expired) {
            // Expired coin - dark, negative colors
            coinColor = '#666666';
            glowColor = '#FF4444';
            borderColor = '#444444';
            innerColor = '#888888';
            shadowBlur = 12;
        } else if (coin.warningProgress > 0) {
            // Warning coin - pulsing orange/red
            const warningIntensity = Math.sin(time * 8) * 0.5 + 0.5;
            coinColor = `rgba(255, ${165 - warningIntensity * 100}, ${0 + warningIntensity * 100}, 1)`;
            glowColor = '#FF8800';
            borderColor = '#FF6600';
            innerColor = '#FFCC88';
            shadowBlur = 10 + warningIntensity * 4;
        }

        // Draw coin with enhanced glow effect
        this.ctx.shadowColor = glowColor;
        this.ctx.shadowBlur = shadowBlur;

        // Main coin body
        this.ctx.fillStyle = coinColor;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 24, 0, Math.PI * 2);
        this.ctx.fill();

        // Enhanced coin border with gradient and high contrast
        const gradient = this.ctx.createRadialGradient(0, 0, 18, 0, 0, 24);
        gradient.addColorStop(0, borderColor);
        gradient.addColorStop(1, coin.expired ? '#333333' : '#B8860B');
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 4; // Increased from 3 for better visibility
        this.ctx.stroke();

        // Add inner dark outline for maximum contrast
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Inner coin highlight
        this.ctx.fillStyle = innerColor;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw sparkle effects around coin (only for normal coins)
        if (!coin.expired && coin.warningProgress === 0) {
            this.renderCoinSparkles(0, 0, time, coin.id);
        } else if (coin.warningProgress > 0) {
            // Warning sparkles - more intense and red/orange
            this.renderWarningSparkles(0, 0, time, coin.id, coin.warningProgress);
        }

        this.ctx.restore();

        // Draw coin value ON the coin (centered)
        if (coin.value > 1) {
            this.ctx.save();
            this.ctx.translate(swayX, bounceY);
            this.ctx.scale(scale, scale);

            // Draw value text on the coin with high contrast
            this.ctx.fillStyle = '#000000'; // Black text for visibility
            this.ctx.font = 'bold 16px Arial'; // Increased from 14px to 16px
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Add white outline for better contrast
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3; // Increased from 2 to 3 for better outline
            this.ctx.strokeText(coin.value.toString(), 0, 0);
            this.ctx.fillText(coin.value.toString(), 0, 0);

            this.ctx.restore();
        }
    }

    // Enhanced sparkle effects for coins
    renderCoinSparkles(centerX, centerY, time, coinId) {
        this.ctx.save();

        // Create 4 sparkles around the coin with enhanced contrast
        for (let i = 0; i < 4; i++) {
            const angle = (time * 2 + i * Math.PI / 2 + coinId * 0.1) % (Math.PI * 2);
            const distance = 25 + Math.sin(time * 3 + i) * 3;
            const sparkleX = centerX + Math.cos(angle) * distance;
            const sparkleY = centerY + Math.sin(angle) * distance;

            const sparkleSize = 2 + Math.sin(time * 4 + i) * 0.5; // Increased from 1.5
            const sparkleAlpha = 0.8 + Math.sin(time * 3 + i) * 0.2; // Increased from 0.6

            this.ctx.globalAlpha = sparkleAlpha;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 8; // Increased from 4 for better visibility
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Enhanced bright center with border
            this.ctx.fillStyle = '#FFF';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // Enhanced warning sparkles for coins approaching expiration
    renderWarningSparkles(centerX, centerY, time, coinId, warningProgress) {
        this.ctx.save();

        // Create more intense sparkles with enhanced warning colors and contrast
        const sparkleCount = 6 + Math.floor(warningProgress * 4); // More sparkles as warning increases

        for (let i = 0; i < sparkleCount; i++) {
            const angle = (time * 4 + i * Math.PI / 3 + coinId * 0.1) % (Math.PI * 2);
            const distance = 30 + Math.sin(time * 6 + i) * 5;
            const sparkleX = centerX + Math.cos(angle) * distance;
            const sparkleY = centerY + Math.sin(angle) * distance;

            const sparkleSize = 2.5 + Math.sin(time * 6 + i) * 1; // Increased from 2
            const sparkleAlpha = 0.9 + Math.sin(time * 8 + i) * 0.1; // Increased from 0.8

            // Enhanced warning colors - more intense red/orange
            const warningIntensity = Math.sin(time * 8 + i) * 0.5 + 0.5;
            const sparkleColor = `rgba(255, ${165 - warningIntensity * 100}, ${0 + warningIntensity * 100}, 1)`;

            this.ctx.globalAlpha = sparkleAlpha;
            this.ctx.fillStyle = sparkleColor;
            this.ctx.shadowColor = sparkleColor;
            this.ctx.shadowBlur = 10; // Increased from 6 for better visibility
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Enhanced bright center with dark border for contrast
            this.ctx.fillStyle = '#FFF';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // Helper to convert hex color to RGB string
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ?
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
            '74, 144, 226'; // fallback to blue
    }

    // Render redesigned tower placement popup: [Selected] [Cycle] [Cancel] + ghost
    renderTowerPlacementPopup(popupInfo) {
        if (!popupInfo) return;

        const { x, y, tileSize } = popupInfo;

        // Get current coins for cost checking
        const currentCoins = this.resourceSystem ? this.resourceSystem.getCoins() : 0;

        // Calculate compact popup position - more square shape
        // x and y are now screen coordinates, not grid coordinates
        const popupWidth = Math.min(1.8 * tileSize, 180);  // Increased from 1.6 * tileSize
        const popupHeight = Math.min(1.8 * tileSize, 180); // Made same as width for square shape
        const popupX = x + (tileSize - popupWidth) / 2;
        const popupY = y + (tileSize - popupHeight) / 2;

        // Ensure popup stays within canvas bounds
        const finalX = Math.max(10, Math.min(popupX, this.width - popupWidth - 10));
        const finalY = Math.max(10, Math.min(popupY, this.height - popupHeight - 10));

        this.ctx.save();

        // Modern popup background with gradient
        this.ctx.beginPath();
        this.ctx.roundRect(finalX, finalY, popupWidth, popupHeight, 18); // Scaled up from 12
        this.ctx.clip();

        const gradient = this.ctx.createLinearGradient(finalX, finalY, finalX, finalY + popupHeight);
        gradient.addColorStop(0, 'rgba(40, 40, 40, 0.7)'); // More transparent: 0.95 → 0.7
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0.6)'); // More transparent: 0.9 → 0.6

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(finalX, finalY, popupWidth, popupHeight);

        this.ctx.restore();

        // Popup border with glow effect
        this.ctx.save();
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 4; // Scaled up from 3
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 15; // Scaled up from 10
        this.ctx.beginPath();
        this.ctx.roundRect(finalX, finalY, popupWidth, popupHeight, 18); // Scaled up from 12
        this.ctx.stroke();
        this.ctx.restore();


        // Selected type main button
        const selectedType = (popupInfo.selectedType && TOWER_TYPES[popupInfo.selectedType]) ? popupInfo.selectedType : 'BASIC';
        const typeCfg = TOWER_TYPES[selectedType];
        const canAffordSelected = currentCoins >= typeCfg.cost;
        const mainBtnW = popupWidth - 24; // Increased margin from 16
        const mainBtnH = (popupHeight - 36) / 2; // Half the height minus margins (12px top + 6px middle + 12px bottom + 6px gap)
        const mainBtnX = finalX + 12; // Increased margin from 8
        const mainBtnY = finalY + 12; // Increased margin from 8

        // Simple ghost preview with clear range indication
        // x and y are now screen coordinates, not grid coordinates
        const centerX = x + tileSize / 2;
        const centerY = y + tileSize / 2;
        const time = Date.now() / 1000;

        this.ctx.save();

        // Simple tower ghost - just a pulsing circle
        const towerPulse = 0.9 + Math.sin(time * 4) * 0.1;
        const towerSize = (typeCfg.size / 2) * towerPulse;

        // Tower ghost with subtle glow
        this.ctx.shadowColor = typeCfg.color;
        this.ctx.shadowBlur = 15;
        this.ctx.globalAlpha = 0.4;
        this.ctx.fillStyle = typeCfg.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, towerSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Range circle - clear and simple
        const rangePixels = (typeCfg.range || 0) * tileSize;
        if (rangePixels > 0) {
            const pulseScale = 1.0 + Math.sin(time * 2) * 0.05;
            const animatedRange = rangePixels * pulseScale;

            // Range circle with high contrast
            this.ctx.shadowBlur = 0;
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.8;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, animatedRange, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inner range fill for coverage area
            this.ctx.globalAlpha = 0.15;
            this.ctx.fillStyle = typeCfg.color;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, animatedRange, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();

        // Main selected button (coin graphic + cost only, centered)
        this.ctx.save();
        this.ctx.globalAlpha = 0.8; // Add transparency to button
        this.ctx.fillStyle = canAffordSelected ? typeCfg.color : '#666';
        this.ctx.beginPath();
        this.ctx.roundRect(mainBtnX, mainBtnY, mainBtnW, mainBtnH, 12); // Scaled up from 8
        this.ctx.fill();
        this.ctx.strokeStyle = canAffordSelected ? '#FFF' : '#999';
        this.ctx.lineWidth = 3; // Scaled up from 2
        this.ctx.stroke();

        // Compute centered layout for coin + cost text
        const costText = `${typeCfg.cost}`;
        this.ctx.font = 'bold 27px Arial'; // Scaled up from 18px
        const textWidth = this.ctx.measureText(costText).width;
        const coinRadius = 15; // Scaled up from 10
        const spacing = 12; // Scaled up from 8
        const totalWidth = coinRadius * 2 + spacing + textWidth;
        const contentStartX = mainBtnX + (mainBtnW - totalWidth) / 2;
        const contentCenterY = mainBtnY + mainBtnH / 2;

        // Draw coin (match HUD coin style)
        const coinCenterX = contentStartX + coinRadius;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(coinCenterX, contentCenterY, coinRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#B8860B';
        this.ctx.lineWidth = 3; // Scaled up from 2
        this.ctx.stroke();

        // Draw cost text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        const textX = coinCenterX + coinRadius + spacing;
        this.ctx.fillText(costText, textX, contentCenterY);
        this.ctx.restore();

        // Cycle and Cancel buttons aligned and stretched under main button
        const bottomMargin = 12; // Increased margin to push bottom buttons down (was 3)
        const buttonGap = 9; // small gap between cycle and cancel (scaled up from 6)
        const bottomBtnY = mainBtnY + mainBtnH + bottomMargin;
        const bottomBtnH = mainBtnH; // same height as selected button (half the popup height)

        // Calculate widths: cycle and cancel fill remaining space
        const availableWidth = mainBtnW;
        const cycleW = (availableWidth - buttonGap) / 2;
        const cancelW = (availableWidth - buttonGap) / 2;

        // Align cycle to left edge of selected button, cancel to right edge
        const cycleX = mainBtnX;
        const cancelX = mainBtnX + cycleW + buttonGap;

        // Cycle button
        this.ctx.save();
        this.ctx.globalAlpha = 0.8; // Add transparency to button
        this.ctx.fillStyle = '#1976D2';
        this.ctx.beginPath();
        this.ctx.roundRect(cycleX, bottomBtnY, cycleW, bottomBtnH, 9); // Scaled up from 6
        this.ctx.fill();
        this.ctx.strokeStyle = '#BBDEFB';
        this.ctx.lineWidth = 2; // Scaled up from 1.5
        this.ctx.stroke();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 48px Arial'; // Scaled up from 32px
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⟳', cycleX + cycleW / 2, bottomBtnY + bottomBtnH / 2);
        this.ctx.restore();

        // Cancel button
        this.ctx.save();
        this.ctx.globalAlpha = 0.8; // Add transparency to button
        this.ctx.fillStyle = '#C62828';
        this.ctx.beginPath();
        this.ctx.roundRect(cancelX, bottomBtnY, cancelW, bottomBtnH, 9); // Scaled up from 6
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFCDD2';
        this.ctx.lineWidth = 2; // Scaled up from 1.5
        this.ctx.stroke();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial'; // Scaled up from 16px
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('X', cancelX + cancelW / 2, bottomBtnY + bottomBtnH / 2);
        this.ctx.restore();

        // Store bounds
        this.placementPopupBounds = {
            selected: { x: mainBtnX, y: mainBtnY, width: mainBtnW, height: mainBtnH },
            cycle: { x: cycleX, y: bottomBtnY, width: cycleW, height: bottomBtnH },
            cancel: { x: cancelX, y: bottomBtnY, width: cancelW, height: bottomBtnH }
        };
    }

    // Render individual tower option button
    renderTowerOptionButton(x, y, width, height, name, cost, color, canAfford, towerType) {
        this.ctx.save();

        // Button background
        if (canAfford) {
            this.ctx.fillStyle = color;
        } else {
            this.ctx.fillStyle = '#666';
        }

        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.fill();

        // Button border
        this.ctx.strokeStyle = canAfford ? '#FFF' : '#999';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Tower icon (simple circle/square based on type)
        const iconSize = 20;
        const iconX = x + width / 2;
        const iconY = y + 15;

        this.ctx.fillStyle = canAfford ? '#FFF' : '#999';
        if (towerType === 'strong') {
            // Square for strong tower
            this.ctx.fillRect(iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize);
        } else {
            // Circle for basic tower
            this.ctx.beginPath();
            this.ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Tower name
        this.ctx.fillStyle = canAfford ? '#FFF' : '#999';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(name, x + width / 2, y + 35);

        // Cost
        this.ctx.font = 'bold 10px Arial';
        this.ctx.fillStyle = canAfford ? '#FFD700' : '#999';
        this.ctx.fillText(`${cost} coins`, x + width / 2, y + 50);

        this.ctx.restore();
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

    // Render damage indicators floating above enemies
    renderDamageIndicators(indicators) {
        indicators.forEach(indicator => {
            this.ctx.save();
            this.ctx.globalAlpha = indicator.alpha;

            // Render damage text with enhanced contrast
            this.ctx.fillStyle = indicator.color;
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.font = `bold ${indicator.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Add glow effect
            this.ctx.shadowColor = indicator.color;
            this.ctx.shadowBlur = 4;

            this.ctx.strokeText(indicator.text, indicator.x, indicator.y);
            this.ctx.fillText(indicator.text, indicator.x, indicator.y);

            this.ctx.restore();
        });
    }

    // Render spawn animation with circle ripples
    renderSpawnAnimation(centerX, centerY, spawnAnimation) {
        this.ctx.save();

        const progress = spawnAnimation.time / spawnAnimation.duration;
        const currentRadius = progress * spawnAnimation.maxRadius;
        const alpha = spawnAnimation.alpha * (1 - progress);

        // Create expanding circle ripples
        for (let i = 0; i < 3; i++) {
            const rippleProgress = Math.max(0, progress - (i * 0.2));
            const rippleRadius = rippleProgress * spawnAnimation.maxRadius;
            const rippleAlpha = alpha * (1 - rippleProgress) * 0.6;

            if (rippleAlpha > 0) {
                this.ctx.globalAlpha = rippleAlpha;
                this.ctx.strokeStyle = '#FF6B6B';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }

    // Render end reached animation with negative effect
    renderEndReachedAnimation(centerX, centerY, endReachedAnimation) {
        this.ctx.save();

        const progress = endReachedAnimation.time / endReachedAnimation.duration;
        const currentRadius = progress * endReachedAnimation.maxRadius;
        const alpha = endReachedAnimation.alpha * (1 - progress);

        // Create expanding red circle with negative effect
        for (let i = 0; i < 4; i++) {
            const rippleProgress = Math.max(0, progress - (i * 0.15));
            const rippleRadius = rippleProgress * endReachedAnimation.maxRadius;
            const rippleAlpha = alpha * (1 - rippleProgress) * 0.8;

            if (rippleAlpha > 0) {
                this.ctx.globalAlpha = rippleAlpha;
                this.ctx.strokeStyle = '#FF0000';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
                this.ctx.stroke();

                // Add inner dark circle for negative effect
                this.ctx.globalAlpha = rippleAlpha * 0.5;
                this.ctx.fillStyle = '#8B0000';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, rippleRadius * 0.3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.restore();
    }

    // Render day/night tile lighting overlay (only affects tiles)
    renderDayNightTileLighting() {
        const currentColors = this.getCurrentColors();
        const ambientLight = currentColors.ambientLight;

        // Only apply lighting effects if not at full brightness (day)
        if (ambientLight < 1.0) {
            this.ctx.save();

            // Create ambient lighting overlay only over tilemap area
            // Use grid offset coordinates to match the actual grid position
            const gridOffsetX = 400; // HUD width only (matching getGridOffsetX changes)
            const gridOffsetY = 0;   // No vertical offset (matching getGridOffsetY changes)
            const tilemapHeight = 12 * 96; // 12 rows * 96px tile size
            const tilemapWidth = 22 * 96;  // 22 columns * 96px tile size

            const overlayAlpha = 1.0 - ambientLight;
            this.ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
            this.ctx.fillRect(gridOffsetX, gridOffsetY, tilemapWidth, tilemapHeight);

            // Add subtle blue tint for night atmosphere
            if (this.dayNightSystem.currentPhase === 'night') {
                this.ctx.fillStyle = `rgba(0, 50, 100, ${overlayAlpha * 0.3})`;
                this.ctx.fillRect(gridOffsetX, gridOffsetY, tilemapWidth, tilemapHeight);
            }

            this.ctx.restore();
        }
    }

    // Render phase change transition effect (full screen)
    renderPhaseChangeEffect() {
        if (!this.dayNightSystem.phaseChangeEffect.active) return;

        const elapsed = Date.now() - this.dayNightSystem.phaseChangeEffect.startTime;
        const progress = Math.min(1.0, elapsed / this.dayNightSystem.phaseChangeEffect.duration);
        const effect = this.dayNightSystem.phaseChangeEffect;

        this.ctx.save();

        if (effect.type === 'flash') {
            // Flash effect for night transition
            const flashAlpha = Math.sin(progress * Math.PI) * 0.3;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else if (effect.type === 'fade') {
            // Fade effect for day transition
            const fadeAlpha = (1.0 - progress) * 0.5;
            this.ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.ctx.restore();
    }

    // Render start and end tiles on layer 3 (after day/night lighting)
    renderStartEndTiles(gridSystem) {
        const tileSize = gridSystem.tileSize;

        // Render start and end tiles with enhanced visibility
        for (let y = 0; y < gridSystem.rows; y++) {
            for (let x = 0; x < gridSystem.cols; x++) {
                const tile = gridSystem.getTile(x, y);
                if (tile && (tile.type === 'start' || tile.type === 'end')) {
                    this.renderStartEndTile(x, y, tile, tileSize);
                }
            }
        }
    }

    // Render path tiles on a separate layer for better night visibility
    renderPathTiles(gridSystem) {
        const tileSize = gridSystem.tileSize;
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin

        // Render path tiles with overlay for night visibility
        for (let y = 0; y < gridSystem.rows; y++) {
            for (let x = 0; x < gridSystem.cols; x++) {
                const tile = gridSystem.getTile(x, y);
                if (tile && tile.type === 'path') {
                    this.renderPathTileOverlay(x, y, tileSize, gridOffsetX, gridOffsetY);
                }
            }
        }
    }

    // Render path tile overlay for better visibility
    renderPathTileOverlay(gridX, gridY, tileSize, gridOffsetX = 0, gridOffsetY = 0) {
        const screenX = gridX * tileSize + gridOffsetX;
        const screenY = gridY * tileSize + gridOffsetY;

        this.ctx.save();

        // Add subtle glow overlay for night visibility
        if (this.dayNightSystem.currentPhase === 'night') {
            this.ctx.shadowColor = '#FFD700';  // Golden glow
            this.ctx.shadowBlur = 12;
            this.ctx.strokeStyle = '#A0826D';  // Lighter path outline
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.6;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX + 2, screenY + 2, tileSize - 4, tileSize - 4, 3);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // Render individual start or end tile with enhanced visibility
    renderStartEndTile(gridX, gridY, tile, tileSize) {
        const gridOffsetX = this.getGridOffsetX(); // HUD width + horizontal margin
        const gridOffsetY = this.getGridOffsetY(); // Vertical margin
        const screenX = gridX * tileSize + gridOffsetX;
        const screenY = gridY * tileSize + gridOffsetY;
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;
        const time = Date.now() / 1000;

        this.ctx.save();

        if (tile.type === 'start') {
            // Enhanced start tile with bright colors and effects
            const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, tileSize / 2);
            gradient.addColorStop(0, '#00FF88');
            gradient.addColorStop(0.7, '#00CC66');
            gradient.addColorStop(1, '#00AA44');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.fill();

            // Add animated sparkle effect
            this.renderTileSparkles(centerX, centerY, time, gridX + gridY);

        } else if (tile.type === 'end') {
            // Enhanced end tile with warning colors and effects
            const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, tileSize / 2);
            gradient.addColorStop(0, '#FF8888');
            gradient.addColorStop(0.7, '#DD6666');
            gradient.addColorStop(1, '#BB4444');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, screenY, tileSize, tileSize, 4);
            this.ctx.fill();

            // Add animated warning effect
            this.renderTileWarningEffect(centerX, centerY, time, gridX + gridY);
        }

        // Draw enhanced borders
        this.renderTileBorder(screenX, screenY, tileSize, tile.type);

        this.ctx.restore();
    }
}
