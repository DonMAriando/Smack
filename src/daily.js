import { hashString } from './rng.js';
import { save, persist, todayStamp } from './save.js';

// El desafío del día usa una semilla derivada de la fecha, así que todos los
// que juegan hoy reciben exactamente la misma secuencia de objetos. Sin eso
// comparar puntajes no significa nada.

export function dailySeed(stamp = todayStamp()) {
  return hashString('smack-daily-' + stamp);
}

export function dailyBest(stamp = todayStamp()) {
  return save.daily[stamp] ?? null;
}

export function recordDaily(score, stamp = todayStamp()) {
  const previous = save.daily[stamp] ?? 0;
  prune();
  if (score <= previous) {
    persist();
    return false;
  }
  save.daily[stamp] = score;
  persist();
  return true;
}

// No hace falta guardar el historial completo para siempre.
function prune() {
  const keys = Object.keys(save.daily).sort();
  while (keys.length > 30) delete save.daily[keys.shift()];
}
