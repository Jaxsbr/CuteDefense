/**
 * Input System - Handles mouse and touch input
 */
class InputSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.clicked = false;
        this.clickPosition = { x: 0, y: 0 };
        this.lastClickTime = 0;
        this.gridSystem = null; // Will be set by game
        this.responsiveScaling = null; // Will be set by game

        this.setupEventListeners();
    }

    // Set grid system reference
    setGridSystem(gridSystem) {
        this.gridSystem = gridSystem;
    }
    
    // Set responsive scaling system reference
    setResponsiveScaling(responsiveScaling) {
        this.responsiveScaling = responsiveScaling;
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleClick(e.clientX, e.clientY);
        });

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleClick(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
    }

    handleClick(clientX, clientY) {
        // Use responsive scaling system if available, otherwise fallback to simple conversion
        if (this.responsiveScaling) {
            const canvasCoords = this.responsiveScaling.screenToCanvas(clientX, clientY, this.canvas);
            this.clickPosition = {
                x: canvasCoords.x,
                y: canvasCoords.y
            };
        } else {
            // Fallback to simple conversion
            const rect = this.canvas.getBoundingClientRect();
            this.clickPosition = {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }
        this.clicked = true;
        this.lastClickTime = Date.now();
    }

    update() {
        // Reset click state after one frame
        this.clicked = false;
    }

    wasClicked() {
        return this.clicked;
    }

    getClickPosition() {
        return this.clickPosition;
    }

    // Handle keyboard input for difficulty switching
    handleKeyDown(e) {
        if (e.key === '1' && this.gridSystem) {
            this.gridSystem.setDifficulty('easy');
        } else if (e.key === '2' && this.gridSystem) {
            this.gridSystem.setDifficulty('hard');
        }
    }

    // Handle start menu keyboard input
    handleStartMenuKeyDown(e) {
        if (e.key === '1') {
            return 'easy';
        } else if (e.key === '2') {
            return 'hard';
        }
        return null;
    }

    // Handle start menu clicks
    handleStartMenuClick(canvasX, canvasY) {
        const x = canvasX;
        const y = canvasY;

        // Menu dimensions (matching renderStartMenu)
        const menuWidth = 500;
        const menuHeight = 400;
        const menuX = (this.canvas.width - menuWidth) / 2;
        const menuY = (this.canvas.height - menuHeight) / 2;

        // Easy checkbox
        const easyCheckX = menuX + 80;
        const easyCheckY = menuY + 120;
        const checkboxSize = 20;

        if (x >= easyCheckX && x <= easyCheckX + checkboxSize &&
            y >= easyCheckY && y <= easyCheckY + checkboxSize) {
            return 'easy';
        }

        // Hard checkbox
        const hardCheckX = menuX + 280;
        const hardCheckY = menuY + 120;

        if (x >= hardCheckX && x <= hardCheckX + checkboxSize &&
            y >= hardCheckY && y <= hardCheckY + checkboxSize) {
            return 'hard';
        }

        // Sound toggle switch
        const soundToggleX = menuX + 80;
        const soundToggleY = menuY + 180;
        const toggleWidth = 60;
        const toggleHeight = 30;

        if (x >= soundToggleX && x <= soundToggleX + toggleWidth &&
            y >= soundToggleY && y <= soundToggleY + toggleHeight) {
            return 'sound_toggle';
        }

        // Play button
        const playButtonX = menuX + 150;
        const playButtonY = menuY + 250;
        const playButtonWidth = 200;
        const playButtonHeight = 60;

        if (x >= playButtonX && x <= playButtonX + playButtonWidth &&
            y >= playButtonY && y <= playButtonY + playButtonHeight) {
            return 'play';
        }

        return null;
    }
}
