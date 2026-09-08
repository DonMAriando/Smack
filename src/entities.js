import { CFG } from './config.js';
import { pick } from './rng.js';

export const DANGER = [
  { emoji: '🩴', name: 'CHANCLA' },
  { emoji: '🐟', name: 'PESCADO' },
  { emoji: '🍅', name: 'TOMATE' },
  { emoji: '🦟', name: 'MOSQUITO' },
  { emoji: '🥊', name: 'GUANTE' },
  { emoji: '🧦', name: 'MEDIA' },
  { emoji: '🥔', name: 'PAPA' },
];

export const SAFE = [
  { emoji: '❤️', name: 'CORAZÓN' },
  { emoji: '🐱', name: 'GATO' },
  { emoji: '🎂', name: 'TORTA' },
  { emoji: '🧸', name: 'OSITO' },
  { emoji: '🌈', name: 'ARCOÍRIS' },
];

// Cada variante es una capa de habilidad distinta sobre el mismo tap.
export const VARIANT = {
  plain: { hp: 1, radius: 28 },
  armored: { hp: 3, radius: 32 },
  deflect: { hp: 1, radius: 30 },
  disguised: { hp: 1, radius: 28 },
};

// Nace fuera de la pantalla, en un lado al azar, y viaja hacia el personaje.
export function spawn({ rng, w, h, elapsed, boss, kind, variant = 'plain' }) {
  const src = kind === 'safe' ? pick(rng, SAFE) : pick(rng, DANGER);
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
    x, y,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    r: spec.radius,
    hp: spec.hp,
    emoji: src.emoji,
    name: src.name,
    born: performance.now(),
    seen: null,          // se completa cuando entra en pantalla
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
