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

    // Calculate optimal scaling for current device.
    //
    // IMPORTANT: the game's internal coordinate system is fixed at the base
    // resolution (96px tiles, 400px HUD, 22x12 tilemap are hardcoded throughout
    // RenderSystem). The renderer is reliable when the canvas BACKING STORE stays
    // at this base resolution; we only ever scale the *displayed* size via CSS.
    //
    // Desktop already worked this way (fixed backing store + CSS shrink-to-fit).
    // The old mobile path recomputed the backing-store resolution and tile size,
    // which broke alignment against those hardcoded offsets AND fought with the
    // CSS `max-height:100% / 100vh` sizing on Android Chrome (where 100vh is the
    // URL-bar-hidden height, so the bottom row was pushed off-screen). We now use
    // the same fixed-resolution path on every device and fit the display in JS.
    calculateScaling() {
        // Same backing-store config for all devices — no per-device geometry.
        this.scaleFactor = 1.0;
        this.currentConfig = { ...this.baseConfig };

        if (this.logger) {
            this.logger.info(`Scaling: fixed base backing store ${this.currentConfig.width}x${this.currentConfig.height} (mobile=${this.isMobile}, dpr=${this.devicePixelRatio})`);
        }
    }

    // The actual visible viewport in CSS pixels. visualViewport reflects the area
    // NOT covered by the URL bar / on-screen keyboard, which is exactly what we
    // need so the whole board (including the bottom placement row) stays on-screen.
    getVisibleViewport() {
        const vv = window.visualViewport;
        if (vv && vv.width > 0 && vv.height > 0) {
            return { width: vv.width, height: vv.height };
        }
        return { width: window.innerWidth, height: window.innerHeight };
    }

    // Compute the CSS display size (largest box with the base aspect ratio that
    // fits inside the visible viewport). The canvas keeps its base backing-store
    // resolution; only style.width/height use these values.
    getDisplaySize() {
        const vp = this.getVisibleViewport();
        const aspect = this.baseConfig.aspectRatio;

        let width = vp.width;
        let height = width / aspect;

        if (height > vp.height) {
            height = vp.height;
            width = height * aspect;
        }

        return {
            width: Math.max(1, Math.floor(width)),
            height: Math.max(1, Math.floor(height)),
            viewportWidth: vp.width,
            viewportHeight: vp.height
        };
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
