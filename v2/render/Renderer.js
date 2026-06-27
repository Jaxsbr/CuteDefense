/**
 * Renderer — reads sim state, draws minimally and fast.
 *  - static tiles baked into one offscreen layer, blitted each frame
 *  - every entity is a baked sprite drawn with drawImage (+ cheap transform/alpha)
 *  - ZERO per-frame shadowBlur or gradient allocation
 *  - one hit-rect registry for all interactive UI (no guessed geometry)
 *
 * Animation reads state.clock (pausable, deterministic), never wall-clock.
 */
import { SpriteCache, roundRect } from './SpriteCache.js';
import { makeCanvas } from './shapes.js';

const FONT = 'Arial, sans-serif';

export class Renderer {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.cfg = config;
    this.L = config.layout;
    this.sprites = new SpriteCache(config);
    this.tileLayer = null;
    this.tileKey = null;
    this.hits = [];           // [{action, x, y, w, h, data}]
  }

  toScreen(gx, gy) {
    return { x: this.L.gridOffsetX + gx * this.L.tile, y: this.L.gridOffsetY + gy * this.L.tile };
  }
  addHit(action, x, y, w, h, data) { this.hits.push({ action, x, y, w, h, data }); }
  hitTest(px, py) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const r = this.hits[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
    }
    return null;
  }

  // ---- top-level ----
  render(state) {
    this.hits = [];
    const ctx = this.ctx;
    if (state.status === 'menu') { this._startMenu(state); return; }

    ctx.fillStyle = this.cfg.visual.grass;
    ctx.fillRect(0, 0, this.L.canvasW, this.L.canvasH);

    this._tiles(state);
    this._enemies(state);
    this._towers(state);
    this._projectiles(state);
    this._effects(state);
    this._coins(state);
    this._placement(state);
    this._hud(state);
    this._announcement(state);
    if (state.status === 'paused') this._pause(state);
    if (state.status === 'won' || state.status === 'lost') this._overlay(state);
  }

  // ---- static tile layer (baked once per map) ----
  _tiles(state) {
    if (this.tileKey !== state.mapIndex) this._bakeTiles(state);
    this.ctx.drawImage(this.tileLayer, this.L.gridOffsetX, this.L.gridOffsetY);
  }
  _bakeTiles(state) {
    const { cols, rows, tile } = this.L;
    const map = state.map;
    const v = this.cfg.visual;
    const canvas = makeCanvas(cols * tile, rows * tile);
    const c = canvas.getContext('2d');
    const pathKeys = new Set(map.path.map(p => `${p.x},${p.y}`));
    const sk = `${map.start.x},${map.start.y}`, ek = `${map.end.x},${map.end.y}`;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * tile, py = y * tile, key = `${x},${y}`;
        // grass checker base
        c.fillStyle = (x + y) % 2 === 0 ? v.grass : v.grassDark;
        c.fillRect(px, py, tile, tile);
        if (pathKeys.has(key)) {
          c.fillStyle = key === sk ? v.start : key === ek ? v.end : v.path;
          c.fillRect(px + 1, py + 1, tile - 2, tile - 2);
          // soft inset for a rounded, friendly path look (baked, not per-frame)
          c.strokeStyle = key === sk || key === ek ? '#ffffff66' : '#00000022';
          c.lineWidth = 2; c.strokeRect(px + 3, py + 3, tile - 6, tile - 6);
          if (key === sk || key === ek) {
            c.fillStyle = '#ffffff'; c.font = `bold ${tile * 0.3}px ${FONT}`;
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(key === sk ? 'IN' : 'OUT', px + tile / 2, py + tile / 2);
          }
        }
      }
    }
    this.tileLayer = canvas;
    this.tileKey = state.mapIndex;
  }

  // ---- entities ----
  _enemies(state) {
    const ctx = this.ctx, tile = this.L.tile;
    for (const e of state.enemies) {
      const sp = this.sprites.enemy(e.typeId);
      const { x, y } = this.toScreen(e.x, e.y);
      let scale = 1, alpha = 1;
      if (e.dying) { const t = Math.min(1, e.deathMs / 500); scale = 1 + t * 0.5; alpha = 1 - t; }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      if (e.dying) ctx.rotate(e.deathMs / 500 * 0.6);
      ctx.scale(scale, scale);
      ctx.drawImage(sp.canvas, -sp.cx, -sp.cy);
      ctx.restore();
      // hit flash
      if (e.hitFlashMs > 0) {
        ctx.save(); ctx.globalAlpha = 0.5 * (e.hitFlashMs / 150);
        ctx.fillStyle = '#ffffff'; ctx.beginPath();
        ctx.arc(x, y, tile * e.size / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      // shield ring
      if (e.behavior?.type === 'shield' && e.bs.shieldActive) {
        ctx.save(); ctx.strokeStyle = '#BB8FCEAA'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, tile * e.size / 2 + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      // spawn ripple
      if (e.spawnClock < 600) {
        const t = e.spawnClock / 600;
        ctx.save(); ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = e.glow; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, tile * e.size / 2 + t * tile * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      // health bar
      if (e.hp < e.maxHp && !e.dying) {
        const w = tile * 0.7, h = 6, bx = x - w / 2, by = y - tile * e.size / 2 - 12;
        ctx.fillStyle = '#00000088'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
        ctx.fillStyle = '#333'; ctx.fillRect(bx, by, w, h);
        const frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = frac > 0.5 ? '#5BC85B' : frac > 0.25 ? '#E2C541' : '#E25B5B';
        ctx.fillRect(bx, by, w * frac, h);
      }
      // selection ring
      if (state.selected.kind === 'enemy' && state.selected.id === e.id) {
        ctx.save(); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, tile * e.size / 2 + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
  }

  _towers(state) {
    const ctx = this.ctx, tile = this.L.tile;
    for (const t of state.towers) {
      const sp = this.sprites.tower(t.typeId, t.level);
      const { x, y } = this.toScreen(t.x, t.y);
      let scale = 1 + Math.sin(t.animTime / 1000 * 4) * 0.04; // idle pulse
      if (t.fireAnimMs > 0) scale += Math.sin((1 - t.fireAnimMs / 180) * Math.PI) * 0.15; // firing pop
      if (t.placeAnimMs > 0) scale *= 1 - (t.placeAnimMs / 280) * 0.6; // grow-in
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ctx.drawImage(sp.canvas, -sp.cx, -sp.cy); ctx.restore();
      // selection: ring + range circle
      if (state.selected.kind === 'tower' && state.selected.id === t.id) {
        const range = this.cfg.towers[t.typeId].levels[t.level - 1].range;
        ctx.save();
        ctx.strokeStyle = '#FFD70088'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(x, y, range * tile, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#FFD70011';
        ctx.beginPath(); ctx.arc(x, y, range * tile, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  _projectiles(state) {
    const ctx = this.ctx, tile = this.L.tile;
    for (const p of state.projectiles) {
      // trail
      if (p.trail.length > 1) {
        ctx.save(); ctx.strokeStyle = p.color; ctx.lineCap = 'round';
        for (let i = 1; i < p.trail.length; i++) {
          const a = this.toScreen(p.trail[i - 1].x, p.trail[i - 1].y);
          const b = this.toScreen(p.trail[i].x, p.trail[i].y);
          ctx.globalAlpha = (i / p.trail.length) * 0.5; ctx.lineWidth = (i / p.trail.length) * p.size;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
      }
      const sp = this.sprites.projectile(p.kind);
      const { x, y } = this.toScreen(p.x, p.y);
      ctx.drawImage(sp.canvas, x - sp.cx, y - sp.cy);
    }
  }

  _effects(state) {
    const ctx = this.ctx, tile = this.L.tile;
    for (const fx of state.effects) {
      const t = fx.age / fx.ttl;
      const { x, y } = this.toScreen(fx.x, fx.y);
      if (fx.kind === 'explosion') {
        ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.strokeStyle = '#FF7A1A'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, fx.radius * tile * t, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#FFC04D'; ctx.globalAlpha = (1 - t) * 0.3;
        ctx.beginPath(); ctx.arc(x, y, fx.radius * tile * t, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (fx.kind === 'hit') {
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.fillStyle = fx.crit ? '#FFD700' : '#fff';
        ctx.beginPath(); ctx.arc(x, y, 4 + t * 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  _coins(state) {
    const ctx = this.ctx, tile = this.L.tile;
    ctx.font = `bold ${tile * 0.22}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const coin of state.coinsList) {
      const sp = this.sprites.coin(coin.phase === 'warning' ? 'warning' : coin.phase === 'expired' ? 'expired' : 'normal');
      const base = this.toScreen(coin.x, coin.y);
      if (coin.phase === 'collected') {
        const t = coin.anim / this.cfg.economy.coin.collectAnimMs;
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.fillStyle = '#FFD700';
        ctx.fillText('+' + coin.value, base.x, base.y - t * 40); ctx.restore();
        continue;
      }
      const bounce = Math.sin(state.clock / 250 + coin.bounceSeed) * 4;
      let alpha = 1;
      if (coin.phase === 'expired') alpha = 1 - coin.anim / this.cfg.economy.coin.expireAnimMs;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(sp.canvas, base.x - sp.cx, base.y - sp.cy + bounce);
      if (coin.value > 1 && coin.phase !== 'expired') {
        ctx.fillStyle = '#5a3d00'; ctx.fillText(String(coin.value), base.x, base.y + bounce);
      }
      ctx.restore();
    }
  }

  _placement(state) {
    if (!state.placement) return;
    const ctx = this.ctx, tile = this.L.tile;
    const { gx, gy, towerType } = state.placement;
    const { x, y } = this.toScreen(gx + 0.5, gy + 0.5);
    const range = this.cfg.towers[towerType].levels[0].range;
    // range circle
    ctx.save(); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(x, y, range * tile, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#ffffff18';
    ctx.beginPath(); ctx.arc(x, y, range * tile, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // ghost tower
    const sp = this.sprites.tower(towerType, 1);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(sp.canvas, x - sp.cx, y - sp.cy); ctx.restore();

    // popup (3 buttons) centered on tile, clamped to canvas
    const bw = 180, bh = 64, gap = 10;
    let px = x - bw / 2, py = y - tile - bh * 2 - gap;
    px = Math.max(this.L.gridOffsetX + 6, Math.min(px, this.L.canvasW - bw - 6));
    py = Math.max(6, py);
    const cost = this.cfg.towers[towerType].levels[0].cost;
    const afford = state.coins >= cost;
    // place (buy) button
    this._button(px, py, bw, bh, `${this.cfg.towers[towerType].name}  ${cost}c`, afford ? '#4CAF50' : '#777', 'place', null, afford);
    // cycle + cancel row
    const hw = (bw - gap) / 2;
    this._button(px, py + bh + gap, hw, bh, '⟳ Type', '#5B8DEF', 'cycle', null, true);
    this._button(px + hw + gap, py + bh + gap, hw, bh, '✕', '#E25B5B', 'closePopup', null, true);
  }

  _button(x, y, w, h, label, color, action, data, enabled = true) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = enabled ? 1 : 0.55;
    ctx.fillStyle = color; roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = '#00000033'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.min(26, h * 0.4)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
    if (enabled && action) this.addHit(action, x, y, w, h, data);
  }

  // ---- HUD (left dock) ----
  _hud(state) {
    const ctx = this.ctx;
    const W = this.L.hudWidth, H = this.L.canvasH, pad = 24;
    // panel
    ctx.fillStyle = '#2b2d42'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1f2133'; ctx.fillRect(W - 6, 0, 6, H);
    ctx.fillStyle = '#FFD700'; ctx.fillRect(0, 0, W, 6);

    // title
    ctx.fillStyle = '#fff'; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('CuteDefense', pad, 22);
    ctx.fillStyle = '#FFD70099'; ctx.font = `bold 18px ${FONT}`; ctx.fillText('v2', pad + 232, 34);

    // info card
    let y = 84;
    this._card(pad, y, W - pad * 2, 150);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // lives
    ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
    this._heart(pad + 22, y + 34, 12); ctx.fillStyle = '#fff';
    ctx.fillText(`Lives  ${state.lives}`, pad + 44, y + 34);
    // wave
    const waveTxt = state.wave.index > 0 ? `Wave  ${state.wave.index} / ${this.cfg.waves.patterns.length}` : 'Get ready!';
    ctx.fillText(waveTxt, pad + 22, y + 78);
    // coins — total pulses gold when credited (kills / sell / wave bonus)
    const coinIconX = pad + 26, coinY = y + 120;
    const pulse = Math.max(0, Math.min(1, (state.coinPulseEnd - state.clock) / 500));
    const coinR = 12 + pulse * 4;
    ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(coinIconX, coinY, coinR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save();
    ctx.translate(pad + 48, coinY); ctx.scale(1 + pulse * 0.35, 1 + pulse * 0.35);
    ctx.fillStyle = pulse > 0 ? '#FFE680' : '#fff'; ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${state.coins}`, 0, 0);
    ctx.restore();
    ctx.font = `bold 26px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // floating "+N bonus" rising near the coin total
    if (state.bonusFloat && state.clock < state.bonusFloat.untilClock) {
      const p = (state.bonusFloat.untilClock - state.clock) / 1400; // 1 -> 0
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.5);
      ctx.fillStyle = '#FFD700'; ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(`+${state.bonusFloat.amount} bonus!`, pad + 120, coinY - (1 - p) * 30);
      ctx.restore();
    }

    // selection card
    y = 260;
    const tower = state.selected.kind === 'tower' ? state.towers.find(t => t.id === state.selected.id) : null;
    const enemy = state.selected.kind === 'enemy' ? state.enemies.find(e => e.id === state.selected.id) : null;
    if (tower) this._towerCard(state, tower, pad, y, W - pad * 2);
    else if (enemy) this._enemyCard(enemy, pad, y, W - pad * 2);
    else { this._card(pad, y, W - pad * 2, 120); ctx.fillStyle = '#ffffff66'; ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Tap a tile to build · tap a tower to manage', W / 2, y + 60); }

    // control row (bottom)
    const by = H - 96, bw = (W - pad * 2 - 16) / 2;
    this._button(pad, by, bw, 64, state.status === 'paused' ? '▶ Resume' : '⏸ Pause', '#5B8DEF', 'pause', null, true);
    this._button(pad + bw + 16, by, bw, 64, state.soundEnabled ? '🔊 Sound' : '🔇 Muted', state.soundEnabled ? '#4CAF50' : '#777', 'sound', null, true);
  }

  _card(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = '#3a3d5c'; roundRect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 2; ctx.stroke();
  }

  _heart(cx, cy, r) {
    const ctx = this.ctx; ctx.fillStyle = '#E25B5B';
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.8);
    ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.6, cx - r * 0.6, cy - r * 1.4, cx, cy - r * 0.4);
    ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 1.5, cy - r * 0.6, cx, cy + r * 0.8);
    ctx.fill();
  }

  _towerCard(state, tower, x, y, w) {
    const ctx = this.ctx;
    this._card(x, y, w, 230);
    const def = this.cfg.towers[tower.typeId];
    const st = def.levels[tower.level - 1];
    // portrait
    const sp = this.sprites.tower(tower.typeId, tower.level);
    const pscale = Math.min(1, 70 / Math.max(sp.canvas.width, sp.canvas.height));
    ctx.drawImage(sp.canvas, x + 20, y + 20, sp.canvas.width * pscale, sp.canvas.height * pscale);
    // stats
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(`${def.name}  L${tower.level}`, x + 110, y + 22);
    ctx.font = `18px ${FONT}`; ctx.fillStyle = '#cdd';
    ctx.fillText(`Damage ${st.bombDamage ?? st.damage}   Range ${st.range}`, x + 110, y + 56);
    ctx.fillText(`Fire ${(st.fireRateMs / 1000).toFixed(2)}s${def.kind === 'aoe' ? '   AoE' : ''}`, x + 110, y + 82);
    // buttons
    const next = def.levels[tower.level];
    const upCost = next ? next.cost : null;
    const canUp = next && state.coins >= upCost;
    this._button(x + 16, y + 120, w - 32, 44, next ? `⬆ Upgrade  ${upCost}c` : 'Max level', canUp ? '#4CAF50' : '#777', 'upgrade', null, !!canUp);
    const refund = Math.floor(tower.invested * this.cfg.economy.sellRefundFraction);
    this._button(x + 16, y + 172, w - 32, 44, `💰 Sell  +${refund}c`, '#E2854B', 'sell', null, true);
  }

  _enemyCard(enemy, x, y, w) {
    const ctx = this.ctx;
    this._card(x, y, w, 150);
    const def = this.cfg.enemies[enemy.typeId];
    const sp = this.sprites.enemy(enemy.typeId);
    const pscale = Math.min(1, 70 / Math.max(sp.canvas.width, sp.canvas.height));
    ctx.drawImage(sp.canvas, x + 20, y + 30, sp.canvas.width * pscale, sp.canvas.height * pscale);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(def.name + (enemy.isBoss ? ' (Boss)' : ''), x + 110, y + 24);
    ctx.font = `18px ${FONT}`; ctx.fillStyle = '#cdd';
    ctx.fillText(`HP ${Math.ceil(enemy.hp)} / ${enemy.maxHp}`, x + 110, y + 58);
    ctx.fillText(`Reward ${enemy.reward}c   Costs ${enemy.livesCost}♥`, x + 110, y + 84);
  }

  // ---- announcements ----
  _announcement(state) {
    const a = state.wave.announcement;
    if (!a) return;
    const ctx = this.ctx;
    const cx = this.L.gridOffsetX + (this.L.canvasW - this.L.gridOffsetX) / 2;
    const cy = 90;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let color = '#fff', size = 48;
    if (a.kind === 'boss') { color = '#FF7A1A'; size = 56; }
    else if (a.kind === 'countdown') { color = '#FFD700'; size = 52; }
    else if (a.kind === 'complete') { color = '#5BC85B'; size = 50; }
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillStyle = '#00000066'; ctx.fillText(a.text, cx + 3, cy + 3);
    ctx.fillStyle = color; ctx.fillText(a.text, cx, cy);
    ctx.restore();
  }

  // ---- overlays ----
  _pause(state) {
    const ctx = this.ctx;
    ctx.fillStyle = '#00000099'; ctx.fillRect(0, 0, this.L.canvasW, this.L.canvasH);
    ctx.fillStyle = '#FFD700'; ctx.font = `bold 80px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', this.L.canvasW / 2, this.L.canvasH / 2 - 40);
    this._centerButton('▶ Resume', this.L.canvasH / 2 + 60, '#4CAF50', 'pause');
  }

  _overlay(state) {
    const ctx = this.ctx, won = state.status === 'won';
    ctx.fillStyle = '#000000b3'; ctx.fillRect(0, 0, this.L.canvasW, this.L.canvasH);
    const cx = this.L.canvasW / 2; let cy = this.L.canvasH / 2 - 160;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 84px ${FONT}`; ctx.fillStyle = won ? '#5BC85B' : '#E25B5B';
    ctx.fillText(won ? 'Victory! 🎉' : 'Game Over', cx, cy);
    // run stats
    const s = state.stats;
    const lines = [
      `Waves cleared: ${s.wavesCleared} / ${this.cfg.waves.patterns.length}`,
      `Towers built: ${s.towersBuilt}`,
      `Enemies defeated: ${s.enemiesKilled}`,
      `Coins earned: ${s.coinsEarned}`,
      `Lives left: ${state.lives}`,
      `Time: ${(s.elapsedMs / 1000).toFixed(0)}s`,
    ];
    cy += 80; ctx.font = `26px ${FONT}`; ctx.fillStyle = '#e8e8f0';
    for (const ln of lines) { ctx.fillText(ln, cx, cy); cy += 40; }
    this._centerButton('▶ Play Again', cy + 30, '#4CAF50', 'playAgain');
  }

  _centerButton(label, cy, color, action) {
    const w = 320, h = 72, x = this.L.canvasW / 2 - w / 2, y = cy - h / 2;
    this._button(x, y, w, h, label, color, action, null, true);
  }

  // ---- start menu ----
  _startMenu(state) {
    const ctx = this.ctx, W = this.L.canvasW, H = this.L.canvasH;
    // soft sky background
    ctx.fillStyle = '#BFE9FF'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = this.cfg.visual.grass; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    // decorative sprites
    const decos = [
      this.sprites.enemy('basic'), this.sprites.enemy('fast'), this.sprites.enemy('strong'),
      this.sprites.tower('basic', 2), this.sprites.tower('strong', 3), this.sprites.coin('normal'),
    ];
    const t = state.clock || 0;
    decos.forEach((sp, i) => {
      const x = W * (0.18 + i * 0.13);
      const y = H * 0.74 + Math.sin(t / 600 + i) * 10;
      ctx.drawImage(sp.canvas, x - sp.cx, y - sp.cy);
    });
    // title
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 120px ${FONT}`;
    ctx.fillStyle = '#00000022'; ctx.fillText('CuteDefense', W / 2 + 5, H * 0.3 + 5);
    ctx.fillStyle = '#FF7AA2'; ctx.fillText('CuteDefense', W / 2, H * 0.3);
    ctx.font = `bold 34px ${FONT}`; ctx.fillStyle = '#5577aa';
    ctx.fillText('Defend the path · pop the cuties · grab the coins', W / 2, H * 0.3 + 90);
    // buttons
    this._centerButton('▶ Play', H * 0.52, '#4CAF50', 'play');
    const w = 320, h = 72, x = W / 2 - w / 2, y = H * 0.52 + 90 - h / 2;
    this._button(x, y, w, h, state.soundEnabled ? '🔊 Sound: On' : '🔇 Sound: Off', state.soundEnabled ? '#5B8DEF' : '#777', 'sound', null, true);
  }
}

export default Renderer;
