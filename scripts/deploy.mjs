// Publica el juego en Cloudflare Pages: https://smack-41n.pages.dev
//
// Existe para que publicar sea un solo paso. Son dos comandos y el que se
// olvida siempre es el primero, así que el sitio queda mostrando una versión
// vieja aunque el deploy diga que salió bien.
//
// Se sube dist/ y no la raíz del repo porque dist/ ya es un sitio completo y
// autocontenido: el HTML con todo embebido, el manifest, el service worker y
// los iconos, sin el README ni los scripts ni el historial de git.
//
// El repo sigue privado. Cloudflare no lo mira: los archivos se suben desde
// acá, así que no hace falta darle acceso al código para tener el sitio en
// línea.
//
// Uso: node scripts/deploy.mjs

import { execFileSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// El shell solo se usa para npx: en Windows Node no ejecuta archivos .cmd sin
// pasar por él, desde la corrección de CVE-2024-27980. Para el resto conviene
// evitarlo, porque el shell parte los argumentos por los espacios y la ruta de
// process.execPath suele tener alguno ("Program Files").
const run = (cmd, args, shell = false) => execFileSync(cmd, args, { stdio: 'inherit', shell });

run(process.execPath, ['scripts/build.mjs']);

console.log('\nSubiendo a Cloudflare Pages...');
run(npx, [
  '--yes',
  'wrangler@latest',
  'pages',
  'deploy',
  'dist',
  '--project-name',
  'smack',
  '--branch',
  'main',
  // Sin esto wrangler se queja si hay cambios sin commitear, que es lo normal
  // mientras se prueba algo antes de darle commit.
  '--commit-dirty=true',
], process.platform === 'win32');

console.log('\nListo: https://smack-41n.pages.dev');
