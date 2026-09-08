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

    drawHalo(ctx, o);
    if (o.variant === 'armored') drawArmor(ctx, o);
    if (o.variant === 'deflect') drawSwipeHint(ctx, o);

    ctx.rotate(o.rot);
    ctx.font = (o.looksLike === 'safe' ? 42 : 46) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.hitFlash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 26;
    }
    ctx.fillText(o.emoji, 0, 0);
    ctx.restore();
  }
}

// Rojo es pegale, verde es dejalo pasar. Tiene que leerse en el borde de la
// pantalla y de reojo, porque el juego mide reflejos y no vista.
//
// El color sigue a looksLike y no a kind, y ese es todo el truco de los
// disfrazados: el halo miente y el ícono dice la verdad. Por eso el halo
// necesita ser fuerte, si fuera sutil el disfraz no engañaría a nadie, solo
// castigaría al azar.
function drawHalo(ctx, o) {
  const rgb = o.looksLike === 'safe' ? '96,229,158' : '255,90,103';
  const outer = o.r + 16;
  const grd = ctx.createRadialGradient(0, 0, o.r * 0.25, 0, 0, outer);
  grd.addColorStop(0, 'rgba(' + rgb + ',.5)');
  grd.addColorStop(0.55, 'rgba(' + rgb + ',.22)');
  grd.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  ctx.fill();
}

// Arcos que se van apagando: cuántos golpes le quedan se lee sin contar.
function drawArmor(ctx, o) {
  const segments = 3;
  const gap = 0.22;
  const step = (Math.PI * 2) / segments;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < segments; i++) {
    ctx.beginPath();
    ctx.strokeStyle = i < o.hp ? '#cfd6e4' : 'rgba(207,214,228,.16)';
    ctx.arc(0, 0, o.r + 6, i * step + gap / 2, (i + 1) * step - gap / 2);
    ctx.stroke();
  }
}

// Tres galones apuntando hacia donde hay que arrastrar, o sea hacia atrás del
// objeto: se devuelve empujándolo por donde vino.
function drawSwipeHint(ctx, o) {
  const len = Math.hypot(o.vx, o.vy) || 1;
  const back = Math.atan2(-o.vy / len, -o.vx / len);
  ctx.save();
  ctx.rotate(back);
  ctx.strokeStyle = 'rgba(255,213,74,.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const d = o.r + 8 + i * 7;
    ctx.globalAlpha = 0.9 - i * 0.25;
    ctx.beginPath();
    ctx.moveTo(d - 5, -7);
    ctx.lineTo(d + 1, 0);
    ctx.lineTo(d - 5, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
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
