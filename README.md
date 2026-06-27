# CuteDefense

A simple, kid-friendly tower defense game with cute graphics and simple controls.

## 🎮 Play Online

**[Play CuteDefense on GitHub Pages →](https://jaxsbr.github.io/CuteDefense)**

## Versions (V1 & V2)

Two implementations are served from the same page, selected by the **`v`** query parameter:

| URL | Loads |
|-----|-------|
| `index.html` (no parameter) | **V1** (default) |
| `index.html?v=1` | **V1** (explicit) |
| `index.html?v=2` | **V2** (the rebuild — faster, reliability-hardened) |

- **V1** is the original game, unchanged except for an opt-in benchmarking hook.
- **V2** is a ground-up rebuild: a pure headless simulation core (fixed timestep,
  seeded RNG, fresh state per game) with a sprite-cached minimal renderer. It is
  ~77% faster at the benchmark fixture and is provably free of V1's boss-wave
  instant-loss and open-tile pathfinding bugs. See `v2/docs/` for the full plan,
  parity analysis, and findings.
- Append **`&bench=1`** to either version to load its benchmark harness
  (`window.__bench`), used by the dev tooling below.

## Development harness (dev-only, never shipped)

V2 ships as plain ES modules with **no build step**. The test + benchmark harness
uses only Node built-ins (`node:test`, `node:http`, the global `WebSocket`) plus
the system Chrome over the DevTools Protocol — **no npm dependencies**.

```bash
npm test          # headless simulation tests (game logic + regression gates)
npm run bench     # V1 vs V2 frame-time benchmark under a 4x Chrome CPU throttle
npm run serve     # host the site locally (http://127.0.0.1:3456)
```

The benchmark gate fails the build if V2's p95 frame time is not lower than V1's.

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
