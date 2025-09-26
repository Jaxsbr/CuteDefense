/**
 * CuteDefense - Resource System
 * Handles coin collection, spending, and resource management
 */

class ResourceSystem {
    constructor() {
        this.coins = 50; // Starting coins
        this.coinAnimations = [];
        this.lastCoinSpawn = 0;
    }

    // Add coins to player's total
    addCoins(amount) {
        this.coins += amount;
        console.log(`Added ${amount} coins. Total: ${this.coins}`);
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
            Math.abs(c.x - x) < 20 &&
            Math.abs(c.y - y) < 20
        );

        if (coin) {
            coin.collected = true;
            this.addCoins(coin.value);
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
    }

    // Get coins for rendering
    getCoinsForRendering() {
        return this.coinAnimations.filter(coin => !coin.collected);
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
