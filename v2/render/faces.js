/**
 * The recognisable charm — faces, baked once per EXPRESSION FRAME into sprites.
 * The renderer selects a frame from cheap per-entity state and blits it; faces
 * are NEVER redrawn per frame (that's the V2 perf model).
 *
 * In-game frames:
 *   enemy : 'neutral' (mean) | 'ouch' (squint + open mouth, V1's best moment)
 *   tower : 'neutral' (smiley) | 'shock' (fire) | 'blink' | 'blush' (shy)
 * Menu portraits (bigger, HD, more expressive): drawPortraitFace / drawCoinFace.
 */
const INK = '#1a1a1a';

// ================= ENEMY (in-game) =================
export function drawEnemyFace(ctx, cx, cy, r, frame = 'neutral') {
  if (frame === 'ouch') return drawEnemyOuch(ctx, cx, cy, r);
  return drawEnemyNeutral(ctx, cx, cy, r);
}

function drawEnemyNeutral(ctx, cx, cy, r) {           // == the current mean face
  const eyeR = r * 0.13, off = r * 0.27, eyeY = cy - r * 0.08;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx - off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - off - eyeR, cy - r * 0.32); ctx.lineTo(cx - off + eyeR, cy - r * 0.20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + off + eyeR, cy - r * 0.32); ctx.lineTo(cx + off - eyeR, cy - r * 0.20); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.45, r * 0.32, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
}

function drawEnemyOuch(ctx, cx, cy, r) {               // V1 squint + open oval mouth (peak)
  const off = r * 0.27, eyeY = cy - r * 0.06, sq = r * 0.05;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx - off, eyeY, sq, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, sq, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - off - r * 0.14, cy - r * 0.34); ctx.lineTo(cx - off + r * 0.10, cy - r * 0.22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + off + r * 0.14, cy - r * 0.34); ctx.lineTo(cx + off - r * 0.10, cy - r * 0.22); ctx.stroke();
  ctx.fillStyle = '#5a1020';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.30, r * 0.15, r * 0.23, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.07); ctx.stroke();
}

// ================= TOWER (in-game) =================
export function drawTowerFace(ctx, cx, cy, r, frame = 'neutral') {
  switch (frame) {
    case 'shock': return drawTowerShock(ctx, cx, cy, r);
    case 'blink': return drawTowerBlink(ctx, cx, cy, r);
    case 'blush': return drawTowerBlush(ctx, cx, cy, r);
    default:      return drawTowerNeutral(ctx, cx, cy, r);
  }
}

function towerCheeks(ctx, cx, cy, r, rad = r * 0.14, alpha = 0.8, color = '#FFB6C1') {
  const off = r * 0.32;
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(cx - off * 1.25, cy + r * 0.18, rad, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off * 1.25, cy + r * 0.18, rad, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function towerEyesOpen(ctx, cx, cy, r) {               // == the current eyes
  const eyeR = r * 0.18, off = r * 0.32, eyeY = cy - r * 0.1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx - off, eyeY, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2); ctx.fill();
}

function drawTowerNeutral(ctx, cx, cy, r) {            // == the current smiley
  towerEyesOpen(ctx, cx, cy, r);
  towerCheeks(ctx, cx, cy, r);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.05, r * 0.4, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
}

function drawTowerShock(ctx, cx, cy, r) {              // wide eyes + open round "o!" mouth (firing)
  const eyeR = r * 0.21, off = r * 0.32, eyeY = cy - r * 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx - off, eyeY + r * 0.02, eyeR * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY + r * 0.02, eyeR * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off + eyeR * 0.18, eyeY - eyeR * 0.18, eyeR * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off + eyeR * 0.18, eyeY - eyeR * 0.18, eyeR * 0.2, 0, Math.PI * 2); ctx.fill();
  towerCheeks(ctx, cx, cy, r);
  ctx.fillStyle = '#7a3b52';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.26, r * 0.15, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.stroke();
}

function drawTowerBlink(ctx, cx, cy, r) {              // ∩∩ closed-eye arcs
  const off = r * 0.32, eyeY = cy - r * 0.08, ew = r * 0.16;
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx - off, eyeY + r * 0.04, ew, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + off, eyeY + r * 0.04, ew, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  towerCheeks(ctx, cx, cy, r);
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.05, r * 0.4, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
}

function drawTowerBlush(ctx, cx, cy, r) {              // deep wide cheeks + blush lines + shy smile
  towerEyesOpen(ctx, cx, cy, r);
  towerCheeks(ctx, cx, cy, r, r * 0.20, 0.95, '#FF8FAE');
  ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = Math.max(1, r * 0.03); ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const bx = cx + s * r * 0.40, by = cy + r * 0.18;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + i * r * 0.06 - r * 0.03, by - r * 0.06);
      ctx.lineTo(bx + i * r * 0.06 + r * 0.03, by + r * 0.06);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.08, r * 0.26, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
}

