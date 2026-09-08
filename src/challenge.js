// Desafiar a un amigo sin servidor.
//
// El desafío del día ya es determinista: la semilla sale de la fecha, así que
// dos personas que juegan el mismo día reciben exactamente la misma secuencia
// de objetos y las mismas misiones. Eso es lo que permite comparar sin
// infraestructura, porque no hace falta que un servidor cuente nada: alcanza
// con que el puntaje viaje en el link.
//
// El que gana manda un link, el otro lo abre, el juego guarda el puntaje a
// superar y al terminar te dice si le ganaste. Cero backend, cero cuentas,
// cero datos personales.
//
// Lo que esto NO es: una tabla de posiciones confiable. Cualquiera puede
// editar el link y ponerse el puntaje que quiera. La suma de control de abajo
// existe para detectar un link cortado al copiarlo o roto por el chat, no para
// impedir que alguien mienta. Para eso hace falta un servidor que valide, y es
// una decisión aparte.

import { save, persist, todayStamp } from './save.js';

// Suma de control corta: detecta truncamiento y pegado sucio, que es el modo
// realista de que un link llegue mal.
function checksum(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
  return h.toString(36);
}

function toUrlSafe(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafe(s) {
  return s.replace(/-/g, '+').replace(/_/g, '/');
}

export function encode({ stamp, score, ms, combo }) {
  const body = [stamp, score, ms ?? '', combo].join('|');
  const payload = body + '|' + checksum(body);
  try {
    return toUrlSafe(btoa(payload));
  } catch (e) {
    return null;
  }
}

export function decode(code) {
  try {
    const raw = atob(fromUrlSafe(code));
    const parts = raw.split('|');
    if (parts.length !== 5) return null;
    const body = parts.slice(0, 4).join('|');
    if (checksum(body) !== parts[4]) return null;
    const [stamp, score, ms, combo] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return null;
    const n = Number(score);
    if (!Number.isFinite(n) || n < 0) return null;
    return { stamp, score: Math.floor(n), ms: ms === '' ? null : Number(ms), combo: Number(combo) || 0 };
  } catch (e) {
    return null;
  }
}

export function challengeUrl(data) {
  const code = encode(data);
  if (!code) return location.href;
  return location.origin + location.pathname + '#d=' + code;
}

// Se llama una vez al cargar. Si vino un desafío, lo guarda y limpia el hash:
// dejarlo puesto haría que al recargar la página el rival "reapareciera" para
// siempre, incluso días después.
export function readIncoming() {
  const m = /[#&]d=([A-Za-z0-9\-_]+)/.exec(location.hash);
  if (!m) return null;
  const data = decode(m[1]);
  history.replaceState(null, '', location.pathname);
  if (!data) return null;

  // Solo el desafío de hoy sirve: la secuencia de ayer era otra, así que
  // comparar contra ella no significaría nada.
  if (data.stamp !== todayStamp()) return { stale: true, ...data };

  const previo = save.rivals[data.stamp];
  // Si llegan varios links del mismo día, queda el más alto: es el que
  // realmente hay que superar.
  if (!previo || data.score > previo.score) {
    save.rivals[data.stamp] = { score: data.score, ms: data.ms, combo: data.combo };
    persist();
  }
  return data;
}

export function rivalToday() {
  return save.rivals[todayStamp()] || null;
}
