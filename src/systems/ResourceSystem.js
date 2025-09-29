/**
 * CuteDefense - Resource System
 * Handles coin collection, spending, and resource management
 */

class ResourceSystem {
    constructor() {
        this.coins = 20; // Starting coins (reduced for challenge)
        this.coinAnimations = [];
        this.lastCoinSpawn = 0;
        this.collectionEffects = []; // Particle effects for coin collection
        this.coinTotalPulse = { active: false, time: 0, duration: 1000 }; // Pulse animation for coin total
        this.audioManager = null; // Audio manager reference
        this.logger = null; // Logger reference
    }

    // Set audio manager reference
    setAudioManager(audioManager) {
        this.audioManager = audioManager;
    }

    // Set logger reference
    setLogger(logger) {
        this.logger = logger;
    }

    // Add coins to player's total
    addCoins(amount) {
        this.coins += amount;

        // Trigger pulse animation on coin total display
        this.coinTotalPulse.active = true;
        this.coinTotalPulse.time = 0;

        if (this.logger) this.logger.info(`Added ${amount} coins. Total: ${this.coins}`);
    }

    // Create collection effect particles
    createCollectionEffect(x, y, coinValue) {
        // Create enhanced sparkle particles
        const particleCount = 12 + Math.min(coinValue * 2, 8); // More particles for higher value coins

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
            const speed = 80 + Math.random() * 60;
            const particle = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20, // Slight upward bias
                life: 1200 + Math.random() * 400, // 1.2-1.6 seconds
                maxLife: 1200 + Math.random() * 400,
                size: 3 + Math.random() * 5,
                color: coinValue > 1 ? '#FFA500' : '#FFD700', // Different colors for different values
                alpha: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            };
            this.collectionEffects.push(particle);
        }

        // Create floating text effect for coin value
        if (coinValue > 1) {
            const floatingText = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 20,
                vy: -60, // Float upward
                life: 1500,
                maxLife: 1500,
                text: `+${coinValue}`,
                alpha: 1.0,
                size: 16
            };
            this.collectionEffects.push(floatingText);
        }
    }

    // Create expiration effect particles (negative feedback)
    createExpirationEffect(x, y, coinValue) {
        // Create dramatic negative effect particles
        const particleCount = 16 + Math.min(coinValue * 3, 12); // More particles for higher value coins

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
            const speed = 100 + Math.random() * 80;
            const particle = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 30, // Strong upward bias for dramatic effect
                life: 1500 + Math.random() * 500, // 1.5-2 seconds
                maxLife: 1500 + Math.random() * 500,
                size: 4 + Math.random() * 6,
                color: coinValue > 1 ? '#FF4444' : '#FF6666', // Red colors for negative feedback
                alpha: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            };
            this.collectionEffects.push(particle);
        }

        // Create dramatic floating text effect for lost coin value
        const floatingText = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 30,
            vy: -80, // Float upward more dramatically
            life: 2000,
            maxLife: 2000,
            text: `-${coinValue}`,
            alpha: 1.0,
            size: 20 // Larger text for more impact
        };
        this.collectionEffects.push(floatingText);
    }

    // Spend coins
    spend(amount) {
        if (this.canAfford(amount)) {
            this.coins -= amount;
            if (this.logger) this.logger.info(`Spent ${amount} coins. Remaining: ${this.coins}`);
            return true;
        }
        return false;
    }

    // Check if player can afford something
    canAfford(amount) {
        return this.coins >= amount;
    }

    // Get current coin count
    getCoins() {
        return this.coins;
    }

    // Spawn coin at position (for collection)
    spawnCoin(x, y, value = 1) {
        const coin = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            value: value,
            collected: false,
            animationTime: 0,
            bounceHeight: 0,
            sparkleTime: 0,
            lifetime: 10000, // 10 seconds before expiration
            expired: false,
            warningTime: 3000 // 3 seconds warning before expiration
        };

        this.coinAnimations.push(coin);
        if (this.logger) this.logger.info(`Coin spawned at (${x}, ${y}) with value ${value}, expires in ${coin.lifetime / 1000}s`);
    }

    // Try to collect coin at position
    tryCollectCoin(x, y) {
        const coin = this.coinAnimations.find(c =>
            !c.collected &&
            Math.abs(c.x - x) < 40 &&  // Increased from 20 to 40 for larger scale
            Math.abs(c.y - y) < 40
        );

        if (coin) {
            coin.collected = true;
            this.addCoins(coin.value);

            // Create satisfying collection effects
            this.createCollectionEffect(coin.x, coin.y, coin.value);

            if (this.logger) this.logger.info(`Collected coin worth ${coin.value} coins`);
            return true;
        }

        return false;
    }

    // Update resource system
    update(deltaTime) {
        // Update coin animations
        this.coinAnimations = this.coinAnimations.filter(coin => {
            coin.animationTime += deltaTime;
            coin.sparkleTime += deltaTime;
            coin.lifetime -= deltaTime;

            // Check for expiration
            if (!coin.collected && !coin.expired && coin.lifetime <= 0) {
                coin.expired = true;
                coin.expirationTime = 0;
                this.createExpirationEffect(coin.x, coin.y, coin.value);
                // Play coin expiration sound
                if (this.audioManager) {
                    this.audioManager.playSound('coin_expire');
                }
                if (this.logger) this.logger.info(`Coin expired at (${coin.x}, ${coin.y}) with value ${coin.value}`);
            }

            // Enhanced bounce animation with more personality
            if (!coin.collected && !coin.expired) {
                // More bouncy animation with slight variation per coin
                const bounceSpeed = 0.004 + (coin.id % 100) * 0.00001; // Slight variation per coin
                const bounceHeight = 8 + Math.sin(coin.animationTime * 0.001) * 2; // Variable bounce height
                coin.bounceHeight = Math.sin(coin.animationTime * bounceSpeed) * bounceHeight;

                // Add subtle horizontal sway
                coin.swayOffset = Math.sin(coin.animationTime * 0.003) * 1;

                // Warning animation as coin approaches expiration
                if (coin.lifetime <= coin.warningTime) {
                    coin.warningProgress = (coin.warningTime - coin.lifetime) / coin.warningTime;
                } else {
                    coin.warningProgress = 0;
                }
            } else if (coin.collected) {
                // Collection animation - coin shrinks and fades
                coin.collectionProgress = (coin.animationTime - 500) / 500; // Start shrinking after 500ms
                coin.bounceHeight = Math.sin(coin.animationTime * 0.01) * 3; // Faster, smaller bounce
                coin.swayOffset = 0;
            } else if (coin.expired) {
                // Expiration animation - coin shrinks and fades with negative effect
                coin.expirationTime += deltaTime;
                coin.expirationProgress = Math.min(coin.expirationTime / 1000, 1.0); // 1 second expiration animation
                coin.bounceHeight = Math.sin(coin.expirationTime * 0.02) * 2; // Fast, small bounce
                coin.swayOffset = 0;
            }

            // Remove coins after their animation completes
            if (coin.collected && coin.animationTime > 1000) {
                return false;
            }
            if (coin.expired && coin.expirationProgress >= 1.0) {
                return false;
            }

            return true;
        });

        // Update collection effect particles
        this.collectionEffects = this.collectionEffects.filter(particle => {
            particle.x += particle.vx * (deltaTime / 1000);
            particle.y += particle.vy * (deltaTime / 1000);
            particle.life -= deltaTime;

            // Apply gravity to particles (only for non-text particles)
            if (!particle.text) {
                particle.vy += 120 * (deltaTime / 1000);

                // Update rotation for sparkle particles
                if (particle.rotation !== undefined) {
                    particle.rotation += particle.rotationSpeed;
                }

                // Fade out over time
                particle.alpha = particle.life / particle.maxLife;
            } else {
                // Floating text particles fade out more slowly
                particle.alpha = particle.life / particle.maxLife;
            }

            return particle.life > 0;
        });

        // Update coin total pulse animation
        if (this.coinTotalPulse.active) {
            this.coinTotalPulse.time += deltaTime;
            if (this.coinTotalPulse.time >= this.coinTotalPulse.duration) {
                this.coinTotalPulse.active = false;
            }
        }
    }

    // Get coins for rendering
    getCoinsForRendering() {
        return this.coinAnimations.filter(coin => !coin.collected);
    }

    // Get collection effects for rendering
    getCollectionEffectsForRendering() {
        return this.collectionEffects;
    }

    // Get coin total pulse animation state
    getCoinTotalPulse() {
        return this.coinTotalPulse;
    }

    // Get resource info for UI
    getResourceInfo() {
        return {
            coins: this.coins,
            coinCount: this.coinAnimations.length
        };
    }

    // Reset resources (for new game)
    reset() {
        this.coins = 50;
        this.coinAnimations = [];
    }
}
