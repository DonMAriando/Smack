// Genera los iconos PNG de la PWA sin dependencias: node ya trae zlib, y las
// formas del personaje son elipses y rectángulos, que se rasterizan con
// aritmética. Se renderiza a 4x y se promedia para tener bordes suaves.
//
// Uso: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SS = 4; // supermuestreo

const BG = [16, 17, 20];
const SKIN = [255, 220, 180];
const HAIR = [61, 43, 35];
const INK = [34, 36, 43];
const ACCENT = [255, 213, 74];
const WHITE = [255, 255, 255];

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inRoundedRect(x, y, size, radius) {
  const min = radius;
  const max = size - radius;
  const cx = Math.min(Math.max(x, min), max);
  const cy = Math.min(Math.max(y, min), max);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
}

// Dibuja la cara del personaje: es el icono más reconocible que puede tener
// el juego, y coincide con lo que el jugador ve en el centro de la pantalla.
function shade(x, y, size) {
  const u = size / 100; // unidades relativas, para que escale a cualquier tamaño
  const cx = size / 2;
  const cy = size * 0.54;

  if (!inRoundedRect(x, y, size, size * 0.22)) return null; // fuera del icono

  // Aro de acento
  const ringOuter = 46 * u;
  const ringInner = 42 * u;
  const dr = Math.hypot(x - cx, y - cy);
  if (dr <= ringOuter && dr >= ringInner) return ACCENT;

  // Cabeza
  const headR = 34 * u;
  const inHead = inEllipse(x, y, cx, cy, headR, headR * 0.96);

  // Pelo: media elipse arriba más un mechón al costado
  const inHairCap = inEllipse(x, y, cx, cy - headR * 0.72, headR * 0.68, headR * 0.32) && y < cy - headR * 0.6;
  // El mechón tiene que quedar dentro del aro de acento, si no parece flotar
  // fuera del icono.
  const inTuft = inEllipse(x, y, cx + headR * 0.36, cy - headR * 0.9, headR * 0.26, headR * 0.32);
  if ((inHairCap || inTuft) && (inHead || y < cy)) return HAIR;

  if (!inHead) return BG;

  // Ojos
  for (const side of [-1, 1]) {
    const ex = cx + side * headR * 0.36;
    const ey = cy - headR * 0.1;
    if (inEllipse(x, y, ex, ey, 8 * u, 9.5 * u)) {
      return inEllipse(x, y, ex, ey, 4.2 * u, 5 * u) ? INK : WHITE;
    }
  }

  // Cejas
  for (const side of [-1, 1]) {
    const bx = cx + side * headR * 0.36;
    const by = cy - headR * 0.46;
    if (Math.abs(x - bx) <= 8 * u && Math.abs(y - by) <= 2 * u) return HAIR;
  }

  // Boca
  if (Math.abs(x - cx) <= 7 * u && Math.abs(y - (cy + headR * 0.36)) <= 1.8 * u) return INK;

  return SKIN;
}

function render(size) {
  const big = size * SS;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x * SS + sx + 0.5) / SS;
          const py = (y * SS + sy + 0.5) / SS;
          const c = shade(px, py, size);
          if (c === null) continue; // transparente fuera del rectángulo
          r += c[0]; g += c[1]; b += c[2]; a += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      if (a === 0) continue;
      // Promedia solo sobre las muestras opacas y usa la cobertura como alfa
      const opaque = a / 255;
      rgba[i] = Math.round(r / opaque);
      rgba[i + 1] = Math.round(g / opaque);
      rgba[i + 2] = Math.round(b / opaque);
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return rgba;
}

// --- Codificador PNG mínimo ---

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // profundidad
  ihdr[9] = 6;   // color RGBA
  // 10, 11, 12 quedan en 0: deflate, filtro adaptativo, sin entrelazado

  // Cada scanline lleva adelante su byte de filtro (0 = sin filtro)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
for (const size of [180, 192, 512]) {
  const png = encodePng(render(size), size);
  writeFileSync(`icons/icon-${size}.png`, png);
  console.log(`icons/icon-${size}.png  ${png.length} bytes`);
}
