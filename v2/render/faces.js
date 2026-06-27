/**
 * The recognisable charm — faces, baked once into sprites.
 * Enemy mean face (angry eyes + angled brows + frown) and tower smiley face
 * (white eyes + pupils + big smile + pink cheeks), ported from V1's geometry.
 */
export function drawEnemyFace(ctx, cx, cy, r) {
  const eyeR = r * 0.13;
  const off = r * 0.27;
  // eyes
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx - off, cy - r * 0.08, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, cy - r * 0.08, eyeR, 0, Math.PI * 2); ctx.fill();
  // tiny eye glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off + eyeR * 0.3, cy - r * 0.08 - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off + eyeR * 0.3, cy - r * 0.08 - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
  // angry eyebrows
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - off - eyeR, cy - r * 0.32); ctx.lineTo(cx - off + eyeR, cy - r * 0.20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + off + eyeR, cy - r * 0.32); ctx.lineTo(cx + off - eyeR, cy - r * 0.20); ctx.stroke();
  // frown
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.45, r * 0.32, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
}

export function drawTowerFace(ctx, cx, cy, r) {
  const eyeR = r * 0.18;
  const off = r * 0.32;
  const eyeY = cy - r * 0.1;
  // white eye bases
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  // pupils
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx - off, eyeY, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off, eyeY, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
  // glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - off + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2); ctx.fill();
  // pink cheeks
  ctx.fillStyle = '#FFB6C1';
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(cx - off * 1.25, cy + r * 0.18, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + off * 1.25, cy + r * 0.18, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // big smile
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.05, r * 0.4, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
}
