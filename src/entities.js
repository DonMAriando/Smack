import { CFG } from './config.js';
import { pick } from './rng.js';
import { unlockedObjects } from './progression.js';

const BASE_DANGER = [
  { emoji: '🩴', name: 'CHANCLA' },
  { emoji: '🐟', name: 'PESCADO' },
  { emoji: '🍅', name: 'TOMATE' },
  { emoji: '🦟', name: 'MOSQUITO' },
  { emoji: '🥊', name: 'GUANTE' },
  { emoji: '🧦', name: 'MEDIA' },
  { emoji: '🥔', name: 'PAPA' },
];

const BASE_SAFE = [
  { emoji: '❤️', name: 'CORAZÓN' },
  { emoji: '🐱', name: 'GATO' },
  { emoji: '🎂', name: 'TORTA' },
  { emoji: '🧸', name: 'OSITO' },
  { emoji: '🌈', name: 'ARCOÍRIS' },
];

// Se resuelve al empezar cada partida y no en cada spawn: los desbloqueos no
// cambian a mitad de una partida, y esto corre cientos de veces por minuto.
let pools = { danger: BASE_DANGER, safe: BASE_SAFE };

export function refreshPools() {
  pools = {
    danger: BASE_DANGER.concat(unlockedObjects('danger')),
    safe: BASE_SAFE.concat(unlockedObjects('safe')),
  };
  return pools;
}

// Cada variante es una capa de habilidad distinta sobre el mismo tap.
//
//   plain      reaccionar y tocar
//   armored    reaccionar y tocar rápido tres veces
//   deflect    reaccionar y hacer un gesto con dirección
//   disguised  reaccionar leyendo el ícono y no el color del brillo
//
// La última es la más importante: el brillo rojo o verde es un atajo que el
// jugador aprende en dos partidas, y el disfraz invierte ese brillo. Quien
// leía el color se equivoca; quien lee el objeto, no.
export const VARIANT = {
  plain: { hp: 1, radius: 28 },
  armored: { hp: 3, radius: 32 },
  deflect: { hp: 1, radius: 30 },
  disguised: { hp: 1, radius: 28 },
};

// Elige variante entre las habilitadas a esta altura de la partida, con pesos.
export function rollVariant({ rng, elapsed, boss, kind }) {
  const pool = [];
  let total = 0;
  for (const v of CFG.variants.schedule) {
    if (elapsed < v.from) continue;
    if (!v.kinds.includes(kind)) continue;
    let weight = v.weight;
    if (boss && CFG.variants.bossBoost[v.id]) weight *= CFG.variants.bossBoost[v.id];
    total += weight;
    pool.push([v.id, total]);
  }
  if (!pool.length) return 'plain';
  const roll = rng() * total;
  for (const [id, cumulative] of pool) if (roll < cumulative) return id;
  return 'plain';
}

// Nace fuera de la pantalla, en un lado al azar, y viaja hacia el personaje.
export function spawn({ rng, w, h, elapsed, boss, kind, variant = 'plain' }) {
  const src = pick(rng, kind === 'safe' ? pools.safe : pools.danger);
  const spec = VARIANT[variant];
  const margin = CFG.arena.spawnMargin;

  const side = Math.floor(rng() * 4);
  let x, y;
  if (side === 0) { x = rng() * w; y = -margin; }
  else if (side === 1) { x = w + margin; y = rng() * h; }
  else if (side === 2) { x = rng() * w; y = h + margin; }
  else { x = -margin; y = rng() * h; }

  const cx = w / 2;
  const cy = h * CFG.arena.centerY;
  const dx = cx - x;
  const dy = cy - y;
  const len = Math.hypot(dx, dy) || 1;

  const base = CFG.speed.base + elapsed * CFG.speed.ramp + (boss ? CFG.speed.bossBonus : 0);
  const speed = Math.min(CFG.speed.max, base + rng() * CFG.speed.jitter);

  return {
    kind,
    variant,
    // Lo que el brillo le dice al jugador. En los disfrazados miente.
    looksLike: variant === 'disguised' ? (kind === 'safe' ? 'danger' : 'safe') : kind,
    deflected: false,
    x, y,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    r: spec.radius,
    hp: spec.hp,
    emoji: src.emoji,
    name: src.name,
    born: performance.now(),
    seen: null,          // se completa cuando entra en pantalla
    firstTouch: null,    // primer contacto, que es lo que mide el reflejo
    dead: false,
    hitFlash: 0,
    rot: (rng() - 0.5) * 0.5,
    spin: (rng() - 0.5) * 1.8,
  };
}

// Decide qué tipo de objeto toca. Separado del spawn para poder cambiar la
// mezcla sin tocar la física.
export function rollKind({ rng, elapsed, boss, forceDanger }) {
  if (forceDanger) return 'danger';
  const chance = boss
    ? CFG.spawn.safeChanceBoss
    : Math.min(CFG.spawn.safeChanceMax, CFG.spawn.safeChanceBase + elapsed * CFG.spawn.safeChanceRamp);
  return rng() < chance ? 'safe' : 'danger';
}
