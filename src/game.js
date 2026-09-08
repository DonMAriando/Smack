import { CFG, reactionRank } from './config.js';
import { makeRng } from './rng.js';
import { save, persist, touchStreak } from './save.js';
import { impact, blip, haptic, ensureAudio, HAPTIC } from './feedback.js';
import { spawn, rollKind } from './entities.js';
import { el, updateHud, showToast, renderStartRecords } from './hud.js';
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
  restartArmedAt: 0,
  rng: Math.random,
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
  s.rng = seed === undefined ? Math.random : makeRng(seed);
  updateHud(s);
}

export function startGame(seed) {
  reset(seed);
  s.running = true;
  s.last = performance.now();
  el.start.style.display = 'none';
  el.gameOver.style.display = 'none';
  el.recordBadge.style.display = 'none';
  el.reactionLine.textContent = '';
  ensureAudio();
  requestAnimationFrame(loop);
}

export function endGame() {
  if (!s.running) return;
  s.running = false;
  s.timeScale = 1;
  s.hitstop = 0;

  const finalScore = Math.floor(s.score);
  const previousBest = save.bestScore;
  // La primera partida fija la marca de referencia; no tiene sentido felicitar
  // a alguien por superar un récord que no existía.
  const firstRun = save.runs === 0;
  const scoreRecord = finalScore > save.bestScore && !firstRun;
  const reactionRecord =
    s.bestReaction !== null && !firstRun &&
    (save.bestReaction === null || s.bestReaction < save.bestReaction);

  touchStreak();
  save.runs++;
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

  if (reactionRecord && scoreRecord) badge('🏆 DOBLE RÉCORD: puntaje y reacción');
  else if (reactionRecord) badge('⚡ REACCIÓN RÉCORD: ' + Math.round(s.bestReaction) + ' ms');
  else if (scoreRecord) badge('🏆 PUNTAJE RÉCORD: ' + finalScore);
  else el.recordBadge.style.display = 'none';

  if (reactionRecord || scoreRecord) {
    el.endMessage.textContent = 'Rompiste tu propio techo.';
    impact({ pitch: 420, dur: 0.5, vol: 0.55, bright: 3200 });
    haptic(HAPTIC.record);
  } else if (finalScore >= 7000) el.endMessage.textContent = 'Ok. Eso ya fue violencia profesional.';
  else if (finalScore >= 4500) el.endMessage.textContent = 'Tu dedo está peligrosamente entrenado.';
  else if (finalScore >= 2500) el.endMessage.textContent = 'Bien. Ahora hacelo más rápido.';
  else if (previousBest > 0 && previousBest - finalScore < 400)
    el.endMessage.textContent = 'Te faltó nada para tu récord.';
  else el.endMessage.textContent = 'Ya entendiste la idea. Otra vez.';

  el.shareBtn.style.display = s.bestReaction ? 'block' : 'none';
  el.gameOver.style.display = 'block';
  s.restartArmedAt = performance.now() + CFG.feel.restartGrace;
  renderStartRecords();
}

function badge(text) {
  el.recordBadge.textContent = text;
  el.recordBadge.style.display = 'block';
}

function burst(x, y, emoji, good = true) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 180;
    s.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.45 + Math.random() * 0.25,
      max: 0.7,
      size: 4 + Math.random() * 6,
      good,
    });
  }
  s.particles.push({ x, y, vx: 0, vy: -70, life: 0.55, max: 0.55, size: 22, text: emoji, good });
}

function updateTension() {
  // La última vida entra en cámara lenta. Convierte el final en el momento más
  // tenso de la partida en vez del más frustrante.
  s.timeScale = s.running && s.lives === 1 ? CFG.feel.lastLifeTimeScale : 1;
}

