/**
 * CuteDefense - Color Palette System
 * Defines consistent colors for game elements
 */

// Basic Tower Color Palette (Blue-based)
const BASIC_TOWER_COLORS = {
    // Base colors for Basic tower
    base: '#4A90E2',        // Primary blue for tower base
    baseDark: '#2E5B8A',    // Darker blue for shadows/depth
    baseLight: '#7BB3F0',   // Lighter blue for highlights

    // Detail colors for Basic tower
    accent: '#87CEEB',      // Sky blue for decorative elements
    accentDark: '#5F9EA0',  // Darker accent for contrast
    accentLight: '#B0E0E6'  // Light accent for highlights
};

// Generic Accent Colors (usable by any tower type)
const GENERIC_ACCENT_COLORS = {
    // Metallic/Structural elements
    metal: '#708090',       // Steel gray for spikes/armor
    metalDark: '#2F4F4F',   // Dark steel for shadows
    metalLight: '#A9A9A9',  // Light steel for highlights

    // Battle/Combat elements
    battle: '#8B4513',      // Brown for battle damage/wear
    battleDark: '#654321',  // Dark brown for deep damage
    battleLight: '#CD853F', // Light brown for wear highlights

    // Energy/Power elements
    energy: '#FFD700',      // Gold for power indicators
    energyDark: '#B8860B',  // Dark gold for shadows
    energyLight: '#FFEC8C',  // Light gold for highlights

    // Neutral structural elements
    neutral: '#696969',     // Dim gray for generic details
    neutralDark: '#2F2F2F', // Dark gray for shadows
    neutralLight: '#D3D3D3' // Light gray for highlights
};

// Color palette configuration
const COLOR_PALETTE = {
    basicTower: BASIC_TOWER_COLORS,
    generic: GENERIC_ACCENT_COLORS
};

// Make color palette available globally
window.COLOR_PALETTE = COLOR_PALETTE;
window.BASIC_TOWER_COLORS = BASIC_TOWER_COLORS;
window.GENERIC_ACCENT_COLORS = GENERIC_ACCENT_COLORS;
