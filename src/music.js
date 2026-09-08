// Música procedural por capas.
//
// No hay ni un archivo de audio en el proyecto y no quiero agregarlos: la
// partida dura 45 segundos y un mp3 decente pesaría más que todo el juego
// junto, que hoy son 39 KB. Pero la razón principal no es el peso: generándola
// la intensidad puede seguir al estado real de la partida nota por nota, en
// lugar de hacer crossfade entre pistas fijas y llegar siempre tarde.
//
// La estructura es un secuenciador de semicorcheas con agenda por adelantado.
// El tiempo lo lleva el reloj de la placa de audio y no el de los frames: si
// lo manejara requestAnimationFrame, cada frame largo se escucharía como un
// tropiezo del ritmo, y este es un juego que ya se traba a propósito cuando
// pegás.
//
// Las capas entran y salen según la intensidad, y como todo está en la misma
// escala pentatónica, cualquier combinación de capas suena bien sin tener que
// escribir armonía de verdad:
//
//   0  el pulso solo. Arranque tranquilo, deja oír los golpes.
//   1  suma contratiempo: empieza a apurar.
//   2  suma bajo en semicorcheas: ya es una persecución.
//   3  suma melodía y redoblante. Es FEVER o es el boss.

import { audioCtx, audioNoise, isMuted } from './feedback.js';

const BPM = 128;
const STEP = 60 / BPM / 4;   // duración de una semicorchea
const LOOKAHEAD = 0.12;      // segundos que se agendan por adelantado
const BAR = 16;              // semicorcheas por compás
const VOLUME = 0.28;         // por debajo de los golpes, que son la voz principal

// La menor pentatónica, en semitonos desde la tónica.
const PENTA = [0, 3, 5, 7, 10];

// Patrón del bajo, en grados de la pentatónica. El -1 es silencio, y los
// silencios son lo que le da empuje: un bajo en todas las semicorcheas es una
// pared, no un groove.
const BASS = [0, -1, 0, 0, -1, 0, -1, 2, 0, -1, 0, 1, -1, 0, 2, -1];
const LEAD = [4, -1, 3, -1, 2, 4, -1, 3, -1, 2, 1, -1, 2, -1, 3, 4];

let master = null;
let enabled = false;
let nextStepAt = 0;
let step = 0;

function freq(root, degree, octave = 0) {
  return root * Math.pow(2, PENTA[degree] / 12 + octave);
}

function build(ctx) {
  master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.connect(ctx.destination);
  // Entra de a poco: un arranque de música a volumen pleno pisa el primer
  // objeto, que es justo el que le enseña al jugador de qué se trata.
  master.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 1.4);
  nextStepAt = ctx.currentTime + 0.06;
  step = 0;
}

export function play() {
  enabled = true;
}

export function stop() {
  enabled = false;
  const ctx = audioCtx();
  if (!ctx || !master) {
    master = null;
    return;
  }
  // Se desvanece en lugar de cortar, y se desconecta después: cortar un nodo
  // con ganancia distinta de cero hace un clic muy audible.
  const dying = master;
  const t = ctx.currentTime;
  dying.gain.cancelScheduledValues(t);
  dying.gain.setValueAtTime(dying.gain.value, t);
  dying.gain.linearRampToValueAtTime(0, t + 0.4);
  setTimeout(() => dying.disconnect(), 700);
  master = null;
}

// Se llama desde el loop del juego. Solo agenda; no suena nada acá.
export function tick({ intensity = 0, boss = false } = {}) {
  if (!enabled || isMuted()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  // Construcción tardía a propósito: si la partida arrancó en silencio no hay
  // contexto todavía, y esto hace que la música entre sola al desmutear.
  if (!master) build(ctx);

  // Si el cursor quedó muy atrás se resincroniza en lugar de agendar de una
  // todos los pasos perdidos, que sonarían juntos como un golpe de ruido.
  // Pasa al volver del mute y al volver de una pestaña en segundo plano, donde
  // el reloj de audio sigue corriendo pero nadie agendó nada.
  if (nextStepAt < ctx.currentTime - 0.25) nextStepAt = ctx.currentTime + 0.02;

  while (nextStepAt < ctx.currentTime + LOOKAHEAD) {
    schedule(ctx, step % BAR, nextStepAt, intensity, boss);
    nextStepAt += STEP;
    step++;
  }
}

function schedule(ctx, i, t, level, boss) {
  // El boss baja la tónica un tono: la misma música, más grave y más amenazante,
  // sin cambiar de tempo. Cambiar el tempo a mitad de partida desacomoda el
  // ritmo del jugador justo cuando más lo necesita.
  const root = boss ? 98 : 110;

  if (i % 4 === 0) kick(ctx, t, boss ? 1.12 : 1);
  if (i === 0) drone(ctx, t, root, boss);

  if (level >= 1 && i % 4 === 2) hat(ctx, t, 0.14);
  if (level >= 2 && i % 2 === 1) hat(ctx, t, 0.07);

  if (level >= 2 && BASS[i] >= 0) bass(ctx, t, freq(root, BASS[i]));

  if (level >= 3) {
    if (LEAD[i] >= 0) lead(ctx, t, freq(root, LEAD[i], 2));
    if (i === 4 || i === 12) snare(ctx, t);
  }
}

function env(ctx, t, peak, dur, target) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(target);
  return g;
}

function kick(ctx, t, punch) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(130 * punch, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  o.connect(env(ctx, t, 0.9, 0.16, master));
  o.start(t);
  o.stop(t + 0.18);
}

function drone(ctx, t, root, boss) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(root / 2, t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = boss ? 190 : 150;
  const g = ctx.createGain();
  const dur = STEP * BAR;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.25);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hat(ctx, t, vol) {
  const noise = audioNoise();
  if (!noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7200;
  src.connect(hp).connect(env(ctx, t, vol, 0.045, master));
  // Entra por un punto al azar del buffer: repetir siempre el mismo tramo de
  // ruido se escucha como un tono afinado y no como un platillo.
  src.start(t, Math.random() * 0.4, 0.06);
}

function snare(ctx, t) {
  const noise = audioNoise();
  if (!noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1900;
  bp.Q.value = 0.7;
  src.connect(bp).connect(env(ctx, t, 0.34, 0.12, master));
  src.start(t, Math.random() * 0.4, 0.14);
}

function bass(ctx, t, f) {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(f, t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1100, t);
  lp.frequency.exponentialRampToValueAtTime(420, t + STEP);
  o.connect(lp).connect(env(ctx, t, 0.2, STEP * 0.9, master));
  o.start(t);
  o.stop(t + STEP);
}

function lead(ctx, t, f) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(f, t);
  o.connect(env(ctx, t, 0.13, STEP * 1.6, master));
  o.start(t);
  o.stop(t + STEP * 1.7);
}
