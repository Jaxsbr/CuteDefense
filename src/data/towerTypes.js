/**
 * CuteDefense - Tower Type Definitions
 * Defines different tower types with their properties
 */

// Tower type configurations
const TOWER_TYPES = {
    BASIC: {
        name: 'Basic Tower',
        cost: 10,
        damage: 25,  // Increased from 1 to 25 for easier testing
        range: 5,
        fireRate: 1500, // milliseconds between shots (slower for balance with guaranteed hits)
        projectileSpeed: 800, // pixels per second (very fast for guaranteed hits)
        color: '#FF6B6B', // Red
        size: 48,  // Increased from 24 to 48 for better visibility
        description: 'Simple tower that shoots at nearby enemies'
    },
    STRONG: {
        name: 'Strong Tower',
        cost: 25,
        damage: 60,  // Increased from 3 to 60 for easier testing
        range: 2,
        fireRate: 2500, // milliseconds between shots (even slower for balance with guaranteed hits)
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
            cost: 15,
            damage: 2,
            range: 4,
            fireRate: 800,
            color: '#FF8E8E'
        },
        level3: {
            cost: 25,
            damage: 3,
            range: 5,
            fireRate: 600,
            color: '#FFB3B3'
        }
    },
    STRONG: {
        level2: {
            cost: 30,
            damage: 5,
            range: 3,
            fireRate: 1500,
            color: '#6EDDD6'
        },
        level3: {
            cost: 50,
            damage: 8,
            range: 4,
            fireRate: 1200,
            color: '#8EE5E0'
        }
    }
};

// Make tower types available globally
window.TOWER_TYPES = TOWER_TYPES;
window.TOWER_UPGRADES = TOWER_UPGRADES;
