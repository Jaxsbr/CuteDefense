/**
 * Enemy Types Configuration
 * Defines different enemy types with their properties
 */

const ENEMY_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Enemy',
        speed: 1.3,        // tiles per second (increased for challenge)
        health: 100,
        color: '#FF6B6B',  // Red
        size: 0.6,         // Relative to tile size
        reward: 3,         // Coins when defeated (reduced for challenge)
        // Visual enhancements
        shape: 'circle',   // Shape for rendering
        borderColor: '#FF4444', // Border color
        borderWidth: 2,    // Border thickness
        glowColor: '#FFAAAA',   // Glow effect color
        animationSpeed: 1.0,    // Animation speed multiplier
        description: 'A basic enemy with balanced stats'
    },
    FAST: {
        id: 'fast',
        name: 'Fast Enemy',
        speed: 2.4,        // tiles per second (increased for challenge)
        health: 50,
        color: '#4ECDC4',  // Teal
        size: 0.5,         // Relative to tile size
        reward: 5,         // Coins when defeated (reduced for challenge)
        // Visual enhancements
        shape: 'diamond',  // Shape for rendering
        borderColor: '#2E8B8B', // Border color
        borderWidth: 2,    // Border thickness
        glowColor: '#7EDDDD',   // Glow effect color
        animationSpeed: 1.5,    // Animation speed multiplier
        description: 'A fast enemy that moves quickly but has low health'
    },
    STRONG: {
        id: 'strong',
        name: 'Strong Enemy',
        speed: 0.7,        // tiles per second (increased for challenge)
        health: 200,
        color: '#45B7D1',  // Blue
        size: 0.8,         // Relative to tile size
        reward: 8,         // Coins when defeated (reduced for challenge)
        // Visual enhancements
        shape: 'square',   // Shape for rendering
        borderColor: '#2E5B7D', // Border color
        borderWidth: 3,    // Border thickness
        glowColor: '#7DB8D1',   // Glow effect color
        animationSpeed: 0.7,    // Animation speed multiplier
        description: 'A strong enemy with high health but moves slowly'
    }
};

/**
 * Wave Configuration
 * Defines wave patterns and enemy spawns with progressive difficulty
 */
const WAVE_CONFIG = {
    WAVE_DURATION: 20000,  // 20 seconds (reduced for 5-10 minute sessions)
    PREPARATION_TIME: 8000, // 8 seconds (reduced for faster pacing)
    SPAWN_INTERVAL: 2000,  // 2 seconds between spawns

    // Enhanced difficulty scaling factors
    DIFFICULTY_SCALING: {
        HEALTH_MULTIPLIER: 1.12,  // 12% health increase per wave (reduced for better balance)
        SPEED_MULTIPLIER: 1.03,   // 3% speed increase per wave (reduced for better balance)
        COUNT_MULTIPLIER: 1.15,   // 15% more enemies per wave (reduced for better balance)
        REWARD_MULTIPLIER: 1.08,  // 8% more coins per wave (reduced for better balance)
        // New scaling factors
        WAVE_INTERVAL_REDUCTION: 0.95, // 5% faster spawn intervals per wave
        BOSS_WAVE_MULTIPLIER: 1.5,     // 50% boost for boss waves (every 5 waves)
        MAX_SCALING_WAVES: 10          // Stop scaling after 10 waves to prevent impossible difficulty
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
        },
        // Wave 6: Escalating difficulty
        {
            enemies: [
                { type: 'basic', count: 10 },
                { type: 'fast', count: 8 },
                { type: 'strong', count: 4 }
            ]
        },
        // Wave 7: More fast enemies
        {
            enemies: [
                { type: 'basic', count: 6 },
                { type: 'fast', count: 12 },
                { type: 'strong', count: 2 }
            ]
        },
        // Wave 8: Balanced challenge
        {
            enemies: [
                { type: 'basic', count: 12 },
                { type: 'fast', count: 8 },
                { type: 'strong', count: 6 }
            ]
        },
        // Wave 9: Strong enemy focus
        {
            enemies: [
                { type: 'basic', count: 8 },
                { type: 'fast', count: 6 },
                { type: 'strong', count: 8 }
            ]
        },
        // Wave 10: Ultimate challenge
        {
            enemies: [
                { type: 'basic', count: 15 },
                { type: 'fast', count: 12 },
                { type: 'strong', count: 8 }
            ]
        }
    ]
};

// Export to global scope for script loading
window.ENEMY_TYPES = ENEMY_TYPES;
window.WAVE_CONFIG = WAVE_CONFIG;
