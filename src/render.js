import { CFG } from './config.js';

export function draw(ctx, s, now, real) {
  const { w, h } = s;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  if (s.shake > 0) {
    ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
    // Decae por segundo, no por frame: antes el temblor duraba más en una
    // pantalla de 60 Hz que en una de 120.
    s.shake *= Math.exp(-real * CFG.feel.shakeDecay);
    if (s.shake < 0.4) s.shake = 0;
  }

  const cx = w / 2;
  const cy = h * CFG.arena.centerY;

  drawArena(ctx, w, h, cx, cy);
  drawCharacter(ctx, s, cx, cy, now);
  drawObjects(ctx, s);
  drawParticles(ctx, s);

  ctx.restore();
}

function drawArena(ctx, w, h, cx, cy) {
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let r = 80; r < Math.max(w, h) * 0.65; r += 72) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCharacter(ctx, s, cx, cy, now) {
  const pulse = 1 + Math.sin(now / 180) * 0.025;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.font = '64px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.lives === 1 ? '😰' : s.boss ? '😱' : '😐', 0, 0);
  ctx.restore();
}

function drawObjects(ctx, s) {
  for (const o of s.objects) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    ctx.font = (o.kind === 'safe' ? 42 : 46) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.kind === 'safe') {
      ctx.shadowColor = 'rgba(96,229,158,.55)';
      ctx.shadowBlur = 16;
    } else {
      ctx.shadowColor = 'rgba(255,90,103,.35)';
      ctx.shadowBlur = 10;
    }
    ctx.fillText(o.emoji, 0, 0);
    ctx.restore();
  }
}

function drawParticles(ctx, s) {
  for (const p of s.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.text) {
      ctx.font = p.size + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.good ? '#ffd54a' : '#ff5a67';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
