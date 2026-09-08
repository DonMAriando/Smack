import { CFG } from './config.js';
import { el, renderStartRecords } from './hud.js';
import { setMuted, isMuted, ensureAudio } from './feedback.js';
import { shareResult } from './share.js';
import { drawSample } from './render.js';
import { s, resize, startGame, loop, pointerDown, pointerMove, pointerUp, drawIdle } from './game.js';

window.addEventListener('resize', resize);
resize();

el.game.addEventListener('pointerdown', (e) => {
  if (!s.running) return;
  e.preventDefault();
  pointerDown(e.clientX, e.clientY);
});
el.game.addEventListener('pointermove', (e) => {
  if (!s.running) return;
  pointerMove(e.clientX, e.clientY);
});
el.game.addEventListener('pointerup', pointerUp);
el.game.addEventListener('pointercancel', pointerUp);
// Si el dedo sale del canvas a mitad del gesto, el arrastre se cancela igual.
el.game.addEventListener('pointerleave', pointerUp);

el.startBtn.addEventListener('click', () => startGame('free'));
el.dailyBtn.addEventListener('click', () => startGame('daily'));
// Repetir mantiene el modo: si venías del desafío del día, seguís en el día.
el.restartBtn.addEventListener('click', () => startGame(s.mode));

// Reintentar tiene que costar cero: un tap en cualquier lado de la pantalla de
// fin, o la barra espaciadora en desktop. La ventana de gracia existe porque
// los taps frenéticos con los que perdés caen justo después de perder, y sin
// ella el jugador nunca ve su puntaje ni el botón de compartir.
el.app.addEventListener('pointerdown', (e) => {
  if (s.running) return;
  if (el.gameOver.style.display !== 'block') return;
  if (performance.now() < s.restartArmedAt) return;
  if (e.target.closest('button')) return;
  startGame(s.mode);
});

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  e.preventDefault();
  if (!s.running) startGame(s.mode);
});

el.mute.addEventListener('click', () => {
  setMuted(!isMuted());
  el.mute.textContent = isMuted() ? '🔇' : '🔊';
  el.mute.setAttribute('aria-label', isMuted() ? 'Activar sonido' : 'Silenciar sonido');
});

const SHARE_LABEL = '📤 COMPARTIR MI REACCIÓN';
el.shareBtn.addEventListener('click', async () => {
  if (s.bestReaction === null) return;
  const outcome = await shareResult({
    ms: Math.round(s.bestReaction),
    score: Math.floor(s.score),
    maxCombo: s.maxCombo,
  });
  const labels = {
    copied: '📋 COPIADO AL PORTAPAPELES',
    downloaded: '⬇️ IMAGEN DESCARGADA',
    failed: '⚠️ NO SE PUDO COMPARTIR',
  };
  if (labels[outcome]) {
    el.shareBtn.textContent = labels[outcome];
    setTimeout(() => (el.shareBtn.textContent = SHARE_LABEL), 1600);
  }
});

// El service worker es lo que hace que el juego se instale en la pantalla de
// inicio y arranque sin conexión. Solo corre sobre HTTPS o localhost, así que
// si falla no importa: el juego funciona igual.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// La leyenda de la pantalla de inicio, dibujada con el mismo código que los
// objetos del juego. Es lo primero que ve un jugador nuevo, y el lenguaje de
// formas hay que aprenderlo antes de que llegue el primer objeto, no durante.
for (const cv of document.querySelectorAll('.legendIcon')) {
  drawSample(cv.getContext('2d'), cv.width / 2, cv.height / 2, cv.dataset.looks, cv.dataset.emoji, 26);
}

renderStartRecords();
drawIdle();

// Le avisa a la guardia de arranque de index.html que los módulos cargaron.
window.__smackBooted = true;

export { CFG, ensureAudio, loop };
