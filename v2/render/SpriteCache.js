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
import { drawEnemyFace, drawTowerFace, drawBossFace, drawPortraitFace, drawCoinFace, drawSparkle } from './faces.js';
import { withAlpha, coinColors } from './colors.js';
import { PALETTE } from './palette.js';
import { flagMask } from '../sim/flags.js';

export { flagMask };

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

  enemy(typeId, frame = 'neutral', flagmask = 0) {
    const def = this.cfg.enemies[typeId];
    const r = this.tile * def.size / 2;
    const pad = r * 0.6;
    const size = (r + pad) * 2;
    return this._bake(`enemy:${typeId}:${frame}:${flagmask}`, size, size, (ctx, cx, cy) => {
      // flat soft glow halo (baked once)
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + pad);
      halo.addColorStop(0, withAlpha(def.glow, '55'));
      halo.addColorStop(1, withAlpha(def.glow, '00'));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, r + pad, 0, Math.PI * 2); ctx.fill();
      // body — 3-stop radial for the rounded, HD "portrait" volume (matches the
      // menu/catalog portraits: a brighter centre-light that rolls to a deeper rim).
      const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.15, cx, cy, r * 1.05);
      grad.addColorStop(0, lighten(def.color, 70));
      grad.addColorStop(0.55, def.color);
      grad.addColorStop(1, darken(def.color, 28));
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.fillStyle = grad; ctx.fill();
      // glossy top sheen, clipped to the body (the "lighting" that makes it pop)
      ctx.save(); shapePath(ctx, def.shape, cx, cy, r); ctx.clip();
      ctx.globalAlpha = 0.30; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.5, r * 0.7, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
      // chunky friendly outline (matches the portrait border weight)
      shapePath(ctx, def.shape, cx, cy, r);
      ctx.strokeStyle = def.border; ctx.lineWidth = Math.max(2.5, r * 0.10); ctx.stroke();
      drawEnemyFace(ctx, cx, cy, r, frame);
      // P2: bake the composable flag glyphs ONCE (keyed into this variant by
      // flagmask) — spikes/shimmer/leaf/cluster/umbrella as loud non-numeric tells.
      if (flagmask) this._bakeFlagGlyphs(ctx, cx, cy, r, flagmask);
    });
  }

  // Decode a flagmask (stable enemyFlags.order bit order) and stamp each flag's
  // glyph as a small badge around the body. Baked once per (typeId,frame,flagmask).
  _bakeFlagGlyphs(ctx, cx, cy, r, flagmask) {
    const order = this.cfg.enemyFlags.order;
    const defs = this.cfg.enemyFlags.defs;
    const active = [];
    for (let i = 0; i < order.length; i++) if (flagmask & (1 << i)) active.push(defs[order[i]].glyph);
    // badge anchor positions (up to 3 visible): top-right, top-left, bottom-right
    const anchors = [[0.75, -0.78], [-0.75, -0.78], [0.78, 0.72]];
    const gr = Math.max(6, r * 0.34);
    active.slice(0, 3).forEach((glyph, i) => {
      const [ax, ay] = anchors[i];
      drawFlagGlyph(ctx, glyph, cx + ax * r, cy + ay * r, gr);
    });
  }

  tower(typeId, level, frame = 'neutral', fork = null) {
    const def = this.cfg.towers[typeId];
    const st = def.levels[level - 1];
    // W8 — footprint-aware sizing. A 1-tile tower clamps its drawn BODY radius to
    // the footprint cap so an L3 body fits its tile (level stays legible via
    // rings/badge/glow/sparkles, not raw body size). A multi-tile tower (the 2x2
    // boss) instead scales to SPAN its fp-tile footprint, so it visibly fills 2x2.
    const fp = def.footprint ?? 1;
    const cap = this.cfg.towers.footprintScaleCap;
    const r = fp > 1
      ? this.tile * (fp / 2) * (st.sizeScale ?? 1)
      : this.tile * Math.min(st.sizeScale, cap);
    const pad = r * 0.55 + 8;
    const size = (r + pad) * 2;
    const G = this.cfg.visual.gold ?? PALETTE.gold;
    return this._bake(`tower:${typeId}:${level}:${fork || '-'}:${frame}`, size, size, (ctx, cx, cy) => {
      // multi-tile boss gets its own menacing obsidian-fortress bake
      if (fp > 1) { this._bakeBossBody(ctx, cx, cy, r, def, level); return; }
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
      // P4 — fork identity overlay (the picture that tells the arm apart). Baked once.
      if (fork) drawForkOverlay(ctx, fork, cx, cy, r);
    });
  }

  // V2.2 — the 2x2 BOSS tower bake: a friendly-but-MIGHTY crowned MONARCH that
  // stays fully INSIDE the soft candy palette. It reads "boss" through SIZE (the
  // 2x2 bake), a soft orchid body, a chunky royal BORDER, a gold CROWN with a sky
  // gem, and a big confident FACE — never through darkness. L2 (ultimate unlocked)
  // visibly steps up: a brighter/larger crown gem, a stronger aura, corner
  // sparkles, and a bolder face. Baked once like every sprite.
  _bakeBossBody(ctx, cx, cy, r, def, level) {
    const B = PALETTE.towers.boss;
    const ult = level >= 2;                 // L2 = ultimate unlocked

    // soft orchid aura halo (brighter once the ultimate is unlocked)
    const halo = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.3);
    halo.addColorStop(0, withAlpha(B.glow, ult ? '99' : '66'));
    halo.addColorStop(1, withAlpha(B.glow, '00'));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2); ctx.fill();

    // body — cheerful 3-stop orchid radial (the same volume the normal towers use)
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.45, r * 0.2, cx, cy, r * 1.1);
    grad.addColorStop(0, lighten(B.body, 55));
    grad.addColorStop(0.6, B.body);
    grad.addColorStop(1, darken(B.body, 22));
    shapePath(ctx, def.shape, cx, cy, r); ctx.fillStyle = grad; ctx.fill();

    // glossy top sheen, clipped to the body (the "lighting" that makes it pop)
    ctx.save(); shapePath(ctx, def.shape, cx, cy, r); ctx.clip();
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.45, r * 0.7, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;

    // chunky royal border (boss-weight outline = the "bigger/tougher" tell)
    shapePath(ctx, def.shape, cx, cy, r);
    ctx.strokeStyle = B.border; ctx.lineWidth = Math.max(3, r * 0.09); ctx.lineJoin = 'round'; ctx.stroke();

    // gold CROWN band + gem across the top of the keep (the dominant boss signal)
    this._bakeBossCrown(ctx, cx, cy, r, B, ult);

    // big confident MONARCH face (L2 = bolder)
    drawBossFace(ctx, cx, cy, r, { level });

    // L2 step-up: extra baked corner sparkles around the crown
    if (ult) {
      for (const [dx, dy] of [[-0.78, -0.55], [0.78, -0.55], [0, -1.02]]) {
        drawSparkle(ctx, cx + dx * r, cy + dy * r, r * 0.12);
      }
    }
  }

  // The boss CROWN: a 3-point gold crown sitting across the top of the keep with a
  // sky-blue gem on the central spire. L2 enlarges the crown and brightens the gem
  // (the visible upgrade). Baked once with the rest of the boss body.
  _bakeBossCrown(ctx, cx, cy, r, B, ult) {
    const topY = cy - r * (ult ? 0.94 : 0.88);   // central crown peak (near the spire)
    const sideY = cy - r * (ult ? 0.74 : 0.68);  // side crown points
    const baseY = cy - r * 0.20;                  // crown band base
    const w = r * (ult ? 0.62 : 0.56);

    ctx.beginPath();
    ctx.moveTo(cx - w, baseY);
    ctx.lineTo(cx - w * 0.62, sideY);            // left point
    ctx.lineTo(cx - w * 0.30, baseY - r * 0.10); // dip
    ctx.lineTo(cx, topY);                        // central peak (tallest)
    ctx.lineTo(cx + w * 0.30, baseY - r * 0.10); // dip
    ctx.lineTo(cx + w * 0.62, sideY);            // right point
    ctx.lineTo(cx + w, baseY);
    ctx.closePath();
    ctx.fillStyle = B.crown; ctx.fill();
    ctx.strokeStyle = darken(B.crown, 40); ctx.lineWidth = Math.max(2, r * 0.04); ctx.lineJoin = 'round'; ctx.stroke();

    // sky gem on the central spire (L2 brighter + larger)
    ctx.fillStyle = ult ? lighten(B.gem, 30) : B.gem;
    ctx.beginPath(); ctx.arc(cx, baseY - r * 0.04, r * (ult ? 0.13 : 0.10), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darken(B.gem, 40); ctx.lineWidth = Math.max(1.5, r * 0.03); ctx.stroke();
    // gem glint
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(cx - r * 0.03, baseY - r * 0.08, r * 0.03, 0, Math.PI * 2); ctx.fill();
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

// P2 flag glyphs — tiny baked badges (each drawn once into a sprite variant). All
// are simple, high-contrast picture tells legible at tile size for a 5-10yo.
function drawFlagGlyph(ctx, glyph, x, y, r) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // white halo disc so the badge reads against any body colour
  ctx.fillStyle = '#FFFFFFEE'; ctx.strokeStyle = '#00000033'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  switch (glyph) {
    case 'spikes': {            // armored — grey rivet/spikes
      ctx.fillStyle = '#8A93A6'; ctx.strokeStyle = '#4A5468'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
        ctx.lineTo(x + Math.cos(a - 0.32) * r * 0.45, y + Math.sin(a - 0.32) * r * 0.45);
        ctx.lineTo(x + Math.cos(a + 0.32) * r * 0.45, y + Math.sin(a + 0.32) * r * 0.45);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'shimmer': {           // evasive — cyan sparkle
      ctx.fillStyle = '#39C5E6';
      for (const [dx, dy, s] of [[0, 0, 1], [-0.55, -0.45, 0.5], [0.55, 0.45, 0.5]]) {
        sparkle4(ctx, x + dx * r, y + dy * r, r * 0.55 * s);
      }
      break;
    }
    case 'leaf': {              // regen — green leaf
      ctx.fillStyle = '#5BBA4A'; ctx.strokeStyle = '#2E7D32'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y + r * 0.5);
      ctx.quadraticCurveTo(x - r * 0.6, y - r * 0.6, x + r * 0.5, y - r * 0.5);
      ctx.quadraticCurveTo(x + r * 0.1, y + r * 0.2, x - r * 0.5, y + r * 0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.35, y + r * 0.35); ctx.lineTo(x + r * 0.25, y - r * 0.25); ctx.stroke();
      break;
    }
    case 'cluster': {          // swarm — three dots
      ctx.fillStyle = '#E06AB0';
      for (const [dx, dy] of [[-0.4, -0.3], [0.4, -0.3], [0, 0.45]]) {
        ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'umbrella': {         // buffer — little umbrella
      ctx.fillStyle = '#F2A93B'; ctx.strokeStyle = '#9A6A12'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.7, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.1); ctx.lineTo(x, y + r * 0.6); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// P4 fork overlays — four distinct procedural "picture" tells (no role words),
// baked ONCE into the tower sprite and reused as the L3 card's picture buttons.
// Each sits in a white halo badge at the tower's lower-right so it reads at tile size.
function drawForkOverlay(ctx, fork, cx, cy, r) {
  const bx = cx + r * 0.7, by = cy + r * 0.7, br = Math.max(9, r * 0.5);
  drawForkIcon(ctx, fork, bx, by, br);
}

// Standalone fork icon (used both for the baked overlay and the L3 picture buttons).
function drawForkIcon(ctx, fork, x, y, r) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // white halo disc so the icon reads against any body / button colour
  ctx.fillStyle = '#FFFFFFEE'; ctx.strokeStyle = '#00000033'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  switch (fork) {
    case 'sniper': {            // scope ring + crosshair (long-range crit)
      ctx.strokeStyle = '#2E6B5E'; ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(1.5, r * 0.10);
      ctx.beginPath(); ctx.moveTo(x - r * 0.9, y); ctx.lineTo(x + r * 0.9, y);
      ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x, y + r * 0.9); ctx.stroke();
      ctx.fillStyle = '#C0392B'; ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'gunner': {            // three rapid-fire pips (faster fire)
      ctx.fillStyle = '#E08A1E';
      for (const dx of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(x + dx * r, y, r * 0.22, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#E08A1E'; ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.5); ctx.lineTo(x + r * 0.7, y + r * 0.5); ctx.stroke();
      break;
    }
    case 'bomber': {            // bigger-boom starburst (wider AoE)
      ctx.fillStyle = '#D24B2A';
      const spikes = 8;
      ctx.beginPath();
      for (let k = 0; k < spikes * 2; k++) {
        const a = k / (spikes * 2) * Math.PI * 2;
        const rr = (k % 2 === 0) ? r * 0.92 : r * 0.42;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'froster': {           // snowflake (adds slow)
      ctx.strokeStyle = '#2E86C1'; ctx.lineWidth = Math.max(2, r * 0.14);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        const ex = x + Math.cos(a) * r * 0.85, ey = y + Math.sin(a) * r * 0.85;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        // little V barbs near the tip
        const ba = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - ba) * r * 0.45, y + Math.sin(a - ba) * r * 0.45);
        ctx.lineTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
        ctx.lineTo(x + Math.cos(a + ba) * r * 0.45, y + Math.sin(a + ba) * r * 0.45);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function sparkle4(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r); ctx.closePath(); ctx.fill();
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

export { roundRect, drawFlagGlyph, drawForkIcon };
export default SpriteCache;
