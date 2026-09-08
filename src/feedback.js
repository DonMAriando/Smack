// Audio y vibración. Es una sola capa conceptual: lo que el juego le devuelve
// al dedo del jugador en el instante del contacto.

let ctx = null;
let noise = null;
let muted = false;

export function setMuted(v) {
  muted = v;
  if (!muted) ensureAudio();
}

export function isMuted() {
  return muted;
}

export function ensureAudio() {
  if (muted) return;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    // Medio segundo de ruido blanco reutilizable. Generarlo por golpe sería
    // tirar basura al recolector en el momento de mayor carga.
    const len = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  // Los navegadores móviles arrancan el contexto suspendido hasta que hay un
  // gesto del usuario.
  if (ctx.state === 'suspended') ctx.resume();
}

export function blip(freq = 260, dur = 0.05, type = 'square', vol = 0.05) {
  if (muted) return;
  ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

// Un golpe real es ruido de banda ancha con un transitorio corto y afinado
// debajo. Un oscilador solo suena a menú, no a impacto.
export function impact({ pitch = 180, dur = 0.16, vol = 0.5, bright = 1400 } = {}) {
  if (muted) return;
  ensureAudio();
  if (!ctx || !noise) return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(bright, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(120, bright * 0.25), t + dur);
  bp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(ng).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);

  const body = ctx.createOscillator();
  const bg = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(pitch * 2.2, t);
  body.frequency.exponentialRampToValueAtTime(pitch, t + dur * 0.7);
  bg.gain.setValueAtTime(vol * 0.42, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  body.connect(bg).connect(ctx.destination);
  body.start(t);
  body.stop(t + dur);
}

export function haptic(pattern) {
  if (muted) return;
  try {
    navigator.vibrate && navigator.vibrate(pattern);
  } catch (e) {}
}

// Patrones con nombre, para que la intención se lea en el call site.
export const HAPTIC = {
  hit: [0, 13],
  hitFever: [0, 16, 24, 16],
  armor: [0, 8],
  deflect: [0, 10, 18, 22],
  mistake: [0, 45, 60, 110],
  hurt: [0, 60, 50, 130],
  fever: [0, 22, 30, 22, 30, 60],
  bossEnter: [0, 120, 80, 120],
  bossKo: [0, 90, 70, 140],
  record: [0, 30, 40, 30, 40, 90],
};
