import { CFG, reactionRank } from './config.js';
import { makeRng } from './rng.js';
import { save, persist, touchStreak } from './save.js';
import { impact, blip, haptic, ensureAudio, HAPTIC } from './feedback.js';
import * as music from './music.js';
import { spawn, rollKind, rollVariant, refreshPools } from './entities.js';
import { refreshLook } from './character.js';
import { pickMissions, evaluate, earnedXp } from './missions.js';
import { addXp, describe } from './progression.js';
import { dailySeed, recordDaily } from './daily.js';
import { el, updateHud, showToast, renderStartRecords, renderMissions } from './hud.js';
import { draw } from './render.js';

const canvas = el.game;
const ctx = canvas.getContext('2d');

export const s = {
  w: 0, h: 0, dpr: 1,
  running: false,
  last: 0,
  elapsed: 0,
  remaining: CFG.run.duration,
  spawnClock: 0,
  objects: [],
  particles: [],
  pendingSpawns: [],
  score: 0,
  combo: 0,
  maxCombo: 0,
  lives: CFG.run.lives,
  bestReaction: null,
  hits: 0,
  feverUntil: 0,
  boss: false,
  bossHp: 0,
  bossStarted: false,
  shake: 0,
  hitstop: 0,
  timeScale: 1,
  accumulator: 0,
  // Destello a pantalla completa y ondas de choque. Son para los momentos que
  // tienen que sentirse grandes: el boss, el FEVER, el golpe recibido.
  flashA: 0,
  flashColor: '255,255,255',
  waves: [],
  restartArmedAt: 0,
  hurtUntil: 0,        // hasta cuándo el personaje muestra la cara de golpe
  seenVariants: new Set(),
  rng: Math.random,

  mode: 'free',
  missions: [],
  // Contadores que las misiones consultan. Están acá y no dentro de cada
  // misión para poder agregar objetivos nuevos sin tocar el game loop.
  deflects: 0,
  armorBreaks: 0,
  bossKos: 0,
  livesLost: 0,
};

export function resize() {
  const r = el.app.getBoundingClientRect();
  s.dpr = Math.min(window.devicePixelRatio || 1, 2);
  s.w = Math.max(CFG.arena.minWidth, r.width);
  s.h = Math.max(CFG.arena.minHeight, window.innerHeight);
  canvas.style.width = s.w + 'px';
  canvas.style.height = s.h + 'px';
  canvas.width = Math.floor(s.w * s.dpr);
  canvas.height = Math.floor(s.h * s.dpr);
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
}

function reset(seed) {
  s.objects = [];
  s.particles = [];
  s.pendingSpawns = [];
  s.elapsed = 0;
  s.remaining = CFG.run.duration;
  s.spawnClock = 0;
  s.score = 0;
  s.combo = 0;
  s.maxCombo = 0;
  s.lives = CFG.run.lives;
  s.bestReaction = null;
  s.hits = 0;
  s.feverUntil = 0;
  s.boss = false;
  s.bossHp = 0;
  s.bossStarted = false;
  s.shake = 0;
  s.hitstop = 0;
  s.timeScale = 1;
  s.accumulator = 0;
  s.flashA = 0;
  s.waves = [];
  s.hurtUntil = 0;
  s.seenVariants = new Set();
  s.deflects = 0;
  s.armorBreaks = 0;
  s.bossKos = 0;
  s.livesLost = 0;
  grab = null;
  s.rng = seed === undefined ? Math.random : makeRng(seed);
  updateHud(s);
}

export function startGame(mode = 'free') {
  const daily = mode === 'daily';
  reset(daily ? dailySeed() : undefined);
  s.mode = mode;

  // Las misiones del diario salen también de la fecha, así que todos reciben
  // las mismas. Van con su propio rng para no consumir de la secuencia de
  // spawns, que si no se desincronizaría entre jugadores.
  s.missions = pickMissions(daily ? makeRng(dailySeed() ^ 0x9e3779b9) : Math.random);

  // Los desbloqueos no cambian a mitad de partida, así que se resuelven una
  // sola vez acá.
  refreshPools();
  refreshLook();

  s.running = true;
  s.last = performance.now();
  el.start.style.display = 'none';
  el.gameOver.style.display = 'none';
  el.recordBadge.style.display = 'none';
  el.rewardBadge.style.display = 'none';
  el.modeLabel.style.display = 'none';
  el.reactionLine.textContent = '';
  ensureAudio();
  music.play();
  requestAnimationFrame(loop);
}

