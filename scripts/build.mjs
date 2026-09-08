// Arma dist/: una versión de un solo archivo con todo el JavaScript embebido.
//
// Existe por dos razones. Una, que los módulos ES están bloqueados por CORS
// desde file://, así que la versión modular no se puede abrir con doble clic.
// Dos, que para subir a itch.io conviene un ZIP con index.html en la raíz y
// sin sorpresas de rutas.
//
// Uso: node scripts/build.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('Empaquetando src/main.js...');
// shell:true es necesario en Windows: desde la corrección de CVE-2024-27980,
// Node no ejecuta archivos .cmd sin pasar por el shell.
const bundle = execFileSync(
  npx,
  ['--yes', 'esbuild', 'src/main.js', '--bundle', '--format=iife', '--minify', '--charset=utf8'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: process.platform === 'win32' }
);

const html = readFileSync('index.html', 'utf8');

const START = '<!-- BUILD:SCRIPTS -->';
const END = '<!-- /BUILD:SCRIPTS -->';
const from = html.indexOf(START);
const to = html.indexOf(END);
if (from < 0 || to < 0) {
  console.error('No encontré los marcadores BUILD:SCRIPTS en index.html');
  process.exit(1);
}

// La guardia de arranque no va: en esta versión el script es inline y siempre
// corre, así que no puede fallar por CORS.
//
// Un "</script>" dentro de una cadena del bundle cerraría la etiqueta antes de
// tiempo, así que se parte en dos.
const safe = bundle.replace(/<\/script/gi, '<\\/script');

let out = html.slice(0, from) + '<script>\n' + safe + '\n</script>' + html.slice(to + END.length);

// El service worker no sirve desde file:// y el manifest tampoco. Se dejan
// referenciados solo si dist/ se publica en un host, cosa que igual funciona.
mkdirSync('dist/icons', { recursive: true });
writeFileSync('dist/index.html', out, 'utf8');

for (const f of ['manifest.webmanifest', 'sw.js']) {
  if (existsSync(f)) copyFileSync(f, 'dist/' + f);
}
for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png']) {
  if (existsSync('icons/' + f)) copyFileSync('icons/' + f, 'dist/icons/' + f);
}

// El sw.js de dist cachea los módulos por separado, que ahí no existen.
const sw = readFileSync('dist/sw.js', 'utf8').replace(/^\s*'\.\/src\/[^']*',\s*$/gm, '');
writeFileSync('dist/sw.js', sw, 'utf8');

console.log('dist/index.html  ' + out.length + ' bytes (bundle: ' + bundle.length + ')');
console.log('Se puede abrir con doble clic o subir a itch.io con index.html en la raíz.');
