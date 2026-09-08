// El protagonista, dibujado con primitivas.
//
// Dos razones para no usar un emoji: la fuente de emoji la pone el sistema
// operativo, así que la cara del juego cambiaba de forma entre Android, iPhone
// y escritorio; y un emoji no puede actuar. Este mira hacia la amenaza más
// cercana, parpadea, se achata cuando le pegan y transpira cuando le queda una
// vida. Eso es lo que hace que el jugador sienta que está defendiendo a
// alguien y no tocando figuritas.

import { unlockedHair } from './progression.js';

const SKIN = '#ffdcb4';
const SKIN_SHADOW = '#e8bd90';
const INK = '#22242b';
const DEFAULT_HAIR = '#3d2b23';

let hair = DEFAULT_HAIR;

// Se refresca al empezar la partida, no en cada frame.
export function refreshLook() {
  const unlocked = unlockedHair();
  hair = unlocked ? unlocked.color : DEFAULT_HAIR;
}

// A qué distancia del centro deja de mirar y entra en pánico.
const PANIC_DISTANCE = 190;

export function drawCharacter(ctx, s, cx, cy, now) {
  const mood = moodOf(s, now);
  const look = lookTarget(s, cx, cy);

  // Respiración de fondo, más rápida cuanto peor la situación.
  const rate = mood === 'panic' ? 90 : mood === 'worried' ? 130 : 190;
  const breathe = 1 + Math.sin(now / rate) * 0.03;

  // Achatado por el golpe: se estira a lo ancho y se hunde a lo alto, y vuelve.
  const hurt = Math.max(0, (s.hurtUntil - now) / 260);
  const squashX = 1 + hurt * 0.3;
  const squashY = 1 - hurt * 0.26;

  ctx.save();
  ctx.translate(cx, cy + hurt * 8);
  ctx.scale(breathe * squashX, breathe * squashY);

  const r = 34;
  drawHair(ctx, r, mood);
  drawHead(ctx, r);
  drawEyes(ctx, r, mood, look, now);
  drawBrows(ctx, r, mood);
  drawMouth(ctx, r, mood, hurt);
  if (mood === 'fever') drawBlush(ctx, r);
  if (mood === 'worried' || mood === 'panic') drawSweat(ctx, r, now);

  ctx.restore();
}

function moodOf(s, now) {
  if (s.hurtUntil > now) return 'hurt';
  if (s.boss) return 'panic';
  if (s.lives === 1) return 'worried';
  if (now < s.feverUntil) return 'fever';
  return 'calm';
}

// Mira al objeto peligroso más cercano. Es el detalle que más vida le da: el
// personaje ve venir el golpe antes que vos.
function lookTarget(s, cx, cy) {
  let best = null;
  let bd = Infinity;
  for (const o of s.objects) {
    if (o.dead || o.deflected || o.looksLike === 'safe') continue;
    const d = Math.hypot(o.x - cx, o.y - cy);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (!best || bd > PANIC_DISTANCE * 2) return { x: 0, y: 0 };
  const len = bd || 1;
  const strength = Math.min(1, PANIC_DISTANCE / len);
  return { x: ((best.x - cx) / len) * strength, y: ((best.y - cy) / len) * strength };
}

function drawHead(ctx, r) {
  // Levemente más ancho que alto y con la base más pesada: da una silueta
  // reconocible incluso a tamaño de miniatura.
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(0, 2, r, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SKIN_SHADOW;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.62, r * 0.72, r * 0.3, 0, 0, Math.PI);
  ctx.fill();
}

// Un mechón al costado, asimétrico. Es lo único que hace falta para que la
// silueta se distinga de cualquier otra carita redonda.
function drawHair(ctx, r, mood) {
  const lift = mood === 'panic' || mood === 'hurt' ? 8 : 0;
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.86);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.5 - lift, r * 0.62, -r * 0.66);
  ctx.quadraticCurveTo(r * 0.2, -r * 0.98, -r * 0.1, -r * 0.86);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -r * 0.72, r * 0.66, r * 0.3, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawEyes(ctx, r, mood, look, now) {
  const dx = r * 0.36;
  const dy = -r * 0.1;
  const blink = Math.sin(now / 1400) > 0.985 ? 0.12 : 1;

  if (mood === 'hurt') {
    // Ojos en cruz: el chiste visual del golpe.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (const sx of [-dx, dx]) {
      ctx.beginPath();
      ctx.moveTo(sx - 6, dy - 6);
      ctx.lineTo(sx + 6, dy + 6);
      ctx.moveTo(sx + 6, dy - 6);
      ctx.lineTo(sx - 6, dy + 6);
      ctx.stroke();
    }
    return;
  }

  const wide = mood === 'panic' ? 1.28 : mood === 'worried' ? 1.12 : 1;
  const rx = 7.4 * wide;
  const ry = 8.6 * wide * blink;

  for (const sx of [-dx, dx]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(sx, dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    if (blink < 1) continue;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(sx + look.x * 3.4, dy + look.y * 3.4, rx * 0.52, ry * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(sx + look.x * 3.4 - 1.8, dy + look.y * 3.4 - 2.4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBrows(ctx, r, mood) {
  if (mood === 'hurt') return;
  const dx = r * 0.36;
  const y = -r * 0.44;
  // El ángulo de la ceja es lo que más comunica: hacia arriba es susto, hacia
  // abajo es determinación.
  // Positivo levanta la punta interna y da susto; negativo la baja y da
  // determinación. Las dos cejas tienen que espejarse respecto del centro de
  // la cara, así que el extremo interno se calcula aparte del externo.
  const tilt = mood === 'panic' ? 5 : mood === 'worried' ? 3.4 : mood === 'fever' ? -4.5 : 0.6;

  ctx.strokeStyle = hair;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (dx + 7), y + tilt * 0.5);
    ctx.lineTo(side * (dx - 7), y - tilt);
    ctx.stroke();
  }
}

function drawMouth(ctx, r, mood, hurt) {
  const y = r * 0.34;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  if (mood === 'panic' || mood === 'hurt') {
    // Boca abierta, más grande cuanto más reciente el golpe.
    ctx.beginPath();
    ctx.ellipse(0, y + 1, 8 + hurt * 4, 7 + hurt * 5, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (mood === 'fever') {
    ctx.beginPath();
    ctx.arc(0, y - 3, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    return;
  }
  if (mood === 'worried') {
    ctx.beginPath();
    ctx.moveTo(-6, y + 2);
    ctx.quadraticCurveTo(0, y - 3, 6, y + 2);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-5.5, y);
  ctx.lineTo(5.5, y);
  ctx.stroke();
}

function drawBlush(ctx, r) {
  ctx.fillStyle = 'rgba(255,90,103,.4)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.62, r * 0.16, 7, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSweat(ctx, r, now) {
  // Cae, se reinicia, vuelve a caer.
  const t = (now % 1100) / 1100;
  ctx.fillStyle = 'rgba(140,205,255,.92)';
  ctx.beginPath();
  ctx.ellipse(r * 0.78, -r * 0.3 + t * r * 1.1, 3.4, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();
}
