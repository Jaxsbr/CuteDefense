/**
 * Input System - Handles mouse and touch input
 */
class InputSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.clicked = false;
        this.clickPosition = { x: 0, y: 0 };
        this.lastClickTime = 0;
        
        this.setupEventListeners();
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
        });
    }
    
    handleClick(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        this.clickPosition = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
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
}
