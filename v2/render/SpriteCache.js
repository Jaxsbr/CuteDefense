/**
 * SpriteCache — bakes each entity look ONCE into a small offscreen canvas; the
 * renderer then just drawImage()s them. Gradients/soft shading are allowed here
 * because they run a single time at bake, not every frame. No per-frame
 * shadowBlur or gradient allocation anywhere (V1's #1 and #2 costs).
 *
 * Each entry is { canvas, cx, cy } where (cx,cy) is the sprite's center offset,
 * so the renderer draws at (screenX - cx, screenY - cy).
 */
import { shapePath, lighten, darken, makeCanvas } from './shapes.js';
import { drawEnemyFace, drawTowerFace } from './faces.js';
import { withAlpha, coinColors } from './colors.js';

export class SpriteCache {
  constructor(config) {
    this.cfg = config;
    this.tile = config.layout.tile;
    this.cache = new Map();
  }

  _bake(key, w, h, drawFn) {
    if (this.cache.has(key)) return this.cache.get(key);
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const cx = w / 2, cy = h / 2;
    drawFn(ctx, cx, cy);
    const entry = { canvas, cx, cy };
    this.cache.set(key, entry);
    return entry;
  }

  enemy(typeId) {
    const def = this.cfg.enemies[typeId];
    const r = this.tile * def.size / 2;
    const pad = r * 0.6;
    const size = (r + pad) * 2;
    return this._bake(`enemy:${typeId}`, size, size, (ctx, cx, cy) => {
      // flat soft glow halo (baked once)
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + pad);
      halo.addColorStop(0, withAlpha(def.glow, '55'));
      halo.addColorStop(1, withAlpha(def.glow, '00'));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, r + pad, 0, Math.PI * 2); ctx.fill();
      // body with subtle top-light shading
      const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      grad.addColorStop(0, lighten(def.color, 35));
      grad.addColorStop(1, darken(def.color, 20));
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.fillStyle = grad; ctx.fill();
      // outlines (border color + dark contrast)
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.strokeStyle = def.border; ctx.lineWidth = Math.max(2, r * 0.12); ctx.stroke();
      drawEnemyFace(ctx, cx, cy, r);
    });
  }

  tower(typeId, level) {
    const def = this.cfg.towers[typeId];
    const st = def.levels[level - 1];
    const r = this.tile * st.sizeScale;
    const pad = r * 0.55 + 8;
    const size = (r + pad) * 2;
    return this._bake(`tower:${typeId}:${level}`, size, size, (ctx, cx, cy) => {
      // upgrade glow halo for L2/L3 (baked)
      if (level >= 2) {
        const gcolor = level === 3 ? '#FF6B6B' : '#FFD700';
        const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r + pad);
        halo.addColorStop(0, withAlpha(gcolor, '66'));
        halo.addColorStop(1, withAlpha(gcolor, '00'));
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r + pad, 0, Math.PI * 2); ctx.fill();
      }
      // body
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
      grad.addColorStop(0, lighten(def.color, 55));
      grad.addColorStop(1, darken(def.color, 25));
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.fillStyle = grad; ctx.fill();
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.strokeStyle = darken(def.color, 50); ctx.lineWidth = Math.max(2, r * 0.1); ctx.stroke();
      // level rings
      for (let i = 1; i < level; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, r + 3 + i * 4, 0, Math.PI * 2);
        ctx.strokeStyle = (level === 3 ? '#FF6B6B' : '#FFD700') + 'AA'; ctx.lineWidth = 2; ctx.stroke();
      }
      drawTowerFace(ctx, cx, cy, r);
      // rank badge (top-right): N little bars
      if (level >= 2) {
        const bx = cx + r * 0.55, by = cy - r * 0.75, bw = 6 * level + 4, bh = 12;
        ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 1;
        roundRect(ctx, bx, by, bw, bh, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7a5c00';
        for (let i = 0; i < level; i++) ctx.fillRect(bx + 3 + i * 6, by + 3, 3, bh - 6);
      }
      // L3 corner sparkles
      if (level === 3) {
        ctx.fillStyle = '#FFF3B0';
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.beginPath(); ctx.arc(cx + dx * r * 0.9, cy + dy * r * 0.9, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
  }

  coin(state = 'normal') {
    const r = this.tile * 0.25;
    const pad = r * 0.7;
    const size = (r + pad) * 2;
    return this._bake(`coin:${state}`, size, size, (ctx, cx, cy) => {
      const { body, border, glow } = coinColors(state);
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + pad);
      halo.addColorStop(0, withAlpha(glow, '66')); halo.addColorStop(1, withAlpha(glow, '00'));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r + pad, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
      grad.addColorStop(0, lighten(body, 40)); grad.addColorStop(1, darken(body, 10));
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = border; ctx.stroke();
      // highlight
      ctx.fillStyle = '#FFFDE7'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  projectile(kind) {
    const def = kind === 'bomb' ? this.cfg.towers.strong.projectile : this.cfg.towers.basic.projectile;
    const s = def.size, pad = s * 1.2;
    const size = (s + pad) * 2;
    return this._bake(`proj:${kind}`, size, size, (ctx, cx, cy) => {
      const halo = ctx.createRadialGradient(cx, cy, s * 0.4, cx, cy, s + pad);
      halo.addColorStop(0, withAlpha(def.color, '88')); halo.addColorStop(1, withAlpha(def.color, '00'));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, s + pad, 0, Math.PI * 2); ctx.fill();
      if (kind === 'bomb') {
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.8, s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6b3'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.4, cy - s * 1.5); ctx.stroke();
        ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(cx + s * 0.4, cy - s * 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { roundRect };
export default SpriteCache;
