/**
 * Renderer — reads sim state, draws minimally and fast.
 *  - static tiles baked into one offscreen layer, blitted each frame
 *  - every entity is a baked sprite drawn with drawImage (+ cheap transform/alpha)
 *  - expression frames (enemy ouch, tower shock/blink/blush) are baked once and
 *    SELECTED per frame from cheap per-entity state — faces never redraw per frame
 *  - ZERO per-frame shadowBlur or gradient allocation
 *  - one hit-rect registry for all interactive UI (no guessed geometry)
 *  - every colour comes from cfg.visual (the single PALETTE source of truth)
 *
 * Animation reads state.clock (pausable, deterministic) or state.menuClock (menu).
 */
import { SpriteCache, roundRect } from './SpriteCache.js';
import { makeCanvas, darken, lighten } from './shapes.js';
import { mix } from './colors.js';

export class Renderer {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.cfg = config;
    this.L = config.layout;
    this.U = config.visual.ui;
    this.FX = config.visual.fx;
    this.G = config.visual.gold;
    this.F = config.visual.font;
    this.sprites = new SpriteCache(config);
    // Denominator the player sees ("/N"): public waves only. Secret waves (the
    // hidden wave-16 boss) are excluded, so the HUD reads "16/15" when it appears.
    this.publicWaves = config.waves.patterns.filter(p => !p.secret).length;
    this.tileLayer = null;
    this.tileKey = null;
    this.menuLayer = null;
    this._warmE = new Set();   // enemy types whose frames are pre-baked
    this._warmT = new Set();   // tower type:level whose frames are pre-baked
    this.hits = [];            // [{action, x, y, w, h, data}]
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

