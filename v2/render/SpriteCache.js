/**
 * SpriteCache — bakes each entity look ONCE into a small offscreen canvas; the
 * renderer then just drawImage()s them. Gradients/soft shading are allowed here
 * because they run a single time at bake, not every frame. No per-frame
 * shadowBlur or gradient allocation anywhere (V1's #1 and #2 costs).
 *
 * Expression frames (enemy ouch, tower shock/blink/blush) and the menu portraits
 * are also baked ONCE under frame-suffixed keys; the renderer selects a frame
 * from cheap per-entity state and blits it — never redrawing a face per frame.
 *
 * Each entry is { canvas, cx, cy } where (cx,cy) is the sprite's center offset,
 * so the renderer draws at (screenX - cx, screenY - cy).
 */
import { shapePath, lighten, darken, makeCanvas } from './shapes.js';
import { drawEnemyFace, drawTowerFace, drawPortraitFace, drawCoinFace, drawSparkle } from './faces.js';
import { withAlpha, coinColors } from './colors.js';
import { PALETTE } from './palette.js';

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

  // Generic one-shot cache for variable-size bakes (title / cloud).
  _cacheGet(key, build) {
    if (this.cache.has(key)) return this.cache.get(key);
    const v = build(); this.cache.set(key, v); return v;
  }

  enemy(typeId, frame = 'neutral') {
    const def = this.cfg.enemies[typeId];
    const r = this.tile * def.size / 2;
    const pad = r * 0.6;
    const size = (r + pad) * 2;
    return this._bake(`enemy:${typeId}:${frame}`, size, size, (ctx, cx, cy) => {
      // flat soft glow halo (baked once)
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + pad);
      halo.addColorStop(0, withAlpha(def.glow, '55'));
      halo.addColorStop(1, withAlpha(def.glow, '00'));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, r + pad, 0, Math.PI * 2); ctx.fill();
      // body — RADIAL centre-light shading (standardised with towers so enemies
      // read just as round; the owner asked for this parity).
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
      grad.addColorStop(0, lighten(def.color, 45));
      grad.addColorStop(1, darken(def.color, 22));
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.fillStyle = grad; ctx.fill();
      // outlines (border color + dark contrast)
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.strokeStyle = def.border; ctx.lineWidth = Math.max(2, r * 0.12); ctx.stroke();
      drawEnemyFace(ctx, cx, cy, r, frame);
    });
  }

  tower(typeId, level, frame = 'neutral') {
    const def = this.cfg.towers[typeId];
    const st = def.levels[level - 1];
    const r = this.tile * st.sizeScale;
    const pad = r * 0.55 + 8;
    const size = (r + pad) * 2;
    const G = this.cfg.visual.gold ?? PALETTE.gold;
    return this._bake(`tower:${typeId}:${level}:${frame}`, size, size, (ctx, cx, cy) => {
      // upgrade glow halo for L2/L3 (baked)
      if (level >= 2) {
        const gcolor = level === 3 ? G.l3glow : G.base;
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
        ctx.strokeStyle = (level === 3 ? G.l3glow : G.base) + 'AA'; ctx.lineWidth = 2; ctx.stroke();
      }
      drawTowerFace(ctx, cx, cy, r, frame);
      // rank badge (top-right): N little bars
      if (level >= 2) {
        const bx = cx + r * 0.55, by = cy - r * 0.75, bw = 6 * level + 4, bh = 12;
        ctx.fillStyle = G.base; ctx.strokeStyle = G.deep; ctx.lineWidth = 1;
        roundRect(ctx, bx, by, bw, bh, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7a5c00';
        for (let i = 0; i < level; i++) ctx.fillRect(bx + 3 + i * 6, by + 3, 3, bh - 6);
      }
      // L3 corner sparkles
      if (level === 3) {
        ctx.fillStyle = G.pale;
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
        ctx.fillStyle = PALETTE.gold.base; ctx.beginPath(); ctx.arc(cx + s * 0.4, cy - s * 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  // ---- HUD lives heart: two baked frames (normal / hurt) ----
  heart(variant = 'normal') {
    const r = 22, pad = 8, size = (r + pad) * 2;
    return this._bake(`heart:${variant}`, size, size, (ctx, cx, cy) => {
      const base = variant === 'hurt' ? '#E2557A' : '#FF6F91';
      const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r + pad);
      halo.addColorStop(0, withAlpha(base, '55')); halo.addColorStop(1, withAlpha(base, '00'));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r + pad, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      g.addColorStop(0, lighten(base, 30)); g.addColorStop(1, darken(base, 15));
      heartPath(ctx, cx, cy, r); ctx.fillStyle = g; ctx.fill();
      heartPath(ctx, cx, cy, r); ctx.strokeStyle = darken(base, 40); ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx - r * 0.32, cy - r * 0.30, r * 0.22, r * 0.32, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#5A2333'; ctx.fillStyle = '#5A2333'; ctx.lineCap = 'round';
      if (variant === 'hurt') {                 // X_X + little o mouth
        ctx.lineWidth = 2.5;
        for (const sx of [-1, 1]) {
          const ex = cx + sx * r * 0.34, ey = cy - r * 0.05, s = r * 0.13;
          ctx.beginPath(); ctx.moveTo(ex - s, ey - s); ctx.lineTo(ex + s, ey + s);
          ctx.moveTo(ex + s, ey - s); ctx.lineTo(ex - s, ey + s); ctx.stroke();
        }
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy + r * 0.30, r * 0.10, 0, Math.PI * 2); ctx.stroke();
      } else {                                   // dot eyes + content smile
        ctx.beginPath(); ctx.arc(cx - r * 0.30, cy - 0.02 * r, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r * 0.30, cy - 0.02 * r, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy + r * 0.12, r * 0.18, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      }
    });
  }

  // ---- HD menu portrait: larger, more shading, big face (2 blink frames) ----
  portrait(kind, typeId, opts = {}) {
    const { r = 80, level = 1, mood = 'happy', frame = 0 } = opts;
    const key = `portrait:${kind}:${typeId}:${level}:${mood}:${frame}`;
    const pad = r * 0.72 + 16;
    const size = (r + pad) * 2;
    return this._bake(key, size, size, (ctx, cx, cy) => {
      let color, border, shape;
      if (kind === 'tower')      { const d = this.cfg.towers[typeId];  color = d.color; shape = d.shape; border = darken(d.color, 50); }
      else if (kind === 'enemy') { const d = this.cfg.enemies[typeId]; color = d.color; shape = d.shape; border = d.border; }
      else                       { color = PALETTE.gold.base; shape = 'circle'; border = PALETTE.gold.deep; }
      // contact shadow (grounds the portrait)
      ctx.fillStyle = '#0000001f';
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.02, r * 0.92, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      // body — 3-stop radial for rounded HD volume (baked once)
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.15, cx, cy, r * 1.05);
      g.addColorStop(0, lighten(color, 70)); g.addColorStop(0.55, color); g.addColorStop(1, darken(color, 28));
      shapePath(ctx, shape, cx, cy, r); ctx.fillStyle = g; ctx.fill();
      // glossy top sheen, clipped to body
      ctx.save(); shapePath(ctx, shape, cx, cy, r); ctx.clip();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.5, r * 0.7, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // chunky friendly outline
      shapePath(ctx, shape, cx, cy, r); ctx.lineWidth = Math.max(3, r * 0.10); ctx.strokeStyle = border; ctx.stroke();
      // big expressive face — enemies are ANGRY (mirror the in-game mean look),
      // towers stay happy. frame 1 = blink, frame 2 = angry snarl (animated meanness).
      if (kind === 'coin') drawCoinFace(ctx, cx, cy, r, frame);
      else drawPortraitFace(ctx, cx, cy, r, { mood: kind === 'enemy' ? 'angry' : mood, blink: frame === 1, snarl: frame === 2 });
      // sparkle only on friendly characters (towers); a sparkly villain undercuts the menace
      if (frame === 0 && kind !== 'enemy') drawSparkle(ctx, cx + r * 0.78, cy - r * 0.82, r * 0.16);
    });
  }

  // ---- baked two-font sticker title ("Cute" round + candy vs "Defense" rugged + grape) ----
  menuTitle() {
    return this._cacheGet('menuTitle', () => {
      const F = this.cfg.visual.font ?? PALETTE.font;
      const ROUND = `bold 150px ${F.round}`;
      const RUGGED = `132px ${F.rugged}`;
      const m = makeCanvas(8, 8).getContext('2d');
      m.font = ROUND;  const wCute = m.measureText('Cute').width;
      m.font = RUGGED; const wDef = m.measureText('Defense').width;
      const gap = 28, pad = 64;
      const w = Math.ceil(wCute + gap + wDef + pad * 2);
      const h = 270;
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      const midY = h / 2;
      // "Cute" — soft, tilted -4deg, candy pink
      ctx.save();
      ctx.translate(pad + wCute / 2, midY); ctx.rotate(-4 * Math.PI / 180); ctx.font = ROUND;
      stickerWord(ctx, 'Cute', 0, 0, 150, { top: '#FF9CC4', bot: '#FF5C9E', edge: '#C9387A', drop: '#A22A6655' });
      ctx.restore();
      // "Defense" — hard, upright, grape (Impact sits tall: +4 to share baseline)
      ctx.save();
      ctx.translate(pad + wCute + gap + wDef / 2, midY); ctx.font = RUGGED;
      stickerWord(ctx, 'Defense', 0, 4, 132, { top: '#8B6FE0', bot: '#5B3FA0', edge: '#33215F', drop: '#1E143F55' });
      ctx.restore();
      return { canvas, cx: w / 2, cy: h / 2, w, h };
    });
  }

  // ---- baked drifting cloud ----
  cloud() {
    return this._cacheGet('cloud', () => {
      const w = 220, h = 120, canvas = makeCanvas(w, h), ctx = canvas.getContext('2d');
      ctx.fillStyle = '#E5D9E1';
      for (const [dx, dy, r] of [[70, 70, 40], [120, 62, 52], [160, 74, 38]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#FFFFFF';
      for (const [dx, dy, r] of [[70, 62, 40], [120, 54, 52], [160, 66, 38]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); }
      return { canvas, cx: w / 2, cy: h / 2 };
    });
  }
}

function heartPath(ctx, cx, cy, r) {
  ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.78);
  ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.55, cx - r * 0.55, cy - r * 1.35, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 1.35, cx + r * 1.5, cy - r * 0.55, cx, cy + r * 0.78);
  ctx.closePath();
}

function stickerWord(ctx, text, x, y, size, c) {
  ctx.fillStyle = c.drop;     ctx.fillText(text, x + size * 0.04, y + size * 0.07);    // soft drop
  ctx.lineWidth = size * 0.16; ctx.strokeStyle = c.edge;    ctx.strokeText(text, x, y); // chunky sticker edge
  ctx.lineWidth = size * 0.08; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(text, x, y); // white inner rim
  const g = ctx.createLinearGradient(0, y - size * 0.55, 0, y + size * 0.55);
  g.addColorStop(0, c.top); g.addColorStop(1, c.bot);
  ctx.fillStyle = g; ctx.fillText(text, x, y);                                          // candy gradient
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