function hitDanger(o) {
  const now = performance.now();
  // El cronómetro arranca cuando el objeto entró en pantalla, no cuando nació
  // fuera del borde a una distancia aleatoria del centro.
  const ms = now - (o.seen ?? o.born);
  const sc = CFG.scoring;

  s.bestReaction = s.bestReaction === null ? ms : Math.min(s.bestReaction, ms);
  s.combo++;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.hits++;

  if (s.combo === sc.feverAt || (s.combo > sc.feverAt && s.combo % sc.feverEvery === 0)) {
    s.feverUntil = now + sc.feverDuration;
    showToast('🔥 FEVER!');
    blip(680, 0.12, 'sawtooth', 0.055);
    impact({ pitch: 300, dur: 0.3, vol: 0.5, bright: 2600 });
    haptic(HAPTIC.fever);
    s.hitstop = CFG.feel.hitstopFever;
    s.shake = 18;
  }

  const fever = now < s.feverUntil;
  let points = Math.max(sc.minPoints, sc.maxPoints - ms);
  points *= 1 + Math.min(s.combo, sc.comboCap) * sc.comboBonus;
  if (fever) points *= sc.feverMultiplier;
  s.score += points;

  if (s.boss) {
    s.bossHp--;
    if (s.bossHp <= 0) {
      s.boss = false;
      s.score += sc.bossKoBonus;
      showToast('👵 BOSS KO +' + sc.bossKoBonus);
      impact({ pitch: 90, dur: 0.55, vol: 0.7, bright: 900 });
      haptic(HAPTIC.bossKo);
      s.hitstop = CFG.feel.hitstopBossKo;
      s.shake = 22;
      el.bossBarWrap.style.display = 'none';
    }
  }

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
  el.reactionLine.textContent = 'NOOO · ' + o.name;
  showToast('💔 NO TOQUES');
  burst(o.x, o.y, '💔', false);
  impact({ pitch: 70, dur: 0.34, vol: 0.6, bright: 420 });
  haptic(HAPTIC.mistake);
  s.hitstop = CFG.feel.hitstopMiss;
  s.shake = 13;
  o.dead = true;
  updateTension();
  if (s.lives <= 0) endGame();
}

export function tap(clientX, clientY) {
  if (!s.running) return;
  const r = canvas.getBoundingClientRect();
  const px = clientX - r.left;
  const py = clientY - r.top;

  let best = null;
  let bd = Infinity;
  for (const o of s.objects) {
    if (o.dead) continue;
    const d = Math.hypot(px - o.x, py - o.y);
    if (d < o.r + CFG.feel.tapForgiveness && d < bd) {
      best = o;
      bd = d;
    }
  }
  if (best) {
    if (best.kind === 'safe') hitSafe(best);
    else hitDanger(best);
    updateHud(s);
  } else {
    blip(150, 0.025, 'sine', 0.018);
  }
}

function doSpawn(forceDanger) {
  const kind = rollKind({ rng: s.rng, elapsed: s.elapsed, boss: s.boss, forceDanger });
  s.objects.push(spawn({ rng: s.rng, w: s.w, h: s.h, elapsed: s.elapsed, boss: s.boss, kind }));
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

    if (Math.hypot(o.x - cx, o.y - cy) < CFG.arena.hurtRadius) {
      o.dead = true;
      if (o.kind === 'safe') {
        s.score += CFG.scoring.dodgeSafeBonus;
        burst(o.x, o.y, '✨', true);
      } else {
        s.combo = 0;
        s.lives--;
        showToast('💥 TE PEGÓ');
        impact({ pitch: 58, dur: 0.4, vol: 0.65, bright: 340 });
        haptic(HAPTIC.hurt);
        s.hitstop = CFG.feel.hitstopHurt;
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

  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  updateHud(s);
}

export function loop(now) {
  if (!s.running) return;
  // El tope evita el túnel de colisión sin ralentizar el juego en cada hipo de
  // frame, que era lo que pasaba con el tope anterior de 33 ms.
  const real = Math.min(CFG.feel.maxDeltaTime, (now - s.last) / 1000 || 0);
  s.last = now;

  if (s.hitstop > 0) {
    s.hitstop -= real;
    draw(ctx, s, now, real);
    requestAnimationFrame(loop);
    return;
  }

  update(real * s.timeScale, now);
  draw(ctx, s, now, real);
  if (s.running) requestAnimationFrame(loop);
}

export function drawIdle() {
  draw(ctx, s, performance.now(), 1 / 60);
}