export function endGame() {
  if (!s.running) return;
  s.running = false;
  s.timeScale = 1;
  s.hitstop = 0;
  music.stop();

  const finalScore = Math.floor(s.score);
  const previousBest = save.bestScore;
  // La primera partida fija la marca de referencia; no tiene sentido felicitar
  // a alguien por superar un récord que no existía.
  const firstRun = save.runs === 0;
  const scoreRecord = finalScore > save.bestScore && !firstRun;
  const reactionRecord =
    s.bestReaction !== null && !firstRun &&
    (save.bestReaction === null || s.bestReaction < save.bestReaction);

  evaluate(s.missions, s);
  const missionXp = earnedXp(s.missions);
  const doneCount = s.missions.filter((m) => m.done).length;
  const rewards = addXp(finalScore + missionXp);
  const dailyRecord = s.mode === 'daily' && recordDaily(finalScore);

  touchStreak();
  save.runs++;
  save.missionsDone += doneCount;
  save.totalSmacks += s.hits;
  // Se guarda siempre, aunque no lo festejemos en pantalla.
  if (finalScore > save.bestScore) save.bestScore = finalScore;
  if (s.bestReaction !== null && (save.bestReaction === null || s.bestReaction < save.bestReaction))
    save.bestReaction = s.bestReaction;
  persist();

  el.bossBarWrap.style.display = 'none';
  el.fever.style.display = 'none';
  el.finalScore.textContent = finalScore;
  el.finalBest.textContent = s.bestReaction ? Math.round(s.bestReaction) + ' ms' : '—';
  el.finalCombo.textContent = s.maxCombo;
  el.finalHits.textContent = s.hits;

  el.modeLabel.textContent = '📅 Desafío del día';
  el.modeLabel.style.display = s.mode === 'daily' ? 'block' : 'none';
  renderMissions(s.missions);

  if (rewards.length) {
    el.rewardBadge.innerHTML = '🎁 DESBLOQUEADO<br>' + rewards.map(describe).join(' · ');
    el.rewardBadge.style.display = 'block';
    impact({ pitch: 520, dur: 0.6, vol: 0.6, bright: 3600 });
    haptic(HAPTIC.record);
  } else {
    el.rewardBadge.style.display = 'none';
  }

  if (dailyRecord) badge('📅 MEJOR DEL DÍA: ' + finalScore);
  else if (reactionRecord && scoreRecord) badge('🏆 DOBLE RÉCORD: puntaje y reacción');
  else if (reactionRecord) badge('⚡ REACCIÓN RÉCORD: ' + Math.round(s.bestReaction) + ' ms');
  else if (scoreRecord) badge('🏆 PUNTAJE RÉCORD: ' + finalScore);
  else el.recordBadge.style.display = 'none';

  if (reactionRecord || scoreRecord) {
    el.endMessage.textContent = 'Rompiste tu propio techo.';
    impact({ pitch: 420, dur: 0.5, vol: 0.55, bright: 3200 });
    haptic(HAPTIC.record);
  } else if (doneCount === 3) el.endMessage.textContent = '¡Las tres misiones! +' + missionXp + ' de experiencia.';
  else if (finalScore >= 7000) el.endMessage.textContent = 'Ok. Eso ya fue violencia profesional.';
  else if (finalScore >= 4500) el.endMessage.textContent = 'Tu dedo está peligrosamente entrenado.';
  else if (finalScore >= 2500) el.endMessage.textContent = 'Bien. Ahora hacelo más rápido.';
  else if (previousBest > 0 && previousBest - finalScore < 400)
    el.endMessage.textContent = 'Te faltó nada para tu récord.';
  else el.endMessage.textContent = 'Ya entendiste la idea. Otra vez.';

  el.shareBtn.style.display = s.bestReaction ? 'block' : 'none';
  el.gameOver.style.display = 'block';
  s.restartArmedAt = performance.now() + CFG.feel.restartGrace;
  renderStartRecords();

  if (reactionRecord || scoreRecord || dailyRecord) celebrate();
}

