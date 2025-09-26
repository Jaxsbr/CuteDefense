/**
 * CuteDefense - Tower Type Definitions
 * Defines different tower types with their properties
 */

// Tower type configurations
const TOWER_TYPES = {
    BASIC: {
        id: 'basic',
        name: 'Basic Tower',
        cost: 10,
        damage: 1,
        range: 5,
        fireRate: 1000, // milliseconds between shots
        projectileSpeed: 200, // pixels per second
        color: '#FF6B6B', // Red
        size: 24,
        description: 'Simple tower that shoots at nearby enemies'
    },
    STRONG: {
        id: 'strong',
        name: 'Strong Tower',
        cost: 25,
        damage: 3,
        range: 2,
        fireRate: 2000, // milliseconds between shots
        projectileSpeed: 150, // pixels per second
        color: '#4ECDC4', // Teal
        size: 28,
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
