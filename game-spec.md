# CuteDefense - Game Design Specification

## Core Vision
A simple, kid-friendly tower defense game with extra simple controls, designed for 5-10 minute play sessions. Players place towers, collect coins, and defend against clearly announced enemy waves.

## Key Pillars
- **Ultra-Simple**: Extra simple controls for young kids
- **Quick Sessions**: 5-10 minute play cycles
- **Tactile & Animated**: Every action is snappy and fun
- **Less is More**: Focus on core mechanics only

## Core Gameplay Loop
1. **PLACE TOWERS**: Click to place towers (off the enemy path only)
2. **COLLECT COINS**: Tap coins to collect them manually
3. **WAVE ANNOUNCEMENT**: Clear visual/audio announcement before each wave
4. **DEFEND**: Watch towers automatically defend against enemies
5. **UPGRADE**: Use collected coins to upgrade towers

## Visual Style
- True top-down perspective (no depth sorting needed)
- 32x32 pixel art sprites (easier to see for kids)
- Cartoony, bright color palette
- Cute, rounded character designs with big eyes
- Highly animated effects (sparkles, bubbles, bouncy movements)
- Day and night have distinctly different visual feels

## Core Systems

### Resource System
- Single resource type: **Coins**
- Manual collection by tapping coins (good time-filler between waves)
- Coins appear with bouncy animations and sparkle effects
- Collecting coins has satisfying tactile feedback

### Tower System  
- Simple click-to-place on 32x32 grid
- **Tower Types**: Basic tower (shoots projectiles), Strong tower (slower but powerful)
- Towers can only be placed OFF the enemy path
- Each tower costs coins to build and upgrade
- Placing towers has satisfying animation and sound effects
- Upgrading towers shows clear visual improvements

### Defense System
- Towers automatically target nearest enemy
- Projectiles have bouncy, cartoony animations
- No direct combat - all defense is automated
- Visual effects when towers hit enemies (sparkles, stars)

### Enemy System
- Randomly generated enemy paths (different each game)
- Clear wave announcements with animation effects before each wave
- Simple enemy types: Basic (slow), Fast (quick), Strong (tanky)
- Enemies follow the randomly generated path toward the goal
- Progressive difficulty: more enemies and slightly stronger stats

### Map System
- Simple 32x32 grid-based map
- Randomly generated enemy paths each game
- Clear visual distinction between:
  - **Enemy Path**: Where enemies walk (towers cannot be placed here)
  - **Buildable Areas**: Where towers can be placed
- Simple, clean visual design

### Wave System
- Clear visual and audio announcements before each wave
- Short preparation time between waves (30-60 seconds)
- Wave duration: 30-90 seconds of automated defense
- Different visual feel for preparation vs. combat phases

## Technical Requirements
- **Platform**: GitHub Pages deployment (static HTML5/JS)
- **Controls**: Mouse/touch only - no keyboard needed
- **Session Length**: 5-10 minutes total
- **Development Time**: Short development cycle for personal use

## Success Metrics
- **MVP**: Place towers, collect coins, survive 3-5 waves
- **Complete**: Smooth animations, clear wave announcements, satisfying feedback
- **Polish**: All interactions feel snappy and fun for kids