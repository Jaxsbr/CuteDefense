/**
 * Responsive Scaling System - Handles dynamic canvas sizing for mobile devices
 */
class ResponsiveScalingSystem {
    constructor() {
        this.baseConfig = {
            width: 2514,
            height: 1154,
            aspectRatio: 2514 / 1154, // ~2.19
            gridCols: 22,
            gridRows: 12,
            tileSize: 96,
            hudWidth: 400,
            hudHeight: 1154,
            gridOffsetX: 120,
            gridOffsetY: 200
        };

        this.currentConfig = null;
        this.scaleFactor = 1.0;
        this.devicePixelRatio = 1.0;
        this.isMobile = false;
        this.logger = null;

        this.detectDevice();
        this.calculateScaling();
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
    }

    // Detect device characteristics
    detectDevice() {
        // Detect device pixel ratio
        this.devicePixelRatio = window.devicePixelRatio || 1.0;

        // Detect if mobile device
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Detect viewport size
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;

        if (this.logger) {
            this.logger.info(`Device Detection:`);
            this.logger.info(`- Device Pixel Ratio: ${this.devicePixelRatio}`);
            this.logger.info(`- Is Mobile: ${this.isMobile}`);
            this.logger.info(`- Viewport: ${this.viewportWidth}x${this.viewportHeight}`);
        }
    }

    // Calculate optimal scaling for current device
    calculateScaling() {
        if (!this.isMobile) {
            // Desktop: use original size
            this.scaleFactor = 1.0;
            this.currentConfig = { ...this.baseConfig };

            if (this.logger) {
                this.logger.info('Desktop detected - using original canvas size');
            }
            return;
        }

        // Mobile: calculate responsive scaling
        let targetWidth = this.viewportWidth;
        let targetHeight = this.viewportHeight;

        // Account for device pixel ratio to prevent 2x scaling
        if (this.devicePixelRatio > 1.0) {
            targetWidth = targetWidth * this.devicePixelRatio;
            targetHeight = targetHeight * this.devicePixelRatio;
        }

        // Calculate scale factor to fit viewport while maintaining aspect ratio
        const widthScale = targetWidth / this.baseConfig.width;
        const heightScale = targetHeight / this.baseConfig.height;

        // Use the smaller scale to ensure full fit
        this.scaleFactor = Math.min(widthScale, heightScale);

        // Apply scaling to all dimensions
        this.currentConfig = {
            width: Math.floor(this.baseConfig.width * this.scaleFactor),
            height: Math.floor(this.baseConfig.height * this.scaleFactor),
            aspectRatio: this.baseConfig.aspectRatio,
            gridCols: this.baseConfig.gridCols,
            gridRows: this.baseConfig.gridRows,
            tileSize: Math.floor(this.baseConfig.tileSize * this.scaleFactor),
            hudWidth: Math.floor(this.baseConfig.hudWidth * this.scaleFactor),
            hudHeight: Math.floor(this.baseConfig.hudHeight * this.scaleFactor),
            gridOffsetX: Math.floor(this.baseConfig.gridOffsetX * this.scaleFactor),
            gridOffsetY: Math.floor(this.baseConfig.gridOffsetY * this.scaleFactor)
        };

        if (this.logger) {
            this.logger.info(`Mobile Scaling Calculated:`);
            this.logger.info(`- Scale Factor: ${this.scaleFactor.toFixed(3)}`);
            this.logger.info(`- Canvas Size: ${this.currentConfig.width}x${this.currentConfig.height}`);
            this.logger.info(`- Tile Size: ${this.currentConfig.tileSize}px`);
            this.logger.info(`- HUD Size: ${this.currentConfig.hudWidth}x${this.currentConfig.hudHeight}`);
        }
    }

    // Get current configuration
    getConfig() {
        return this.currentConfig || this.baseConfig;
    }

    // Get scale factor
    getScaleFactor() {
        return this.scaleFactor;
    }

    // Check if mobile device
    getIsMobile() {
        return this.isMobile;
    }

    // Get device pixel ratio
    getDevicePixelRatio() {
        return this.devicePixelRatio;
    }

    // Convert screen coordinates to canvas coordinates (accounting for display scaling)
    screenToCanvas(screenX, screenY, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (screenX - rect.left) * scaleX,
            y: (screenY - rect.top) * scaleY
        };
    }

    // Convert canvas coordinates to screen coordinates
    canvasToScreen(canvasX, canvasY, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;

        return {
            x: canvasX * scaleX + rect.left,
            y: canvasY * scaleY + rect.top
        };
    }

    // Convert screen coordinates to scaled coordinates (legacy method for compatibility)
    screenToScaled(screenX, screenY) {
        if (this.scaleFactor === 1.0) {
            return { x: screenX, y: screenY };
        }

        return {
            x: screenX / this.scaleFactor,
            y: screenY / this.scaleFactor
        };
    }

    // Convert scaled coordinates to screen coordinates (legacy method for compatibility)
    scaledToScreen(scaledX, scaledY) {
        if (this.scaleFactor === 1.0) {
            return { x: scaledX, y: scaledY };
        }

        return {
            x: scaledX * this.scaleFactor,
            y: scaledY * this.scaleFactor
        };
    }

    // Handle window resize
    handleResize() {
        if (this.logger) {
            this.logger.info('Window resized - recalculating scaling');
        }

        this.detectDevice();
        this.calculateScaling();
    }

    // Get scaling info for debugging
    getScalingInfo() {
        return {
            devicePixelRatio: this.devicePixelRatio,
            isMobile: this.isMobile,
            scaleFactor: this.scaleFactor,
            viewportSize: { width: this.viewportWidth, height: this.viewportHeight },
            canvasSize: { width: this.currentConfig.width, height: this.currentConfig.height },
            tileSize: this.currentConfig.tileSize
        };
    }
}
