/**
 * Enemy Types Configuration
 * Defines different enemy types with their properties
 */

const ENEMY_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Enemy',
        speed: 1.1,        // tiles per second (reduced for better balance)
        health: 100,
        color: '#FF6B6B',  // Red
        size: 0.8,         // Relative to tile size (increased from 0.6 for better face visibility)
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
        speed: 2.0,        // tiles per second (reduced for better balance)
        health: 50,
        color: '#4ECDC4',  // Teal
        size: 0.7,         // Relative to tile size (increased from 0.5 for better face visibility)
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
        size: 1.0,         // Relative to tile size (increased from 0.8 for better face visibility)
        reward: 8,         // Coins when defeated (reduced for challenge)
        // Visual enhancements
        shape: 'square',   // Shape for rendering
        borderColor: '#2E5B7D', // Border color
        borderWidth: 3,    // Border thickness
        glowColor: '#7DB8D1',   // Glow effect color
        animationSpeed: 0.7,    // Animation speed multiplier
        description: 'A strong enemy with high health but moves slowly'
    },
    // Boss Enemy Types - Unique enemies that appear every 5th wave
    BOSS_SHIELD: {
        id: 'boss_shield',
        name: 'Shield Boss',
        speed: 0.8,
        health: 500,
        color: '#9B59B6',  // Purple
        size: 1.3,         // Larger than regular enemies
        reward: 25,        // Higher reward
        // Visual enhancements
        shape: 'hexagon',  // Unique shape for bosses
        borderColor: '#8E44AD', // Purple border
        borderWidth: 4,    // Thicker border
        glowColor: '#BB8FCE',   // Light purple glow
        animationSpeed: 0.8,    // Animation speed multiplier
        description: 'A boss with temporary damage immunity',
        // Boss-specific properties
        isBoss: true,
        bossType: 'shield',
        specialAbilities: {
            shield: {
                duration: 3000,  // 3 seconds of immunity
                cooldown: 8000,  // 8 second cooldown
                active: false,
                lastUsed: 0
            }
        }
    },
    BOSS_SPEED: {
        id: 'boss_speed',
        name: 'Speed Boss',
        speed: 1.8,        // Very fast
        health: 300,
        color: '#E74C3C',  // Red
        size: 1.2,
        reward: 20,
        // Visual enhancements
        shape: 'diamond',  // Sharp, fast-looking shape
        borderColor: '#C0392B', // Dark red border
        borderWidth: 4,
        glowColor: '#F1948A',   // Light red glow
        animationSpeed: 2.0,    // Fast animation
        description: 'A boss that can boost its speed',
        // Boss-specific properties
        isBoss: true,
        bossType: 'speed',
        specialAbilities: {
            speedBoost: {
                multiplier: 2.0,  // Double speed
                duration: 4000,   // 4 seconds
                cooldown: 10000,  // 10 second cooldown
                active: false,
                lastUsed: 0
            }
        }
    },
    BOSS_REGENERATE: {
        id: 'boss_regenerate',
        name: 'Regenerate Boss',
        speed: 0.6,
        health: 600,       // High health
        color: '#27AE60',  // Green
        size: 1.4,         // Largest boss
        reward: 30,
        // Visual enhancements
        shape: 'octagon',  // Complex shape
        borderColor: '#1E8449', // Dark green border
        borderWidth: 4,
        glowColor: '#82E0AA',   // Light green glow
        animationSpeed: 0.6,    // Slow, steady animation
        description: 'A boss that regenerates health over time',
        // Boss-specific properties
        isBoss: true,
        bossType: 'regenerate',
        specialAbilities: {
            regeneration: {
                rate: 2,         // 2 health per second
                interval: 1000,  // Every 1 second
                lastTick: 0
            }
        }
    },
    BOSS_SPLIT: {
        id: 'boss_split',
        name: 'Split Boss',
        speed: 0.9,
        health: 400,
        color: '#F39C12',  // Orange
        size: 1.3,
        reward: 15,        // Lower initial reward, but creates more enemies
        // Visual enhancements
        shape: 'star',     // Unique star shape
        borderColor: '#D68910', // Dark orange border
        borderWidth: 4,
        glowColor: '#F7DC6F',   // Light yellow glow
        animationSpeed: 1.2,    // Moderate animation
        description: 'A boss that splits into smaller enemies when defeated',
        // Boss-specific properties
        isBoss: true,
        bossType: 'split',
        specialAbilities: {
            split: {
                splitCount: 3,   // Creates 3 smaller enemies
                splitType: 'basic', // Type of enemies created
                splitHealth: 50,  // Health of split enemies
                splitReward: 5    // Reward per split enemy
            }
        }
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
        // Wave 1: Basic enemies only (increased for better early game balance)
        {
            enemies: [
                { type: 'basic', count: 8, formation: 'single' }
            ]
        },
        // Wave 2: Mix of basic and fast (more basic enemies)
        {
            enemies: [
                { type: 'basic', count: 6, formation: 'single' },
                { type: 'fast', count: 2, formation: 'single' }
            ]
        },
        // Wave 3: All types with formations (more basic enemies)
        {
            enemies: [
                { type: 'basic', count: 6, formation: 'line' },
                { type: 'fast', count: 3, formation: 'single' },
                { type: 'strong', count: 1, formation: 'single' }
            ]
        },
        // Wave 4: More challenging with formations
        {
            enemies: [
                { type: 'basic', count: 6, formation: 'wedge' },
                { type: 'fast', count: 4, formation: 'line' },
                { type: 'strong', count: 2, formation: 'single' }
            ]
        },
        // Wave 5: First Boss wave - Shield Boss (boss only)
        {
            enemies: [
                { type: 'boss_shield', count: 1, formation: 'single' }
            ],
            isBossWave: true,
            bossType: 'shield'
        },
        // Wave 6: Escalating difficulty with mixed formations
        {
            enemies: [
                { type: 'basic', count: 10, formation: 'wedge' },
                { type: 'fast', count: 8, formation: 'line' },
                { type: 'strong', count: 4, formation: 'single' }
            ]
        },
        // Wave 7: Fast enemy swarm tactics
        {
            enemies: [
                { type: 'basic', count: 6, formation: 'single' },
                { type: 'fast', count: 12, formation: 'swarm' },
                { type: 'strong', count: 2, formation: 'single' }
            ]
        },
        // Wave 8: Balanced challenge with advanced formations
        {
            enemies: [
                { type: 'basic', count: 12, formation: 'phalanx' },
                { type: 'fast', count: 8, formation: 'swarm' },
                { type: 'strong', count: 6, formation: 'line' }
            ]
        },
        // Wave 9: Strong enemy focus with defensive formations
        {
            enemies: [
                { type: 'basic', count: 8, formation: 'single' },
                { type: 'fast', count: 6, formation: 'line' },
                { type: 'strong', count: 8, formation: 'phalanx' }
            ]
        },
        // Wave 10: Second Boss wave - Speed Boss (boss only)
        {
            enemies: [
                { type: 'boss_speed', count: 1, formation: 'single' }
            ],
            isBossWave: true,
            bossType: 'speed'
        }
    ]
};

// Export to global scope for script loading
window.ENEMY_TYPES = ENEMY_TYPES;
window.WAVE_CONFIG = WAVE_CONFIG;
