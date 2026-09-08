import { CFG } from './config.js';
import { drawCharacter } from './character.js';

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
  drawObjects(ctx, s, now);
  drawParticles(ctx, s);
  drawWaves(ctx, s);

  ctx.restore();

  // Va fuera del temblor a propósito: un rectángulo a pantalla completa que
  // tiembla deja ver los bordes. Pero con su propio save, porque si no su
  // fillStyle semitransparente sobrevive al frame y contamina el siguiente:
  // los emojis de los objetos se dibujaban con alpha 0.12 y desaparecían.
  if (s.flashA > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(' + s.flashColor + ',' + s.flashA * 0.55 + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawWaves(ctx, s) {
  for (const w of s.waves) {
    const t = w.life / w.max;
    ctx.strokeStyle = 'rgba(' + w.color + ',' + t * 0.55 + ')';
    ctx.lineWidth = 2 + t * 7;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
  }
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

function drawObjects(ctx, s, now) {
  for (const o of s.objects) {
    ctx.save();
    ctx.translate(o.x, o.y);

    drawTrail(ctx, o);

    // La cáscara gira, el ícono no. El giro le da amenaza a lo puntiagudo,
    // pero rotar el emoji era justo lo que lo volvía ilegible: reconocer un
    // glifo con detalle fino mientras gira es carísimo para la vista.
    ctx.save();
    ctx.rotate(o.rot);
    drawShell(ctx, o);
    ctx.restore();

    if (o.variant === 'disguised') drawDisguise(ctx, o, now);
    if (o.variant === 'armored') drawArmor(ctx, o);
    if (o.variant === 'deflect') drawSwipeHint(ctx, o);

    ctx.font = Math.round(o.r * 0.86) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Explícito y no heredado. Los emojis de color ignoran el color del
    // fillStyle pero no su transparencia, así que un alpha que venga de otro
    // dibujo los borra sin dejar rastro de por qué.
    ctx.fillStyle = '#ffffff';
    if (o.hitFlash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 26;
    }
    ctx.fillText(o.emoji, 0, 0);
    ctx.restore();
  }
}

// Una estela que sale de la velocidad real del objeto. Además de verse mejor,
// hace legible algo que antes había que adivinar: cuál de los objetos que
// entran es el más rápido, o sea a cuál hay que atender primero.
function drawTrail(ctx, o) {
  const sp = Math.hypot(o.vx, o.vy);
  if (sp < 60) return;
  const len = Math.min(52, sp * 0.12);
  const nx = -o.vx / sp;
  const ny = -o.vy / sp;
  const rgb = o.looksLike === 'safe' ? '63,207,136' : '255,68,83';
  const grd = ctx.createLinearGradient(0, 0, nx * len, ny * len);
  grd.addColorStop(0, 'rgba(' + rgb + ',.45)');
  grd.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.strokeStyle = grd;
  ctx.lineWidth = o.r * 0.95;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(nx * len, ny * len);
  ctx.stroke();
}

// El jugador tiene que resolver "pego o no pego" en menos de medio segundo y
// de reojo, porque el objeto entra por el borde de la pantalla.
//
// Un solo canal no alcanza. Antes la respuesta venía casi solo del color de un
// halo difuso, y los propios emojis lo contaminaban: el corazón tierno es rojo
// brillante y el tomate peligroso también. Encima rojo contra verde es el peor
// par posible, porque buena parte de los jugadores no lo distingue.
//
// Ahora la misma respuesta viaja por tres canales redundantes:
//
//   forma    puntiagudo se pega, redondo se deja pasar. Es el canal rápido:
//            la visión periférica resuelve siluetas mucho antes que detalles,
//            y una silueta no depende de distinguir colores. Además no hay
//            nada que memorizar, que era el otro problema: que la papa fuera
//            peligrosa y la torta no era una lista, no una regla.
//   color    el borde, como refuerzo para quien sí lo ve.
//   ícono    el emoji, el canal lento, y el único que dice la verdad.
//
// El relleno oscuro no es decoración: aísla el emoji del color de la cáscara,
// que era exactamente lo que arruinaba la lectura.
const SPIKES = 11;
const LOBES = 7;

export function shellOuter(o) {
  return o.looksLike === 'safe' ? o.r * 1.12 : o.r * 1.35;
}

function shellPath(ctx, o) {
  ctx.beginPath();
  if (o.looksLike === 'safe') {
    // Circunferencia con lóbulos suaves: de lejos es "redondo, blando".
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const rad = o.r * (1.04 + 0.08 * Math.cos(a * LOBES));
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  } else {
    // Estrella de puntas agudas y largas: de lejos es "esto pincha".
    for (let i = 0; i < SPIKES * 2; i++) {
      const a = (i / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? o.r * 0.95 : o.r * 1.35;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

// La forma es la masa del objeto y no su contorno. El primer intento la dibujó
// como un borde fino alrededor del emoji, y no se leía nada: el ícono tapaba
// la silueta y el resplandor difuminaba las puntas, que eran justo lo único
// que había que ver.
//
// Relleno opaco y saturado contra la arena oscura, y adentro un disco oscuro
// que sostiene el emoji. Así la corona lleva forma y color de lejos, y el
// disco central mantiene el ícono legible de cerca, sin que se peleen.
function drawShell(ctx, o) {
  const safe = o.looksLike === 'safe';

  shellPath(ctx, o);
  ctx.fillStyle = safe ? '#3fcf88' : '#ff4453';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, o.r * 0.74, 0, Math.PI * 2);
  ctx.fillStyle = safe ? '#0d2118' : '#2a0e12';
  ctx.fill();
}

// Una muestra suelta de un objeto, para la leyenda de la pantalla de inicio.
// Usa el mismo código que el juego a propósito: una leyenda dibujada aparte se
// desincroniza del juego en el primer cambio de forma, y entonces enseña mal,
// que es peor que no enseñar.
export function drawSample(ctx, cx, cy, looksLike, emoji, r = 26) {
  const o = { r, looksLike, emoji, variant: 'plain', vx: 0, vy: 0, rot: 0, hitFlash: 0 };
  ctx.save();
  ctx.translate(cx, cy);
  drawShell(ctx, o);
  ctx.font = Math.round(r * 0.86) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

// Los disfrazados son el único caso en que la cáscara miente, así que se
// anuncian: el aro discontinuo que gira dice "este no te lo creas, leé el
// ícono". Sin esa marca, saber que el disfraz existe obligaba a desconfiar de
// todos los objetos, y el canal rápido dejaba de servir en toda la partida.
// Marcado, la desconfianza dura lo que dura el objeto.
function drawDisguise(ctx, o, now) {
  const outer = shellOuter(o) + 9;
  ctx.save();
  ctx.rotate(now / 420);
  ctx.setLineDash([5, 7]);
  // Violeta y no blanco: el blanco ya es el blindado, y dos marcas blancas
  // alrededor de la cáscara se confundían entre sí. Cada mecánica tiene su
  // color y ninguno se repite: blanco blinda, amarillo se arrastra, violeta
  // miente.
  ctx.strokeStyle = 'rgba(198,138,255,.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
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
    ctx.arc(0, 0, shellOuter(o) + 5, i * step + gap / 2, (i + 1) * step - gap / 2);
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
    const d = shellOuter(o) + 7 + i * 7;
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
      ctx.fillStyle = p.color || (p.good ? '#ffd54a' : '#ff5a67');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
