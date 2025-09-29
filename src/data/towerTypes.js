/**
 * CuteDefense - Tower Type Definitions
 * Defines different tower types with their properties
 */

// Tower type configurations
const TOWER_TYPES = {
    BASIC: {
        name: 'Basic Tower',
        cost: 5,  // Cheap placement
        damage: 8,  // Reduced base damage for balance
        range: 5,
        fireRate: 1800, // 1.8 seconds between shots
        projectileSpeed: 800, // pixels per second (very fast for guaranteed hits)
        color: '#4A90E2', // Blue (from color palette)
        size: 48,  // Increased from 24 to 48 for better visibility
        description: 'Simple tower that shoots at nearby enemies'
    },
    STRONG: {
        name: 'Strong Tower',
        cost: 15,  // More expensive placement
        damage: 20,  // Higher damage but not overwhelming
        range: 2,
        fireRate: 3000, // 3 seconds between shots (slower for balance)
        projectileSpeed: 800, // pixels per second (same as basic for guaranteed hits)
        color: '#4ECDC4', // Teal
        size: 56,  // Increased from 28 to 56 for better visibility
        description: 'Powerful tower with high damage but slower firing'
    }
};

// Tower upgrade configurations
const TOWER_UPGRADES = {
    BASIC: {
        level2: {
            cost: 50,  // Very expensive upgrade (10x base cost)
            damage: 12,  // +4 damage (50% increase)
            range: 6,   // +1 range
            fireRate: 1350,  // Faster firing (25% improvement)
            color: '#7BB3F0'  // Light blue from color palette
        },
        level3: {
            cost: 100,  // Extremely expensive upgrade (20x base cost)
            damage: 18,  // +10 damage (125% increase from base)
            range: 7,   // +2 range
            fireRate: 900,   // Much faster firing (50% faster than base)
            color: '#B0E0E6'  // Light accent blue from color palette
        }
    },
    STRONG: {
        level2: {
            cost: 60,  // Very expensive upgrade (4x base cost)
            damage: 35,  // +15 damage (75% increase)
            range: 3,   // +1 range
            fireRate: 2000,  // Faster firing (33% improvement)
            color: '#6EDDD6'
        },
        level3: {
            cost: 120,  // Extremely expensive upgrade (8x base cost)
            damage: 55,  // +35 damage (175% increase from base)
            range: 4,   // +2 range
            fireRate: 1500,  // Much faster firing (50% improvement)
            color: '#8EE5E0'
        }
    }
};

// Make tower types available globally
window.TOWER_TYPES = TOWER_TYPES;
window.TOWER_UPGRADES = TOWER_UPGRADES;
