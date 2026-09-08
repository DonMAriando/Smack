import { reactionRank } from './config.js';

// 1080x1080 entra bien en historias de Instagram y en estados de WhatsApp.
// El número ocupa media tarjeta porque es lo único que se comparte de verdad.
function buildCard({ ms, score, maxCombo }) {
  return new Promise((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1080;
    const g = c.getContext('2d');

    const grd = g.createLinearGradient(0, 0, 0, 1080);
    grd.addColorStop(0, '#1b1d24');
    grd.addColorStop(1, '#0d0e11');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1080, 1080);

    g.strokeStyle = 'rgba(255,255,255,.07)';
    g.lineWidth = 2;
    for (let r = 140; r < 920; r += 110) {
      g.beginPath();
      g.arc(540, 470, r, 0, Math.PI * 2);
      g.stroke();
    }

    g.textAlign = 'center';
    g.fillStyle = '#ffd54a';
    g.font = '900 96px system-ui, sans-serif';
    g.fillText('SMACK!', 540, 175);

    g.fillStyle = '#a7abb5';
    g.font = '700 40px system-ui, sans-serif';
    g.fillText('MI MEJOR REACCIÓN', 540, 395);

    g.fillStyle = '#f7f7f8';
    g.font = '1000 250px system-ui, sans-serif';
    g.fillText(String(ms), 540, 605);
    g.fillStyle = '#ffd54a';
    g.font = '900 70px system-ui, sans-serif';
    g.fillText('ms', 540, 688);

    g.fillStyle = '#f7f7f8';
    g.font = '700 46px system-ui, sans-serif';
    g.fillText(reactionRank(ms), 540, 790);

    g.fillStyle = '#a7abb5';
    g.font = '600 38px system-ui, sans-serif';
    g.fillText('Puntaje ' + score + ' · Combo máximo x' + maxCombo, 540, 878);

    g.fillStyle = '#60e59e';
    g.font = '700 40px system-ui, sans-serif';
    g.fillText('¿Podés más rápido?', 540, 970);

    c.toBlob(
      (b) => (b ? resolve(new File([b], 'smack.png', { type: 'image/png' })) : reject(new Error('toBlob falló'))),
      'image/png'
    );
  });
}

// Devuelve qué camino terminó usando, para que la UI avise al jugador.
export async function shareResult({ ms, score, maxCombo }) {
  const text = 'Reaccioné en ' + ms + ' ms en SMACK! 🩴 ¿Podés más rápido?';

  let file = null;
  try {
    file = await buildCard({ ms, score, maxCombo });
  } catch (e) {}

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {}
  if (file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smack.png';
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }
  return 'failed';
}
