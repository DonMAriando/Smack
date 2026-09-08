import { CFG } from './config.js';
import { save } from './save.js';
import { levelFor, titleFor, nextStep, describe, progress } from './progression.js';
import { dailyBest } from './daily.js';

const ids = [
  'app', 'game', 'score', 'combo', 'timer', 'lives', 'bestReaction', 'reactionLine',
  'start', 'gameOver', 'startBtn', 'restartBtn', 'finalScore', 'finalBest',
  'finalCombo', 'finalHits', 'endMessage', 'fever', 'toast', 'mute',
  'bossBarWrap', 'bossFill', 'startRecords', 'recordBadge', 'shareBtn',
  'dailyBtn', 'progressWrap', 'progressLabel', 'progressFill',
  'modeLabel', 'missionList', 'rewardBadge',
];

export const el = {};
for (const id of ids) el[id] = document.getElementById(id);

export function updateHud(s) {
  el.score.textContent = Math.floor(s.score);
  el.combo.textContent = 'x' + s.combo;
  el.timer.textContent = Math.ceil(s.remaining);
  el.lives.textContent =
    '❤️'.repeat(Math.max(0, s.lives)) + '🖤'.repeat(Math.max(0, CFG.run.lives - s.lives));
  el.bestReaction.textContent = s.bestReaction ? Math.round(s.bestReaction) + ' ms' : '—';
  el.fever.style.display = performance.now() < s.feverUntil ? 'block' : 'none';
  if (s.boss) {
    el.bossBarWrap.style.display = 'block';
    el.bossFill.style.width = (Math.max(0, s.bossHp) / CFG.boss.hp) * 100 + '%';
  }
}

let toastTimer = null;
export function showToast(text) {
  el.toast.textContent = text;
  el.toast.style.opacity = '1';
  el.toast.style.transform = 'translate(-50%,-50%) scale(1.08)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.style.opacity = '0';
    el.toast.style.transform = 'translate(-50%,-50%) scale(.95)';
  }, 430);
}

export function renderStartRecords() {
  const parts = [];
  if (save.bestScore > 0) parts.push(cell('Récord', save.bestScore));
  if (save.bestReaction !== null) parts.push(cell('Tu mejor reacción', Math.round(save.bestReaction) + ' ms'));
  if (save.streak > 1) parts.push(cell('Racha', '🔥 ' + save.streak + ' días'));
  const today = dailyBest();
  if (today !== null) parts.push(cell('Diario de hoy', today));
  el.startRecords.innerHTML = parts.join('');
  renderProgress();
}

// La zanahoria: siempre a la vista qué falta para lo próximo y cuánto queda.
export function renderProgress() {
  const next = nextStep();
  el.progressLabel.textContent = next
    ? 'Nivel ' + levelFor() + ' · ' + titleFor() + ' → ' + describe(next) + ' en ' + (next.xp - save.xp).toLocaleString('es') + ' pts'
    : 'Nivel ' + levelFor() + ' · ' + titleFor() + ' · todo desbloqueado';
  el.progressFill.style.width = progress() * 100 + '%';
}

export function renderMissions(missions) {
  el.missionList.innerHTML = missions
    .map((m) => '<div class="' + (m.done ? 'done' : '') + '">' + (m.done ? '✅' : '⬜') + ' ' + m.label + '<b>+' + m.xp + '</b></div>')
    .join('');
}

function cell(label, value) {
  return '<div>' + label + '<br><b>' + value + '</b></div>';
}
