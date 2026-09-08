// Estado que sobrevive al cierre de la pestaña. Todo acceso a localStorage
// pasa por acá y está envuelto en try/catch: en modo incógnito de iOS
// escribir tira excepción, y no quiero que eso rompa el juego.

const KEY = 'smack.save.v2';

const EMPTY = {
  bestScore: 0,
  bestReaction: null,
  runs: 0,
  streak: 0,
  lastPlayed: null,
  totalSmacks: 0,
  unlocked: [],
  daily: {},        // { 'AAAA-MM-DD': mejorPuntajeDelDia }
  missionsDone: 0,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
    // Migración del formato anterior, para no borrarle los récords a quien
    // ya venía jugando.
    const old = localStorage.getItem('smack.save.v1');
    if (old) return { ...EMPTY, ...JSON.parse(old) };
  } catch (e) {}
  return { ...EMPTY };
}

export const save = read();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {}
}

export function todayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function yesterdayStamp() {
  return todayStamp(new Date(Date.now() - 864e5));
}

export function isUnlocked(id) {
  return save.unlocked.includes(id);
}

export function unlock(id) {
  if (save.unlocked.includes(id)) return false;
  save.unlocked.push(id);
  persist();
  return true;
}

// Registra la racha de días seguidos. Devuelve true si hoy es un día nuevo.
export function touchStreak() {
  const today = todayStamp();
  if (save.lastPlayed === today) return false;
  save.streak = save.lastPlayed === yesterdayStamp() ? save.streak + 1 : 1;
  save.lastPlayed = today;
  return true;
}
