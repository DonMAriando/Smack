// Todo número que afecte cómo se siente el juego vive acá y en ningún otro
// lado. Antes estaban sueltos entre la lógica, así que balancear implicaba
// buscarlos de memoria en 700 líneas.

export const CFG = {
  run: {
    duration: 45,      // segundos de partida
    lives: 3,
    bossAt: 27,        // segundo en que entra el boss
  },

  arena: {
    minWidth: 320,
    minHeight: 560,
    maxWidth: 520,
    centerY: 0.55,     // fracción de la altura donde está el personaje
    hurtRadius: 37,    // a esta distancia del centro el objeto impacta
    spawnMargin: 48,   // cuánto afuera del borde nacen
  },

  speed: {
    base: 175,         // px/s al empezar
    ramp: 2.5,         // px/s que se suma por segundo transcurrido
    bossBonus: 90,
    jitter: 55,
    max: 410,
  },

  spawn: {
    baseInterval: 0.88,
    rampPerSecond: 0.012,
    comboRelief: 0.008,   // el combo acelera el ritmo
    minInterval: 0.34,
    bossInterval: 0.27,
    jitter: [0.82, 0.38],  // [mínimo, rango extra] multiplicador del intervalo
    safeChanceBase: 0.16,
    safeChanceRamp: 1 / 140,
    safeChanceMax: 0.30,
    safeChanceBoss: 0.08,
    bossDoubleChance: 0.24,
    bossDoubleDelay: 0.095,
  },

  scoring: {
    minPoints: 55,
    maxPoints: 360,        // puntos = maxPoints - ms de reacción
    comboBonus: 0.045,     // por punto de combo
    comboCap: 25,
    feverMultiplier: 3,
    feverAt: 10,           // combo que dispara FEVER
    feverEvery: 18,        // y cada tantos combos después
    feverDuration: 6000,   // ms
    dodgeSafeBonus: 18,    // por dejar pasar algo tierno
    bossKoBonus: 1500,
  },

  boss: {
    hp: 18,
  },

  // Las variantes entran de a una y espaciadas, para que cada mecánica se
  // aprenda sola sin tutorial. El peso es relativo entre las ya habilitadas.
  variants: {
    schedule: [
      { id: 'plain', from: 0, weight: 100, kinds: ['danger', 'safe'] },
      { id: 'disguised', from: 9, weight: 20, kinds: ['danger', 'safe'] },
      { id: 'armored', from: 15, weight: 24, kinds: ['danger'] },
      { id: 'deflect', from: 21, weight: 22, kinds: ['danger'] },
    ],
    // Durante el boss conviene que aparezca más de lo que da puntos altos.
    bossBoost: { armored: 1.6, deflect: 1.9 },
  },

  armor: {
    hitPoints: 40,        // puntos por cada golpe que no lo rompe
    hitstop: 0.022,
  },

  deflect: {
    swipeDistance: 26,           // px de desplazamiento para que cuente
    maxAngle: Math.PI * 0.55,    // tolerancia respecto de la dirección correcta
    bossDamage: 3,               // devolverlo durante el boss pega fuerte
    points: 240,
    exitSpeed: 620,
  },

  feel: {
    // El congelamiento es proporcional a la calidad de la reacción: premiar
    // el reflejo haciendo que el golpe se sienta más, no solo sumando puntos.
    hitstopBase: 0.035,
    hitstopCrispBonus: 0.04,
    crispWindow: 400,      // ms; por debajo de esto la reacción cuenta como limpia
    hitstopMiss: 0.11,
    hitstopHurt: 0.13,
    hitstopFever: 0.14,
    hitstopBossEnter: 0.3,
    hitstopBossKo: 0.26,
    shakeDecay: 10,        // por segundo, no por frame
    lastLifeTimeScale: 0.78,
    maxDeltaTime: 0.05,    // tope que evita túnel de colisión sin ralentizar
    restartGrace: 700,     // ms antes de que un tap en cualquier lado reinicie
    tapForgiveness: 24,    // px extra de radio para acertar
  },

  // Umbrales de los rangos de reacción, en ms.
  ranks: [
    [145, '⚡ GODLIKE'],
    [185, '🔥 INSANE'],
    [235, '✨ PERFECT'],
    [320, 'GREAT'],
    [Infinity, 'GOOD'],
  ],
};

export function reactionRank(ms) {
  for (const [limit, label] of CFG.ranks) if (ms < limit) return label;
  return 'GOOD';
}