  // ---- shared range circle (placement + tower selection: minimal white dash
  //      with a faint dark halo so it survives the new light pastel map) ----
  _rangeCircle(x, y, radius) {
    const ctx = this.ctx, u = this.U;
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = u.rangeHalo; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = u.rangeDash; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = u.rangeFill;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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
          c.strokeStyle = key === sk || key === ek ? '#ffffff66' : '#00000018';
          c.lineWidth = 2; c.strokeRect(px + 3, py + 3, tile - 6, tile - 6);
          if (key === sk) this._goalInIcon(c, px, py, tile);
          else if (key === ek) this._goalOutIcon(c, px, py, tile);
        }
      }
    }
    this.tileLayer = canvas;
    this.tileKey = state.mapIndex;
  }
  // baked picture-not-text goal markers (kills the "IN"/"OUT" slop tell)
  _goalInIcon(c, px, py, t) {                 // a little burrow / doorway
    const cx = px + t / 2, cy = py + t * 0.58, w = t * 0.34, h = t * 0.42, g = this.cfg.visual.goal;
    c.fillStyle = g.inDark;
    c.beginPath();
    c.moveTo(cx - w, cy + h * 0.5); c.lineTo(cx - w, cy - h * 0.1);
    c.arc(cx, cy - h * 0.1, w, Math.PI, 0); c.lineTo(cx + w, cy + h * 0.5);
    c.closePath(); c.fill();
    c.fillStyle = g.inLight; c.globalAlpha = 0.6;
    c.beginPath(); c.ellipse(cx - w * 0.3, cy - h * 0.1, w * 0.28, h * 0.22, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
  _goalOutIcon(c, px, py, t) {                // a little goal flag
    const bx = px + t * 0.42, top = py + t * 0.20, bot = py + t * 0.80, g = this.cfg.visual.goal;
    c.strokeStyle = g.outDark; c.lineWidth = Math.max(3, t * 0.05); c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx, top); c.lineTo(bx, bot); c.stroke();
    c.fillStyle = g.outFlag;
    c.beginPath(); c.moveTo(bx, top); c.lineTo(bx + t * 0.34, top + t * 0.12); c.lineTo(bx, top + t * 0.26); c.closePath(); c.fill();
    c.strokeStyle = g.outDark; c.lineWidth = 2; c.stroke();
  }

  // ---- entities ----
  _enemies(state) {
    const ctx = this.ctx, tile = this.L.tile, A = this.cfg.visual.anim, fx = this.FX;
    for (const e of state.enemies) {
      if (!this._warmE.has(e.typeId)) {           // pre-bake neutral + ouch once
        this._warmE.add(e.typeId);
        this.sprites.enemy(e.typeId, 'neutral');
        this.sprites.enemy(e.typeId, 'ouch');
      }
      const frame = (!e.dying && e.ouchMs > 0) ? 'ouch' : 'neutral';
      const sp = this.sprites.enemy(e.typeId, frame);
      const { x, y } = this.toScreen(e.x, e.y);
      let scale = 1, alpha = 1;
      if (e.dying) { const t = Math.min(1, e.deathMs / 500); scale = 1 + t * 0.5; alpha = 1 - t; }
      let sx = scale, sy = scale;
      if (!e.dying && e.ouchMs > 0) {              // bonk recoil: squash wide, eases out
        const k = e.ouchMs / A.enemyOuchMs;
        sx = scale * (1 + 0.14 * k); sy = scale * (1 - 0.10 * k);
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      if (e.dying) ctx.rotate(e.deathMs / 500 * 0.6);
      ctx.scale(sx, sy);
      ctx.drawImage(sp.canvas, -sp.cx, -sp.cy);
      ctx.restore();
      // hit flash
      if (e.hitFlashMs > 0) {
        ctx.save(); ctx.globalAlpha = 0.4 * (e.hitFlashMs / 150);
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
        ctx.fillStyle = frac > 0.5 ? fx.hpGood : frac > 0.25 ? fx.hpMid : fx.hpLow;
        ctx.fillRect(bx, by, w * frac, h);
      }
      // selection ring
      if (state.selected.kind === 'enemy' && state.selected.id === e.id) {
        ctx.save(); ctx.strokeStyle = this.U.rangeDash; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, tile * e.size / 2 + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
  }

  _towers(state) {
    const ctx = this.ctx, tile = this.L.tile, A = this.cfg.visual.anim;
    for (const t of state.towers) {
      const wk = `${t.typeId}:${t.level}`;
      if (!this._warmT.has(wk)) {                  // pre-bake all 4 frames once per type/level
        this._warmT.add(wk);
        for (const f of ['neutral', 'shock', 'blink', 'blush']) this.sprites.tower(t.typeId, t.level, f);
      }
      // expression priority: shock (firing) > double-blink > blush (shy) > neutral
      let frame = 'neutral';
      if (t.fireAnimMs > 0) {
        frame = 'shock';
      } else {
        const bc = (state.clock + t.blinkOffset) % t.blinkPeriod;
        const bd = A.blink.durationMs, gap = A.blink.doubleGapMs;
        if (bc < bd || (bc >= bd + gap && bc < bd * 2 + gap)) {
          frame = 'blink';
        } else if (t.shy) {
          const sc = (state.clock + t.blushOffset) % t.blushPeriod;
          if (sc < A.blush.durationMs) frame = 'blush';
        }
      }
      const sp = this.sprites.tower(t.typeId, t.level, frame);
      const { x, y } = this.toScreen(t.x, t.y);
      // base scale: idle breathe + place grow-in
      let base = 1 + Math.sin(t.animTime / 1000 * 4) * 0.04;
      if (t.placeAnimMs > 0) base *= 1 - (t.placeAnimMs / 280) * 0.6;
      // slow cute puff on fire — squash & stretch (per-frame transform only)
      let sx = base, sy = base;
      if (t.fireAnimMs > 0) {
        const p = 1 - t.fireAnimMs / A.towerFireAnimMs;        // 0..1 over the whole puff
        const env = Math.sin(Math.pow(p, 1.4) * Math.PI);      // slow rise, gentle settle
        const wob = Math.sin(p * Math.PI * 3) * (1 - p) * 0.035; // tiny release jiggle
        sx = base * (1 + env * A.towerPuffX + wob);
        sy = base * (1 + env * A.towerPuffY - wob);
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      ctx.drawImage(sp.canvas, -sp.cx, -sp.cy); ctx.restore();
      // selection range circle — shared minimal white/dashed style (was harsh yellow)
      if (state.selected.kind === 'tower' && state.selected.id === t.id) {
        const range = this.cfg.towers[t.typeId].levels[t.level - 1].range;
        this._rangeCircle(x, y, range * tile);
      }
    }
  }

  _projectiles(state) {
    const ctx = this.ctx;
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
    const ctx = this.ctx, tile = this.L.tile, fx = this.FX;
    for (const effect of state.effects) {
      const t = effect.age / effect.ttl;
      const { x, y } = this.toScreen(effect.x, effect.y);
      if (effect.kind === 'explosion') {
        ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.strokeStyle = fx.explosionStroke; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, effect.radius * tile * t, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = fx.explosionFill; ctx.globalAlpha = (1 - t) * 0.3;
        ctx.beginPath(); ctx.arc(x, y, effect.radius * tile * t, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (effect.kind === 'hit') {
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.fillStyle = effect.crit ? this.G.base : '#fff';
        ctx.beginPath(); ctx.arc(x, y, 4 + t * 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  _coins(state) {
    const ctx = this.ctx, tile = this.L.tile;
    ctx.font = `bold ${tile * 0.22}px ${this.F.body}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const coin of state.coinsList) {
      const sp = this.sprites.coin(coin.phase === 'warning' ? 'warning' : coin.phase === 'expired' ? 'expired' : 'normal');
      const base = this.toScreen(coin.x, coin.y);
      if (coin.phase === 'collected') {
        const t = coin.anim / this.cfg.economy.coin.collectAnimMs;
        ctx.save(); ctx.globalAlpha = 1 - t; ctx.fillStyle = this.G.base;
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

  // ---- placement popup: a contained cute "sticker" panel anchored to the tile ----
  _placement(state) {
    if (!state.placement) return;
    const ctx = this.ctx, tile = this.L.tile;
    const { gx, gy, towerType } = state.placement;
    const { x, y } = this.toScreen(gx + 0.5, gy + 0.5);
    const def = this.cfg.towers[towerType];
    const range = def.levels[0].range;

    // (a) range circle — shared minimal white/dashed style
    this._rangeCircle(x, y, range * tile);

    // (b) ghost tower, gently alive
    const sp = this.sprites.tower(towerType, 1);
    const gpulse = 1 + Math.sin(state.clock / 300) * 0.04;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(x, y); ctx.scale(gpulse, gpulse);
    ctx.drawImage(sp.canvas, -sp.cx, -sp.cy); ctx.restore();

    // (c) panel geometry (contained, clamped, with a downward nub at the tile)
    const P = 12, BH = 76, Gp = 10, SH = 56, g2 = 8;
    const CW = 248, PW = CW + P * 2, PH = P + BH + Gp + SH + P, NUB = 18;
    let pxL = x - PW / 2;
    let pyT = (y - tile / 2) - NUB - PH;
    pxL = Math.max(this.L.gridOffsetX + 8, Math.min(pxL, this.L.canvasW - PW - 8));
    const aboveTile = pyT >= 8;
    pyT = Math.max(8, pyT);
    const nubX = aboveTile ? Math.max(pxL + 28, Math.min(x, pxL + PW - 28)) : null;
    this._popupPanel(pxL, pyT, PW, PH, nubX);

    // (d) buttons inside the panel content box
    const cx0 = pxL + P, cy0 = pyT + P;
    const cost = def.levels[0].cost;
    const afford = state.coins >= cost;
    this._towerBuyButton(cx0, cy0, CW, BH, towerType, cost, afford);
    const by = cy0 + BH + Gp;
    const cycleW = CW - SH - g2;
    this._cycleButton(cx0, by, cycleW, SH, this._nextTowerType(towerType));
    this._cancelButton(cx0 + cycleW + g2, by, SH, SH);
  }

  _nextTowerType(typeId) {
    const ids = Object.keys(this.cfg.towers);
    return ids[(ids.indexOf(typeId) + 1) % ids.length];
  }

  _popupPanel(x, y, w, h, nubX) {
    const ctx = this.ctx, u = this.U, r = 20;
    ctx.save();
    // fake drop-shadow (offset translucent rect; no shadowBlur)
    ctx.fillStyle = u.popupShadow; roundRect(ctx, x + 4, y + 7, w, h, r); ctx.fill();
    // thick candy border
    ctx.fillStyle = u.popupEdge; roundRect(ctx, x - 4, y - 4, w + 8, h + 8, r + 4); ctx.fill();
    if (nubX != null) {
      const ny = y + h;
      ctx.beginPath(); ctx.moveTo(nubX - 17, ny - 6); ctx.lineTo(nubX + 17, ny - 6); ctx.lineTo(nubX, ny + 18); ctx.closePath(); ctx.fill();
    }
    // cream body
    ctx.fillStyle = u.popupPanel; roundRect(ctx, x, y, w, h, r); ctx.fill();
    if (nubX != null) {
      const ny = y + h;
      ctx.beginPath(); ctx.moveTo(nubX - 11, ny - 4); ctx.lineTo(nubX + 11, ny - 4); ctx.lineTo(nubX, ny + 11); ctx.closePath(); ctx.fill();
    }
    // fluffy inner highlight
    ctx.strokeStyle = u.popupHi; ctx.lineWidth = 2; roundRect(ctx, x + 3, y + 3, w - 6, h - 6, r - 3); ctx.stroke();
    ctx.restore();
  }

  _towerBuyButton(x, y, w, h, towerType, cost, afford) {
    const ctx = this.ctx, def = this.cfg.towers[towerType], u = this.U;
    ctx.save();
    ctx.fillStyle = afford ? def.color : u.btnDisabled;
    roundRect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = afford ? darken(def.color, 35) : u.btnDisabledEdge; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFFFF33'; roundRect(ctx, x + 3, y + 3, w - 6, h * 0.4, 11); ctx.fill();
    // tower sprite thumbnail (left)
    const sp = this.sprites.tower(towerType, 1);
    const thumb = h - 18, psc = thumb / Math.max(sp.canvas.width, sp.canvas.height);
    const tw = sp.canvas.width * psc, th = sp.canvas.height * psc;
    ctx.drawImage(sp.canvas, x + 14, y + (h - th) / 2, tw, th);
    // gold coin + cost (right)
    const coinX = x + w - 86, coinY = y + h / 2;
    ctx.fillStyle = this.G.base; ctx.beginPath(); ctx.arc(coinX, coinY, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.G.deep; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFDE7'; ctx.beginPath(); ctx.arc(coinX - 5, coinY - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = afford ? '#FFFFFF' : '#FFD6D6'; ctx.font = `bold 30px ${this.F.body}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(cost), coinX + 24, coinY + 1);
    ctx.restore();
    if (afford) this.addHit('place', x, y, w, h, null);
  }

  _cycleButton(x, y, w, h, nextType) {
    const ctx = this.ctx;
    // The button wears the COLOUR of the tower it cycles TO (matches that tower's
    // body), so a non-reader sees what they're switching into — colour + thumbnail.
    const nextColor = this.cfg.towers[nextType].color;
    ctx.save();
    ctx.fillStyle = nextColor; roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = darken(nextColor, 35); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFFFF33'; roundRect(ctx, x + 3, y + 3, w - 6, h * 0.4, 9); ctx.fill();
    // next tower mini-thumbnail (the "what you'll switch to" cue)
    const sp = this.sprites.tower(nextType, 1);
    const thumb = h - 18, psc = thumb / Math.max(sp.canvas.width, sp.canvas.height);
    ctx.drawImage(sp.canvas, x + 12, y + (h - sp.canvas.height * psc) / 2, sp.canvas.width * psc, sp.canvas.height * psc);
    // vector circular arrow — inset off the right edge (was jammed against it)
    const ax = x + w - h * 0.58, ay = y + h / 2, ar = h * 0.24;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(3, ar * 0.45); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ax, ay, ar, Math.PI * 0.45, Math.PI * 1.95); ctx.stroke();
    const ea = Math.PI * 1.95, hx = ax + Math.cos(ea) * ar, hy = ay + Math.sin(ea) * ar;
    ctx.beginPath();
    ctx.moveTo(hx, hy); ctx.lineTo(hx + ar * 0.55, hy - ar * 0.15);
    ctx.moveTo(hx, hy); ctx.lineTo(hx + ar * 0.15, hy + ar * 0.55);
    ctx.stroke();
    ctx.restore();
    this.addHit('cycle', x, y, w, h, null);
  }

  _cancelButton(x, y, w, h) {
    const ctx = this.ctx, u = this.U;
    ctx.save();
    ctx.fillStyle = u.btnDanger; roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = u.btnDangerEdge; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFFFF33'; roundRect(ctx, x + 3, y + 3, w - 6, h * 0.4, 9); ctx.fill();
    const cx = x + w / 2, cy = y + h / 2, m = h * 0.24;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - m, cy - m); ctx.lineTo(cx + m, cy + m);
    ctx.moveTo(cx + m, cy - m); ctx.lineTo(cx - m, cy + m);
    ctx.stroke();
    ctx.restore();
    this.addHit('closePopup', x, y, w, h, null);
  }

  // Static dock chrome baked ONCE (gradient + rail + stripes + wordmark), blitted
  // each frame — no per-frame gradient allocation (keeps the V2 perf model).
  _bakeHudChrome() {
    const u = this.U, W = this.L.hudWidth, H = this.L.canvasH, pad = 24;
    const canvas = makeCanvas(W, H);
    const c = canvas.getContext('2d');
    const dock = c.createLinearGradient(0, 0, 0, H);
    dock.addColorStop(0, u.dockTop); dock.addColorStop(1, u.dockBottom);
    c.fillStyle = dock; c.fillRect(0, 0, W, H);
    c.fillStyle = u.dockEdge; c.fillRect(W - 6, 0, 6, H);
    c.fillStyle = u.accent; c.fillRect(0, 0, W, 7);
    c.fillStyle = u.ribbonB; c.fillRect(0, 7, W, 3);
    // brand wordmark — two-tone candy, NO overlapping v2 badge (bug fixed)
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = `bold 38px ${this.F.display}`;
    c.fillStyle = u.title; c.fillText('Cute', pad, 54);
    const cw = c.measureText('Cute').width;
    c.fillStyle = '#FFF1F6'; c.fillText('Defense', pad + cw, 54);
    this.hudChrome = canvas;
  }

  // ---- HUD (left dock) ----
  _hud(state) {
    const ctx = this.ctx, u = this.U;
    const W = this.L.hudWidth, H = this.L.canvasH, pad = 24;
    if (!this.hudChrome) this._bakeHudChrome();
    ctx.drawImage(this.hudChrome, 0, 0);

    // hero LIVES card
    this._heroLives(state, pad, 80, W - pad * 2, 100);
    // WAVE | COINS chips
    this._waveCoinChips(state, pad, 196);

    // selection card
    const y = 286;
    const tower = state.selected.kind === 'tower' ? state.towers.find(t => t.id === state.selected.id) : null;
    const enemy = state.selected.kind === 'enemy' ? state.enemies.find(e => e.id === state.selected.id) : null;
    if (tower) this._towerCard(state, tower, pad, y, W - pad * 2);
    else if (enemy) this._enemyCard(enemy, pad, y, W - pad * 2);
    else {
      this._card(pad, y, W - pad * 2, 120);
      ctx.fillStyle = u.textOnCard; ctx.font = `20px ${this.F.body}`; ctx.textAlign = 'center';
      ctx.fillText('Tap a spot to plop a buddy', W / 2, y + 52);
      ctx.fillStyle = '#9A86B8'; ctx.font = `17px ${this.F.body}`;
      ctx.fillText('tap a buddy to manage', W / 2, y + 80);
    }

    // control row (bottom)
    const by = H - 96, bw = (W - pad * 2 - 16) / 2;
    this._button(pad, by, bw, 64, state.status === 'paused' ? 'Resume' : 'Pause', u.btnInfo, 'pause', null, true, { edge: u.btnInfoEdge });
    this._button(pad + bw + 16, by, bw, 64, state.soundEnabled ? 'Sound' : 'Muted', state.soundEnabled ? u.btnPrimary : u.btnDisabled, 'sound', null, true, { edge: state.soundEnabled ? u.btnPrimaryEdge : u.btnDisabledEdge });
  }

  _heroLives(state, HX, HY, HW, HH) {
    const ctx = this.ctx, u = this.U;
    const lf = Math.max(0, (state.livesFlashUntil - state.clock) / 600);   // 1->0 ouch
    const low = state.lives > 0 && state.lives <= 5;
    const beat = low ? 0.5 + 0.5 * Math.sin(state.clock / 280) : 0;
    const dx = lf > 0 ? Math.sin(state.clock / 28) * 7 * lf : 0;
    // card
    this._card(HX, HY, HW, HH, u.cardBg, u.pinkSoft);
    ctx.save(); roundRect(ctx, HX, HY, HW, 10, this.U.radCard); ctx.clip();
    ctx.fillStyle = u.accent; ctx.fillRect(HX, HY, HW, 10); ctx.restore();
    // heart (baked frame + cheap transform)
    const sp = this.sprites.heart(lf > 0.4 ? 'hurt' : 'normal');
    const hs = 1 + lf * 0.35 + beat * 0.12;
    ctx.save(); ctx.translate(HX + 48 + dx, HY + 52); ctx.scale(hs, hs); ctx.drawImage(sp.canvas, -sp.cx, -sp.cy); ctx.restore();
    // label + number
    ctx.save(); ctx.translate(dx, 0); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = u.pink; ctx.font = `bold 15px ${this.F.display}`; ctx.fillText('LIVES', HX + 88, HY + 24);
    ctx.fillStyle = lf > 0 ? mix('#5A3D6B', '#E23B5B', Math.min(1, lf)) : (low ? '#D23B6B' : u.textOnCard);
    ctx.font = `bold 44px ${this.F.body}`; ctx.fillText(String(state.lives), HX + 88, HY + 38);
    ctx.restore();
    // candy meter
    const mx = HX + 90, my = HY + 84, mw = HW - 116, mh = 8, frac = Math.max(0, state.lives / this.cfg.lives.max);
    ctx.fillStyle = '#EBD9F2'; roundRect(ctx, mx, my, mw, mh, 4); ctx.fill();
    ctx.fillStyle = lf > 0 ? u.pinkDeep : u.heart; roundRect(ctx, mx, my, mw * frac, mh, 4); ctx.fill();
    // red wash on hit
    if (lf > 0) { ctx.save(); ctx.globalAlpha = lf * 0.22; ctx.fillStyle = u.pinkDeep; roundRect(ctx, HX, HY, HW, HH, this.U.radCard); ctx.fill(); ctx.restore(); }
  }

  _waveCoinChips(state, X, Y) {
    const ctx = this.ctx, u = this.U;
    const W = this.L.hudWidth, pad = 24, gap = 14;
    const CW = (W - pad * 2 - gap) / 2, CH = 74, r = this.U.radChip;
    const WX = X, CX = X + CW + gap;

    // wave chip
    const wp = Math.max(0, (state.wavePopUntil - state.clock) / 700);
    const boss = state.wave.isBossWave;
    let cx0 = WX + CW / 2, cy0 = Y + CH / 2, sc = 1 + Math.sin(wp * Math.PI) * 0.22;
    ctx.save(); ctx.translate(cx0, cy0); ctx.scale(sc, sc); ctx.translate(-cx0, -cy0);
    ctx.fillStyle = boss ? u.bossSoft : u.skySoft; roundRect(ctx, WX, Y, CW, CH, r); ctx.fill();
    ctx.strokeStyle = boss ? u.boss : u.skyDeep; ctx.lineWidth = 2; roundRect(ctx, WX, Y, CW, CH, r); ctx.stroke();
    // pennant flag
    ctx.strokeStyle = boss ? u.boss : u.skyDeep; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(WX + 22, Y + 18); ctx.lineTo(WX + 22, Y + 56); ctx.stroke();
    ctx.fillStyle = boss ? u.boss : u.sky;
    ctx.beginPath(); ctx.moveTo(WX + 22, Y + 20); ctx.lineTo(WX + 44, Y + 27); ctx.lineTo(WX + 22, Y + 34); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = boss ? u.boss : u.skyDeep; ctx.font = `bold 13px ${this.F.display}`;
    ctx.fillText(boss ? 'BOSS' : 'WAVE', WX + 54, Y + 16);
    ctx.fillStyle = '#2B5A72'; ctx.font = `bold 26px ${this.F.body}`;
    ctx.fillText(state.wave.index > 0 ? `${state.wave.index}/${this.publicWaves}` : 'Soon', WX + 54, Y + 34);
    ctx.restore();

    // coins chip
    const pulse = Math.max(0, Math.min(1, (state.coinPulseEnd - state.clock) / 500));
    ctx.fillStyle = u.goldSoft; roundRect(ctx, CX, Y, CW, CH, r); ctx.fill();
    ctx.strokeStyle = u.goldDeep; ctx.lineWidth = 2; roundRect(ctx, CX, Y, CW, CH, r); ctx.stroke();
    const flip = pulse > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(pulse * Math.PI * 2)) : 1;
    ctx.save(); ctx.translate(CX + 28, Y + 37); ctx.scale(flip, 1);
    ctx.fillStyle = this.G.base; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.G.deep; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#FFF7CC'; ctx.beginPath(); ctx.arc(-4, -4, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = u.goldDeep; ctx.font = `bold 13px ${this.F.display}`; ctx.fillText('COINS', CX + 54, Y + 16);
    ctx.save(); ctx.translate(CX + 54, Y + 32); ctx.scale(1 + pulse * 0.3, 1 + pulse * 0.3);
    ctx.fillStyle = pulse > 0 ? '#FFB300' : '#7A5A12'; ctx.font = `bold 26px ${this.F.body}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(state.coins), 0, 0); ctx.restore();
    // "+N bonus" float rising above the coins chip
    if (state.bonusFloat && state.clock < state.bonusFloat.untilClock) {
      const p = (state.bonusFloat.untilClock - state.clock) / 1400;
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.5);
      ctx.fillStyle = this.G.base; ctx.font = `bold 20px ${this.F.display}`; ctx.textAlign = 'left';
      ctx.fillText(`+${state.bonusFloat.amount} bonus!`, CX + 6, Y - 6 - (1 - p) * 24); ctx.restore();
    }
  }

  _card(x, y, w, h, bg, border) {
    const ctx = this.ctx;
    ctx.fillStyle = bg ?? this.U.cardBg; roundRect(ctx, x, y, w, h, this.U.radCard); ctx.fill();
    ctx.strokeStyle = border ?? this.U.cardBorder; ctx.lineWidth = 2; ctx.stroke();
  }

  _towerCard(state, tower, x, y, w) {
    const ctx = this.ctx, u = this.U;
    this._card(x, y, w, 230);
    const def = this.cfg.towers[tower.typeId];
    const st = def.levels[tower.level - 1];
    const sp = this.sprites.tower(tower.typeId, tower.level);
    const pscale = Math.min(1, 70 / Math.max(sp.canvas.width, sp.canvas.height));
    ctx.drawImage(sp.canvas, x + 20, y + 20, sp.canvas.width * pscale, sp.canvas.height * pscale);
    ctx.fillStyle = u.textOnCard; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold 24px ${this.F.display}`;
    ctx.fillText(`${def.name}  L${tower.level}`, x + 110, y + 22);
    ctx.font = `18px ${this.F.body}`; ctx.fillStyle = '#7C6A95';
    ctx.fillText(`Damage ${st.bombDamage ?? st.damage}   Range ${st.range}`, x + 110, y + 56);
    ctx.fillText(`Fire ${(st.fireRateMs / 1000).toFixed(2)}s${def.kind === 'aoe' ? '   AoE' : ''}`, x + 110, y + 82);
    const next = def.levels[tower.level];
    const upCost = next ? next.cost : null;
    const canUp = next && state.coins >= upCost;
    this._button(x + 16, y + 120, w - 32, 44, next ? `Upgrade  ${upCost}c` : 'Max level', canUp ? u.btnPrimary : u.btnDisabled, 'upgrade', null, !!canUp, { edge: canUp ? u.btnPrimaryEdge : u.btnDisabledEdge });
    const refund = Math.floor(tower.invested * this.cfg.economy.sellRefundFraction);
    this._button(x + 16, y + 172, w - 32, 44, `Sell  +${refund}c`, u.btnWarn, 'sell', null, true, { edge: u.btnWarnEdge });
  }

  _enemyCard(enemy, x, y, w) {
    const ctx = this.ctx, u = this.U;
    this._card(x, y, w, 150);
    const def = this.cfg.enemies[enemy.typeId];
    const sp = this.sprites.enemy(enemy.typeId);
    const pscale = Math.min(1, 70 / Math.max(sp.canvas.width, sp.canvas.height));
    ctx.drawImage(sp.canvas, x + 20, y + 30, sp.canvas.width * pscale, sp.canvas.height * pscale);
    ctx.fillStyle = u.textOnCard; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold 24px ${this.F.display}`;
    ctx.fillText(def.name + (enemy.isBoss ? ' (Boss)' : ''), x + 110, y + 24);
    ctx.font = `18px ${this.F.body}`; ctx.fillStyle = '#7C6A95';
    ctx.fillText(`HP ${Math.ceil(enemy.hp)} / ${enemy.maxHp}`, x + 110, y + 58);
    ctx.fillText(`Reward ${enemy.reward}c   Costs ${enemy.livesCost}♥`, x + 110, y + 84);
  }

  _button(x, y, w, h, label, color, action, data, enabled = true, opts = {}) {
    const ctx = this.ctx;
    const r = opts.radius ?? this.U.radButton;
    ctx.save();
    ctx.globalAlpha = enabled ? 1 : 0.55;
    if (opts.edge) { ctx.fillStyle = opts.edge; roundRect(ctx, x, y + 4, w, h, r); ctx.fill(); }
    ctx.fillStyle = color; roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = '#FFFFFF33'; roundRect(ctx, x + 3, y + 3, w - 6, h * 0.4, Math.max(2, r - 4)); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.min(26, h * 0.42)}px ${this.F.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
    if (enabled && action) this.addHit(action, x, y, w, h, data);
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
    if (a.kind === 'boss') { color = this.FX.annBoss; size = 56; }
    else if (a.kind === 'countdown') { color = this.U.pinkDeep; size = 52; } // urgency hue — gold stays "coins only"
    else if (a.kind === 'complete') { color = this.FX.annComplete; size = 50; }
    ctx.font = `bold ${size}px ${this.F.display}`;
    // soft white halo instead of a hard +3/+3 black offset (slop tell)
    ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFFCC'; ctx.strokeText(a.text, cx, cy);
    ctx.fillStyle = color; ctx.fillText(a.text, cx, cy);
    ctx.restore();
  }

  // ---- overlays ----
  _pause(state) {
    const ctx = this.ctx;
    ctx.fillStyle = this.U.scrim + 'B0'; ctx.fillRect(0, 0, this.L.canvasW, this.L.canvasH);
    ctx.fillStyle = this.G.base; ctx.font = `bold 80px ${this.F.display}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Paused', this.L.canvasW / 2, this.L.canvasH / 2 - 40);
    this._centerButton('Resume', this.L.canvasH / 2 + 60, this.U.btnPrimary, 'pause', this.U.btnPrimaryEdge);
  }

  _overlay(state) {
    const ctx = this.ctx, won = state.status === 'won';
    // frosted scrim so the cuties stay visible (win = cream wash, lose = light
    // grape veil — both keep the board lively, never mud-black)
    ctx.fillStyle = won ? '#FFF7F0CC' : '#5B4CA0AB'; ctx.fillRect(0, 0, this.L.canvasW, this.L.canvasH);
    const cx = this.L.canvasW / 2;
    // report card
    const cardW = 560, cardH = 470, cardX = cx - cardW / 2, cardY = this.L.canvasH / 2 - cardH / 2;
    ctx.fillStyle = '#FFF9F2'; roundRect(ctx, cardX, cardY, cardW, cardH, this.U.radPanel); ctx.fill();
    ctx.fillStyle = won ? this.U.accent : this.U.pinkDeep;
    ctx.save(); roundRect(ctx, cardX, cardY, cardW, 14, this.U.radPanel); ctx.clip(); ctx.fillRect(cardX, cardY, cardW, 14); ctx.restore();
    let cy = cardY + 70;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 64px ${this.F.display}`; ctx.fillStyle = won ? this.FX.win : this.FX.lose;
    ctx.fillText(won ? 'You did it!' : 'Aww, they got through', cx, cy);
    // run stats, in voice
    const s = state.stats;
    const lines = [
      `Waves cleared:  ${s.wavesCleared} / ${this.publicWaves}`,
      `Buddies plopped:  ${s.towersBuilt}`,
      `Cuties booped:  ${s.enemiesKilled}`,
      `Coins gathered:  ${s.coinsEarned}`,
      `Hearts kept:  ${state.lives}`,
      `Time played:  ${(s.elapsedMs / 1000).toFixed(0)}s`,
    ];
    cy += 70; ctx.font = `26px ${this.F.body}`; ctx.fillStyle = this.U.textOnCard;
    for (const ln of lines) { ctx.fillText(ln, cx, cy); cy += 40; }
    this._centerButton('Play Again', cy + 30, this.U.btnPrimary, 'playAgain', this.U.btnPrimaryEdge);
  }

  _centerButton(label, cy, color, action, edge) {
    const w = 320, h = 72, x = this.L.canvasW / 2 - w / 2, y = cy - h / 2;
    this._button(x, y, w, h, label, color, action, null, true, { edge });
  }

  // ---- start menu ----
  _startMenu(state) {
    const ctx = this.ctx, W = this.L.canvasW, H = this.L.canvasH, u = this.U;
    const t = state.menuClock || 0;

    // baked pastel backdrop (sky gradient + hills) — one drawImage
    if (!this.menuLayer) this._bakeMenuBg();
    ctx.drawImage(this.menuLayer, 0, 0);

    // drifting baked clouds
    const cloud = this.sprites.cloud(), cw = cloud.canvas.width;
    for (const [baseX, y, spd, sc] of [[W * 0.18, H * 0.16, 0.012, 1], [W * 0.62, H * 0.10, 0.008, 0.8]]) {
      const x = ((baseX + t * spd) % (W + cw)) - cw / 2;
      ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.drawImage(cloud.canvas, -cloud.cx, -cloud.cy); ctx.restore();
    }

    // HD portrait cast — layout: enemy | basic tower | BIG enemy (centre) |
    // strong tower | enemy. Enemies are angry (mirror the in-game look) and gnash;
    // towers stay happy. Arc puts the big centre baddie highest.
    const cast = [
      { kind: 'enemy', type: 'fast',       r: 70 },              // teal diamond
      { kind: 'tower', type: 'basic',      r: 84, level: 2 },    // blue circle tower
      { kind: 'enemy', type: 'boss_split', r: 104, hero: true }, // orange star boss — largest centre
      { kind: 'tower', type: 'strong',     r: 84, level: 2 },    // purple square tower (not shown before)
      { kind: 'enemy', type: 'basic',      r: 70 },              // red circle
    ];
    const n = cast.length, span = W * 0.62, bandY = H * 0.54, x0 = W / 2 - span / 2;
    cast.forEach((mch, i) => {
      const fx = i / (n - 1);
      const cx = x0 + fx * span;
      const arc = -Math.cos((fx - 0.5) * Math.PI) * (H * 0.05);
      const bob = Math.sin(t / 600 + i * 0.8) * 9;
      const cy = bandY + arc + bob;
      // frame: enemies cycle an angry snarl (frame 2) + occasional blink; towers just blink
      let frame = 0, snarling = false;
      if (mch.kind === 'enemy') {
        const gnash = (t + i * 500) % 2200;
        if (gnash < 360) { frame = 2; snarling = true; }
        else if (((t + i * 700) % (3000 + i * 220)) < 110) frame = 1;
      } else if (((t + i * 700) % (3000 + i * 220)) < 110) {
        frame = 1;
      }
      const sp = this.sprites.portrait(mch.kind, mch.type, { r: mch.r, level: mch.level || 1, mood: 'happy', frame });
      let s = mch.hero ? 1 + Math.sin(t / 760) * 0.025 : 1;
      if (snarling) s *= 1.06;                                   // a little lunge when it snarls
      const jit = snarling ? Math.sin(t / 38) * 3 : 0;           // tiny angry shimmy
      ctx.save(); ctx.translate(cx + jit, cy); ctx.scale(s, s); ctx.drawImage(sp.canvas, -sp.cx, -sp.cy); ctx.restore();
    });

    // baked two-font title with idle bounce — tagline removed
    const title = this.sprites.menuTitle();
    const ty = H * 0.21 + Math.sin(t / 520) * 7;
    ctx.drawImage(title.canvas, W / 2 - title.cx, ty - title.cy);

    // candy CTA buttons (primary Play, secondary Sound)
    this._menuButton(W / 2 - 210, H * 0.76, 420, 104, 'Play', u.btnPrimary, u.btnPrimaryEdge, '#7BE0A3', 'play', true);
    const on = state.soundEnabled;
    this._menuButton(W / 2 - 150, H * 0.76 + 124, 300, 80,
      on ? 'Sound: On' : 'Sound: Off',
      on ? u.btnInfo : u.btnDisabled, on ? u.btnInfoEdge : u.btnDisabledEdge, on ? '#9FD0F5' : '#C7CDD8', 'sound', false);
  }

  _menuButton(x, y, w, h, label, face, rim, hi, action, withPlayIcon) {
    const ctx = this.ctx, r = h / 2;
    ctx.save();
    ctx.fillStyle = rim; roundRect(ctx, x, y + 6, w, h, r); ctx.fill();      // 3D bottom rim
    ctx.fillStyle = face; roundRect(ctx, x, y, w, h, r); ctx.fill();          // face
    ctx.globalAlpha = 0.9; ctx.fillStyle = hi;
    roundRect(ctx, x + r * 0.5, y + h * 0.16, w - r, h * 0.22, h * 0.11); ctx.fill(); // sheen
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(h * 0.42)}px ${this.F.display}`;
    const lx = withPlayIcon ? x + w / 2 + h * 0.18 : x + w / 2;
    ctx.fillText(label, lx, y + h / 2 + 1);
    if (withPlayIcon) {                              // baked-look vector play triangle (no emoji)
      const tx = x + w / 2 - ctx.measureText(label).width / 2 - h * 0.30, ty = y + h / 2, s = h * 0.18;
      ctx.beginPath(); ctx.moveTo(tx, ty - s); ctx.lineTo(tx + s * 1.1, ty); ctx.lineTo(tx, ty + s); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    this.addHit(action, x, y, w, h);
  }

  _bakeMenuBg() {
    const W = this.L.canvasW, H = this.L.canvasH, u = this.U;
    const canvas = makeCanvas(W, H);
    const c = canvas.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, u.menuSky); sky.addColorStop(0.55, u.menuSkyMid); sky.addColorStop(1, u.menuSkyBot);
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(W / 2, H * 0.30, 30, W / 2, H * 0.30, W * 0.32);
    sun.addColorStop(0, '#FFF7E8AA'); sun.addColorStop(1, '#FFF7E800');
    c.fillStyle = sun; c.beginPath(); c.arc(W / 2, H * 0.30, W * 0.32, 0, Math.PI * 2); c.fill();
    c.fillStyle = u.menuHillBack; this._hill(c, H * 0.74, H * 0.10);
    c.fillStyle = u.menuHillFront; this._hill(c, H * 0.82, H * 0.14);
    this.menuLayer = canvas;
  }
  _hill(c, baseY, amp) {
    const W = this.L.canvasW, H = this.L.canvasH;
    // Build the silhouette edge-to-edge and land exactly on baseY at BOTH ends so
    // there's no stray diagonal to the corner (the old "drop-off"). A gentle
    // secondary undulation makes it read as natural rolling hills.
    c.beginPath(); c.moveTo(0, H); c.lineTo(0, baseY);
    for (let x = 20; x <= W; x += 20) {
      const u = x / W;
      const edge = Math.sin(u * Math.PI);                       // 0 at both edges, 1 at centre
      const roll = 0.85 + 0.15 * Math.sin(u * Math.PI * 3 + 0.6); // soft rolling undulation
      c.lineTo(x, baseY - edge * amp * roll);
    }
    c.lineTo(W, baseY); c.lineTo(W, H); c.closePath(); c.fill();
  }
}

export default Renderer;
