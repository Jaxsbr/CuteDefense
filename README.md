# CuteDefense

A simple, kid-friendly tower defense game with cute graphics and simple controls.

## 🎮 Play Online

**[Play CuteDefense on GitHub Pages →](https://yourusername.github.io/CuteDefense)**

*Note: Replace 'yourusername' with your actual GitHub username after deployment*

## Quick Launch (Local)

### Option 1: Direct Browser (Simplest)
1. **Open the game**: Simply open `index.html` in your web browser
2. **Enable audio**: Click anywhere on the page to enable audio (required for full experience)
3. **Start playing**: Click to place towers, collect coins, and defend against enemy waves!

### Option 2: Local Web Server (Recommended)
1. **Start web server**: Run `python3 -m http.server 3456` in the project directory
2. **Open browser**: Navigate to `http://localhost:3456`
3. **Enable audio**: Click anywhere on the page to enable audio
4. **Start playing**: Click to place towers, collect coins, and defend against enemy waves!

## Game Controls

- **Mouse/Touch**: Click to place towers, collect coins, and interact with the game
- **ESC Key**: Pause/unpause the game
- **M Key**: Toggle audio on/off
- **D Key**: Toggle debug mode
- **G Key**: Toggle grid visualization
- **P Key**: Toggle path visualization
- **C Key**: Toggle collision visualization

## Gameplay

- Place towers on the grid (not on enemy paths)
- Collect coins by clicking them
- Upgrade towers with collected coins
- Survive enemy waves and protect your base!

## Development

This is a vanilla HTML5/JavaScript game designed for GitHub Pages deployment. No build process required - just open and play!

## Deployment

The game automatically deploys to GitHub Pages when you push to the `main` branch. The deployment workflow is configured in `.github/workflows/deploy.yml`.

### Manual Deployment

You can also trigger a manual deployment from the GitHub Actions tab.

### First-Time Setup

1. Go to your repository settings on GitHub
2. Navigate to "Pages" in the left sidebar
3. Under "Build and deployment", set Source to "GitHub Actions"
4. The game will be available at `https://yourusername.github.io/CuteDefense`
