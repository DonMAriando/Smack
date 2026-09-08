// Tres objetivos cortos por partida. Existen para que una partida mala igual
// deje algo: podés fallar el récord y todavía cerrar dos misiones.
//
// Cada una se evalúa contra los contadores que la partida ya lleva, así que
// agregar una misión nueva no requiere tocar el game loop.

const POOL = [
  { id: 'combo15', label: 'Combo x15', test: (s) => s.maxCombo >= 15, xp: 300 },
  { id: 'combo25', label: 'Combo x25', test: (s) => s.maxCombo >= 25, xp: 600 },
  { id: 'fast250', label: 'Reaccionar bajo 250 ms', test: (s) => s.bestReaction !== null && s.bestReaction < 250, xp: 350 },
  { id: 'fast200', label: 'Reaccionar bajo 200 ms', test: (s) => s.bestReaction !== null && s.bestReaction < 200, xp: 700 },
  { id: 'deflect3', label: 'Devolver 3 objetos', test: (s) => s.deflects >= 3, xp: 400 },
  { id: 'armor4', label: 'Romper 4 blindados', test: (s) => s.armorBreaks >= 4, xp: 400 },
  { id: 'bossKo', label: 'Noquear a la Abuela', test: (s) => s.bossKos >= 1, xp: 500 },
  { id: 'noHit', label: 'Terminar sin perder vidas', test: (s) => s.livesLost === 0, xp: 800 },
  { id: 'score3000', label: 'Sumar 3000 puntos', test: (s) => s.score >= 3000, xp: 300 },
  { id: 'smacks30', label: 'Pegar 30 veces', test: (s) => s.hits >= 30, xp: 350 },
];

// Tres distintas, elegidas con el rng que se le pase: si es el del día, todos
// los jugadores reciben las mismas.
export function pickMissions(rng) {
  const bag = POOL.slice();
  const out = [];
  for (let i = 0; i < 3 && bag.length; i++) {
    const idx = Math.floor(rng() * bag.length);
    out.push({ ...bag[idx], done: false });
    bag.splice(idx, 1);
  }
  return out;
}

export function evaluate(missions, s) {
  for (const m of missions) m.done = m.test(s);
  return missions;
}

export function earnedXp(missions) {
  return missions.reduce((sum, m) => sum + (m.done ? m.xp : 0), 0);
}
