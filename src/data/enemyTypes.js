/**
 * Enemy Types Configuration
 * Defines different enemy types with their properties
 */

const ENEMY_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Enemy',
        speed: 1.0,        // tiles per second
        health: 100,
        color: '#FF6B6B',  // Red
        size: 0.6,         // Relative to tile size
        reward: 10         // Coins when defeated
    },
    FAST: {
        id: 'fast',
        name: 'Fast Enemy',
        speed: 2.0,        // tiles per second
        health: 50,
        color: '#4ECDC4',  // Teal
        size: 0.5,         // Relative to tile size
        reward: 15         // Coins when defeated
    },
    STRONG: {
        id: 'strong',
        name: 'Strong Enemy',
        speed: 0.5,        // tiles per second
        health: 200,
        color: '#45B7D1',  // Blue
        size: 0.8,         // Relative to tile size
        reward: 25         // Coins when defeated
    }
};

/**
 * Wave Configuration
 * Defines wave patterns and enemy spawns with progressive difficulty
 */
const WAVE_CONFIG = {
    WAVE_DURATION: 30000,  // 30 seconds
    PREPARATION_TIME: 10000, // 10 seconds
    SPAWN_INTERVAL: 2000,  // 2 seconds between spawns

    // Difficulty scaling factors
    DIFFICULTY_SCALING: {
        HEALTH_MULTIPLIER: 1.15,  // 15% health increase per wave
        SPEED_MULTIPLIER: 1.05,   // 5% speed increase per wave
        COUNT_MULTIPLIER: 1.2,    // 20% more enemies per wave
        REWARD_MULTIPLIER: 1.1    // 10% more coins per wave
    },

    // Base wave patterns - enemies to spawn per wave (scaled dynamically)
    BASE_WAVE_PATTERNS: [
        // Wave 1: Basic enemies only
        {
            enemies: [
                { type: 'basic', count: 5 }
            ]
        },
        // Wave 2: Mix of basic and fast
        {
            enemies: [
                { type: 'basic', count: 3 },
                { type: 'fast', count: 2 }
            ]
        },
        // Wave 3: All types
        {
            enemies: [
                { type: 'basic', count: 4 },
                { type: 'fast', count: 3 },
                { type: 'strong', count: 1 }
            ]
        },
        // Wave 4: More challenging
        {
            enemies: [
                { type: 'basic', count: 6 },
                { type: 'fast', count: 4 },
                { type: 'strong', count: 2 }
            ]
        },
        // Wave 5: Boss wave
        {
            enemies: [
                { type: 'basic', count: 8 },
                { type: 'fast', count: 6 },
                { type: 'strong', count: 3 }
            ]
        }
    ]
};

// Export to global scope for script loading
window.ENEMY_TYPES = ENEMY_TYPES;
window.WAVE_CONFIG = WAVE_CONFIG;
