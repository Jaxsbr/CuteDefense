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
import { SpriteCache, roundRect, flagMask, drawFlagGlyph, drawForkIcon } from './SpriteCache.js';
import { makeCanvas, darken, lighten } from './shapes.js';
import { mix } from './colors.js';
import { effectiveStats, forkArmsFor, forkLabel, towerTypeIds, towerCardLines } from '../sim/systems/towerSystem.js';
import { fmtStat, fitFontPx } from './format.js';
import { trayCostLayout, buyCostLayout } from './trayLayout.js';
import { freezeSlotRect, freezeUiState, ultimateSlotRect, ultimateUiState, hasBossTower } from './abilityHud.js';

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
    this._warmE = new Set();   // enemy (typeId:flagmask) variants whose frames are pre-baked
    this._warmT = new Set();   // tower type:level whose frames are pre-baked
    // P2: bit of the sole live-animated flag (evasive shimmer) in the stable order.
    this._evasiveBit = 1 << (config.enemyFlags?.order?.indexOf('evasive') ?? -1);
    this.hits = [];            // [{action, x, y, w, h, data}]
    this._restartArmed = false; // W7 — two-tap arm for the in-game RESTART button
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
    this._napBeams(state);
    this._enemies(state);
    this._towers(state);
    this._projectiles(state);
    this._beams(state);
    this._effects(state);
    this._coins(state);
    this._freezeField(state);
    this._crosshair(state);
    this._placement(state);
    this._hud(state);
    this._announcement(state);
    if (state.status === 'paused') this._pauseFrame(state);
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
      // P2: variant key is (typeId, flagmask). flagmask is static per enemy, so
      // cache it once on the entity (render-only field; sim never reads it).
      if (e._flagmask === undefined) e._flagmask = flagMask(this.cfg, e.flags);
      const mask = e._flagmask;
      const wk = `${e.typeId}:${mask}`;
      if (!this._warmE.has(wk)) {                  // pre-bake neutral + ouch once per variant
        this._warmE.add(wk);
        this.sprites.enemy(e.typeId, 'neutral', mask);
        this.sprites.enemy(e.typeId, 'ouch', mask);
      }
      const frame = (!e.dying && e.ouchMs > 0) ? 'ouch' : 'neutral';
      const sp = this.sprites.enemy(e.typeId, frame, mask);
      const { x, y } = this.toScreen(e.x, e.y);
      let scale = 1, alpha = 1;
      if (e.dying) { const t = Math.min(1, e.deathMs / 500); scale = 1 + t * 0.5; alpha = 1 - t; }
      // P2: the ONE live-animated flag — evasive shimmer is a cheap alpha pulse
      // (single Math.sin per evasive enemy/frame; the only non-blit per-frame cost).
      if (!e.dying && (mask & this._evasiveBit)) alpha *= 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(e.animTime * 0.012));
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
      const wk = `${t.typeId}:${t.level}:${t.fork || '-'}`;
      if (!this._warmT.has(wk)) {                  // pre-bake all 4 frames once per type/level/fork
        this._warmT.add(wk);
        for (const f of ['neutral', 'shock', 'blink', 'blush']) this.sprites.tower(t.typeId, t.level, f, t.fork);
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
      const sp = this.sprites.tower(t.typeId, t.level, frame, t.fork);
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
      // P3 nap: a "zzz" sleepy bubble + integer wake countdown so the recovery is
      // dead-obvious (the tower is napping, not broken). Cheap text/arc, no blur.
      if (t.stunnedUntil > state.clock) {
        const sec = Math.ceil((t.stunnedUntil - state.clock) / 1000);
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#EAF4FF'; ctx.strokeStyle = '#7FB4E6'; ctx.lineWidth = 2;
        roundRect(ctx, x + 8, y - tile * 0.55, 52, 34, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5B86B8'; ctx.font = `bold 20px ${this.F.display}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('z', x + 26, y - tile * 0.55 + 14);
        ctx.fillStyle = '#3E6FA0'; ctx.font = `bold 22px ${this.F.body}`;
        ctx.fillText(sec, x + 46, y - tile * 0.55 + 14);
        ctx.restore();
      }
      // selection range circle — shared minimal white/dashed style (was harsh yellow).
      // W8: a fullMap tower (the boss) sees the WHOLE board, so a finite ring would be
      // noise — skip it; the selection card carries the affordance instead.
      if (state.selected.kind === 'tower' && state.selected.id === t.id && !this.cfg.towers[t.typeId].fullMap) {
        const range = effectiveStats(state, t).range;   // P4: Sniper fork extends the ring
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
        // P2 affinity tell (non-numeric): right tool -> a big bright SPLAT; wrong
        // tool -> a small dim TINK + sad blue puff (it "bounced"); neutral -> normal.
        ctx.save(); ctx.globalAlpha = 1 - t;
        if (effect.affinity === 'strong') {
          ctx.fillStyle = effect.crit ? this.G.base : '#FFE89A';
          ctx.beginPath(); ctx.arc(x, y, 6 + t * 14, 0, Math.PI * 2); ctx.fill();
        } else if (effect.affinity === 'weak') {
          ctx.strokeStyle = '#9FB4D8'; ctx.lineWidth = 2; ctx.globalAlpha = (1 - t) * 0.7;
          ctx.beginPath(); ctx.arc(x, y, 3 + t * 5, 0, Math.PI * 2); ctx.stroke();   // tink ring (bounce)
        } else {
          ctx.fillStyle = effect.crit ? this.G.base : '#fff';
          ctx.beginPath(); ctx.arc(x, y, 4 + t * 8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  // V2.2 — the streaming boss BEAM: a thick ember line from each casting tower to its
  // live target with a little per-frame jitter + a small impact glow. Cheap (a couple
  // of strokes + one arc per beam, no blur/gradient). DoT lifetime is owned by the sim.
  _beams(state) {
    if (!state.beams || state.beams.length === 0) return;
    const ctx = this.ctx, U = this.U;
    for (const beam of state.beams) {
      const a = this.toScreen(beam.x, beam.y);
      const b = this.toScreen(beam.tx, beam.ty);
      const jit = Math.sin(state.clock / 40 + beam.id) * 2;   // subtle shimmer
      ctx.save();
      ctx.lineCap = 'round';
      // outer ember glow
      ctx.globalAlpha = 0.35; ctx.strokeStyle = beam.color || U.ultActive; ctx.lineWidth = (beam.widthPx || 12) + 6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + jit, b.y - jit); ctx.stroke();
      // hot core
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#FFF1E0'; ctx.lineWidth = Math.max(2, (beam.widthPx || 12) * 0.45);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + jit, b.y - jit); ctx.stroke();
      // impact glow on the target
      ctx.globalAlpha = 0.6; ctx.fillStyle = beam.color || U.ultReady;
      ctx.beginPath(); ctx.arc(b.x, b.y, (beam.widthPx || 12) * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // V2.2 — aim-confirm crosshair while the boss beam is armed. Mobile-legible: a
  // contrasting crosshair is drawn over EVERY tappable enemy (the "tap one" affordance),
  // plus one at the pointer on desktop. No hover/tooltip text (kid + mobile friendly).
  _crosshair(state) {
    if (!state.ultimateAiming) return;
    const ctx = this.ctx, U = this.U;
    const draw = (sx, sy, r) => {
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - r * 1.5, sy); ctx.lineTo(sx + r * 1.5, sy);
      ctx.moveTo(sx, sy - r * 1.5); ctx.lineTo(sx, sy + r * 1.5);
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = U.ultReady; ctx.lineWidth = 3;
    for (const e of state.enemies) {
      if (!e.alive || e.reachedGoal) continue;
      const { x, y } = this.toScreen(e.x, e.y);
      draw(x, y, this.L.tile * 0.42);
    }
    if (this.pointer) { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#FFF1E0'; draw(this.pointer.x, this.pointer.y, this.L.tile * 0.3); }
    ctx.restore();
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
    const ids = towerTypeIds(this.cfg);
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
    // gold coin + cost — measured right-anchored group so any digit count clears the edge.
    const costFontPx = this.cfg.visual.buyButton?.costFontPx ?? 30;
    const costTxt = fmtStat(cost, 0);
    ctx.font = `bold ${costFontPx}px ${this.F.body}`;
    const cw = ctx.measureText(costTxt).width;
    const L = buyCostLayout(this.cfg, w, cw);
    const coinX = x + L.coinX, coinY = y + h / 2;
    ctx.fillStyle = this.G.base; ctx.beginPath(); ctx.arc(coinX, coinY, L.coinR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.G.deep; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFDE7'; ctx.beginPath(); ctx.arc(coinX - 5, coinY - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = afford ? '#FFFFFF' : '#FFD6D6';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(costTxt, x + L.costRight, coinY + 1);
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

    // W4 — ABILITY slot (always drawn so the dock never jumps): the field-freeze
    // power, parked in the dock gutter OFF the play grid. Eyebrow label groups it
    // as a power, distinct from the admin Pause/Sound row at the very bottom.
    const ab = freezeSlotRect(this.L, this.cfg);
    ctx.fillStyle = u.abilityLabel; ctx.font = `bold 14px ${this.F.display}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ABILITY', ab.x + 2, ab.y - this.cfg.visual.ability.labelGap + 14);
    this._freezeAbility(state, ab.x, ab.y, ab.w, ab.h);

    // W8 — the SECOND ability (the boss-tower ULTIMATE), stacked above Freeze in the
    // same dock gutter. Drawn ONLY once a boss tower exists, so the dock never carries
    // a dead control before the late game.
    if (hasBossTower(state)) {
      const ub = ultimateSlotRect(this.L, this.cfg);
      ctx.fillStyle = u.abilityLabel; ctx.font = `bold 14px ${this.F.display}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('ULTIMATE', ub.x + 2, ub.y - this.cfg.visual.ability.labelGap + 14);
      this._ultimateAbility(state, ub.x, ub.y, ub.w, ub.h);
    }

    // tap-once build tray (above the control row)
    this._tray(state);

    // control row (bottom) — three equal cells: Pause/Play | Sound/Muted | Restart.
    // W7 added the restart cell; the 2->3 split leaves the same gutter (16px) so a
    // later item (W8 ultimate) can re-flow this row. The restart cell is in-game
    // only (playing/paused) — won/lost/menu route restart through their own flows.
    const by = H - 96, gap = 16, bw = (W - pad * 2 - gap * 2) / 3;
    this._button(pad, by, bw, 64, state.status === 'paused' ? 'Play' : 'Pause', u.btnInfo, 'pause', null, true, { edge: u.btnInfoEdge });
    this._button(pad + bw + gap, by, bw, 64, state.soundEnabled ? 'Sound' : 'Muted', state.soundEnabled ? u.btnPrimary : u.btnDisabled, 'sound', null, true, { edge: state.soundEnabled ? u.btnPrimaryEdge : u.btnDisabledEdge });
    if (state.status === 'playing' || state.status === 'paused') {
      const armed = this._restartArmed;
      this._button(pad + (bw + gap) * 2, by, bw, 64, armed ? 'Sure?' : '↻',
        armed ? u.btnDanger : u.btnWarn, 'restart', null, true,
        { edge: armed ? u.btnDangerEdge : u.btnWarnEdge });
    } else {
      this._restartArmed = false; // leaving play disarms a stray pending confirm
    }
  }

  // W7 — two-tap arm for the in-game RESTART (guards the 5-10yo audience from an
  // accidental run loss). First call arms (button repaints 'Sure?'); second call
  // fires and disarms. Renderer-local, mirroring the old ready-valve idiom.
  confirmRestart() {
    if (this._restartArmed) { this._restartArmed = false; return true; }
    this._restartArmed = true;
    return false;
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

  // W6 — draw one card stat line, shrinking the font (down to statMinFontPx) only
  // if it would overflow the card's text budget. Keeps kid-legibility: shrink
  // triggers solely on genuine overflow. `display` picks the bold display face
  // (the gold Power line) over the body face.
  _statLine(text, x, y, maxW, basePx, display = false) {
    const ctx = this.ctx, face = display ? this.F.display : this.F.body;
    const weight = display ? 'bold ' : '';
    const px = fitFontPx(
      (p) => { ctx.font = `${weight}${p}px ${face}`; return ctx.measureText(text).width; },
      basePx, this.cfg.visual.statMinFontPx, maxW);
    ctx.font = `${weight}${px}px ${face}`;
    ctx.fillText(text, x, y);
  }

  _towerCard(state, tower, x, y, w) {
    const ctx = this.ctx, u = this.U;
    // W3: taller card so the L3 fork buttons can carry icon + name + plain-words.
    this._card(x, y, w, 270);
    const def = this.cfg.towers[tower.typeId];
    const sp = this.sprites.tower(tower.typeId, tower.level, 'neutral', tower.fork);
    const pscale = Math.min(1, 70 / Math.max(sp.canvas.width, sp.canvas.height));
    ctx.drawImage(sp.canvas, x + 20, y + 20, sp.canvas.width * pscale, sp.canvas.height * pscale);
    const forkDef = tower.fork ? def.forks[tower.fork] : null;
    ctx.fillStyle = u.textOnCard; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold 23px ${this.F.display}`;
    ctx.fillText(`${forkDef ? forkDef.name : def.name}  L${tower.level}`, x + 110, y + 20);

    // W6: route every displayed number through fmtStat (kills the forked-L3 float
    // spill) via the pure towerCardLines composition; auto-shrink any line that
    // would still exceed the card.
    const F = (n) => fmtStat(n, this.cfg.visual.statDecimals);
    const { statLines, power } = towerCardLines(state, tower, F);
    const maxW = w - 110 - 16;
    ctx.fillStyle = '#7C6A95';
    this._statLine(statLines[0], x + 110, y + 50, maxW, 17);
    this._statLine(statLines[1], x + 110, y + 74, maxW, 17);
    // the single rising "POWER" number (gold, watch-it-grow)
    ctx.fillStyle = this.G.deep;
    this._statLine(power, x + 110, y + 100, maxW, 18, true);

    const next = def.levels[tower.level];
    if (next) {
      // not yet max — the legible Upgrade button (delta already shown above)
      const canUp = state.coins >= next.cost;
      const upLabel = (def.ultimate && next.ultimate) ? `Unlock Ultimate  ${next.cost}c` : `Upgrade  ${next.cost}c`;
      this._button(x + 16, y + 130, w - 32, 44, upLabel, canUp ? u.btnPrimary : u.btnDisabled, 'upgrade', null, canUp, { edge: canUp ? u.btnPrimaryEdge : u.btnDisabledEdge });
    } else if (def.ultimate) {
      // W8 — a maxed BOSS (no next level, no fork arms): an ULTIMATE status pill that
      // reads ready / charging, so the card explains the dock button. Cast happens via
      // the dock ability button, not here (no aim on this card).
      const ready = state.clock >= (tower.ultReadyAt || 0);
      ctx.fillStyle = ready ? u.ultReady : u.ultCooldown;
      roundRect(ctx, x + 16, y + 130, w - 32, 44, this.U.radButton); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 20px ${this.F.display}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ready ? `${def.ultimate.name} READY` : `${def.ultimate.name} charging…`, x + w / 2, y + 152);
    } else {
      // MAX level — the identity FORK choice. W3: icon + name + kid plain-words so
      // a child knows what each arm DOES before tapping (no hover on mobile).
      this._forkRow(state, tower, x + 16, y + 130, w - 32, 58);
    }
    const refund = Math.floor(tower.invested * this.cfg.economy.sellRefundFraction);
    this._button(x + 16, y + 212, w - 32, 44, `Sell  +${refund}c`, u.btnWarn, 'sell', null, true, { edge: u.btnWarnEdge });
  }

  // W3 — two legible fork buttons at L3. Each button is icon (left) + the arm NAME
  // (bold) over a short kid plain-words blurb, so a child knows what the fork DOES
  // before tapping (no hover on mobile). The +{reForkCost}c / ✓ affordance moves to
  // a small top-right corner badge so it no longer occupies the word column. The
  // two-rect hit contract from captureP4.mjs (b) is preserved.
  _forkRow(state, tower, x, y, w, h) {
    const ctx = this.ctx, u = this.U;
    const arms = forkArmsFor(this.cfg, tower.typeId);
    const gap = 12, bw = (w - gap) / 2;
    arms.forEach((arm, i) => {
      const bx = x + i * (bw + gap);
      const chosen = tower.fork === arm;
      const reCost = this.cfg.economy.reForkCost;
      const isReFork = tower.fork != null && !chosen;
      const cost = tower.fork == null ? this.cfg.economy.firstForkCost : (chosen ? 0 : reCost);
      const afford = chosen || state.coins >= cost;
      const lab = forkLabel(this.cfg, tower.typeId, arm) || { name: arm, blurb: '' };
      ctx.save();
      ctx.globalAlpha = afford ? 1 : 0.5;
      ctx.fillStyle = chosen ? u.btnPrimary : u.btnInfo;
      roundRect(ctx, bx, y, bw, h, this.U.radButton); ctx.fill();
      ctx.strokeStyle = chosen ? u.btnPrimaryEdge : u.btnInfoEdge; ctx.lineWidth = chosen ? 4 : 2;
      roundRect(ctx, bx, y, bw, h, this.U.radButton); ctx.stroke();
      // icon on the left
      const iconCx = bx + h * 0.42;
      drawForkIcon(ctx, arm, iconCx, y + h / 2, h * 0.30);
      // name (bold display) over blurb (small muted body) to the right of the icon
      const tx = bx + h * 0.8;
      const txMax = bx + bw - tx - 6;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      this._statLine(lab.name, tx, y + h * 0.42, txMax, 15, true);
      ctx.fillStyle = chosen ? '#EBE3FF' : '#5A4A78';
      this._statLine(lab.blurb, tx, y + h * 0.78, txMax, 12);
      // re-fork / chosen affordance — small badge in the top-right corner
      if (isReFork && cost > 0) {
        ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${this.F.display}`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(`+${cost}c`, bx + bw - 7, y + 5);
      } else if (chosen) {
        ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${this.F.display}`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('✓', bx + bw - 7, y + 4);
      }
      ctx.restore();
      // a fork is legal on the chosen arm too (no-op), but only register when it would change
      if (afford && !chosen) this.addHit('fork', bx, y, bw, h, arm);
    });
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
    else if (a.kind === 'bossdown') { color = this.G.deep; size = 56; } // P5 — distinct gold "Boss down!" celebration
    else if (a.kind === 'complete') { color = this.FX.annComplete; size = 50; }
    ctx.font = `bold ${size}px ${this.F.display}`;
    // soft white halo instead of a hard +3/+3 black offset (slop tell)
    ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFFCC'; ctx.strokeText(a.text, cx, cy);
    ctx.fillStyle = color; ctx.fillText(a.text, cx, cy);
    ctx.restore();
    // P2 Tactical Recon: a threat glyph + entry arrow under the banner (clear of the
    // ready-valve chip), so a kid sees WHICH tool and WHERE before the wave (picture,
    // never a number).
    if ((a.threats && a.threats.length) || a.threat || a.entry === 'end') this._reconBanner(a, cx, this.L.gridOffsetY + 360);
  }

  // W2 — pre-wave flag LEGEND: one row per incoming flag (glyph disc + 1-word
  // label + plain-words effect), then an entry row when the wave comes from
  // behind. Pictures-first words, no hover. Layout + copy come from
  // cfg.enemyFlags.recon / .defs — no magic numbers or hardcoded strings here.
  _reconBanner(a, cx, cy) {
    const ctx = this.ctx;
    const rc = this.cfg.enemyFlags.recon;
    const defs = this.cfg.enemyFlags.defs;
    const flags = (a.threats && a.threats.length) ? a.threats : (a.threat ? [a.threat] : []);
    const rows = [];
    for (const f of flags) { const d = defs[f]; if (d) rows.push({ glyph: d.glyph, label: d.label, legend: d.legend }); }
    if (a.entry === 'end') rows.push({ entry: true, label: rc.entryLabel });
    if (!rows.length) return;

    const gr = rc.glyphR, pad = rc.padY;
    ctx.save(); ctx.textBaseline = 'middle';
    let y = cy;
    for (const row of rows) {
      // measure so each row centers on cx (no fixed block width / magic numbers)
      ctx.font = `bold ${rc.labelSize}px ${this.F.display}`;
      const labelW = ctx.measureText(row.label).width;
      ctx.font = `${rc.legendSize}px ${this.F.body}`;
      const legendW = row.legend ? ctx.measureText(row.legend).width : 0;
      const rowW = gr * 2 + pad + labelW + (row.legend ? pad + legendW : 0);
      let x = cx - rowW / 2;
      const gcx = x + gr;
      if (row.entry) {
        // reverse-entry arrow: enemies come from the far (right) end heading left
        ctx.strokeStyle = '#5B3FA0'; ctx.fillStyle = '#8B6FE0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(gcx + gr, y); ctx.lineTo(gcx - gr * 0.4, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gcx - gr, y); ctx.lineTo(gcx - gr * 0.2, y - gr * 0.6); ctx.lineTo(gcx - gr * 0.2, y + gr * 0.6); ctx.closePath(); ctx.fill();
      } else if (row.glyph) {
        drawFlagGlyph(ctx, row.glyph, gcx, y, gr);
      }
      x += gr * 2 + pad;
      // label (bold) + legend (lighter), each with a soft white halo for legibility
      ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFFD9';
      ctx.font = `bold ${rc.labelSize}px ${this.F.display}`;
      ctx.strokeText(row.label, x, y); ctx.fillStyle = this.U.pinkDeep; ctx.fillText(row.label, x, y);
      if (row.legend) {
        x += labelW + pad;
        ctx.font = `${rc.legendSize}px ${this.F.body}`;
        ctx.strokeText(row.legend, x, y); ctx.fillStyle = '#5B3FA0'; ctx.fillText(row.legend, x, y);
      }
      y += rc.rowGap;
    }
    ctx.restore();
  }

  // ---- pause frame (non-occluding: thin candy border, NO scrim) ----
  // The board, enemies and towers stay fully visible behind the frame so a kid
  // can inspect; building is blocked in the sim, so the frame shows no build
  // affordance. A small label + big Play button make resuming obvious.
  _pauseFrame(state) {
    const ctx = this.ctx, u = this.U;
    const x = this.L.gridOffsetX, y = this.L.gridOffsetY;
    const w = this.L.canvasW - x, h = this.L.canvasH - y;
    ctx.save();
    ctx.strokeStyle = u.accent; ctx.lineWidth = 10; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    ctx.strokeStyle = '#FFFFFFAA'; ctx.lineWidth = 3; ctx.strokeRect(x + 11, y + 11, w - 22, h - 22);
    // label pill, top-centre of the board
    const lx = x + w / 2, ly = y + 44;
    ctx.fillStyle = u.popupPanel; roundRect(ctx, lx - 170, ly - 24, 340, 48, 24); ctx.fill();
    ctx.strokeStyle = u.accent; ctx.lineWidth = 3; roundRect(ctx, lx - 170, ly - 24, 340, 48, 24); ctx.stroke();
    ctx.fillStyle = u.textOnCard; ctx.font = `bold 24px ${this.F.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Paused — tap Play to resume', lx, ly);
    ctx.restore();
    // big Play button, bottom-centre of the board
    const bw = 280, bh = 76, bx = x + w / 2 - bw / 2, by = this.L.canvasH - bh - 28;
    this._button(bx, by, bw, bh, 'Play', u.btnPrimary, 'pause', null, true, { edge: u.btnPrimaryEdge });
  }

  // ---- tap-once build tray (N icons in the HUD dock; selected type highlighted) ----
  // W8: the tray grows to N columns so a new tower type (the boss) auto-appears —
  // towerTypeIds() already discovers it; the cell width divides evenly across N.
  _tray(state) {
    const ctx = this.ctx, u = this.U;
    const W = this.L.hudWidth, H = this.L.canvasH, pad = 24, gap = 16;
    const ids = towerTypeIds(this.cfg);
    const n = Math.max(1, ids.length);
    const ty = H - 180;
    ids.forEach((id, i) => {
      const sp = this.sprites.tower(id, 1);
      const L = trayCostLayout(this.cfg, n, sp.canvas.width, sp.canvas.height);
      const bw = L.bw, th = L.th;
      const x = pad + i * (bw + gap), def = this.cfg.towers[id];
      const sel = state.trayType === id, cost = def.levels[0].cost, afford = state.coins >= cost;
      ctx.save();
      ctx.globalAlpha = afford ? 1 : 0.55;
      ctx.fillStyle = sel ? def.color : u.cardBg; roundRect(ctx, x, ty, bw, th, 14); ctx.fill();
      ctx.strokeStyle = sel ? darken(def.color, 35) : u.cardBorder; ctx.lineWidth = sel ? 4 : 2;
      roundRect(ctx, x, ty, bw, th, 14); ctx.stroke();
      ctx.drawImage(sp.canvas, x + 12, ty + (th - sp.canvas.height * L.psc) / 2, sp.canvas.width * L.psc, sp.canvas.height * L.psc);
      const costTxt = `${fmtStat(cost, 0)}c`;
      ctx.fillStyle = sel ? '#fff' : u.textOnCard;
      const px = fitFontPx(
        (p) => { ctx.font = `bold ${p}px ${this.F.body}`; return ctx.measureText(costTxt).width; },
        L.baseFontPx, L.minFontPx, L.budget);
      ctx.font = `bold ${px}px ${this.F.body}`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(costTxt, x + L.costRight, ty + th / 2);
      ctx.restore();
      this.addHit('tray', x, ty, bw, th, id);
    });
  }

  // P3 — the disabler's sleepy-beam telegraph: a dashed line from the disabler to
  // the targeted tower that "charges" over the wind-up so the player can read it
  // (and learn "boop the Sleepy first" — discoverable, never required).
  _napBeams(state) {
    const ctx = this.ctx, tile = this.L.tile;
    for (const e of state.enemies) {
      if (!e.alive || !e.bs || e.bs.beamTowerId == null) continue;
      const t = state.towers.find(tw => tw.id === e.bs.beamTowerId);
      if (!t) continue;
      const a = this.toScreen(e.x, e.y), b = this.toScreen(t.x, t.y);
      const total = this.cfg.nap.telegraphMs;
      const charge = total > 0 ? Math.max(0, Math.min(1, 1 - (e.bs.beamFireAt - state.clock) / total)) : 1;
      ctx.save();
      ctx.globalAlpha = 0.35 + charge * 0.45;
      ctx.strokeStyle = '#9AD0FF'; ctx.lineWidth = 3 + charge * 4; ctx.lineCap = 'round';
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -(state.clock / 40);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#CDEBFF'; ctx.globalAlpha = charge * 0.8;
      ctx.beginPath(); ctx.arc(b.x, b.y, tile * 0.18 * charge, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // P3 — frost field while a freeze is active: a soft icy scrim over the board so
  // the slowed enemies read as "iced". One flat rect, no blur/gradient.
  _freezeField(state) {
    if (state.clock >= state.freeze.activeUntil) return;
    const ctx = this.ctx, x = this.L.gridOffsetX;
    const remain = state.freeze.activeUntil - state.clock;
    const a = 0.10 + 0.10 * Math.min(1, remain / this.cfg.freeze.durationMs);
    ctx.save();
    ctx.fillStyle = '#BFE6FF'; ctx.globalAlpha = a;
    ctx.fillRect(x, 0, this.L.canvasW - x, this.L.canvasH);
    ctx.restore();
  }

  // W4 — the field-freeze ABILITY in its HUD slot. Four distinct looks
  // (READY / ACTIVELY-FREEZING / COOLDOWN / LOCKED) so the power reads at a glance,
  // and the 'freeze' tap is registered ONLY when castFreeze is legal (state==='ready').
  // Geometry comes from freezeSlotRect; state from freezeUiState (both pure, tested).
  _freezeAbility(state, x, y, w, h) {
    const ctx = this.ctx, u = this.U, r = this.U.radButton;
    const a = this.cfg.visual.ability;
    const ui = freezeUiState(state, this.cfg);
    const fill = { ready: u.freezeReady, active: u.freezeActive, cooldown: u.freezeCooldown, locked: u.freezeLocked }[ui];
    const edge = { ready: u.freezeReadyEdge, active: u.freezeActiveEdge, cooldown: u.freezeCooldownEdge, locked: u.freezeLockedEdge }[ui];
    // base panel: edge rim + face + top gloss (no per-frame blur/gradient)
    ctx.save();
    ctx.fillStyle = edge; roundRect(ctx, x, y + 4, w, h, r); ctx.fill();
    ctx.fillStyle = fill; roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = '#FFFFFF33'; roundRect(ctx, x + 3, y + 3, w - 6, h * 0.4, Math.max(2, r - 4)); ctx.fill();
    ctx.restore();

    // COOLDOWN: left->right charge sweep = fraction recharged since last cast (kept from P3).
    // ACTIVELY-FREEZING: depleting bar = remaining/durationMs (the genuinely new feedback).
    if (ui === 'cooldown' || ui === 'active') {
      const frac = ui === 'cooldown'
        ? Math.max(0, Math.min(1, 1 - (state.freeze.readyAt - state.clock) / this.cfg.freeze.cooldownMs))
        : Math.max(0, Math.min(1, (state.freeze.activeUntil - state.clock) / this.cfg.freeze.durationMs));
      ctx.save();
      ctx.globalAlpha = ui === 'cooldown' ? a.sweepAlpha : a.ringAlpha;
      ctx.fillStyle = u.freezeSweep;
      roundRect(ctx, x, y, w, h, r); ctx.clip();
      ctx.fillRect(x, y, w * frac, h);
      ctx.restore();
    }

    // snowflake glyph + label, per state
    const t = state.clock ?? 0, cyg = y + h / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let gScale = 1, gAlpha = 1, label = '', labelColor = '#fff';
    if (ui === 'ready') { gScale = 1 + 0.06 * Math.sin(t / 260); label = 'Freeze!'; }
    else if (ui === 'active') { gScale = 1 + 0.14 * Math.abs(Math.sin(t / 150)); label = 'Brrr!'; }
    else if (ui === 'cooldown') { gAlpha = 0.55; }
    else { gAlpha = 0.5; label = 'zzz'; labelColor = '#FFFFFFCC'; }
    ctx.globalAlpha = gAlpha; ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(h * 0.46 * gScale)}px ${this.F.display}`;
    ctx.fillText('❄', x + h * 0.5, cyg + 1);
    if (label) {
      ctx.globalAlpha = 1; ctx.fillStyle = labelColor;
      ctx.font = `bold ${Math.min(26, h * 0.30)}px ${this.F.display}`;
      ctx.fillText(label, x + h + (w - h) / 2, cyg);
    }
    ctx.restore();

    // affordance <=> legality: register the tap ONLY when castFreeze is legal.
    if (ui === 'ready') this.addHit('freeze', x, y, w, h, null);
  }

  // W8 — the boss-tower ULTIMATE button. Copies the freeze 4-state look but on the
  // hot ember ramp (its own identity), with a per-tower-cooldown sweep. Registers the
  // 'ultimate' hit-rect ONLY when castable (affordance <=> castUltimate legality).
  _ultimateAbility(state, x, y, w, h) {
    const ctx = this.ctx, u = this.U, r = this.U.radButton;
    const a = this.cfg.visual.ability;
    const cfg = this.cfg;
    const ui = ultimateUiState(state);
    const fill = { ready: u.ultReady, active: u.ultActive, cooldown: u.ultCooldown, locked: u.ultLocked }[ui];
    const edge = { ready: u.ultReadyEdge, active: u.ultActiveEdge, cooldown: u.ultCooldownEdge, locked: u.ultLockedEdge }[ui];
    // base panel: edge rim + face + top gloss (no per-frame blur/gradient)
    ctx.save();
    ctx.fillStyle = edge; roundRect(ctx, x, y + 4, w, h, r); ctx.fill();
    ctx.fillStyle = fill; roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = '#FFFFFF33'; roundRect(ctx, x + 3, y + 3, w - 6, h * 0.4, Math.max(2, r - 4)); ctx.fill();
    ctx.restore();

    // COOLDOWN: left->right charge sweep = recharge fraction of the MOST-READY boss
    // tower (the one the button would cast). Cheap clip-fill, no allocation.
    if (ui === 'cooldown') {
      const bosses = state.towers.filter(t => cfg.towers[t.typeId]?.kind === 'boss' && cfg.towers[t.typeId].levels[t.level - 1]?.ultimate);
      const ult = cfg.towers.boss.ultimate;
      const readyAt = Math.min(...bosses.map(t => t.ultReadyAt || 0));
      const frac = Math.max(0, Math.min(1, 1 - (readyAt - state.clock) / ult.cooldownMs));
      ctx.save();
      ctx.globalAlpha = a.sweepAlpha; ctx.fillStyle = u.ultSweep;
      roundRect(ctx, x, y, w, h, r); ctx.clip();
      ctx.fillRect(x, y, w * frac, h);
      ctx.restore();
    }

    // glyph (a hot burst) + label, per state
    const t = state.clock ?? 0, cyg = y + h / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let gScale = 1, gAlpha = 1, label = '', labelColor = '#fff';
    if (ui === 'ready') { gScale = 1 + 0.07 * Math.sin(t / 240); label = 'Beam!'; }
    else if (ui === 'active') { gScale = 1 + 0.16 * Math.abs(Math.sin(t / 130)); label = 'PEW!'; }
    else if (ui === 'cooldown') { gAlpha = 0.55; }
    else { gAlpha = 0.5; label = 'L2?'; labelColor = '#FFFFFFCC'; }   // locked: hint that the upgrade unlocks it
    ctx.globalAlpha = gAlpha; ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(h * 0.46 * gScale)}px ${this.F.display}`;
    ctx.fillText('☄', x + h * 0.5, cyg + 1);
    if (label) {
      ctx.globalAlpha = 1; ctx.fillStyle = labelColor;
      ctx.font = `bold ${Math.min(26, h * 0.30)}px ${this.F.display}`;
      ctx.fillText(label, x + h + (w - h) / 2, cyg);
    }
    ctx.restore();

    // affordance <=> legality: register the tap ONLY when castUltimate is legal.
    if (ui === 'ready') this.addHit('ultimate', x, y, w, h, null);
  }

  _overlay(state) {
    const ctx = this.ctx, won = state.status === 'won';
    // P5 — a failed SUMMIT never reads as a loss: if the public win was banked, the
    // run is celebrated as a win even when status==='lost' (the summit was just a dare).
    const banked = state.publicWinBanked;
    const celebrate = won || banked;
    const summitOffer = banked && state.config.waves.summit?.enabled && !state.summitMode && won;
    // card grows to fit the star row (celebrate) and the optional dare button.
    const cardW = 560, cardH = 470 + (celebrate ? 56 : 0) + (summitOffer ? 64 : 0);
    const cx = this.L.canvasW / 2;
    // frosted scrim so the cuties stay visible (win = cream wash, lose = light
    // grape veil — both keep the board lively, never mud-black)
    ctx.fillStyle = celebrate ? '#FFF7F0CC' : '#5B4CA0AB'; ctx.fillRect(0, 0, this.L.canvasW, this.L.canvasH);
    const cardX = cx - cardW / 2, cardY = this.L.canvasH / 2 - cardH / 2;
    ctx.fillStyle = '#FFF9F2'; roundRect(ctx, cardX, cardY, cardW, cardH, this.U.radPanel); ctx.fill();
    ctx.fillStyle = celebrate ? this.U.accent : this.U.pinkDeep;
    ctx.save(); roundRect(ctx, cardX, cardY, cardW, 14, this.U.radPanel); ctx.clip(); ctx.fillRect(cardX, cardY, cardW, 14); ctx.restore();
    let cy = cardY + 70;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 64px ${this.F.display}`; ctx.fillStyle = celebrate ? this.FX.win : this.FX.lose;
    // P5 — softened copy: a banked win that then lost the summit still says "You did it!"
    const title = won ? 'You did it!' : (banked ? 'You did it!' : 'Aww, they got through');
    ctx.fillText(title, cx, cy);
    if (banked && !won) {
      cy += 44; ctx.font = `24px ${this.F.body}`; ctx.fillStyle = this.U.textOnCard;
      ctx.fillText('…and gave the SUPER boss a great try!', cx, cy);
    }
    // P5 — quality stars (1-3) just under the title on a celebrated run.
    if (celebrate) { cy += 60; this._drawStars(cx, cy, state.stars || 1); }
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
    cy += 64; ctx.font = `26px ${this.F.body}`; ctx.fillStyle = this.U.textOnCard;
    for (const ln of lines) { ctx.fillText(ln, cx, cy); cy += 40; }
    this._centerButton('Play Again', cy + 30, this.U.btnPrimary, 'playAgain', this.U.btnPrimaryEdge);
    // P5 — the opt-in SUMMIT dare, below Play Again, only on a freshly banked win.
    if (summitOffer) this._centerButton(state.config.waves.summit.dareText, cy + 30 + 64, this.U.btnInfo, 'continueSummit', this.U.btnInfoEdge);
  }

  // P5 — a small gold star row: `filled` of 3 stars filled (gold), the rest pale.
  _drawStars(cx, cy, filled) {
    const ctx = this.ctx, R = 22, gap = 18, n = 3;
    const totalW = n * (R * 2) + (n - 1) * gap;
    let x = cx - totalW / 2 + R;
    for (let i = 0; i < n; i++) {
      const on = i < filled;
      this._starPath(x, cy, R);
      ctx.fillStyle = on ? this.G.base : '#E7E0EC';
      ctx.fill();
      this._starPath(x, cy, R);
      ctx.lineWidth = 3; ctx.strokeStyle = on ? this.G.deep : '#C7BFD2'; ctx.stroke();
      x += R * 2 + gap;
    }
  }

  _starPath(cx, cy, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const ang = -Math.PI / 2 + k * Math.PI / 5;
      const rad = k % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
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