function badge(text) {
  el.recordBadge.textContent = text;
  el.recordBadge.style.display = 'block';
}

function burst(x, y, emoji, good = true) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 220;
    s.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.45 + Math.random() * 0.3,
      max: 0.75,
      size: 4 + Math.random() * 6,
      // Los escombros caen. Sin gravedad las partículas flotaban hacia afuera
      // como humo, y lo que se rompió tiene que pesar algo.
      gravity: 850 + Math.random() * 500,
      good,
    });
  }
  // El emoji que sale despedido no cae: sube y se desvanece, porque es la
  // etiqueta de lo que pasó y tiene que poder leerse.
  s.particles.push({ x, y, vx: 0, vy: -70, life: 0.55, max: 0.55, size: 22, text: emoji, good, gravity: 0 });
}

// Un anillo que se expande desde el punto de impacto. Comunica alcance, que es
// lo que un destello solo no dice: el FEVER llena la pantalla, un blindado que
// se rompe no.
function shockwave(x, y, radius, color) {
  s.waves.push({ x, y, r: 0, to: radius, life: 0.42, max: 0.42, color });
}

// Partículas, ondas y destello. Está aparte del update porque el festejo del
// récord lo necesita cuando la simulación ya se detuvo.
function advanceEffects(dt) {
  for (const p of s.particles) {
    if (p.gravity) p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  for (const w of s.waves) {
    w.life -= dt;
    // Se expande rápido y frena, que es como se ve una onda de verdad. Lineal
    // parecía un círculo creciendo, no algo que estalló.
    const t = 1 - w.life / w.max;
    w.r = w.to * (1 - Math.pow(1 - t, 3));
  }
  s.waves = s.waves.filter((w) => w.life > 0);

  if (s.flashA > 0) {
    s.flashA -= dt * 3.4;
    if (s.flashA < 0) s.flashA = 0;
  }
}

const CONFETTI = ['#ffd54a', '#ff5a67', '#60e59e', '#7cc4ff', '#c68aff'];

// La partida ya terminó y el loop principal se detuvo, así que el festejo corre
// su propio bucle corto. Sin esto el récord se anunciaba sobre una pantalla
// congelada, que es el momento más importante de la sesión y el menos vistoso.
function celebrate() {
  for (let i = 0; i < 80; i++) {
    s.particles.push({
      x: Math.random() * s.w,
      y: -20 - Math.random() * s.h * 0.5,
      vx: (Math.random() - 0.5) * 130,
      vy: 120 + Math.random() * 260,
      life: 1.5 + Math.random() * 1.1,
      max: 2.6,
      size: 3 + Math.random() * 5,
      gravity: 240,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    });
  }
  flash(0.28, '255,213,74');
  shockwave(s.w / 2, s.h * CFG.arena.centerY, Math.max(s.w, s.h) * 0.8, '255,213,74');

  let last = performance.now();
  const step = (t) => {
    // Si el jugador arrancó otra partida, el loop principal ya está dibujando
    // y este bucle tiene que desaparecer sin pelearse por el canvas.
    if (s.running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    advanceEffects(dt);
    draw(ctx, s, t, dt);
    if (s.particles.length || s.waves.length || s.flashA > 0) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function flash(alpha, color = '255,255,255') {
  // Se queda con el más fuerte en lugar de sumar: dos eventos juntos no tienen
  // que blanquear la pantalla entera.
  if (alpha > s.flashA) {
    s.flashA = alpha;
    s.flashColor = color;
  }
}

function damageBoss(n) {
  if (!s.boss) return;
  s.bossHp -= n;
  if (s.bossHp > 0) return;
  s.boss = false;
  s.bossKos++;
  s.score += CFG.scoring.bossKoBonus;
  showToast('👵 BOSS KO +' + CFG.scoring.bossKoBonus);
  impact({ pitch: 90, dur: 0.55, vol: 0.7, bright: 900 });
  haptic(HAPTIC.bossKo);
  s.hitstop = CFG.feel.hitstopBossKo;
  s.shake = 22;
  // El remate del boss es el pico de la partida, así que se lleva el tratamiento
  // más grande: destello, dos anillos desfasados y escombros desde el centro.
  flash(0.5, '255,213,74');
  const cx = s.w / 2;
  const cy = s.h * CFG.arena.centerY;
  shockwave(cx, cy, Math.max(s.w, s.h) * 0.9, '255,213,74');
  shockwave(cx, cy, Math.max(s.w, s.h) * 0.55, '255,255,255');
  burst(cx, cy, '👵', true);
  el.bossBarWrap.style.display = 'none';
}

// Cada variante se presenta con un cartel la primera vez que sale en la
// partida. Enseñar en contexto en vez de alargar la pantalla de reglas, que
// hoy promete que todo entra en dos segundos.
const VARIANT_INTRO = {
  armored: '🛡️ BLINDADO · 3 TOQUES',
  deflect: '↩️ ARRASTRALO PARA DEVOLVERLO',
  disguised: '🎭 EL ARO PUNTEADO MIENTE · LEÉ EL ÍCONO',
};

function introduceVariant(id) {
  if (id === 'plain' || s.seenVariants.has(id)) return;
  s.seenVariants.add(id);
  showToast(VARIANT_INTRO[id]);
  blip(520, 0.14, 'triangle', 0.05);
  haptic(HAPTIC.armor);
}

function updateTension() {
  // La última vida entra en cámara lenta. Convierte el final en el momento más
  // tenso de la partida en vez del más frustrante.
  s.timeScale = s.running && s.lives === 1 ? CFG.feel.lastLifeTimeScale : 1;
}

// El cronómetro arranca cuando el objeto entró en pantalla, no cuando nació
// fuera del borde a una distancia aleatoria del centro. Y si ya lo habías
// tocado antes (blindados), la reacción es la del primer contacto: el resto es
// velocidad de dedo, no reflejo.
function reactionOf(o, now) {
  return now - (o.firstTouch ?? o.seen ?? o.born);
}

// Golpe que no rompe el blindaje. No cuenta como acierto ni sube el combo:
// si contara, un blindado inflaría el combo tres veces por un solo objeto.
function hitArmor(o, now) {
  if (o.firstTouch === null) o.firstTouch = now;
  o.hp--;
  o.hitFlash = 0.12;
  s.score += CFG.armor.hitPoints;
  s.hitstop = Math.max(s.hitstop, CFG.armor.hitstop);
  s.shake = Math.max(s.shake, 5);
  impact({ pitch: 340, dur: 0.07, vol: 0.32, bright: 3000 });
  haptic(HAPTIC.armor);
}

function checkFever(now) {
  const sc = CFG.scoring;
  if (s.combo !== sc.feverAt && !(s.combo > sc.feverAt && s.combo % sc.feverEvery === 0)) return;
  s.feverUntil = now + sc.feverDuration;
  showToast('🔥 FEVER!');
  blip(680, 0.12, 'sawtooth', 0.055);
  impact({ pitch: 300, dur: 0.3, vol: 0.5, bright: 2600 });
  haptic(HAPTIC.fever);
  s.hitstop = CFG.feel.hitstopFever;
  s.shake = 18;
  flash(0.32, '255,120,60');
  shockwave(s.w / 2, s.h * CFG.arena.centerY, Math.max(s.w, s.h) * 0.75, '255,140,70');
}

// Devolver un objeto con el gesto correcto. Durante el boss pega el triple,
// que es la razón para ir a buscar los deslizables en vez de esquivarlos.
function deflect(o) {
  const now = performance.now();
  const ms = reactionOf(o, now);

  o.deflected = true;
  o.hitFlash = 0.2;
  s.deflects++;
  s.bestReaction = s.bestReaction === null ? ms : Math.min(s.bestReaction, ms);
  s.combo++;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.hits++;
  checkFever(now);

  const fever = now < s.feverUntil;
  s.score += CFG.deflect.points * (fever ? CFG.scoring.feverMultiplier : 1);

  if (s.boss) {
    damageBoss(CFG.deflect.bossDamage);
    showToast('↩️ DEVUELTO ×' + CFG.deflect.bossDamage);
  } else {
    showToast('↩️ DEVUELTO');
  }

  const len = Math.hypot(o.vx, o.vy) || 1;
  o.vx = (-o.vx / len) * CFG.deflect.exitSpeed;
  o.vy = (-o.vy / len) * CFG.deflect.exitSpeed;
  o.spin *= 6;

  el.reactionLine.textContent = 'DEVUELTO · ' + Math.round(ms) + ' ms';
  burst(o.x, o.y, '↩️', true);
  impact({ pitch: 210, dur: 0.22, vol: 0.55, bright: 2200 });
  haptic(HAPTIC.deflect);
  s.hitstop = Math.max(s.hitstop, 0.06);
  s.shake = 12;
}

function hitDanger(o) {
  const now = performance.now();
  if (o.hp > 1) {
    hitArmor(o, now);
    return;
  }
  const ms = reactionOf(o, now);
  const sc = CFG.scoring;

  if (o.variant === 'armored') s.armorBreaks++;
  s.bestReaction = s.bestReaction === null ? ms : Math.min(s.bestReaction, ms);
  s.combo++;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.hits++;

  checkFever(now);

  const fever = now < s.feverUntil;
  let points = Math.max(sc.minPoints, sc.maxPoints - ms);
  points *= 1 + Math.min(s.combo, sc.comboCap) * sc.comboBonus;
  if (fever) points *= sc.feverMultiplier;
  s.score += points;

  if (s.boss) damageBoss(1);

  el.reactionLine.textContent = reactionRank(ms) + ' · ' + Math.round(ms) + ' ms';
  showToast(reactionRank(ms));
  burst(o.x, o.y, '💥', true);

  // Cuanto más limpia la reacción, más largo el congelamiento: el juego premia
  // el reflejo haciéndose sentir más, no solo sumando puntos.
  const crisp = Math.max(0, 1 - ms / CFG.feel.crispWindow);
  s.hitstop = Math.max(s.hitstop, CFG.feel.hitstopBase + crisp * CFG.feel.hitstopCrispBonus);
  s.shake = Math.min(14, 4 + s.combo * 0.25 + crisp * 4);
  impact({ pitch: 150 + Math.min(s.combo, 18) * 9, dur: 0.15, vol: 0.5, bright: 1100 + crisp * 1700 });
  haptic(fever ? HAPTIC.hitFever : HAPTIC.hit);
  o.dead = true;
}

function hitSafe(o) {
  s.combo = 0;
  s.lives--;
  s.livesLost++;
  el.reactionLine.textContent = 'NOOO · ' + o.name;
  showToast('💔 NO TOQUES');
  burst(o.x, o.y, '💔', false);
  impact({ pitch: 70, dur: 0.34, vol: 0.6, bright: 420 });
  haptic(HAPTIC.mistake);
  s.hitstop = CFG.feel.hitstopMiss;
  s.hurtUntil = performance.now() + 260;
  s.shake = 13;
  // Rojo a pantalla completa: el error tiene que registrarse aunque estés
  // mirando el otro extremo de la pantalla.
  flash(0.36, '255,60,70');
  o.dead = true;
  updateTension();
  if (s.lives <= 0) endGame();
}

// Objeto agarrado esperando un gesto. Solo los deslizables llegan acá.
let grab = null;

function toLocal(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

function objectAt(px, py) {
  let best = null;
  let bd = Infinity;
  for (const o of s.objects) {
    if (o.dead || o.deflected) continue;
    const d = Math.hypot(px - o.x, py - o.y);
    if (d < o.r + CFG.feel.tapForgiveness && d < bd) {
      best = o;
      bd = d;
    }
  }
  return best;
}

export function pointerDown(clientX, clientY) {
  if (!s.running) return;
  const p = toLocal(clientX, clientY);
  const o = objectAt(p.x, p.y);
  if (!o) {
    blip(150, 0.025, 'sine', 0.018);
    return;
  }

  // Los deslizables no se resuelven al tocarlos, hay que arrastrarlos. Pero el
  // cronómetro de reacción se detiene acá, en el primer contacto: eso es lo que
  // midió el reflejo, y el resto es la ejecución del gesto. Todo lo demás se
  // resuelve en el pointerdown para no agregar ni un ms de latencia al tap.
  if (o.variant === 'deflect' && o.kind === 'danger') {
    if (o.firstTouch === null) o.firstTouch = performance.now();
    grab = { o, x0: p.x, y0: p.y };
    return;
  }

  if (o.kind === 'safe') hitSafe(o);
  else hitDanger(o);
  updateHud(s);
}

export function pointerMove(clientX, clientY) {
  if (!s.running || !grab) return;
  const p = toLocal(clientX, clientY);
  const dx = p.x - grab.x0;
  const dy = p.y - grab.y0;
  if (Math.hypot(dx, dy) < CFG.deflect.swipeDistance) return;

  const o = grab.o;
  grab = null;
  if (o.dead || o.deflected) return;

  // Lo correcto es empujarlo hacia atrás, por donde vino.
  const want = Math.atan2(-o.vy, -o.vx);
  const got = Math.atan2(dy, dx);
  let diff = Math.abs(want - got);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;

  if (diff > CFG.deflect.maxAngle) {
    showToast('↩️ AL REVÉS');
    blip(140, 0.09, 'sawtooth', 0.04);
    haptic(HAPTIC.armor);
    return;
  }
  deflect(o);
  updateHud(s);
}

export function pointerUp() {
  grab = null;
}

function doSpawn(forceDanger) {
  const kind = rollKind({ rng: s.rng, elapsed: s.elapsed, boss: s.boss, forceDanger });
  const variant = rollVariant({ rng: s.rng, elapsed: s.elapsed, boss: s.boss, kind });
  introduceVariant(variant);
  s.objects.push(spawn({ rng: s.rng, w: s.w, h: s.h, elapsed: s.elapsed, boss: s.boss, kind, variant }));
}

function update(dt, now) {
  s.elapsed += dt;
  s.remaining = Math.max(0, CFG.run.duration - s.elapsed);
  if (s.remaining <= 0) {
    endGame();
    return;
  }

  if (!s.bossStarted && s.elapsed > CFG.run.bossAt) {
    s.bossStarted = true;
    s.boss = true;
    s.bossHp = CFG.boss.hp;
    // Limpia lo que venía en vuelo: la fase del boss arranca en cancha
    // despejada en vez de apilarse sobre la oleada anterior.
    for (const o of s.objects) o.dead = true;
    showToast('👵 ABUELA CHANCLA');
    impact({ pitch: 64, dur: 0.7, vol: 0.7, bright: 600 });
    haptic(HAPTIC.bossEnter);
    s.hitstop = CFG.feel.hitstopBossEnter;
    s.shake = 20;
  }

  const sp = CFG.spawn;
  const interval = s.boss
    ? sp.bossInterval
    : Math.max(sp.minInterval, sp.baseInterval - s.elapsed * sp.rampPerSecond - Math.min(s.combo, 15) * sp.comboRelief);

  s.spawnClock -= dt;
  if (s.spawnClock <= 0) {
    doSpawn(s.boss);
    // Antes esto era un setTimeout, así que el segundo objeto aparecía durante
    // el hitstop y sobrevivía a la pausa y al fin de partida.
    if (s.boss && s.rng() < sp.bossDoubleChance) s.pendingSpawns.push({ t: sp.bossDoubleDelay, danger: true });
    s.spawnClock = interval * (sp.jitter[0] + s.rng() * sp.jitter[1]);
  }

  for (const p of s.pendingSpawns) p.t -= dt;
  for (const p of s.pendingSpawns) if (p.t <= 0) doSpawn(p.danger);
  s.pendingSpawns = s.pendingSpawns.filter((p) => p.t > 0);

  const cx = s.w / 2;
  const cy = s.h * CFG.arena.centerY;
  for (const o of s.objects) {
    if (o.dead) continue;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.rot += o.spin * dt;
    if (o.hitFlash > 0) o.hitFlash -= dt;

    // El cronómetro de reacción arranca cuando el objeto entra en pantalla:
    // nacen a distintas distancias del centro, así que medir desde el
    // nacimiento daba números inventados.
    if (o.seen === null && o.x > -o.r && o.x < s.w + o.r && o.y > -o.r && o.y < s.h + o.r) o.seen = now;

    // Los devueltos salen volando hacia afuera. Antes ningún objeto podía
    // dejar la pantalla, así que no había que recogerlos; ahora sí, o se
    // acumulan para siempre.
    const margin = CFG.arena.spawnMargin * 3;
    if (o.x < -margin || o.x > s.w + margin || o.y < -margin || o.y > s.h + margin) {
      o.dead = true;
      continue;
    }
    if (o.deflected) continue;

    if (Math.hypot(o.x - cx, o.y - cy) < CFG.arena.hurtRadius) {
      o.dead = true;
      if (o.kind === 'safe') {
        s.score += CFG.scoring.dodgeSafeBonus;
        burst(o.x, o.y, '✨', true);
      } else {
        s.combo = 0;
        s.lives--;
        s.livesLost++;
        showToast('💥 TE PEGÓ');
        impact({ pitch: 58, dur: 0.4, vol: 0.65, bright: 340 });
        haptic(HAPTIC.hurt);
        s.hitstop = CFG.feel.hitstopHurt;
        s.hurtUntil = now + 260;
        s.shake = 16;
        updateTension();
        if (s.lives <= 0) {
          endGame();
          return;
        }
      }
    }
  }
  s.objects = s.objects.filter((o) => !o.dead);

  advanceEffects(dt);

  updateHud(s);
}

// La música sigue al estado real de la partida, no al reloj. Son los mismos
// umbrales que ya usa el juego para otras cosas, así que la capa que entra
// coincide con lo que el jugador está sintiendo.
function musicIntensity(now) {
  if (s.boss || now < s.feverUntil) return 3;
  if (s.combo >= CFG.scoring.feverAt) return 2;
  if (s.combo >= 4) return 1;
  return 0;
}

export function loop(now) {
  if (!s.running) return;
  // El tope evita el túnel de colisión sin ralentizar el juego en cada hipo de
  // frame, que era lo que pasaba con el tope anterior de 33 ms.
  const real = Math.min(CFG.feel.maxDeltaTime, (now - s.last) / 1000 || 0);
  s.last = now;

  // Se agenda incluso durante el congelamiento: el ritmo no se frena cuando
  // pegás, justamente para que el golpe se sienta contra un pulso que sigue.
  music.tick({ intensity: musicIntensity(now), boss: s.boss });

  if (s.hitstop > 0) {
    s.hitstop -= real;
    draw(ctx, s, now, real);
    requestAnimationFrame(loop);
    return;
  }

  // La cámara lenta escala cuánto tiempo entra al acumulador, no el tamaño del
  // paso: así el mundo avanza más despacio en el reloj de pared pero elapsed
  // sigue creciendo en incrementos exactos e idénticos para todos.
  s.accumulator += real * s.timeScale;
  let steps = 0;
  while (s.accumulator >= CFG.feel.step && steps < CFG.feel.maxStepsPerFrame) {
    update(CFG.feel.step, now);
    s.accumulator -= CFG.feel.step;
    steps++;
    if (!s.running) break;
  }

  draw(ctx, s, now, real);
  if (s.running) requestAnimationFrame(loop);
}

export function drawIdle() {
  draw(ctx, s, performance.now(), 1 / 60);
}
