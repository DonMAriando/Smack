import { save, persist } from './save.js';

// El puntaje de cada partida se acumula como experiencia. La idea es que
// siempre haya una recompensa concreta a la vista: la pantalla de inicio
// muestra qué falta para la próxima y cuánto queda.
//
// Las recompensas de tipo 'object' entran al pool de spawn, así que la partida
// número cincuenta no tiene los mismos objetos que la primera.

export const TRACK = [
  { xp: 0,      title: 'NOVATO' },
  { xp: 2500,   object: { kind: 'danger', emoji: '👟', name: 'ZAPATILLA' } },
  { xp: 7000,   hair: { id: 'rubio', color: '#c98f3f', label: 'PELO RUBIO' } },
  { xp: 13000,  title: 'REFLEJO' },
  { xp: 21000,  object: { kind: 'safe', emoji: '🐶', name: 'PERRITO' } },
  { xp: 32000,  object: { kind: 'danger', emoji: '🧅', name: 'CEBOLLA' } },
  { xp: 46000,  hair: { id: 'rojo', color: '#b4432f', label: 'PELO ROJO' } },
  { xp: 64000,  title: 'RELÁMPAGO' },
  { xp: 86000,  object: { kind: 'danger', emoji: '🪳', name: 'CUCARACHA' } },
  { xp: 112000, object: { kind: 'safe', emoji: '🌻', name: 'GIRASOL' } },
  { xp: 145000, hair: { id: 'verde', color: '#3f8f6a', label: 'PELO VERDE' } },
  { xp: 185000, title: 'SOBREHUMANO' },
];

export function levelFor(xp = save.xp) {
  let level = 0;
  for (const step of TRACK) if (xp >= step.xp) level++;
  return level;
}

export function titleFor(xp = save.xp) {
  let title = TRACK[0].title;
  for (const step of TRACK) if (xp >= step.xp && step.title) title = step.title;
  return title;
}

// Qué viene después, para poder mostrarlo como zanahoria.
export function nextStep(xp = save.xp) {
  for (const step of TRACK) if (xp < step.xp) return step;
  return null;
}

export function describe(step) {
  if (!step) return 'Todo desbloqueado';
  if (step.title) return 'Título ' + step.title;
  if (step.hair) return step.hair.label;
  if (step.object) return step.object.emoji + ' ' + step.object.name;
  return '';
}

// Progreso dentro del nivel actual, de 0 a 1.
export function progress(xp = save.xp) {
  const next = nextStep(xp);
  if (!next) return 1;
  let floor = 0;
  for (const step of TRACK) if (xp >= step.xp) floor = step.xp;
  const span = next.xp - floor;
  return span > 0 ? (xp - floor) / span : 1;
}

export function unlockedObjects(kind, xp = save.xp) {
  return TRACK.filter((t) => xp >= t.xp && t.object && t.object.kind === kind).map((t) => t.object);
}

export function unlockedHair(xp = save.xp) {
  const hairs = TRACK.filter((t) => xp >= t.xp && t.hair).map((t) => t.hair);
  return hairs.length ? hairs[hairs.length - 1] : null;
}

// Suma experiencia y devuelve las recompensas cruzadas en esta partida, para
// que la pantalla de fin las pueda festejar.
export function addXp(amount) {
  const before = save.xp;
  save.xp += amount;
  persist();
  return TRACK.filter((step) => step.xp > before && step.xp <= save.xp);
}