// ================= MENU PORTRAITS (HD, baked once) =================
// Bigger, rounder, cuter than the in-game faces. Enemies get a cheeky "mischief"
// face (raised brows + smirk + a little fang) so the menu reads inviting, not
// hostile — the "cuties" are cute even as foes.
export function drawPortraitFace(ctx, cx, cy, r, { mood = 'happy', blink = false, snarl = false } = {}) {
  if (mood === 'angry') return drawAngryPortrait(ctx, cx, cy, r, { blink, snarl });
  const eyeOff = r * 0.34, eyeY = cy - r * 0.06, eyeR = r * 0.20, ink = '#1F1A24';
  // big soft blush (always)
  ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#FF9DB0';
  ctx.beginPath(); ctx.arc(cx - eyeOff * 1.25, cy + r * 0.24, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + eyeOff * 1.25, cy + r * 0.24, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (blink) {                                  // happy closed-eye arcs
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.07); ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY, eyeR * 0.9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  } else {                                       // big white eyes + pupils + double glint
    ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = ink;    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY + eyeR * 0.12, eyeR * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.arc(cx + sx * eyeOff - eyeR * 0.22, eyeY - eyeR * 0.22, eyeR * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + sx * eyeOff + eyeR * 0.25, eyeY + eyeR * 0.20, eyeR * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    if (mood === 'mischief') {                   // raised curved brows = cheeky, not angry
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, r * 0.05); ctx.lineCap = 'round';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY - eyeR * 1.5, eyeR * 0.7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    }
  }
  ctx.lineCap = 'round';
  if (mood === 'mischief') {                     // smirk + one fang
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.075);
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.34, r * 0.26, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(cx - r * 0.10, cy + r * 0.45); ctx.lineTo(cx - r * 0.02, cy + r * 0.45); ctx.lineTo(cx - r * 0.06, cy + r * 0.58); ctx.closePath(); ctx.fill();
  } else {                                        // big open happy smile + tongue
    ctx.fillStyle = '#7A2E3A';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.28, r * 0.30, 0.15 * Math.PI, 0.85 * Math.PI); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.075);
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.30, r * 0.30, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#FF7E9B'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.5, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }
}

// HD angry portrait — mirrors the in-game mean face (angled brows + frown) but
// bigger, with an animated 'snarl' (lowered brows + open gnashing mouth + fangs)
// so the menu enemies read MEAN, matching how they look in game. No blush.
function drawAngryPortrait(ctx, cx, cy, r, { blink = false, snarl = false } = {}) {
  const eyeOff = r * 0.32, eyeY = cy - r * 0.02, eyeR = r * 0.17, ink = '#1F1A24';
  const drop = snarl ? r * 0.05 : 0;            // everything scrunches down on the snarl
  // eyes
  if (blink) {
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.07); ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY + r * 0.02, eyeR * 0.9, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  } else {
    ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * eyeOff, eyeY + drop, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = ink;    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY + drop + eyeR * 0.12, eyeR * 0.52, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff - eyeR * 0.22, eyeY + drop - eyeR * 0.22, eyeR * 0.16, 0, Math.PI * 2); ctx.fill(); }
  }
  // thick angry eyebrows, steeply angled down toward the centre (steeper on snarl)
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(3, r * 0.085); ctx.lineCap = 'round';
  const browInnerY = eyeY - r * 0.12 + drop + (snarl ? r * 0.05 : 0);
  const browOuterY = eyeY - r * 0.30;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * (eyeOff + eyeR * 1.0), browOuterY);
    ctx.lineTo(cx + sx * (eyeOff - eyeR * 0.5), browInnerY);
    ctx.stroke();
  }
  // mouth
  if (snarl) {                                   // open gnashing maw + jagged fangs
    ctx.fillStyle = '#7a1e2a';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.40, r * 0.25, r * 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.06); ctx.stroke();
    ctx.fillStyle = '#fff'; const tw = r * 0.11;
    for (let k = -1; k <= 1; k++) {
      const mx = cx + k * tw * 1.5;
      ctx.beginPath(); ctx.moveTo(mx - tw * 0.5, cy + r * 0.30); ctx.lineTo(mx + tw * 0.5, cy + r * 0.30); ctx.lineTo(mx, cy + r * 0.30 + tw); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mx - tw * 0.5, cy + r * 0.50); ctx.lineTo(mx + tw * 0.5, cy + r * 0.50); ctx.lineTo(mx, cy + r * 0.50 - tw); ctx.closePath(); ctx.fill();
    }
  } else {                                       // mean frown (∩), mirror of the in-game face
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.52, r * 0.30, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
  }
}

export function drawCoinFace(ctx, cx, cy, r, frame = 0) {
  ctx.strokeStyle = '#E0A100'; ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2); ctx.stroke();
  const ink = '#7A5A00', eyeOff = r * 0.30, eyeY = cy - r * 0.05;
  if (frame === 1) {
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.07); ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY, r * 0.16, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  } else {
    ctx.fillStyle = ink; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff, eyeY, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * eyeOff - r * 0.04, eyeY - r * 0.04, r * 0.045, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.5, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.12, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}

export function drawSparkle(ctx, x, y, s) {       // 4-point twinkle
  ctx.save(); ctx.fillStyle = '#FFFDF2'; ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.32, Math.sin(a + Math.PI / 4) * s * 0.32);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
