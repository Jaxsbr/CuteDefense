/**
 * CuteDefense - Resource System
 * Handles coin collection, spending, and resource management
 */

class ResourceSystem {
    constructor() {
        this.coins = 50; // Starting coins
        this.coinAnimations = [];
        this.lastCoinSpawn = 0;
        this.collectionEffects = []; // Particle effects for coin collection
        this.coinTotalPulse = { active: false, time: 0, duration: 1000 }; // Pulse animation for coin total
    }

    // Add coins to player's total
    addCoins(amount) {
        this.coins += amount;

        // Trigger pulse animation on coin total display
        this.coinTotalPulse.active = true;
        this.coinTotalPulse.time = 0;

        console.log(`Added ${amount} coins. Total: ${this.coins}`);
    }

    // Create collection effect particles
    createCollectionEffect(x, y, coinValue) {
        // Create sparkle particles
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 50 + Math.random() * 50;
            const particle = {
                id: Date.now() + Math.random(),
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1000, // 1 second
                maxLife: 1000,
                size: 4 + Math.random() * 4,
                color: '#FFD700'
            };
            this.collectionEffects.push(particle);
        }

        // Note: Floating indicator removed - using coin total pulse instead
    }

    // Spend coins
    spend(amount) {
        if (this.canAfford(amount)) {
            this.coins -= amount;
            console.log(`Spent ${amount} coins. Remaining: ${this.coins}`);
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
            sparkleTime: 0
        };

        this.coinAnimations.push(coin);
        console.log(`Coin spawned at (${x}, ${y}) with value ${value}`);
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

            console.log(`Collected coin worth ${coin.value} coins`);
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

            // Bounce animation
            coin.bounceHeight = Math.sin(coin.animationTime * 0.005) * 5;

            // Remove collected coins after animation
            if (coin.collected && coin.animationTime > 1000) {
                return false;
            }

            return true;
        });

        // Update collection effect particles
        this.collectionEffects = this.collectionEffects.filter(particle => {
            particle.x += particle.vx * (deltaTime / 1000);
            particle.y += particle.vy * (deltaTime / 1000);
            particle.life -= deltaTime;

            // Apply gravity to particles
            particle.vy += 100 * (deltaTime / 1000);

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
