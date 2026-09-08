import { CFG } from './config.js';
import { el, renderStartRecords } from './hud.js';
import { setMuted, isMuted, ensureAudio } from './feedback.js';
import { shareResult } from './share.js';
import { s, resize, startGame, loop, tap, drawIdle } from './game.js';

window.addEventListener('resize', resize);
resize();

el.game.addEventListener('pointerdown', (e) => {
  if (!s.running) return;
  e.preventDefault();
  tap(e.clientX, e.clientY);
});

el.startBtn.addEventListener('click', () => startGame());
el.restartBtn.addEventListener('click', () => startGame());

// Reintentar tiene que costar cero: un tap en cualquier lado de la pantalla de
// fin, o la barra espaciadora en desktop. La ventana de gracia existe porque
// los taps frenéticos con los que perdés caen justo después de perder, y sin
// ella el jugador nunca ve su puntaje ni el botón de compartir.
el.app.addEventListener('pointerdown', (e) => {
  if (s.running) return;
  if (el.gameOver.style.display !== 'block') return;
  if (performance.now() < s.restartArmedAt) return;
  if (e.target.closest('button')) return;
  startGame();
});

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  e.preventDefault();
  if (!s.running) startGame();
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

renderStartRecords();
drawIdle();

export { CFG, ensureAudio, loop };
